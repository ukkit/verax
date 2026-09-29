// Values a portfolio: per-position value, gain and XIRR, and portfolio totals. An open position without any NAV is left
// out of the totals and the portfolio XIRR together, so it cannot skew either. Closed positions always count towards
// realised gain and XIRR.
import type { Portfolio, Position } from '../domain/holdings';
import { xirr, type CashFlow } from '../domain/xirr';
import type { PositionQuote, Quote } from './quotes';

export interface ValuedPosition {
  position: Position;
  quote: Quote | null;
  issue: string | null;
  value: number | null;
  gain: number | null;
  /** Gain as a fraction of the amount invested (0.12 = 12%). */
  gainPct: number | null;
  /** Change since the previous NAV, in rupees. Null when the NAV source gave none. */
  dayChange: number | null;
  xirr: number | null;
}

export interface Totals {
  invested: number;
  value: number;
  gain: number;
  returnPct: number | null;
  xirr: number | null;
  dayChange: number;
  realised: number;
  /** Positions that were left out because no NAV was available. */
  unvalued: number;
}

export interface ValuedPortfolio {
  open: ValuedPosition[];
  closed: ValuedPosition[];
  totals: Totals;
}

const atNav = (flows: readonly CashFlow[], quote: Quote, units: number): CashFlow[] => [...flows, { date: quote.date, amount: units * quote.nav }];

function valueOpen(position: Position, { quote, issue }: PositionQuote): ValuedPosition {
  if (!quote) return { position, quote, issue, value: null, gain: null, gainPct: null, dayChange: null, xirr: null };
  const value = position.units * quote.nav;
  const pct = quote.dayChangePct;
  return {
    position, quote, issue, value,
    gain: value - position.invested,
    gainPct: position.invested > 0 ? (value - position.invested) / position.invested : null,
    dayChange: pct === null ? null : value - value / (1 + pct / 100),
    xirr: xirr(atNav(position.flows, quote, position.units)),
  };
}

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

export function valuePortfolio(portfolio: Portfolio, quotes: ReadonlyMap<string, PositionQuote>): ValuedPortfolio {
  const open = portfolio.open.map((p) => valueOpen(p, quotes.get(p.id) ?? { quote: null, issue: 'No NAV was looked up for this scheme.' }));
  const closed = portfolio.closed.map((position): ValuedPosition => ({
    position, quote: null, issue: null, value: 0, gain: position.realised, gainPct: null, dayChange: null, xirr: xirr(position.flows),
  }));

  const valued = open.filter((v) => v.value !== null);
  const invested = sum(valued.map((v) => v.position.invested));
  const value = sum(valued.map((v) => v.value!));
  const flows = [...valued.flatMap((v) => atNav(v.position.flows, v.quote!, v.position.units)), ...closed.flatMap((v) => v.position.flows)];
  return {
    open, closed,
    totals: {
      invested, value, gain: value - invested,
      returnPct: invested > 0 ? (value - invested) / invested : null,
      xirr: xirr(flows),
      dayChange: sum(valued.map((v) => v.dayChange ?? 0)),
      realised: sum([...open, ...closed].map((v) => v.position.realised)),
      unvalued: open.length - valued.length,
    },
  };
}
