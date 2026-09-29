import { describe, expect, it } from 'vitest';
import { parseStatement } from './cams';
import { fixSigns, reconcile } from './reconcile';
import { buildItems, footer, schemeLine, type CasSpec, type TxnSpec } from './testing/fixtures';
import type { Scheme } from './types';

const oneScheme = (txns: TxnSpec[], extra: { open?: number; close?: number } = {}): CasSpec => ({
  amcs: [{ name: 'Sample Alpha Mutual Fund', folios: [{ line: 'Folio No: 1000', schemes: [{ header: [schemeLine('ALPHFG', 'Sample Alpha Flexi Cap Fund', 'INF000A01AB3')], txns, footer: footer(10, 100, 100), ...extra }] }] }],
});
const parse = (txns: TxnSpec[], extra?: { open?: number; close?: number }) => parseStatement(buildItems(oneScheme(txns, extra))).folios[0]!.schemes[0]!;

const buy = (date: string, units: number, balance?: number): TxnSpec => ({ date, desc: 'Purchase', amount: units * 10, units, price: 10, balance });

describe('a scheme that adds up', () => {
  it('is reconciled with no warnings', () => {
    const scheme = parse([buy('01-Jan-2021', 10), buy('01-Feb-2021', 5)]);
    expect(scheme).toMatchObject({ reconciled: true, warnings: [], close: 15, closeCalculated: 15 });
  });
});

describe('a row that was dropped or misread', () => {
  // The statement prints balances 10, 15, 22; the middle row never made it into the parse.
  const missing = () => parse([buy('01-Jan-2021', 10, 10), buy('01-Mar-2021', 7, 22)], { close: 22 });

  it('breaks the balance chain and flags the scheme', () => {
    const scheme = missing();
    expect(scheme.reconciled).toBe(false);
    expect(scheme.warnings[0]).toMatch(/stops adding up at 2021-03-01.*17\.000 units.*prints 22\.000/);
  });

  it('gives one warning, not one per following row, because the running total resyncs to the statement', () => {
    const scheme = parse([buy('01-Jan-2021', 10, 10), buy('01-Mar-2021', 7, 22), buy('01-Apr-2021', 3, 25), buy('01-May-2021', 1, 26)], { close: 26 });
    expect(scheme.warnings).toHaveLength(1);
  });

  it('catches a dropped last row through the closing balance', () => {
    const scheme = parse([buy('01-Jan-2021', 10, 10)], { close: 15 });
    expect(scheme.reconciled).toBe(false);
    expect(scheme.warnings.join(' ')).toMatch(/Closing balance mismatch.*10\.000.*15\.000/);
  });
});

describe('fixSigns', () => {
  it('flips a row whose parentheses lie: the balance shows units were added, not removed', () => {
    const scheme = parse([buy('01-Jan-2021', 100, 100), { date: '01-Feb-2021', desc: 'Payment - Units Extinguished-Reversed', amount: -50, units: -5, price: 10, balance: 105 }], { close: 105 });
    const row = scheme.transactions[1]!;
    expect(row).toMatchObject({ units: 5, amount: 50, type: 'PURCHASE' });
    expect(scheme.reconciled).toBe(true);
  });

  it('leaves rows that already agree with the balance alone', () => {
    const scheme = parse([buy('01-Jan-2021', 100, 100), { date: '01-Feb-2021', desc: 'Redemption', amount: -50, units: -5, price: 10, balance: 95 }], { close: 95 });
    expect(scheme.transactions[1]).toMatchObject({ units: -5, type: 'REDEMPTION' });
  });
});

describe('reconcile and fixSigns on a hand-made scheme', () => {
  const base = (over: Partial<Scheme> = {}): Scheme => ({ name: 'x', isin: null, rta: 'CAMS', rtaCode: 'X', open: 0, close: 0, closeCalculated: 0, valuation: { date: null, nav: null, value: null, cost: null }, transactions: [], reconciled: false, warnings: [], ...over });

  it('cannot check a scheme whose closing balance was never found', () => {
    expect(reconcile(base({ close: null }))).toEqual(['The closing unit balance was not found, so this scheme cannot be checked.']);
  });

  it('tolerates float noise below half a thousandth of a unit', () => {
    const t = { date: '2021-01-01', description: 'Purchase', type: 'PURCHASE' as const, amount: 1, units: 0.1 + 0.2, nav: 1, balance: 0.3, dividendRate: null, giftFolio: null };
    expect(reconcile(base({ close: 0.3, transactions: [t] }))).toEqual([]);
  });

  it('recomputes the calculated closing balance after fixing signs', () => {
    const scheme = base({ open: 10, close: 15, transactions: [{ date: '2021-01-01', description: 'Reversed', type: 'REDEMPTION', amount: -50, units: -5, nav: 10, balance: 15, dividendRate: null, giftFolio: null }] });
    fixSigns(scheme);
    expect(scheme.closeCalculated).toBe(15);
  });
});
