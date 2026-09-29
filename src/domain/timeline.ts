// Portfolio value over time: what was invested and what it was worth, from each position's history of units held and cost
// and each fund's NAV history. Pure; the NAV history is fetched elsewhere.
import type { NavPoint } from '../nav';
import type { Step } from './holdings';

export interface TimelinePoint {
  date: string;
  /** Cost of the units held on that date. */
  invested: number;
  /** Those units at the NAV in force on that date. */
  value: number;
}

export interface PositionHistory {
  steps: readonly Step[];
  /** Oldest first. */
  navs: readonly NavPoint[];
}

/** The last item dated on or before `date` in a list sorted by date, or undefined. */
export function atOrBefore<T extends { date: string }>(sorted: readonly T[], date: string): T | undefined {
  let lo = 0;
  let hi = sorted.length - 1;
  let found: T | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]!.date <= date) {
      found = sorted[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** `from`, then the last day of every month in between, then `to`. */
export function sampleDates(from: string, to: string): string[] {
  const dates = [from];
  const start = new Date(`${from}T00:00:00Z`);
  for (let month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)); ; month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 2, 0))) {
    const iso = month.toISOString().slice(0, 10);
    if (iso >= to) break;
    if (iso > from) dates.push(iso);
  }
  if (to > from) dates.push(to);
  return dates;
}

/** Totals across positions on each date. A date before a NAV history begins uses the history's first NAV. */
export function timeline(positions: readonly PositionHistory[], dates: readonly string[]): TimelinePoint[] {
  return dates.map((date) => {
    let invested = 0;
    let value = 0;
    for (const { steps, navs } of positions) {
      const held = atOrBefore(steps, date);
      if (!held || held.units === 0) continue;
      const nav = (atOrBefore(navs, date) ?? navs[0])?.nav;
      if (nav === undefined) continue;
      invested += held.cost;
      value += held.units * nav;
    }
    return { date, invested, value };
  });
}
