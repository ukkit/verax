import { afterEach, describe, expect, it, vi } from 'vitest';

// The host wrappers are thin; these tests only check they are wired to the shared core.
// Requests here are rejected before any network call, so nothing leaves the machine.

describe('Cloudflare Pages Function wrapper', () => {
  afterEach(() => vi.unstubAllGlobals());
  const context = (request: Request) => ({ request, waitUntil: () => {} });

  it('delegates to the proxy core', async () => {
    vi.stubGlobal('caches', { default: { match: async () => undefined, put: async () => {} } });
    const { onRequest } = await import('../functions/api/[[path]]');
    expect((await onRequest(context(new Request('https://x.example/api/evil/1')))).status).toBe(400);
    expect((await onRequest(context(new Request('https://x.example/api/funds/1', { method: 'POST' })))).status).toBe(405);
  });

  it('answers from the Cloudflare cache before running the proxy', async () => {
    const hit = new Response('cached body');
    vi.stubGlobal('caches', { default: { match: async () => hit, put: async () => {} } });
    const { onRequest } = await import('../functions/api/[[path]]');
    expect(await onRequest(context(new Request('https://x.example/api/funds/1')))).toBe(hit);
  });
});

describe('Vercel Function wrapper', () => {
  it('exports a fetch handler that delegates to the proxy core', async () => {
    const mod = await import('../api/proxy');
    expect(typeof mod.default.fetch).toBe('function');
    expect((await mod.default.fetch(new Request('https://x.example/api/evil/1'))).status).toBe(400);
    expect((await mod.default.fetch(new Request('https://x.example/api/funds/1', { method: 'POST' }))).status).toBe(405);
  });

  it('reads the path from the rewrite vercel.json sends every /api request through', async () => {
    const mod = await import('../api/proxy');
    expect((await mod.default.fetch(new Request('https://x.example/api/proxy?__path=evil%2F1'))).status).toBe(400);
    expect((await mod.default.fetch(new Request('https://x.example/api/proxy?__path=funds%2F1&path=funds%2F1', { method: 'POST' }))).status).toBe(405);

  });
});

describe('Vercel optional gate (middleware.ts)', () => {
  afterEach(() => vi.unstubAllEnvs());
  const basic = (user: string, pass: string) => ({ authorization: `Basic ${btoa(`${user}:${pass}`)}` });
  const req = (headers: Record<string, string> = {}) => new Request('https://x.example/', { headers });

  it('matches only the page and the proxy, not the static bundle', async () => {
    const { config } = await import('../middleware');
    expect(config.matcher).toEqual(['/', '/api/:path*']);
  });

  it('is a no-op when SITE_USER / SITE_PASS are not set', async () => {
    const { default: middleware } = await import('../middleware');
    expect((await middleware(req())).status).not.toBe(401);
  });

  it('challenges when set and no credentials are sent', async () => {
    vi.stubEnv('SITE_USER', 'alice');
    vi.stubEnv('SITE_PASS', 's3cret');
    const { default: middleware } = await import('../middleware');
    const res = await middleware(req());
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('Basic');
  });

  it('rejects wrong credentials and malformed headers, accepts the right ones', async () => {
    vi.stubEnv('SITE_USER', 'alice');
    vi.stubEnv('SITE_PASS', 's3cret');
    const { default: middleware } = await import('../middleware');
    expect((await middleware(req(basic('alice', 'wrong')))).status).toBe(401);
    expect((await middleware(req(basic('mallory', 's3cret')))).status).toBe(401);
    expect((await middleware(req({ authorization: 'Basic %%%not-base64' }))).status).toBe(401);
    expect((await middleware(req({ authorization: 'Bearer abc' }))).status).toBe(401);
    expect((await middleware(req(basic('alice', 's3cret')))).status).not.toBe(401);
  });
});
