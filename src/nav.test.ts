import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHistory, NavError } from './nav';

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

  it('reports a missing fund', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));
    await expect(getHistory(7, '2025-01-01')).rejects.toBeInstanceOf(NavError);
  });
});
