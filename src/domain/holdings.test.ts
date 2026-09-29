import { describe, expect, it } from 'vitest';
import type { Scheme, Statement, Transaction, TransactionType } from '../parser/types';
import { buildPortfolio } from './holdings';

let seq = 0;
const txn = (date: string, type: TransactionType, units: number | null, amount: number | null): Transaction => ({
  date, description: `row ${seq++}`, type, units, amount, nav: null, balance: null, dividendRate: null, giftFolio: null,
});

const scheme = (transactions: Transaction[], extra: Partial<Scheme> = {}): Scheme => ({
  name: 'Sample Equity Fund - Direct Growth', isin: 'INF000A01234', rta: 'CAMS', rtaCode: 'SEF', open: 0, close: null, closeCalculated: 0,
  valuation: { date: null, nav: null, value: null, cost: null }, transactions, reconciled: true, warnings: [], ...extra,
});

const statement = (...schemes: Scheme[]): Statement => ({
  source: 'CAMS', period: null, warnings: [],
  folios: [{ id: 'f1', amc: 'Sample Mutual Fund', folioMasked: '••••1234', schemes }],
});

describe('buildPortfolio', () => {
  it('holds purchases as lots and derives the average cost', () => {
    const { open } = buildPortfolio(statement(scheme([txn('2024-01-10', 'PURCHASE', 10, 1000), txn('2024-02-10', 'PURCHASE_SIP', 10, 1200)])));
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ units: 20, invested: 2200, avgCost: 110, realised: 0 });
    expect(open[0]!.flows).toEqual([{ date: '2024-01-10', amount: -1000 }, { date: '2024-02-10', amount: -1200 }]);
  });

  it('sells the oldest units first and books realised gain', () => {
    const { open } = buildPortfolio(statement(scheme([
      txn('2024-01-10', 'PURCHASE', 10, 1000),
      txn('2024-02-10', 'PURCHASE', 10, 1200),
      txn('2024-03-10', 'REDEMPTION', -15, -2000),
    ])));
    // 10 units at 100 plus 5 units at 120 = 1600 cost, so 400 realised; 5 units at 120 = 600 remain.
    expect(open[0]).toMatchObject({ units: 5, invested: 600, avgCost: 120, realised: 400 });
    expect(open[0]!.lots).toEqual([{ date: '2024-02-10', units: 5, cost: 600 }]);
  });

  it('moves a fully redeemed scheme to closed positions', () => {
    const { open, closed } = buildPortfolio(statement(scheme([txn('2024-01-10', 'PURCHASE', 10, 1000), txn('2024-06-10', 'REDEMPTION', -10, -1300)])));
    expect(open).toHaveLength(0);
    expect(closed[0]).toMatchObject({ units: 0, invested: 0, avgCost: null, realised: 300 });
    expect(closed[0]!.flows).toHaveLength(2);
  });

  it('adds stamp duty to the cost of its purchase and to the cash paid', () => {
    const { open } = buildPortfolio(statement(scheme([txn('2024-01-10', 'PURCHASE', 10, 999.95), txn('2024-01-10', 'STAMP_DUTY_TAX', null, 0.05)])));
    expect(open[0]!.invested).toBeCloseTo(1000, 6);
    expect(open[0]!.flows.reduce((sum, f) => sum + f.amount, 0)).toBeCloseTo(-1000, 6);
  });

  it('treats a dividend payout as cash received and a reinvestment as units without cash', () => {
    const { open } = buildPortfolio(statement(scheme([
      txn('2024-01-10', 'PURCHASE', 10, 1000),
      txn('2024-04-10', 'DIVIDEND_PAYOUT', null, 50),
      txn('2024-05-10', 'DIVIDEND_REINVEST', 0.5, 50),
    ])));
    expect(open[0]).toMatchObject({ units: 10.5, invested: 1050 });
    expect(open[0]!.flows).toEqual([{ date: '2024-01-10', amount: -1000 }, { date: '2024-04-10', amount: 50 }]);
  });

  it('counts a switch as a sale and a purchase', () => {
    const { open, closed } = buildPortfolio(statement(
      scheme([txn('2024-01-10', 'PURCHASE', 10, 1000), txn('2024-03-10', 'SWITCH_OUT', -10, -1100)]),
      scheme([txn('2024-03-10', 'SWITCH_IN', 5, 1100)], { name: 'Sample Debt Fund - Direct Growth' }),
    ));
    expect(closed[0]!.realised).toBe(100);
    expect(open[0]).toMatchObject({ units: 5, invested: 1100 });
  });

  it('moves gifted units without a cash flow or realised gain', () => {
    const { open, closed } = buildPortfolio(statement(
      scheme([txn('2024-01-10', 'PURCHASE', 10, 1000), txn('2024-02-10', 'GIFT_OUT', -4, -500)]),
      scheme([txn('2024-02-10', 'GIFT_IN', 4, null)], { name: 'Sample Gift Fund' }),
    ));
    expect(closed).toHaveLength(0);
    expect(open[0]).toMatchObject({ units: 6, realised: 0 });
    expect(open[0]!.flows).toEqual([{ date: '2024-01-10', amount: -1000 }]);
    expect(open[1]).toMatchObject({ units: 4, invested: 0 });
  });

  it('records buys and sells for charting, but not dividends or stamp duty', () => {
    const { open } = buildPortfolio(statement(scheme([
      txn('2024-01-10', 'PURCHASE', 10, 999.95), txn('2024-01-10', 'STAMP_DUTY_TAX', null, 0.05),
      txn('2024-04-10', 'DIVIDEND_PAYOUT', null, 50), txn('2024-05-10', 'REDEMPTION', -4, -450),
    ])));
    expect(open[0]!.trades).toEqual([{ date: '2024-01-10', side: 'buy' }, { date: '2024-05-10', side: 'sell' }]);
  });

  it('excludes a scheme that does not reconcile, with a reason', () => {
    const { open, excluded } = buildPortfolio(statement(scheme([txn('2024-01-10', 'PURCHASE', 10, 1000)], { reconciled: false })));
    expect(open).toHaveLength(0);
    expect(excluded).toEqual([expect.objectContaining({ folioMasked: '••••1234', reason: expect.stringContaining('do not add up') })]);
  });

  it('excludes a scheme that starts with units of unknown cost', () => {
    const { excluded } = buildPortfolio(statement(scheme([txn('2024-01-10', 'PURCHASE', 1, 100)], { open: 50 })));
    expect(excluded[0]!.reason).toContain('unknown');
  });

  it('excludes a scheme that sells more than it bought', () => {
    const { open, excluded } = buildPortfolio(statement(scheme([txn('2024-01-10', 'PURCHASE', 5, 500), txn('2024-02-10', 'REDEMPTION', -8, -900)])));
    expect(open).toHaveLength(0);
    expect(excluded[0]!.reason).toContain('never shows being bought');
  });

  it('ignores rounding noise when the last units are sold', () => {
    const { open, closed } = buildPortfolio(statement(scheme([txn('2024-01-10', 'PURCHASE', 10.0004, 1000), txn('2024-02-10', 'REDEMPTION', -10, -1100)])));
    expect(open).toHaveLength(0);
    expect(closed).toHaveLength(1);
  });
});
