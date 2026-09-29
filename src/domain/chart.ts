// Geometry for the NAV line chart: points and trade markers scaled into a box. Pure, so it is tested without a browser.
import type { NavPoint } from '../nav';
import type { Trade } from './holdings';

export interface Box {
  width: number;
  height: number;
  /** Space kept free on the left and bottom for axis labels. */
  left: number;
  bottom: number;
  /** Space kept free on the top and right. */
  pad: number;
}

export interface Placed {
  x: number;
  y: number;
}

export interface Marker extends Placed {
  side: Trade['side'];
  date: string;
  nav: number;
}

export interface Plot {
  line: Placed[];
  markers: Marker[];
  min: number;
  max: number;
  from: string;
  to: string;
}

const day = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

/** The NAV in force on `date`: the latest point on or before it, or the first point if the date is earlier. */
function navOn(points: readonly NavPoint[], date: string): NavPoint {
  let found = points[0]!;
  for (const p of points) {
    if (p.date > date) break;
    found = p;
  }
  return found;
}

/** Scales an oldest-first NAV series into `box`, with the trades inside the series' dates as markers. Null for fewer than two points. */
export function plot(points: readonly NavPoint[], trades: readonly Trade[], box: Box): Plot | null {
  if (points.length < 2) return null;
  const from = points[0]!.date;
  const to = points[points.length - 1]!.date;
  const navs = points.map((p) => p.nav);
  const min = Math.min(...navs);
  const max = Math.max(...navs);
  const x0 = day(from);
  const span = Math.max(day(to) - x0, 1);
  const spread = max - min || 1;
  const innerW = box.width - box.left - box.pad;
  const innerH = box.height - box.bottom - box.pad;
  const place = (date: string, nav: number): Placed => ({ x: box.left + ((day(date) - x0) / span) * innerW, y: box.pad + (1 - (nav - min) / spread) * innerH });
  return {
    line: points.map((p) => place(p.date, p.nav)),
    markers: trades.filter((t) => t.date >= from && t.date <= to).map((t) => {
      const at = navOn(points, t.date);
      return { ...place(t.date, at.nav), side: t.side, date: t.date, nav: at.nav };
    }),
    min, max, from, to,
  };
}

/** The first date of a range ending at `today`: "1Y" and "3Y" step back whole years; "ALL" starts at the first trade. */
export function rangeStart(range: '1Y' | '3Y' | 'ALL', today: string, firstTrade: string): string {
  if (range === 'ALL') return firstTrade;
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - (range === '1Y' ? 1 : 3));
  return d.toISOString().slice(0, 10);
}
