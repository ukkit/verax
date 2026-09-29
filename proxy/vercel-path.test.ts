import { describe, expect, it } from 'vitest';
import { buildUpstreamUrl } from './core';
import { restorePath } from './vercel-path';

describe('restorePath', () => {
  it('puts the original path and query back', () => {
    const restored = restorePath(new Request('https://x.example/api/proxy?__path=funds%2F119551&q=abc&page=2'));
    const url = new URL(restored.url);
    expect(url.pathname).toBe('/api/funds/119551');
    expect([...url.searchParams]).toEqual([['q', 'abc'], ['page', '2']]);
  });

  it('drops the path parameter Vercel appends to a rewrite, as the generated route does', () => {
    const restored = restorePath(new Request('https://x.example/api/proxy?__path=funds%2F119551&path=funds%2F119551&q=abc'));
    expect(new URL(restored.url).pathname).toBe('/api/funds/119551');
    expect([...new URL(restored.url).searchParams.keys()]).toEqual(['q']);
  });

  it('gives the core a request it accepts, exactly as the generated Vercel route delivers one', () => {
    const upstream = buildUpstreamUrl(new URL(restorePath(new Request('https://x.example/api/proxy?__path=funds%2Fsearch&path=funds%2Fsearch&q=INF209KA12Z1&page_size=10')).url));
    expect(String(upstream)).toBe('https://mfnav.in/api/funds/search?page_size=10&q=INF209KA12Z1');
    expect(typeof buildUpstreamUrl(new URL('https://x.example/api/proxy?path=funds%2F1'))).toBe('string');
  });

  it('handles a single segment, and an unencoded slash', () => {
    expect(new URL(restorePath(new Request('https://x.example/api/proxy?__path=date')).url).pathname).toBe('/api/date');
    expect(new URL(restorePath(new Request('https://x.example/api/proxy?__path=nav/119551&start_date=2024-01-01')).url).pathname).toBe('/api/nav/119551');
  });

  it('returns a request that did not come through the rewrite unchanged', () => {
    const request = new Request('https://x.example/api/funds/119551?q=1');
    expect(restorePath(request)).toBe(request);
  });

  it('keeps the method and cannot climb out of /api', () => {
    const post = restorePath(new Request('https://x.example/api/proxy?__path=funds/1', { method: 'POST' }));
    expect(post.method).toBe('POST');
    expect(new URL(restorePath(new Request('https://x.example/api/proxy?__path=..%2F..%2Fetc')).url).pathname.startsWith('/api/')).toBe(false);
  });
});
