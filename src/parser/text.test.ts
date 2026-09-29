import { describe, expect, it } from 'vitest';
import { maskFolio, parseDate, parseNumber, round } from './text';

describe('parseNumber', () => {
  it.each([
    ['5,000.00', 5000],
    ['1,23,456.78', 123456.78],
    ['(1,234.500)', -1234.5],
    ['-12.5', -12.5],
    ['0.000', 0],
    ['  7 ', 7],
  ])('%s -> %s', (raw, expected) => expect(parseNumber(raw)).toBe(expected));

  it.each(['', '   ', 'abc', '1.2.3', '--', '()', null, undefined])('%s is not a number', (raw) => expect(parseNumber(raw as string)).toBeNull());
});

describe('parseDate', () => {
  it.each([
    ['15-Jan-2021', '2021-01-15'],
    ['5-Feb-2021', '2021-02-05'],
    ['15 Jan 2021', '2021-01-15'],
    ['15--Jan--2021', '2021-01-15'],
    ['15Jan2021', '2021-01-15'],
    ['31-DEC-2020', '2020-12-31'],
  ])('%s -> %s', (raw, expected) => expect(parseDate(raw)).toBe(expected));

  it.each(['32-Jan-2021', '00-Jan-2021', '15-Foo-2021', '15-Jan-21', 'Jan 2021', ''])('%s is invalid', (raw) => expect(parseDate(raw)).toBeNull());
});

describe('maskFolio', () => {
  it('keeps only the last four digits of the folio number, ignoring the sub-account suffix', () => {
    expect(maskFolio('12345678901 / 63')).toBe('••••8901');
    expect(maskFolio('99887766')).toBe('••••7766');
    expect(maskFolio('12')).toBe('••••12');
  });
});

describe('round', () => {
  it('rounds to the given places', () => expect(round(1.23456789, 4)).toBe(1.2346));
});
