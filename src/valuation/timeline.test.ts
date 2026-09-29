import { describe, expect, it, vi } from 'vitest';
import type { Position } from '../domain/holdings';
import { NavError } from '../nav';
import type { NavSource } from './navSource';
import { fetchHistories } from './timeline';

const position = (id: string, over: Partial<Position> = {}): Position => ({
  id, folioId: 'f1', amc: 'A', folioMasked: '••••1234', name: id, isin: `INF${id}`, units: 0, lots: [], invested: 0, avgCost: null, realised: 0,
  flows: [], trades: [], steps: [{ date: '2024-01-10', units: 1, cost: 10 }], statementNav: null, ...over,
});
const source = (over: Partial<NavSource> = {}): NavSource => ({ schemeCode: async () => 5, fund: async () => { throw new Error('unused'); }, ...over });
const nav = [{ date: '2024-01-03', nav: 10 }];

describe('fetchHistories', () => {
  it('asks for history from a week before the first transaction, using a known code before the ISIN', async () => {
    const load = vi.fn(async () => nav);
    const schemeCode = vi.fn(async () => 5);
    const out = await fetchHistories([position('a'), position('b')], new Map([['a', 99]]), source({ schemeCode }), undefined, load);
    expect(load).toHaveBeenCalledWith(99, '2024-01-03');
    expect(load).toHaveBeenCalledWith(5, '2024-01-03');
    expect(schemeCode).toHaveBeenCalledTimes(1);
    expect([...out.navs.keys()].sort()).toEqual(['a', 'b']);
  });

  it('reports a fund it cannot find, keeps the rest, and logs only a status', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const load = vi.fn(async (code: number) => { if (code === 6) throw new NavError('NAV service error (429).', 429); return nav; });
    const out = await fetchHistories(
      [position('a'), position('b', { isin: null }), position('c')], new Map([['c', 6]]), source(), undefined, load,
    );
    expect([...out.navs.keys()]).toEqual(['a']);
    expect(out.missing.map((m) => [m.position.id, m.reason])).toEqual(expect.arrayContaining([['b', 'The statement gives no ISIN for this scheme.'], ['c', 'NAV service error (429).']]));
    expect(log).toHaveBeenCalledWith('history_lookup_failed', { status: 429 });
    log.mockRestore();
  });

  it('skips positions that never held units, reports progress, and lets a bug propagate', async () => {
    const progress = vi.fn();
    await fetchHistories([position('a'), position('empty', { steps: [] })], new Map(), source(), progress, async () => nav);
    expect(progress).toHaveBeenCalledWith(1, 1);
    await expect(fetchHistories([position('a')], new Map(), source(), undefined, async () => { throw new TypeError('bug'); })).rejects.toThrow('bug');
  });
});
