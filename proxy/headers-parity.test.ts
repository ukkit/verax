import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ASSET_CACHE_CONTROL, HSTS, SECURITY_HEADERS } from './security';

// Cloudflare (_headers) and Vercel (vercel.json) cannot import proxy/security.ts, so keep them honest here.
const site = { ...SECURITY_HEADERS, 'Strict-Transport-Security': HSTS };
const assets = { 'Cache-Control': ASSET_CACHE_CONTROL };

/** Parses Cloudflare's _headers format: an unindented URL pattern followed by indented `Name: value` lines. */
function parseHeadersFile(text: string): Record<string, Record<string, string>> {
  const rules: Record<string, Record<string, string>> = {};
  let current: Record<string, string> | undefined;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      current = rules[line.trim()] = {};
      continue;
    }
    const match = /^\s+([A-Za-z-]+):\s*(.+)$/.exec(line);
    if (current && match?.[1] && match[2]) current[match[1]] = match[2].trim();
  }
  return rules;
}

describe('response headers stay identical across hosts', () => {
  it('public/_headers (Cloudflare Pages)', () => {
    const rules = parseHeadersFile(readFileSync(new URL('../public/_headers', import.meta.url), 'utf8'));
    expect(rules).toEqual({ '/*': site, '/assets/*': assets });
  });

  it('vercel.json (Vercel)', () => {
    const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };
    const byPattern = Object.fromEntries(config.headers.map((h) => [h.source, Object.fromEntries(h.headers.map((x) => [x.key, x.value]))]));
    expect(byPattern).toEqual({ '/(.*)': site, '/assets/(.*)': assets });
  });

  it('the CSP forbids inline scripts, third-party origins and framing', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy']!;
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|https?:\/\//);
  });
});

describe('Cloudflare _routes.json', () => {
  it('invokes Functions only for /api/*, so static requests stay free and never touch the Functions quota', () => {
    const routes = JSON.parse(readFileSync(new URL('../public/_routes.json', import.meta.url), 'utf8'));
    expect(routes).toEqual({ version: 1, include: ['/api/*'], exclude: [] });
  });
});
