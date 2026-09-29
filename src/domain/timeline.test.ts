import { describe, expect, it } from 'vitest';
import { atOrBefore, sampleDates, timeline } from './timeline';

describe('atOrBefore', () => {
  const items = [{ date: '2024-01-01', n: 1 }, { date: '2024-01-05', n: 2 }, { date: '2024-01-09', n: 3 }];
  it('finds the last item on or before a date', () => {
    expect(atOrBefore(items, '2024-01-05')?.n).toBe(2);
    expect(atOrBefore(items, '2024-01-08')?.n).toBe(2);
    expect(atOrBefore(items, '2030-01-01')?.n).toBe(3);
    expect(atOrBefore(items, '2023-12-31')).toBeUndefined();
    expect(atOrBefore([], '2024-01-01')).toBeUndefined();
  });
});

describe('sampleDates', () => {
  it('runs from the first date through each month end to the last date', () => {
    expect(sampleDates('2024-01-15', '2024-04-10')).toEqual(['2024-01-15', '2024-01-31', '2024-02-29', '2024-03-31', '2024-04-10']);
  });
  it('does not repeat a month end that is the first or last date', () => {
    expect(sampleDates('2024-01-31', '2024-02-29')).toEqual(['2024-01-31', '2024-02-29']);
  });
  it('is just the one date when the range is empty', () => {
    expect(sampleDates('2024-01-15', '2024-01-15')).toEqual(['2024-01-15']);
  });
  it('crosses a year end', () => {
    expect(sampleDates('2023-11-20', '2024-01-05')).toEqual(['2023-11-20', '2023-11-30', '2023-12-31', '2024-01-05']);
  });
});

describe('timeline', () => {
  const navs = [{ date: '2024-01-01', nav: 10 }, { date: '2024-02-01', nav: 20 }, { date: '2024-03-01', nav: 30 }];
  // 10 units for 100 on 1 Jan, 5 more for 90 on 15 Feb, then all 15 sold on 20 Feb.
  const steps = [{ date: '2024-01-01', units: 10, cost: 100 }, { date: '2024-02-15', units: 15, cost: 190 }, { date: '2024-02-20', units: 0, cost: 0 }];

  it('values the units held at the NAV in force on each date', () => {
    const points = timeline([{ steps, navs }], ['2024-01-01', '2024-01-31', '2024-02-16', '2024-02-29']);
    expect(points).toEqual([
      { date: '2024-01-01', invested: 100, value: 100 },
      { date: '2024-01-31', invested: 100, value: 100 },
      { date: '2024-02-16', invested: 190, value: 300 },
      { date: '2024-02-29', invested: 0, value: 0 },
    ]);
  });

  it('adds positions together and ignores dates before a position began', () => {
    const other = { steps: [{ date: '2024-02-01', units: 2, cost: 30 }], navs };
    const points = timeline([{ steps, navs }, other], ['2024-01-15', '2024-02-16']);
    expect(points[0]).toEqual({ date: '2024-01-15', invested: 100, value: 100 });
    expect(points[1]).toEqual({ date: '2024-02-16', invested: 220, value: 340 });
  });

  it('uses the first NAV when a date falls before the NAV history starts', () => {
    const late = [{ date: '2024-01-10', nav: 12 }];
    expect(timeline([{ steps: [{ date: '2024-01-05', units: 1, cost: 11 }], navs: late }], ['2024-01-06'])[0]).toEqual({ date: '2024-01-06', invested: 11, value: 12 });
  });

  it('skips a position with no NAV history at all', () => {
    expect(timeline([{ steps, navs: [] }], ['2024-01-15'])).toEqual([{ date: '2024-01-15', invested: 0, value: 0 }]);
  });
});
