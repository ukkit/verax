// From pdf.js text items to lines of segments.
import type { Line, TextItem } from './types';

/** Some statements draw the same text twice, ~1pt apart vertically (KFintech's "date twin"), which would otherwise
 *  read back as "22002200". Drops the second copy. */
export function dropOverlayDuplicates(items: TextItem[]): TextItem[] {
  const seen = new Map<string, number[]>();
  const kept: TextItem[] = [];
  for (const item of items) {
    const key = `${item.page}|${item.str}|${Math.round(item.x)}`;
    const ys = seen.get(key) ?? [];
    if (ys.some((y) => Math.abs(y - item.y) < 1.2)) continue;
    ys.push(item.y);
    seen.set(key, ys);
    kept.push(item);
  }
  return kept;
}

const SAME_LINE_TOLERANCE = 2;
/** Adjacent items closer than this (points) belong to one word or number. */
const MERGE_GAP = 2.5;
const SPACE_GAP = 0.8;

/** Groups items into lines top to bottom, page by page, and merges touching items into segments. */
export function toLines(items: TextItem[]): Line[] {
  const sorted = [...items].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const groups: TextItem[][] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && last[0]!.page === item.page && Math.abs(last[0]!.y - item.y) <= SAME_LINE_TOLERANCE) last.push(item);
    else groups.push([item]);
  }
  return groups.map((group) => {
    group.sort((a, b) => a.x - b.x);
    const segs: Line['segs'] = [];
    for (const item of group) {
      const prev = segs[segs.length - 1];
      if (prev && item.x - prev.x1 < MERGE_GAP) {
        prev.s += (item.x - prev.x1 > SPACE_GAP ? ' ' : '') + item.str;
        prev.x1 = item.x + item.w;
      } else segs.push({ s: item.str, x0: item.x, x1: item.x + item.w });
    }
    return { page: group[0]!.page, y: group[0]!.y, segs, text: segs.map((s) => s.s).join(' ') };
  });
}
