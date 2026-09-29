// Vercel sends only one path segment to a catch-all file in api/ (checked with `vercel build`: `api/[...path].ts` and
// `api/[[...path]].ts` both get the route `^/api/([^/]+)$`), so `/api/funds/119551` was a 404. vercel.json therefore rewrites
// `/api/:path*` to `/api/proxy?__path=:path*`, and this puts the original path back before the shared core sees the request.

export const PATH_PARAM = '__path';
/** Vercel also appends each named path parameter of the rewrite to the destination's query. The core would reject it as an unknown key. */
const EXTRA_PARAM = 'path';

/** The request as the client sent it. A request that did not come through the rewrite is returned unchanged. */
export function restorePath(request: Request): Request {
  const url = new URL(request.url);
  const rest = url.searchParams.get(PATH_PARAM);
  if (rest === null) return request;
  url.searchParams.delete(PATH_PARAM);
  url.searchParams.delete(EXTRA_PARAM);
  url.pathname = `/api/${rest}`;
  return new Request(url, request);
}
