// Fetches the NAV history behind the value-over-time chart: every position, closed ones included, because funds sold
// later were held earlier. A fund whose history cannot be had is reported and left out of the chart.
import type { Position } from '../domain/holdings';
import type { PositionHistory } from '../domain/timeline';
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

export interface ChartInputs {
  /** One entry per position that can be drawn. */
  inputs: PositionHistory[];
  /** Drawn from the statement's own NAVs because mfnav.in's history could not be loaded. */
  approximate: { position: Position; reason: string }[];
  /** Not drawn at all: no history and no NAV anywhere on the statement. */
  left: { position: Position; reason: string }[];
}

/**
 * The statement's own NAVs for a position, oldest first, one per date: the NAV on each transaction, the NAV the statement
 * printed for its valuation date, and today's quote when there is one. It is flat between those dates, so it is a rough guide.
 */
export function statementNavs(position: Position, quote?: { date: string; nav: number }): NavPoint[] {
  const byDate = new Map<string, number>();
  for (const p of position.navs) byDate.set(p.date, p.nav);
  if (position.statementNav) byDate.set(position.statementNav.date, position.statementNav.nav);
  if (quote) byDate.set(quote.date, quote.nav);
  return [...byDate].map(([date, nav]) => ({ date, nav })).sort((a, b) => a.date.localeCompare(b.date));
}

/** Combines fetched histories with the statement's own NAVs for the funds whose history is missing. */
export function chartInputs(positions: readonly Position[], histories: Histories, quotes: ReadonlyMap<string, { date: string; nav: number } | null>): ChartInputs {
  const result: ChartInputs = { inputs: [], approximate: [], left: [] };
  const reasons = new Map(histories.missing.map((m) => [m.position.id, m.reason]));
  for (const position of positions.filter((p) => p.steps.length > 0)) {
    const fetched = histories.navs.get(position.id);
    if (fetched) {
      result.inputs.push({ steps: position.steps, navs: fetched });
      continue;
    }
    const reason = reasons.get(position.id) ?? 'Its NAV history was not loaded.';
    const navs = statementNavs(position, quotes.get(position.id) ?? undefined);
    if (navs.length === 0) result.left.push({ position, reason });
    else {
      result.inputs.push({ steps: position.steps, navs });
      result.approximate.push({ position, reason });
    }
  }
  return result;
}
