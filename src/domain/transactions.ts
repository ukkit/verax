// The statement's transactions as one list, and the filters the transaction view offers.
import type { Statement, Transaction, TransactionType } from '../parser/types';

export interface TransactionRow {
  /** Identifies the scheme: folio id plus its position in the folio. */
  schemeKey: string;
  schemeName: string;
  amc: string;
  folioMasked: string;
  transaction: Transaction;
}

export interface TransactionFilter {
  schemeKey?: string;
  type?: TransactionType;
  /** ISO dates, inclusive. */
  from?: string;
  to?: string;
}

export const TYPE_LABELS: Record<TransactionType, string> = {
  PURCHASE: 'Purchase',
  PURCHASE_SIP: 'SIP purchase',
  REDEMPTION: 'Redemption',
  DIVIDEND_PAYOUT: 'Dividend paid out',
  DIVIDEND_REINVEST: 'Dividend reinvested',
  SWITCH_IN: 'Switch in',
  SWITCH_IN_MERGER: 'Switch in (merger)',
  SWITCH_OUT: 'Switch out',
  SWITCH_OUT_MERGER: 'Switch out (merger)',
  STT_TAX: 'STT',
  STAMP_DUTY_TAX: 'Stamp duty',
  TDS_TAX: 'TDS',
  SEGREGATION: 'Segregation',
  GIFT_IN: 'Gift in',
  GIFT_OUT: 'Gift out',
  REVERSAL: 'Reversal',
  MISC: 'Other',
  UNKNOWN: 'Unclassified',
};

/** Every transaction in the statement, newest first (ties keep statement order). */
export const transactionRows = (statement: Statement): TransactionRow[] =>
  statement.folios
    .flatMap((folio) =>
      folio.schemes.flatMap((scheme, n) =>
        scheme.transactions.map((transaction) => ({ schemeKey: `${folio.id}:${n}`, schemeName: scheme.name, amc: folio.amc, folioMasked: folio.folioMasked, transaction })),
      ),
    )
    .sort((a, b) => b.transaction.date.localeCompare(a.transaction.date));

export const filterRows = (rows: readonly TransactionRow[], f: TransactionFilter): TransactionRow[] =>
  rows.filter(
    ({ schemeKey, transaction: t }) =>
      (!f.schemeKey || schemeKey === f.schemeKey) && (!f.type || t.type === f.type) && (!f.from || t.date >= f.from) && (!f.to || t.date <= f.to),
  );
