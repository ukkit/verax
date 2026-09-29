import { describe, expect, it, vi } from 'vitest';
import { cached, type EdgeCache } from './edge-cache';

const shareable = () => new Response('{"ok":true}', { status: 200, headers: { 'cache-control': 'public, max-age=300, s-maxage=3600' } });
const errorResponse = () => new Response('{"error":"x"}', { status: 502, headers: { 'cache-control': 'no-store' } });
const get = (path = '/api/funds/1', method = 'GET') => new Request(`https://app.example.com${path}`, { method });

function fakeCache(initial?: Response): EdgeCache & { match: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> } {
  return { match: vi.fn().mockResolvedValue(initial), put: vi.fn().mockResolvedValue(undefined) };
}

describe('cached', () => {
  it('returns a cache hit without running the handler', async () => {
    const hit = new Response('from cache');
    const cache = fakeCache(hit);
    const handler = vi.fn();
    const res = await cached(get(), cache, vi.fn(), handler);
    expect(res).toBe(hit);
    expect(handler).not.toHaveBeenCalled();
  });

  it('runs the handler on a miss and stores a shareable response in the background', async () => {
    const cache = fakeCache();
    const waitUntil = vi.fn();
    const res = await cached(get(), cache, waitUntil, async () => shareable());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":true}'); // the caller still gets a readable body after the clone was stored
    expect(cache.put).toHaveBeenCalledOnce();
    expect(waitUntil).toHaveBeenCalledOnce();
  });

  it('does not store errors or no-store responses', async () => {
    const cache = fakeCache();
    const waitUntil = vi.fn();
    await cached(get(), cache, waitUntil, async () => errorResponse());
    expect(cache.put).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it('bypasses the cache entirely for non-GET requests', async () => {
    const cache = fakeCache();
    const handler = vi.fn().mockResolvedValue(new Response('nope', { status: 405 }));
    const res = await cached(get('/api/funds/1', 'POST'), cache, vi.fn(), handler);
    expect(res.status).toBe(405);
    expect(cache.match).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });
});
