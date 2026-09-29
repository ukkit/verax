import { describe, expect, it } from 'vitest';
import { dropOverlayDuplicates, toLines } from './layout';
import type { TextItem } from './types';

const item = (str: string, x: number, y: number, page = 1, w = str.length * 4.4): TextItem => ({ page, str, x, y, w });

describe('dropOverlayDuplicates', () => {
  it('drops the second copy of text drawn twice about a point apart', () => {
    expect(dropOverlayDuplicates([item('15-Jan-2021', 40, 700), item('15-Jan-2021', 40, 700.7)])).toHaveLength(1);
  });

  it('keeps identical text on different lines, in different columns, or on different pages', () => {
    expect(dropOverlayDuplicates([item('0.000', 400, 700), item('0.000', 400, 689)])).toHaveLength(2);
    expect(dropOverlayDuplicates([item('0.000', 400, 700), item('0.000', 460, 700)])).toHaveLength(2);
    expect(dropOverlayDuplicates([item('0.000', 400, 700, 1), item('0.000', 400, 700, 2)])).toHaveLength(2);
  });
});

describe('toLines', () => {
  it('orders lines top to bottom within each page, and pages in order', () => {
    const lines = toLines([item('low', 40, 100), item('high', 40, 700), item('next page', 40, 700, 2)]);
    expect(lines.map((l) => l.text)).toEqual(['high', 'low', 'next page']);
  });

  it('puts items with slightly different baselines on one line, left to right', () => {
    const lines = toLines([item('Amount', 300, 500.8), item('Date', 40, 500)]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.text).toBe('Date Amount');
  });

  it('merges touching items into one segment and keeps separated ones apart', () => {
    const lines = toLines([item('5,00', 100, 500, 1, 17.8), item('0.00', 117.9, 500, 1, 17.8), item('Units', 300, 500)]);
    expect(lines[0]!.segs.map((s) => s.s)).toEqual(['5,000.00', 'Units']);
  });
});
