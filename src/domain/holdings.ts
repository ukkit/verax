// Turns a parsed Statement into positions with FIFO cost lots, realised gain and dated cash flows (the investor's view:
// money paid in is negative). Only reconciled schemes with a complete history become positions; the rest are listed as
// excluded, with the reason, and never enter a total.
import type { Scheme, Statement, Transaction, TransactionType } from '../parser/types';
import type { CashFlow } from './xirr';

/** Units below this are rounding noise (statements print three decimals). */
const UNIT_EPS = 0.0005;

/** Units still held from one purchase, and what they cost. */
export interface Lot {
  date: string;
  units: number;
  cost: number;
}

/** The NAV the statement itself printed for a scheme, used until a live NAV is available. */
export interface StatementNav {
  nav: number;
  date: string;
}

export interface Position {
  /** Unique within a statement: folio id plus the scheme's position in that folio. */
  id: string;
  folioId: string;
  amc: string;
  folioMasked: string;
  name: string;
  isin: string | null;
  units: number;
  lots: Lot[];
  /** Cost of the units still held (FIFO). */
  invested: number;
  /** Cost per unit held, or null when nothing is held. */
  avgCost: number | null;
  /** Proceeds of every sale minus the FIFO cost of the units sold. Not a tax figure. */
  realised: number;
  flows: CashFlow[];
  statementNav: StatementNav | null;
}

export interface Excluded {
  folioId: string;
  amc: string;
  folioMasked: string;
  name: string;
  reason: string;
}

export interface Portfolio {
  open: Position[];
  closed: Position[];
  excluded: Excluded[];
}

// Switches count as a sale and a purchase (they net out in the portfolio XIRR). A payout is cash received; a reinvested
// dividend, a segregation and a gift move units without cash. STT, TDS and unclassified rows carry no cash flow here.
const PAID_IN: ReadonlySet<TransactionType> = new Set(['PURCHASE', 'PURCHASE_SIP', 'SWITCH_IN', 'SWITCH_IN_MERGER', 'STAMP_DUTY_TAX']);
const PAID_OUT: ReadonlySet<TransactionType> = new Set(['REDEMPTION', 'SWITCH_OUT', 'SWITCH_OUT_MERGER', 'DIVIDEND_PAYOUT', 'REVERSAL']);

const cashOf = (t: Transaction): number => (PAID_IN.has(t.type) ? -Math.abs(t.amount ?? 0) : PAID_OUT.has(t.type) ? Math.abs(t.amount ?? 0) : 0);

class IncompleteHistory extends Error {}

function buildPosition(folio: { id: string; amc: string; folioMasked: string }, scheme: Scheme, index: number): Position {
  if (scheme.open > UNIT_EPS) throw new IncompleteHistory('The statement starts with units already held, so their cost is unknown. Upload a statement from the first purchase.');
  const lots: Lot[] = [];
  const flows: CashFlow[] = [];
  let realised = 0;
  let latest: Lot | undefined;

  for (const t of scheme.transactions) {
    const cash = cashOf(t);
    if (cash !== 0) flows.push({ date: t.date, amount: cash });
    if (t.units === null || t.units === 0) {
      // Stamp duty is part of the cost of the purchase it was charged on.
      if (t.type === 'STAMP_DUTY_TAX' && latest) latest.cost += Math.abs(t.amount ?? 0);
      continue;
    }
    if (t.units > 0) {
      latest = { date: t.date, units: t.units, cost: Math.abs(t.amount ?? 0) };
      lots.push(latest);
      continue;
    }
    let toSell = -t.units;
    let costSold = 0;
    while (toSell > UNIT_EPS && lots.length > 0) {
      const lot = lots[0]!;
      const take = Math.min(lot.units, toSell);
      const cost = (lot.cost * take) / lot.units;
      costSold += cost;
      toSell -= take;
      if (take >= lot.units - UNIT_EPS) lots.shift();
      else {
        lot.units -= take;
        lot.cost -= cost;
      }
    }
    if (toSell > UNIT_EPS) throw new IncompleteHistory('Units were sold that the statement never shows being bought.');
    if (cash !== 0) realised += cash - costSold;
  }

  const units = lots.reduce((sum, lot) => sum + lot.units, 0);
  const held = units > UNIT_EPS;
  const invested = held ? lots.reduce((sum, lot) => sum + lot.cost, 0) : 0;
  const { nav, date } = scheme.valuation;
  return {
    id: `${folio.id}:${index}`,
    folioId: folio.id,
    amc: folio.amc,
    folioMasked: folio.folioMasked,
    name: scheme.name,
    isin: scheme.isin,
    units: held ? units : 0,
    lots: held ? lots : [],
    invested,
    avgCost: held ? invested / units : null,
    realised,
    flows,
    statementNav: nav !== null && date !== null ? { nav, date } : null,
  };
}

/** Splits a statement into open positions, closed positions and excluded schemes. */
export function buildPortfolio(statement: Statement): Portfolio {
  const portfolio: Portfolio = { open: [], closed: [], excluded: [] };
  for (const folio of statement.folios) {
    for (const [index, scheme] of folio.schemes.entries()) {
      const who = { folioId: folio.id, amc: folio.amc, folioMasked: folio.folioMasked, name: scheme.name };
      if (!scheme.reconciled) {
        portfolio.excluded.push({ ...who, reason: 'The statement’s unit balances do not add up for this scheme.' });
        continue;
      }
      try {
        const position = buildPosition(folio, scheme, index);
        (position.units > 0 ? portfolio.open : portfolio.closed).push(position);
      } catch (error) {
        if (!(error instanceof IncompleteHistory)) throw error;
        portfolio.excluded.push({ ...who, reason: error.message });
      }
    }
  }
  return portfolio;
}
