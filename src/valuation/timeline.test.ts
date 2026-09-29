import { describe, expect, it, vi } from 'vitest';
import type { Position } from '../domain/holdings';
import { NavError } from '../nav';
import type { NavSource } from './navSource';
import { chartInputs, fetchHistories, statementNavs } from './timeline';

const position = (id: string, over: Partial<Position> = {}): Position => ({
  id, folioId: 'f1', amc: 'A', folioMasked: '••••1234', name: id, isin: `INF${id}`, units: 0, lots: [], invested: 0, avgCost: null, realised: 0,
  flows: [], trades: [], steps: [{ date: '2024-01-10', units: 1, cost: 10 }], navs: [], statementNav: null, ...over,
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

describe('statementNavs', () => {
  it('merges transaction NAVs, the valuation NAV and today\'s quote into one dated series', () => {
    const p = position('a', { navs: [{ date: '2024-03-01', nav: 12 }, { date: '2024-01-15', nav: 10 }], statementNav: { date: '2024-06-30', nav: 15 } });
    expect(statementNavs(p, { date: '2024-09-01', nav: 18 })).toEqual([
      { date: '2024-01-15', nav: 10 }, { date: '2024-03-01', nav: 12 }, { date: '2024-06-30', nav: 15 }, { date: '2024-09-01', nav: 18 },
    ]);
  });

  it('lets the newest source win when two share a date, and is empty with nothing to go on', () => {
    expect(statementNavs(position('a', { navs: [{ date: '2024-01-15', nav: 10 }] }), { date: '2024-01-15', nav: 11 })).toEqual([{ date: '2024-01-15', nav: 11 }]);
    expect(statementNavs(position('a'))).toEqual([]);
  });
});

describe('chartInputs', () => {
  const histories = (navs: [string, number][], missing: [string, string][] = []) => ({
    navs: new Map(navs.map(([id]) => [id, [{ date: '2024-01-01', nav: 10 }]])),
    missing: missing.map(([id, reason]) => ({ position: position(id), reason })),
  });

  it('uses fetched history where there is some, statement NAVs where there is not, and leaves out what has neither', () => {
    const a = position('a');
    const b = position('b', { navs: [{ date: '2024-01-10', nav: 9 }] });
    const c = position('c');
    const out = chartInputs([a, b, c], histories([['a', 1]], [['b', 'mfnav.in refused this host'], ['c', 'mfnav.in refused this host']]), new Map());
    expect(out.inputs).toHaveLength(2);
    expect(out.approximate.map((x) => [x.position.id, x.reason])).toEqual([['b', 'mfnav.in refused this host']]);
    expect(out.left.map((x) => x.position.id)).toEqual(['c']);
  });

  it('adds today\'s quote to a fund drawn from statement NAVs and skips positions that never held units', () => {
    const b = position('b', { navs: [{ date: '2024-01-10', nav: 9 }] });
    const out = chartInputs([b, position('empty', { steps: [] })], histories([]), new Map([['b', { date: '2026-09-29', nav: 20 }]]));
    expect(out.inputs).toHaveLength(1);
    expect(out.inputs[0]!.navs.at(-1)).toEqual({ date: '2026-09-29', nav: 20 });
    expect(out.approximate[0]!.reason).toBe('Its NAV history was not loaded.');
  });
});
