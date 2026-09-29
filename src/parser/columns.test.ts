import { describe, expect, it } from 'vitest';
import { inferColumns, splitRow } from './columns';
import { toLines } from './layout';
import { buildItems, COLUMN_EDGES, sampleSpec } from './testing/fixtures';

const lines = toLines(buildItems(sampleSpec()));

describe('inferColumns', () => {
  it('finds the four number columns from where the numbers actually sit', () => {
    const columns = inferColumns(lines)!;
    for (const name of ['amount', 'units', 'price', 'balance'] as const) expect(columns[name]).toBeCloseTo(COLUMN_EDGES[name], 0);
  });

  it('finds three columns when the price column is absent', () => {
    const spec = sampleSpec();
    for (const amc of spec.amcs) for (const folio of amc.folios) for (const scheme of folio.schemes) for (const t of scheme.txns) t.noPrice = true;
    const columns = inferColumns(toLines(buildItems(spec)))!;
    expect(columns.price).toBeNull();
    expect(columns.balance).toBeCloseTo(COLUMN_EDGES.balance, 0);
  });

  it('is null when no dated row carries numbers', () => {
    expect(inferColumns(toLines([{ page: 1, str: 'No transactions here', x: 40, y: 700, w: 80 }]))).toBeNull();
  });
});

describe('splitRow', () => {
  const columns = inferColumns(lines)!;
  const rowOf = (text: string) => splitRow(lines.find((l) => l.text.startsWith(text))!, columns);

  it('puts a lone amount, such as stamp duty, in the amount column and not the balance', () => {
    expect(rowOf('05-Feb-2021 *** Stamp')).toMatchObject({ amount: 0.25, units: null, price: null, balance: null });
  });

  it('reads all four cells of a full row and leaves the date and description as lead text', () => {
    expect(rowOf('05-Jan-2021 Purchase')).toMatchObject({ lead: '05-Jan-2021 Purchase', amount: 5000, units: 100, price: 50, balance: 100 });
  });

  it('reads a negative number in parentheses', () => {
    expect(rowOf('15-Mar-2021 Redemption')).toMatchObject({ amount: -2500, units: -40 });
  });

  it('leaves numbers that are not under a column in the description', () => {
    const row = rowOf('30-Jun-2021 IDCW Reinvestment');
    expect(row.lead).toContain('@ Rs. 0.25 per unit');
    expect(row.units).toBe(6.25);
  });
});
