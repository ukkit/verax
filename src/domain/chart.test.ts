import { describe, expect, it } from 'vitest';
import { plot, rangeStart, type Box } from './chart';

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
