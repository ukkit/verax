import { describe, expect, it } from 'vitest';
import { formatDate, formatPercent, formatRupees, formatSignedRupees, formatUnits, trend } from './format';

describe('formatting', () => {
  it('groups digits the Indian way', () => {
    expect(formatRupees(1234567.5)).toBe('₹12,34,567.50');
    expect(formatUnits(1234567.891)).toBe('12,34,567.891');
    expect(formatUnits(0)).toBe('0.000');
  });

  it('formats an ISO date without shifting it across a time zone boundary', () => {
    expect(formatDate('2026-09-17')).toMatch(/^17 Sep/);
    expect(formatDate('2026-01-01')).toMatch(/^1 Jan 2026$/);
    expect(formatDate('2026-12-31')).toMatch(/^31 Dec 2026$/);
  });

  it('signs gains and percentages', () => {
    expect(formatSignedRupees(1234.5)).toBe('+₹1,234.50');
    expect(formatSignedRupees(-99)).toBe('-₹99.00');
    expect(formatPercent(0.1234)).toBe('+12.34%');
    expect(formatPercent(-0.05)).toBe('-5.00%');
  });

  it('colours by direction', () => {
    expect([trend(1), trend(-1), trend(0)]).toEqual(['chg up', 'chg down', 'chg']);
  });
});
