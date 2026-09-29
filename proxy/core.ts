// Shared same-origin proxy to the mfnav.in NAV API.
//
// mfnav.in sends no CORS headers, so browsers cannot call it directly. This module is the single
// place that talks to it. It uses only web-standard Request/Response so the Cloudflare Pages,
// Vercel and local Node wrappers can each call it in a few lines.
//
// It only ever handles public data (scheme codes, ISINs, NAVs). It never sees a CAS or its contents.

export const UPSTREAM = 'https://mfnav.in';

/** /api/<funds|nav|date>[/<segment>]{0,3}, segments limited to a safe character set. */
const PATH_RE = /^\/api\/(?:funds|nav|date)(?:\/[A-Za-z0-9_.-]{1,64}){0,3}$/;

const QUERY_KEYS = new Set(['q', 'category', 'page', 'page_size', 'start_date', 'end_date', 'active_only']);
const QUERY_VALUE_RE = /^[A-Za-z0-9 _.,:&()-]{0,100}$/;
const MAX_QUERY_PARAMS = 6;

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;

const CACHE_OK = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
const CACHE_NOT_FOUND = 'public, max-age=60, s-maxage=300';

export interface ProxyOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });
}

/** Returns the upstream URL for an allowed request, or an error string. */
export function buildUpstreamUrl(requestUrl: URL): URL | string {
  const { pathname, searchParams } = requestUrl;
  if (!PATH_RE.test(pathname)) return 'path not allowed';
  if (pathname.split('/').some((seg) => seg !== '' && /^\.+$/.test(seg))) return 'path not allowed';

  const entries = [...searchParams.entries()];
  if (entries.length > MAX_QUERY_PARAMS) return 'too many query parameters';
  const seen = new Set<string>();
  const upstream = new URL(pathname, UPSTREAM);
  // Sorted so equivalent requests share one cache entry.
  for (const [key, value] of entries.sort(([a], [b]) => a.localeCompare(b))) {
    if (!QUERY_KEYS.has(key)) return `query parameter not allowed: ${key}`;
    if (seen.has(key)) return `duplicate query parameter: ${key}`;
    if (!QUERY_VALUE_RE.test(value)) return `invalid value for ${key}`;
    seen.add(key);
    upstream.searchParams.append(key, value);
  }
  return upstream;
}

export async function handle(request: Request, options: ProxyOptions = {}): Promise<Response> {
  const doFetch = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (request.method !== 'GET') return json(405, { error: 'method not allowed' }, { allow: 'GET' });

  const upstreamUrl = buildUpstreamUrl(new URL(request.url));
  if (typeof upstreamUrl === 'string') return json(400, { error: upstreamUrl });

  let upstream: Response;
  try {
    // Nothing from the incoming request is forwarded: no cookies, auth, referrer or client headers.
    upstream = await doFetch(upstreamUrl, {
      method: 'GET',
      headers: { accept: 'application/json', 'user-agent': 'verax-nav-proxy' },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return timedOut ? json(504, { error: 'upstream timed out' }) : json(502, { error: 'upstream unreachable' });
  }

  if (upstream.status === 429) {
    const retryAfter = upstream.headers.get('retry-after');
    return json(429, { error: 'upstream rate limit reached' }, retryAfter && /^\d{1,5}$/.test(retryAfter) ? { 'retry-after': retryAfter } : {});
  }
  if (upstream.status === 404) return json(404, { error: 'not found' }, { 'cache-control': CACHE_NOT_FOUND });
  if (upstream.status !== 200) return json(502, { error: `upstream returned ${upstream.status}` });

  if (!(upstream.headers.get('content-type') ?? '').toLowerCase().includes('json')) {
    return json(502, { error: 'unexpected upstream content type' });
  }
  const declared = Number(upstream.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return json(502, { error: 'upstream response too large' });
  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) return json(502, { error: 'upstream response too large' });

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': CACHE_OK,
      'x-content-type-options': 'nosniff',
    },
  });
}
