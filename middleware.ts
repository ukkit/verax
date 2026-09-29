// Optional Basic Auth gate for Vercel deployments (Routing Middleware).
// Inactive unless both SITE_USER and SITE_PASS are set in the Vercel project's environment variables.
// Cloudflare deployments should use Cloudflare Access instead (see README); this file is ignored there.
import { next } from '@vercel/functions';

// Vercel bills a middleware call per matched request, so match only what needs gating: the page and the proxy.
// The hashed JS/CSS under /assets is public code from a public repo, so it is deliberately left ungated.
export const config = {
  matcher: ['/', '/api/:path*'],
};

const encoder = new TextEncoder();

/** Constant-time comparison of two strings via SHA-256 digests. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= (va[i] ?? 0) ^ (vb[i] ?? 0);
  return diff === 0;
}

/** Decodes a Basic auth header into [user, password]; null when it is absent or malformed. */
function parseBasic(header: string): [string, string] | null {
  if (!header.startsWith('Basic ')) return null;
  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return null; // not valid base64: treated the same as no credentials
  }
  const sep = decoded.indexOf(':');
  return sep < 0 ? null : [decoded.slice(0, sep), decoded.slice(sep + 1)];
}

export default async function middleware(request: Request): Promise<Response> {
  const user = process.env.SITE_USER;
  const pass = process.env.SITE_PASS;
  if (!user || !pass) return next();

  const credentials = parseBasic(request.headers.get('authorization') ?? '');
  if (credentials) {
    const okUser = await safeEqual(credentials[0], user);
    const okPass = await safeEqual(credentials[1], pass);
    if (okUser && okPass) return next();
  }
  return new Response('Authentication required. Send the site username and password (HTTP Basic auth).', {
    status: 401,
    headers: { 'www-authenticate': 'Basic realm="Verax", charset="UTF-8"', 'cache-control': 'no-store' },
  });
}
