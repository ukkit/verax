// Fetches the NAV history behind the value-over-time chart: every position, closed ones included, because funds sold
// later were held earlier. A fund whose history cannot be had is reported and left out of the chart.
import type { Position } from '../domain/holdings';
import { NavError, type NavPoint } from '../nav';
import { history } from './history';
import type { NavSource } from './navSource';
import { mapLimit } from './pool';
import { CONCURRENCY } from './quotes';

export interface Histories {
  navs: Map<string, NavPoint[]>;
  missing: { position: Position; reason: string }[];
}

/** A week before a position's first transaction, so the NAV in force on that day is included. */
const startFor = (position: Position): string => {
  const d = new Date(`${position.steps[0]!.date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
};

/**
 * NAV history for each position with `steps`. `codes` holds scheme codes already known (from the live lookup or a manual
 * override); the rest are found from the ISIN. Unexpected errors propagate; a fund that cannot be fetched is `missing`.
 */
export async function fetchHistories(
  positions: readonly Position[],
  codes: ReadonlyMap<string, number>,
  source: NavSource,
  onProgress: (done: number, total: number) => void = () => {},
  load: (code: number, start: string) => Promise<NavPoint[]> = history,
): Promise<Histories> {
  const result: Histories = { navs: new Map(), missing: [] };
  const held = positions.filter((p) => p.steps.length > 0);
  let done = 0;
  await mapLimit(held, CONCURRENCY, async (position) => {
    try {
      const code = codes.get(position.id) ?? (position.isin ? await source.schemeCode(position.isin) : null);
      if (code === null) throw new NavError(position.isin ? 'mfnav.in has no single fund for this ISIN.' : 'The statement gives no ISIN for this scheme.', 404);
      result.navs.set(position.id, await load(code, startFor(position)));
    } catch (error) {
      if (!(error instanceof NavError)) throw error;
      if (error.status !== 404) console.error('history_lookup_failed', { status: error.status });
      result.missing.push({ position, reason: error.message });
    }
    onProgress(++done, held.length);
  });
  return result;
}
