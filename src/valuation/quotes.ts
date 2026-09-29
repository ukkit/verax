// Finds a current NAV for each open position: a manual scheme-code override first, then the ISIN, and the statement's
// own NAV when neither works. A failure is reported on the position (what failed, what to do) and never hides the rest.
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
}

export interface PositionQuote {
  quote: Quote | null;
  /** Why the live NAV could not be used, or null when it was. */
  issue: string | null;
}

/** Manual scheme codes typed by the user, by position id. */
export type Overrides = ReadonlyMap<string, number>;

async function live(position: Position, source: NavSource, overrides: Overrides): Promise<Quote> {
  const code = overrides.get(position.id) ?? (position.isin ? await source.schemeCode(position.isin) : null);
  if (code === null) throw new NavError(position.isin ? 'mfnav.in has no single fund for this ISIN.' : 'The statement gives no ISIN for this scheme.', 404);
  const fund = await source.fund(code);
  if (fund.latest_nav === undefined || !fund.latest_nav_date) throw new NavError('mfnav.in has no NAV for this fund yet.', 404);
  return { nav: fund.latest_nav, date: fund.latest_nav_date, dayChangePct: fund.latest_day_change_pct ?? null, from: 'mfnav' };
}

export async function fetchQuotes(positions: readonly Position[], source: NavSource, overrides: Overrides = new Map()): Promise<Map<string, PositionQuote>> {
  const pairs = await mapLimit(positions, CONCURRENCY, async (position): Promise<[string, PositionQuote]> => {
    try {
      return [position.id, { quote: await live(position, source, overrides), issue: null }];
    } catch (error) {
      if (!(error instanceof NavError)) throw error;
      if (error.status !== 404) console.error('nav_lookup_failed', { status: error.status });
      const fallback = position.statementNav;
      const advice = fallback ? 'Valued at the NAV printed on your statement. Enter a scheme code to fix this.' : 'Not valued. Enter a scheme code to fix this.';
      return [position.id, { quote: fallback && { ...fallback, dayChangePct: null, from: 'statement' }, issue: `${error.message} ${advice}` }];
    }
  });
  return new Map(pairs);
}
