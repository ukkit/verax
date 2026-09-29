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

export interface LinePoint {
  date: string;
  value: number;
}

export interface Lines {
  lines: Placed[][];
  /** The top of the y axis; the bottom is always 0. */
  max: number;
  from: string;
  to: string;
}

/** Scales several series that share the same dates onto one 0-to-max axis. Null when there are fewer than two dates or nothing above zero. */
export function plotLines(series: readonly (readonly LinePoint[])[], box: Box): Lines | null {
  const first = series[0];
  if (!first || first.length < 2) return null;
  const max = Math.max(...series.flatMap((s) => s.map((p) => p.value)));
  if (!(max > 0)) return null;
  const from = first[0]!.date;
  const to = first[first.length - 1]!.date;
  const x0 = day(from);
  const span = Math.max(day(to) - x0, 1);
  const innerW = box.width - box.left - box.pad;
  const innerH = box.height - box.bottom - box.pad;
  return {
    lines: series.map((s) => s.map((p) => ({ x: box.left + ((day(p.date) - x0) / span) * innerW, y: box.pad + (1 - p.value / max) * innerH }))),
    max, from, to,
  };
}

/** Year labels for the x axis: each 1 January inside (from, to), thinned to at most `most`. */
export function yearTicks(from: string, to: string, box: Box, most = 8): { label: string; x: number }[] {
  const x0 = day(from);
  const span = Math.max(day(to) - x0, 1);
  const years: number[] = [];
  for (let y = Number(from.slice(0, 4)) + 1; `${y}-01-01` < to; y++) years.push(y);
  const every = Math.max(1, Math.ceil(years.length / most));
  return years
    .filter((_, i) => i % every === 0)
    .map((y) => ({ label: String(y), x: box.left + ((day(`${y}-01-01`) - x0) / span) * (box.width - box.left - box.pad) }));
}
