// The transaction table's number columns, found from the data rather than from the header text.
//
// pdf.js splits the header ("Date Transaction Amount Units Price Unit Balance") into items unpredictably: a real
// statement gave 0 usable headers out of 36. The numbers, though, are right-aligned, so their right edges form tight
// clusters, one per column. Learned from that spike; see CLAUDE.md's failure log.
import type { Line } from './types';
import { parseNumber } from './text';

export const DATE_CELL_RE = /^\s*(\d{1,2}[-\s]*[A-Za-z]{3}[-\s]*\d{4})/;
const NUMBER_CELL_RE = /^\(?-?[\d,]+\.\d+\)?$/;
/** How far (points) a number's right edge may sit from its column's anchor and still belong to it. */
const COLUMN_TOLERANCE = 14;
/** Right edges closer together than this are the same column. */
const CLUSTER_GAP = 3;

export interface Columns {
  amount: number;
  units: number;
  /** Older templates omit the per-row price column. */
  price: number | null;
  balance: number;
}

/** Right-edge anchors of the number columns, or null when no dated row carries numbers (a statement with no
 *  transactions in the period has none, and needs none). */
export function inferColumns(lines: Line[]): Columns | null {
  const edges: number[] = [];
  for (const line of lines) {
    if (!DATE_CELL_RE.test(line.text)) continue;
    for (const seg of line.segs.slice(1)) if (NUMBER_CELL_RE.test(seg.s)) edges.push(seg.x1);
  }
  edges.sort((a, b) => a - b);

  const clusters: { sum: number; n: number; last: number }[] = [];
  for (const x of edges) {
    const cluster = clusters[clusters.length - 1];
    if (cluster && x - cluster.last < CLUSTER_GAP) {
      cluster.sum += x;
      cluster.n++;
      cluster.last = x;
    } else clusters.push({ sum: x, n: 1, last: x });
  }
  const columns = clusters
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
    .sort((a, b) => a.sum / a.n - b.sum / b.n)
    .map((c) => c.sum / c.n);
  if (columns.length === 4) return { amount: columns[0]!, units: columns[1]!, price: columns[2]!, balance: columns[3]! };
  if (columns.length === 3) return { amount: columns[0]!, units: columns[1]!, price: null, balance: columns[2]! };
  return null;
}

export interface Row {
  /** Everything that is not a number cell: the date and the description, in reading order. */
  lead: string;
  amount: number | null;
  units: number | null;
  price: number | null;
  balance: number | null;
}

/** Splits a line into its date/description text and its numeric cells. */
export function splitRow(line: Line, columns: Columns | null): Row {
  const row: Row = { lead: '', amount: null, units: null, price: null, balance: null };
  const lead: string[] = [];
  const anchors = columns ? (Object.entries(columns).filter(([, x]) => x !== null) as [keyof Columns, number][]) : [];
  for (const seg of line.segs) {
    let best: keyof Columns | null = null;
    let bestDistance = Infinity;
    if (NUMBER_CELL_RE.test(seg.s)) {
      for (const [name, x] of anchors) {
        const distance = Math.abs(seg.x1 - x);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = name;
        }
      }
    }
    if (best && bestDistance <= COLUMN_TOLERANCE && row[best] === null) row[best] = parseNumber(seg.s);
    else lead.push(seg.s);
  }
  row.lead = lead.join(' ').trim();
  return row;
}
