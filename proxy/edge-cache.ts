// Cloudflare's CDN does not cache Pages Function (JSON) responses by default, so the `s-maxage` the proxy core sets
// has no effect there. This wraps a handler with Cloudflare's per-data-center Cache API. Vercel needs none of this:
// its CDN honours `s-maxage` on function responses by itself.

export interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

/** Serves a cached GET response when there is one; otherwise runs the handler and caches cacheable results. */
export async function cached(
  request: Request,
  cache: EdgeCache,
  waitUntil: (promise: Promise<unknown>) => void,
  handler: (request: Request) => Promise<Response>,
): Promise<Response> {
  if (request.method !== 'GET') return handler(request);

  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await handler(request);
  // Only responses the core marked shareable (`s-maxage`) are stored; errors carry `no-store` and are skipped.
  if (response.headers.get('cache-control')?.includes('s-maxage')) waitUntil(cache.put(request, response.clone()));
  return response;
}
