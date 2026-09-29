import { describe, expect, it } from 'vitest';
import { xirr } from './xirr';

describe('xirr', () => {
  it('gives the simple return for a single year', () => {
    // 2024 has 366 days, so the exponent is 366/365 and the rate is a hair under 10%.
    expect(xirr([{ date: '2024-01-01', amount: -1000 }, { date: '2025-01-01', amount: 1100 }])).toBeCloseTo(1.1 ** (365 / 366) - 1, 8);
  });

  it('matches the Excel XIRR example', () => {
    const flows = [
      { date: '2008-01-01', amount: -10000 },
      { date: '2008-03-01', amount: 2750 },
      { date: '2008-10-30', amount: 4250 },
      { date: '2009-02-15', amount: 3250 },
      { date: '2009-04-01', amount: 2750 },
    ];
    expect(xirr(flows)).toBeCloseTo(0.373362535, 6);
  });

  it('handles a loss', () => {
    expect(xirr([{ date: '2024-01-01', amount: -1000 }, { date: '2025-01-01', amount: 900 }])).toBeCloseTo(-0.1, 2);
  });

  it('is order independent', () => {
    const a = { date: '2024-01-01', amount: -500 };
    const b = { date: '2024-07-01', amount: -500 };
    const c = { date: '2025-01-01', amount: 1200 };
    expect(xirr([c, a, b])).toBeCloseTo(xirr([a, b, c])!, 9);
  });

  it('solves a very high rate', () => {
    // 1.5x in 30 days is about 13,900% a year.
    expect(xirr([{ date: '2024-01-01', amount: -1000 }, { date: '2024-01-31', amount: 1500 }])).toBeCloseTo(1.5 ** (365 / 30) - 1, 3);
  });

  it('returns null when the rate is beyond the search range', () => {
    expect(xirr([{ date: '2024-01-01', amount: -1000 }, { date: '2024-01-31', amount: 3000 }])).toBeNull();
  });

  it('returns null without both an outflow and an inflow', () => {
    expect(xirr([{ date: '2024-01-01', amount: -1000 }])).toBeNull();
    expect(xirr([{ date: '2024-01-01', amount: 1000 }, { date: '2024-02-01', amount: 5 }])).toBeNull();
    expect(xirr([])).toBeNull();
  });
});
