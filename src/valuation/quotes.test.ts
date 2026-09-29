import { describe, expect, it, vi } from 'vitest';
import type { Position } from '../domain/holdings';
import { NavError, type Fund } from '../nav';
import type { NavSource } from './navSource';
import { fetchQuotes } from './quotes';
import { mapLimit } from './pool';

const fund = (code: number, over: Partial<Fund> = {}): Fund => ({ scheme_code: code, scheme_name: 'Sample Fund', fund_house: 'Sample', plan_type: 'Direct', option_type: 'Growth', isin: null, category: 'Equity', sub_category: null, latest_nav: 12.5, latest_nav_date: '2025-01-01', latest_day_change_pct: 0.5, ...over });
const position = (id: string, over: Partial<Position> = {}): Position => ({
  id, folioId: 'f1', amc: 'A', folioMasked: '••••1234', name: id, isin: `INF${id}`, units: 1, lots: [], invested: 10, avgCost: 10, realised: 0, flows: [], trades: [], steps: [], navs: [], statementNav: { nav: 11, date: '2024-12-31' }, ...over,
});
const source = (over: Partial<NavSource> = {}): NavSource => ({ schemeCode: async () => 5, fund: async (c) => fund(c), ...over });

describe('fetchQuotes', () => {
  it('quotes a position from mfnav.in by ISIN', async () => {
    const quotes = await fetchQuotes([position('a')], source());
    expect(quotes.get('a')).toEqual({ quote: { nav: 12.5, date: '2025-01-01', dayChangePct: 0.5, from: 'mfnav', schemeCode: 5 }, issue: null });
  });

  it('falls back to the statement NAV when the ISIN is unmapped, and says so', async () => {
    const quotes = await fetchQuotes([position('a')], source({ schemeCode: async () => null }));
    expect(quotes.get('a')?.quote).toEqual({ nav: 11, date: '2024-12-31', dayChangePct: null, from: 'statement', schemeCode: null });
    expect(quotes.get('a')?.issue).toBe('mfnav.in has no single fund for this ISIN. Valued at the NAV printed on your statement.');
  });

  it('reports a scheme with no ISIN and no statement NAV as not valued', async () => {
    const quotes = await fetchQuotes([position('a', { isin: null, statementNav: null })], source());
    expect(quotes.get('a')).toMatchObject({ quote: null, issue: 'The statement gives no ISIN for this scheme. Not valued.' });
  });

  it('keeps going when one lookup fails and logs its status only', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const quotes = await fetchQuotes([position('a'), position('b')], source({ schemeCode: async (isin) => (isin === 'INFa' ? 5 : 6), fund: async (c) => { if (c === 5) throw new NavError('NAV service error (503).', 503); return fund(c); } }));
    expect([...quotes.values()].filter((q) => q.issue)).toHaveLength(1);
    expect(log).toHaveBeenCalledWith('nav_lookup_failed', { status: 503 });
    log.mockRestore();
  });

  it('lets an unexpected error propagate', async () => {
    await expect(fetchQuotes([position('a')], source({ fund: async () => { throw new TypeError('bug'); } }))).rejects.toThrow('bug');
  });
});

describe('mapLimit', () => {
  it('never runs more than the limit at once and keeps order', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, async (n) => {
      peak = Math.max(peak, ++running);
      await new Promise((r) => setTimeout(r, 2));
      running--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18]);
    expect(peak).toBe(4);
  });
});
