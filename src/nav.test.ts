import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFund, getHistory, MAX_REQUESTS_PER_MINUTE, NavError } from './nav';

const page = (rows: [string, number][], total: number) => new Response(JSON.stringify({ data: rows.map(([nav_date, nav]) => ({ nav_date, nav })), total }));

afterEach(() => vi.unstubAllGlobals());

describe('getHistory', () => {
  it('follows the pages and returns the points oldest first', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(page([['2025-01-03', 3], ['2025-01-02', 2]], 3))
      .mockResolvedValueOnce(page([['2025-01-01', 1]], 3));
    vi.stubGlobal('fetch', fetchMock);
    expect(await getHistory(7, '2025-01-01')).toEqual([{ date: '2025-01-01', nav: 1 }, { date: '2025-01-02', nav: 2 }, { date: '2025-01-03', nav: 3 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]![0])).toContain('page=2');
  });

  it('stops on an empty page instead of looping', async () => {
    const fetchMock = vi.fn().mockResolvedValue(page([], 5));
    vi.stubGlobal('fetch', fetchMock);
    expect(await getHistory(7, '2025-01-01')).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes on the proxy\'s own explanation of a failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'upstream returned 403: mfnav.in refused this host' }), { status: 502 })));
    await expect(getHistory(7, '2025-01-01')).rejects.toMatchObject({ status: 502, message: 'NAV service error (502): upstream returned 403: mfnav.in refused this host.' });
  });

  it('keeps the plain message when the failure page is not the proxy\'s JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })));
    await expect(getHistory(7, '2025-01-01')).rejects.toMatchObject({ status: 502, message: 'NAV service error (502).' });
  });

  it('reports a missing fund', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));
    await expect(getHistory(7, '2025-01-01')).rejects.toBeInstanceOf(NavError);
  });

  it('holds back requests beyond the per-minute limit until the window has room', async () => {
    vi.useFakeTimers();
    try {
      await vi.advanceTimersByTimeAsync(61_000); // let calls made by earlier tests leave the window
      const fetchMock = vi.fn(async () => new Response(JSON.stringify({ scheme_code: 1 })));
      vi.stubGlobal('fetch', fetchMock);
      const calls = Array.from({ length: MAX_REQUESTS_PER_MINUTE + 1 }, () => getFund(1));
      await vi.advanceTimersByTimeAsync(1_000);
      expect(fetchMock).toHaveBeenCalledTimes(MAX_REQUESTS_PER_MINUTE);
      await vi.advanceTimersByTimeAsync(60_000);
      await Promise.all(calls);
      expect(fetchMock).toHaveBeenCalledTimes(MAX_REQUESTS_PER_MINUTE + 1);
    } finally {
      vi.useRealTimers();
    }
  });
});

