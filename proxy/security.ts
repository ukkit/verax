// Response headers for the static site. Cloudflare Pages reads public/_headers and Vercel reads vercel.json, and
// neither can import this file, so proxy/headers-parity.test.ts fails if the three copies drift. The local Node
// server imports this module directly.

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

export const HSTS = 'max-age=31536000; includeSubDomains';

/** Headers common to every host. HSTS is added separately because plain-HTTP localhost must not send it. */
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP,
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/** Content-hashed build output (dist/assets/*) never changes, so browsers and CDNs may keep it for a year. */
export const ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable';
