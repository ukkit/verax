import { describe, expect, it } from 'vitest';
import type { Statement, Transaction, TransactionType } from '../parser/types';
import { filterRows, transactionRows } from './transactions';

const txn = (date: string, type: TransactionType): Transaction => ({ date, description: 'row', type, units: 1, amount: 1, nav: null, balance: null, dividendRate: null, giftFolio: null });
const scheme = (name: string, transactions: Transaction[]) => ({ name, isin: null, rta: 'CAMS', rtaCode: 'X', open: 0, close: null, closeCalculated: 0, valuation: { date: null, nav: null, value: null, cost: null }, transactions, reconciled: true, warnings: [] });
const statement: Statement = {
  source: 'CAMS', period: null, warnings: [],
  folios: [
    { id: 'f1', amc: 'A', folioMasked: '••••1111', schemes: [scheme('One', [txn('2024-01-10', 'PURCHASE'), txn('2024-03-10', 'REDEMPTION')])] },
    { id: 'f2', amc: 'B', folioMasked: '••••2222', schemes: [scheme('Two', [txn('2024-02-10', 'PURCHASE')])] },
  ],
};

describe('transaction rows', () => {
  const rows = transactionRows(statement);

  it('lists every transaction, newest first', () => {
    expect(rows.map((r) => r.transaction.date)).toEqual(['2024-03-10', '2024-02-10', '2024-01-10']);
  });

  it('filters by scheme, type and inclusive date range, and combines them', () => {
    expect(filterRows(rows, { schemeKey: 'f2:0' })).toHaveLength(1);
    expect(filterRows(rows, { type: 'PURCHASE' })).toHaveLength(2);
    expect(filterRows(rows, { from: '2024-02-10', to: '2024-03-10' })).toHaveLength(2);
    expect(filterRows(rows, { type: 'PURCHASE', from: '2024-02-01' }).map((r) => r.schemeName)).toEqual(['Two']);
    expect(filterRows(rows, {})).toHaveLength(3);
  });
});
