import { describe, expect, it, vi } from 'vitest';
import { buildUpstreamUrl, handle } from './core';

const ok = (body: unknown = { scheme_code: 119551, latest_nav: 106.8699 }, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ...headers } });

const get = (path: string, init: RequestInit = {}) => new Request(`https://app.example.com${path}`, init);

describe('handle: allowed requests', () => {
  it('forwards to mfnav.in and nothing from the client request', async () => {
    const upstream = vi.fn().mockResolvedValue(ok());
    const res = await handle(get('/api/funds/119551', { headers: { cookie: 'session=secret', authorization: 'Bearer x', referer: 'https://app.example.com/' } }), { fetch: upstream });

    expect(res.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
    const [url, init] = upstream.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe('https://mfnav.in/api/funds/119551');
    expect(init.method).toBe('GET');
    expect(init.redirect).toBe('manual');
    const sent = Object.keys(init.headers as Record<string, string>).map((h) => h.toLowerCase());
    expect(sent.sort()).toEqual(['accept', 'user-agent']);
  });

  it('sets cache and safety headers on success', async () => {
    const res = await handle(get('/api/nav/119551'), { fetch: vi.fn().mockResolvedValue(ok()) });
    expect(res.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await res.json()).toEqual({ scheme_code: 119551, latest_nav: 106.8699 });
  });

  it('passes allow-listed query parameters in sorted order', async () => {
    const upstream = vi.fn().mockResolvedValue(ok({ results: [] }));
    await handle(get('/api/funds/search?q=INF209KA12Z1&page_size=5'), { fetch: upstream });
    expect(String((upstream.mock.calls[0] as [URL])[0])).toBe('https://mfnav.in/api/funds/search?page_size=5&q=INF209KA12Z1');
  });

  it.each(['/api/funds/direct/growth', '/api/date/latest', '/api/date/2026-09-28', '/api/nav/119551?start_date=2026-01-01&end_date=2026-09-28'])(
    'allows %s',
    async (path) => {
      const res = await handle(get(path), { fetch: vi.fn().mockResolvedValue(ok()) });
      expect(res.status).toBe(200);
    },
  );
});

describe('handle: rejected requests never reach upstream', () => {
  const cases: Array<[string, string]> = [
    ['unknown api area', '/api/categories/1'],
    ['other prefix', '/other/funds/1'],
    ['bare api', '/api'],
    ['too many segments', '/api/funds/a/b/c/d'],
    ['encoded dot segments', '/api/funds/%2e%2e/secret'],
    ['encoded slash', '/api/funds/a%2fb'],
    ['non-ASCII segment', '/api/funds/%E0%A4%85'],
    ['unknown query key', '/api/funds/1?debug=1'],
    ['duplicate query key', '/api/funds/search?q=a&q=b'],
    ['markup in query value', '/api/funds/search?q=%3Cscript%3E'],
    ['overlong query value', `/api/funds/search?q=${'a'.repeat(101)}`],
    ['too many parameters', '/api/funds/search?q=a&category=b&page=1&page_size=2&start_date=x&end_date=y&active_only=z'],
  ];
  it.each(cases)('%s', async (_name, path) => {
    const upstream = vi.fn();
    const res = await handle(get(path), { fetch: upstream });
    expect(res.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it.each(['POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'])('%s gets 405', async (method) => {
    const upstream = vi.fn();
    const res = await handle(get('/api/funds/1', { method }), { fetch: upstream });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET');
    expect(upstream).not.toHaveBeenCalled();
  });
});

describe('handle: upstream failures', () => {
  it('maps 404 to a cacheable 404', async () => {
    const res = await handle(get('/api/funds/1'), { fetch: vi.fn().mockResolvedValue(new Response('nope', { status: 404 })) });
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toContain('s-maxage=300');
  });

  it('passes 429 with a sane retry-after and does not cache it', async () => {
    const res = await handle(get('/api/funds/1'), { fetch: vi.fn().mockResolvedValue(new Response('', { status: 429, headers: { 'retry-after': '30' } })) });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('30');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('ignores a malformed retry-after', async () => {
    const res = await handle(get('/api/funds/1'), { fetch: vi.fn().mockResolvedValue(new Response('', { status: 429, headers: { 'retry-after': 'soon<script>' } })) });
    expect(res.headers.get('retry-after')).toBeNull();
  });

  it('turns upstream 5xx into an uncached 502', async () => {
    const res = await handle(get('/api/funds/1'), { fetch: vi.fn().mockResolvedValue(new Response('boom', { status: 500 })) });
    expect(res.status).toBe(502);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('does not follow or forward upstream redirects', async () => {
    const res = await handle(get('/api/funds/1'), { fetch: vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://evil.example/' } })) });
    expect(res.status).toBe(502);
    expect(res.headers.get('location')).toBeNull();
  });

  it('rejects non-JSON upstream content', async () => {
    const res = await handle(get('/api/funds/1'), { fetch: vi.fn().mockResolvedValue(new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })) });
    expect(res.status).toBe(502);
  });

  it('rejects oversized responses', async () => {
    const big = new Response('{}', { status: 200, headers: { 'content-type': 'application/json', 'content-length': String(6 * 1024 * 1024) } });
    const res = await handle(get('/api/funds/1'), { fetch: vi.fn().mockResolvedValue(big) });
    expect(res.status).toBe(502);
  });

  it('returns 504 on timeout and 502 on network failure', async () => {
    const timeout = vi.fn().mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
    expect((await handle(get('/api/funds/1'), { fetch: timeout })).status).toBe(504);
    const down = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    expect((await handle(get('/api/funds/1'), { fetch: down })).status).toBe(502);
  });

  it('passes an abort signal so the timeout is enforced', async () => {
    const upstream = vi.fn().mockResolvedValue(ok());
    await handle(get('/api/funds/1'), { fetch: upstream, timeoutMs: 50 });
    expect((upstream.mock.calls[0] as [URL, RequestInit])[1].signal).toBeInstanceOf(AbortSignal);
  });
});

describe('buildUpstreamUrl', () => {
  it('always builds URLs on the mfnav.in origin', () => {
    const built = buildUpstreamUrl(new URL('https://anything.example/api/funds/1'));
    expect(built).toBeInstanceOf(URL);
    expect((built as URL).origin).toBe('https://mfnav.in');
  });
});
