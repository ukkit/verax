// Finds a current NAV for each open position from its ISIN, and uses the statement's own NAV when that fails. A failure is
// reported on the position (what failed and what it was valued at) and never hides the rest.
import type { Position } from '../domain/holdings';
import { NavError } from '../nav';
import type { NavSource } from './navSource';
import { mapLimit } from './pool';

/** The client fetches NAVs with at most this many requests in flight (see CLAUDE.md, Performance). */
export const CONCURRENCY = 4;

export interface Quote {
  nav: number;
  /** ISO date of the NAV. */
  date: string;
  dayChangePct: number | null;
  from: 'mfnav' | 'statement';
  /** The mfnav.in scheme code the NAV came from; null for a statement NAV. */
  schemeCode: number | null;
}

export interface PositionQuote {
  quote: Quote | null;
  /** Why the live NAV could not be used, or null when it was. */
  issue: string | null;
}

async function live(position: Position, source: NavSource): Promise<Quote> {
  const code = position.isin ? await source.schemeCode(position.isin) : null;
  if (code === null) throw new NavError(position.isin ? 'mfnav.in has no single fund for this ISIN.' : 'The statement gives no ISIN for this scheme.', 404);
  const fund = await source.fund(code);
  if (fund.latest_nav === undefined || !fund.latest_nav_date) throw new NavError('mfnav.in has no NAV for this fund yet.', 404);
  return { nav: fund.latest_nav, date: fund.latest_nav_date, dayChangePct: fund.latest_day_change_pct ?? null, from: 'mfnav', schemeCode: code };
}

export async function fetchQuotes(positions: readonly Position[], source: NavSource): Promise<Map<string, PositionQuote>> {
  const pairs = await mapLimit(positions, CONCURRENCY, async (position): Promise<[string, PositionQuote]> => {
    try {
      return [position.id, { quote: await live(position, source), issue: null }];
    } catch (error) {
      if (!(error instanceof NavError)) throw error;
      if (error.status !== 404) console.error('nav_lookup_failed', { status: error.status });
      const fallback = position.statementNav;
      const advice = fallback ? 'Valued at the NAV printed on your statement.' : 'Not valued.';
      return [position.id, { quote: fallback && { ...fallback, dayChangePct: null, from: 'statement', schemeCode: null }, issue: `${error.message} ${advice}` }];
    }
  });
  return new Map(pairs);
}
