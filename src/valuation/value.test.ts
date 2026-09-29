import { describe, expect, it } from 'vitest';
import type { Portfolio, Position } from '../domain/holdings';
import type { PositionQuote } from './quotes';
import { staleIds, valuePortfolio } from './value';

const position = (id: string, over: Partial<Position> = {}): Position => ({
  id, folioId: 'f1', amc: 'Sample Mutual Fund', folioMasked: '••••1234', name: `Fund ${id}`, isin: null,
  units: 10, lots: [], invested: 1000, avgCost: 100, realised: 0, statementNav: null, trades: [], steps: [], navs: [],
  flows: [{ date: '2024-01-01', amount: -1000 }], ...over,
});

const mf = (nav: number, dayChangePct: number | null = null): PositionQuote => ({ quote: { nav, date: '2025-01-01', dayChangePct, from: 'mfnav', schemeCode: 1 }, issue: null });
const portfolio = (open: Position[], closed: Position[] = []): Portfolio => ({ open, closed, excluded: [] });

describe('valuePortfolio', () => {
  it('values a position and its return', () => {
    const { open, totals } = valuePortfolio(portfolio([position('a')]), new Map([['a', mf(110)]]));
    expect(open[0]).toMatchObject({ value: 1100, gain: 100, gainPct: 0.1 });
    expect(open[0]!.xirr).toBeCloseTo(1.1 ** (365 / 366) - 1, 6);
    expect(totals).toMatchObject({ invested: 1000, value: 1100, gain: 100, returnPct: 0.1, unvalued: 0 });
  });

  it('derives the day change from the percentage', () => {
    const { open, totals } = valuePortfolio(portfolio([position('a')]), new Map([['a', mf(110, 10)]]));
    expect(open[0]!.dayChange).toBeCloseTo(100, 6);
    expect(totals.dayChange).toBeCloseTo(100, 6);
  });

  it('leaves an unvalued position out of the totals and the XIRR', () => {
    const { totals } = valuePortfolio(portfolio([position('a'), position('b')]), new Map([['a', mf(110)], ['b', { quote: null, issue: 'no nav' }]]));
    expect(totals).toMatchObject({ invested: 1000, value: 1100, unvalued: 1 });
    expect(totals.xirr).toBeCloseTo(1.1 ** (365 / 366) - 1, 6);
  });

  it('counts a missing lookup as unvalued', () => {
    const { open, totals } = valuePortfolio(portfolio([position('a')]), new Map());
    expect(open[0]!.issue).toContain('No NAV');
    expect(totals.unvalued).toBe(1);
  });

  it('includes closed positions in realised gain and the portfolio XIRR', () => {
    const closed = position('c', { units: 0, invested: 0, avgCost: null, realised: 200, flows: [{ date: '2024-01-01', amount: -1000 }, { date: '2025-01-01', amount: 1200 }] });
    const { closed: rows, totals } = valuePortfolio(portfolio([position('a')], [closed]), new Map([['a', mf(110)]]));
    expect(rows[0]).toMatchObject({ value: 0, gain: 200 });
    expect(rows[0]!.xirr).toBeCloseTo(1.2 ** (365 / 366) - 1, 6);
    expect(totals.realised).toBe(200);
    expect(totals.xirr).toBeCloseTo(1.15 ** (365 / 366) - 1, 6); // both 1,000 stakes over the same year: 2,300 back on 2,000
  });
});

describe('staleIds', () => {
  const at = (date: string, from: 'mfnav' | 'statement' = 'mfnav'): PositionQuote => ({ quote: { nav: 10, date, dayChangePct: null, from, schemeCode: null }, issue: null });

  it('flags a NAV older than the newest live one and any statement NAV, but not the newest', () => {
    const p = portfolio([position('new'), position('old'), position('stmt'), position('none')]);
    const quotes = new Map([['new', at('2025-01-03')], ['old', at('2025-01-01')], ['stmt', at('2025-01-03', 'statement')], ['none', { quote: null, issue: 'x' }]]);
    expect([...staleIds(valuePortfolio(p, quotes).open)].sort()).toEqual(['old', 'stmt']);
  });

  it('flags nothing when every NAV is the same date', () => {
    expect(staleIds(valuePortfolio(portfolio([position('a'), position('b')]), new Map([['a', at('2025-01-03')], ['b', at('2025-01-03')]])).open).size).toBe(0);
  });
});
