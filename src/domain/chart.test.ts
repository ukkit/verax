import { describe, expect, it } from 'vitest';
import { plot, plotLines, rangeStart, yearTicks, type Box } from './chart';

const box: Box = { width: 110, height: 60, left: 10, bottom: 10, pad: 0 };
const points = [{ date: '2024-01-01', nav: 10 }, { date: '2024-01-11', nav: 20 }, { date: '2024-01-21', nav: 15 }];

describe('plot', () => {
  it('scales dates across the width and NAVs up the height', () => {
    const p = plot(points, [], box)!;
    expect(p.line[0]).toEqual({ x: 10, y: 50 });
    expect(p.line[1]).toEqual({ x: 60, y: 0 });
    expect(p.line[2]).toEqual({ x: 110, y: 25 });
    expect([p.min, p.max, p.from, p.to]).toEqual([10, 20, '2024-01-01', '2024-01-21']);
  });

  it('puts a trade on the NAV in force that day, and drops trades outside the series', () => {
    const p = plot(points, [{ date: '2024-01-15', side: 'buy' }, { date: '2023-12-01', side: 'sell' }, { date: '2024-02-01', side: 'sell' }], box)!;
    expect(p.markers).toEqual([{ x: 80, y: 0, side: 'buy', date: '2024-01-15', nav: 20 }]);
  });

  it('copes with a flat series and refuses fewer than two points', () => {
    expect(plot([{ date: '2024-01-01', nav: 5 }, { date: '2024-01-02', nav: 5 }], [], box)!.line.every((q) => Number.isFinite(q.y))).toBe(true);
    expect(plot([points[0]!], [], box)).toBeNull();
  });
});

describe('rangeStart', () => {
  it('steps back whole years or starts at the first trade', () => {
    expect(rangeStart('1Y', '2026-09-29', '2020-04-01')).toBe('2025-09-29');
    expect(rangeStart('3Y', '2026-09-29', '2020-04-01')).toBe('2023-09-29');
    expect(rangeStart('ALL', '2026-09-29', '2020-04-01')).toBe('2020-04-01');
  });
});

describe('plotLines', () => {
  const invested = [{ date: '2024-01-01', value: 50 }, { date: '2024-01-21', value: 100 }];
  const value = [{ date: '2024-01-01', value: 50 }, { date: '2024-01-21', value: 200 }];

  it('puts every series on one axis from zero to the highest value', () => {
    const p = plotLines([invested, value], box)!;
    expect(p.max).toBe(200);
    expect(p.lines[0]).toEqual([{ x: 10, y: 37.5 }, { x: 110, y: 25 }]);
    expect(p.lines[1]).toEqual([{ x: 10, y: 37.5 }, { x: 110, y: 0 }]);
    expect([p.from, p.to]).toEqual(['2024-01-01', '2024-01-21']);
  });

  it('refuses a single date and an all-zero portfolio', () => {
    expect(plotLines([[invested[0]!]], box)).toBeNull();
    expect(plotLines([[{ date: '2024-01-01', value: 0 }, { date: '2024-02-01', value: 0 }]], box)).toBeNull();
    expect(plotLines([], box)).toBeNull();
  });
});

describe('yearTicks', () => {
  const wide: Box = { width: 1000, height: 100, left: 0, bottom: 0, pad: 0 };

  it('labels each 1 January inside the range', () => {
    expect(yearTicks('2022-07-01', '2025-03-01', wide).map((t) => t.label)).toEqual(['2023', '2024', '2025']);
  });

  it('thins a long range and labels none for a short one', () => {
    expect(yearTicks('2000-01-01', '2026-06-01', wide, 8).length).toBeLessThanOrEqual(8);
    expect(yearTicks('2024-02-01', '2024-11-01', wide)).toEqual([]);
  });

  it('places a tick by its date', () => {
    const [tick] = yearTicks('2023-01-01', '2025-01-01', { ...wide, width: 731 }, 8);
    expect(tick!.label).toBe('2024');
    expect(tick!.x).toBeCloseTo(365, 0);
  });
});
