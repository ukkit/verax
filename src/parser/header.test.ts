import { describe, expect, it } from 'vitest';
import { cleanSchemeName, hasSchemeHeader, isTransactionHeaderLine, readSchemeHeader } from './header';

const single = 'ALPHFG-Sample Alpha Flexi Cap Fund - Direct Plan - Growth - ISIN: INF000A01AB3(Advisor: DIRECT) Registrar : CAMS';

describe('readSchemeHeader', () => {
  it('reads a header on one line', () => {
    expect(readSchemeHeader([single])).toEqual({ name: 'Sample Alpha Flexi Cap Fund - Direct Plan - Growth', isin: 'INF000A01AB3', rta: 'CAMS', rtaCode: 'ALPHFG' });
  });

  it('reads a header wrapped over several lines, with the advisor code on its own line', () => {
    const region = ['BETADB-Sample Beta Dynamic Bond Fund - Regular Plan - IDCW - ISIN: INF000B01CD7(Advisor:', 'Registrar : CAMS', 'ARN-28283)'];
    expect(readSchemeHeader(region)).toMatchObject({ name: 'Sample Beta Dynamic Bond Fund - Regular Plan - IDCW', isin: 'INF000B01CD7', rta: 'CAMS' });
  });

  it('finds a complete ISIN when the labelled value wrapped behind the Registrar label and arrived truncated', () => {
    const region = ['GAMMA-Sample Gamma Equity Fund - ISIN: INF769K', 'Registrar : KFINTECH INF769K01AB2'];
    expect(readSchemeHeader(region)).toMatchObject({ isin: 'INF769K01AB2', rta: 'KFINTECH' });
  });

  it('reports no ISIN when the statement prints none', () => {
    expect(readSchemeHeader(['DELTA-Sample Delta Fund Registrar : CAMS'])?.isin).toBeNull();
  });

  it('accepts a scheme code with spaces and ignores load and disclaimer lines around it', () => {
    const region = ['Entry Load - NIL', '127 CPGPG-Sample Gamma Fund - ISIN: INF000C01AB9 Registrar : CAMS', '01-Jan-1990 Some note'];
    expect(readSchemeHeader(region)).toMatchObject({ rtaCode: '127 CPGPG', name: 'Sample Gamma Fund' });
  });

  it('does not take a hyphenated investor name for the scheme line', () => {
    const region = ['ANNE-MARIE SAMPLE', single];
    expect(readSchemeHeader(region)?.rtaCode).toBe('ALPHFG');
  });

  it('does not take an advisor code that wrapped onto its own line for a scheme code', () => {
    const region = ['ARN-28283)', single];
    expect(readSchemeHeader(region)?.rtaCode).toBe('ALPHFG');
  });

  it('is null for a region with no scheme, or with a hyphenated word but no Registrar label', () => {
    expect(readSchemeHeader(['Some disclaimer text', 'Entry Load - NIL'])).toBeNull();
    expect(readSchemeHeader(['NOTE-this is a footnote about something'])).toBeNull();
    expect(hasSchemeHeader(['NOTE-this is a footnote about something'])).toBe(false);
    expect(hasSchemeHeader([single])).toBe(true);
  });
});

describe('cleanSchemeName', () => {
  it('drops "formerly" and "Demat" trailers and trailing punctuation', () => {
    expect(cleanSchemeName('Sample Fund (formerly Old Name Fund) - Growth -')).toBe('Sample Fund - Growth');
    expect(cleanSchemeName('Sample Fund (Demat Only)')).toBe('Sample Fund');
    expect(cleanSchemeName('  Sample   Fund  ')).toBe('Sample Fund');
  });
});

describe('isTransactionHeaderLine', () => {
  it('recognises the table header but not ordinary text', () => {
    expect(isTransactionHeaderLine('Date Transaction Amount Units Price Unit')).toBe(true);
    expect(isTransactionHeaderLine('Unit Balance')).toBe(false);
    expect(isTransactionHeaderLine('Purchase of units')).toBe(false);
  });
});
