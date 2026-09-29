import { describe, expect, it } from 'vitest';
import { parseStatement } from './cams';
import { ParseError } from './errors';
import { buildItems, footer, sampleSpec, schemeLine, type CasSpec } from './testing/fixtures';

const parse = (spec: CasSpec = sampleSpec()) => parseStatement(buildItems(spec));
const schemes = (spec?: CasSpec) => parse(spec).folios.flatMap((f) => f.schemes);

describe('parseStatement: the synthetic statement', () => {
  const statement = parse();

  it('reads the source, period and folio structure', () => {
    expect(statement.source).toBe('CAMS');
    expect(statement.period).toEqual({ from: '2020-04-01', to: '2026-09-17' });
    expect(statement.warnings).toEqual([]);
    expect(statement.folios.map((f) => [f.id, f.amc, f.folioMasked, f.schemes.length])).toEqual([
      ['f1', 'Sample Alpha Mutual Fund', '••••8901', 1],
      ['f2', 'Sample Beta Mutual Fund', '••••7766', 2],
    ]);
  });

  it('reads a single-line scheme header', () => {
    const scheme = statement.folios[0]!.schemes[0]!;
    expect(scheme).toMatchObject({ name: 'Sample Alpha Flexi Cap Fund - Direct Plan - Growth', isin: 'INF000A01AB3', rta: 'CAMS', rtaCode: 'ALPHFG', open: 0, close: 1150.909 });
  });

  it('reads a scheme header whose ISIN wraps onto the next line, and is not fooled by a hyphenated holder name', () => {
    const scheme = statement.folios[1]!.schemes[0]!;
    expect(scheme).toMatchObject({ name: 'Sample Beta Dynamic Bond Fund - Regular Plan - IDCW', isin: 'INF000B01CD7', rtaCode: 'BETADB' });
  });

  it('reads every transaction with its type, numbers and running balance', () => {
    const rows = statement.folios[0]!.schemes[0]!.transactions.map((t) => [t.date, t.type, t.amount, t.units, t.nav, t.balance]);
    expect(rows).toEqual([
      ['2021-01-05', 'PURCHASE', 5000, 100, 50, 100],
      ['2021-02-05', 'PURCHASE_SIP', 5000, 90.909, 55.0001, 190.909],
      ['2021-02-05', 'STAMP_DUTY_TAX', 0.25, null, null, null],
      ['2021-03-15', 'REDEMPTION', -2500, -40, 62.5, 150.909],
      ['2021-03-15', 'STT_TAX', 0.63, null, null, null],
      ['2021-04-20', 'PURCHASE', 123456.5, 1000, 123.4565, 1150.909],
    ]);
  });

  it('merges a wrapped description and classifies on the merged text', () => {
    const sip = statement.folios[0]!.schemes[0]!.transactions[1]!;
    expect(sip.description).toBe('Systematic Investment Purchase Instalment 2/24');
  });

  it('classifies dividends, switches, STP and gifts, and masks the gift counterparty folio', () => {
    const [bond, liquid] = statement.folios[1]!.schemes;
    expect(bond!.transactions.map((t) => [t.type, t.dividendRate])).toEqual([
      ['PURCHASE', null],
      ['DIVIDEND_REINVEST', 0.25],
      ['DIVIDEND_PAYOUT', 0.3],
      ['SWITCH_OUT', null],
    ]);
    expect(liquid!.transactions.map((t) => t.type)).toEqual(['SWITCH_IN', 'SWITCH_IN', 'GIFT_OUT']);
    expect(liquid!.transactions[2]!.giftFolio).toBe('••••2110');
  });

  it("reads the statement's own valuation line", () => {
    expect(statement.folios[0]!.schemes[0]!.valuation).toEqual({ date: '2026-09-17', nav: 70.1234, value: 77138.25, cost: 133956.5 });
  });

  it('reconciles every scheme', () => {
    expect(schemes().every((s) => s.reconciled && s.warnings.length === 0)).toBe(true);
    for (const s of schemes()) expect(s.closeCalculated).toBeCloseTo(s.close!, 6);
  });

  it('masks a folio number inside a description, including one that wraps onto the next line', () => {
    const gift = statement.folios[1]!.schemes[1]!.transactions[2]!;
    expect(gift.description).toBe('Gifting of units-TO Folio No: ••••2110');

    const spec = sampleSpec();
    spec.amcs[1]!.folios[0]!.schemes[1]!.txns[2] = { date: '11-Oct-2021', desc: 'Gifting of units-TO Folio No:', amount: -1000, units: -0.95, price: 1052.6316, wrap: '55443322110' };
    const wrapped = parse(spec).folios[1]!.schemes[1]!.transactions[2]!;
    expect(wrapped).toMatchObject({ type: 'GIFT_OUT', giftFolio: '••••2110', description: 'Gifting of units-TO Folio No: ••••2110' });
    expect(JSON.stringify(parse(spec))).not.toContain('55443322110');
  });

  it('masks payment references in a description, including one that wraps onto the next line', () => {
    const spec = sampleSpec();
    const rows = spec.amcs[0]!.folios[0]!.schemes[0]!.txns;
    rows[0] = { ...rows[0]!, desc: 'Purchase - UPI Ref 402512345678', wrap: 'Bank ref 998877665544' };
    const first = parse(spec).folios[0]!.schemes[0]!.transactions[0]!;
    expect(first.description).toBe('Purchase - UPI Ref ••••5678 Bank ref ••••5544');
    expect(JSON.stringify(parse(spec))).not.toMatch(/402512345678|998877665544/);
  });

  it('never carries personal data', () => {
    const json = JSON.stringify(statement);
    for (const secret of ['ABCDE1234F', 'JANE', 'ANNE-MARIE', 'user@example.com', '9000000000', 'Example Street', 'ARN-12345', '12345678901', '55443322110', '99887766']) {
      expect(json).not.toContain(secret);
    }
    expect(json).not.toMatch(/[A-Z]{5}\d{4}[A-Z]/);
  });
});

describe('parseStatement: layout variations', () => {
  it('gives the same result when the statement is split across many pages', () => {
    expect(parse(sampleSpec({ linesPerPage: 7 }))).toEqual(parse());
  });

  it('drops the overlay duplicate of a date (KFintech)', () => {
    const spec = sampleSpec();
    spec.amcs[0]!.folios[0]!.schemes[0]!.txns[0]!.twin = true;
    expect(parse(spec).folios[0]!.schemes[0]!.transactions[0]!.date).toBe('2021-01-05');
  });

  it('does not need the column header row', () => {
    const spec = sampleSpec();
    for (const amc of spec.amcs) for (const folio of amc.folios) for (const scheme of folio.schemes) scheme.noColumnHeader = true;
    expect(parse(spec)).toEqual(parse());
  });

  it('derives the price when the template omits it', () => {
    const spec = sampleSpec();
    for (const amc of spec.amcs) for (const folio of amc.folios) for (const scheme of folio.schemes) for (const t of scheme.txns) t.noPrice = true;
    const purchase = parse(spec).folios[0]!.schemes[0]!.transactions[0]!;
    expect(purchase.nav).toBe(50);
  });

  it('keeps folios of different AMCs apart even when the folio number is the same', () => {
    const spec = sampleSpec();
    spec.amcs[1]!.folios[0]!.line = 'Folio No: 12345678901 / 63';
    expect(parse(spec).folios.map((f) => f.amc)).toEqual(['Sample Alpha Mutual Fund', 'Sample Beta Mutual Fund']);
  });

  it('reads a scheme with no transactions in the period', () => {
    const spec: CasSpec = {
      amcs: [{ name: 'Sample Alpha Mutual Fund', folios: [{ line: 'Folio No: 1000', schemes: [{ header: [schemeLine('ALPHFG', 'Sample Alpha Flexi Cap Fund', 'INF000A01AB3')], open: 12.5, txns: [], footer: footer(10, 125, 100) }] }] }],
    };
    expect(schemes(spec)[0]).toMatchObject({ open: 12.5, close: 12.5, reconciled: true, transactions: [] });
  });

  it('keeps a marker row that has a balance but no amount, and skips a stray dated footnote', () => {
    const spec = sampleSpec();
    spec.amcs[0]!.folios[0]!.schemes[0]!.txns.splice(1, 0, { date: '10-Jan-2021', desc: '***Registration of Nominee***' }, { date: '10-Jan-2021', desc: 'Effective from 01-Apr-2019 the rates changed' });
    const rows = parse(spec).folios[0]!.schemes[0]!.transactions;
    expect(rows[1]).toMatchObject({ type: 'MISC', description: '***Registration of Nominee***', amount: null, units: null });
    expect(rows).toHaveLength(7);
  });
});

describe('parseStatement: what it refuses', () => {
  const codeOf = (items: ReturnType<typeof buildItems>) => {
    try {
      parseStatement(items);
    } catch (error) {
      return (error as ParseError).code;
    }
    return null;
  };

  it('rejects NSDL and CDSL demat statements and Summary statements with a clear code', () => {
    expect(codeOf(buildItems(sampleSpec({ title: 'NSDL Consolidated Account Statement' })))).toBe('UNSUPPORTED_STATEMENT');
    expect(codeOf(buildItems(sampleSpec({ title: 'Central Depository Services (India) Limited' })))).toBe('UNSUPPORTED_STATEMENT');
    expect(codeOf(buildItems(sampleSpec({ title: 'Consolidated Account Summary' })))).toBe('UNSUPPORTED_STATEMENT');
  });

  it('rejects a document that is not a statement', () => {
    const items = [{ page: 1, str: 'Just a letter about something else', x: 40, y: 700, w: 100 }];
    expect(codeOf(items)).toBe('NOT_A_STATEMENT');
  });

  it('tags the source: KFintech by its marker, unmarked as UNKNOWN (beta)', () => {
    expect(parse(sampleSpec({ marker: 'KFINCASWS' })).source).toBe('KFINTECH');
    expect(parse(sampleSpec({ marker: null })).source).toBe('UNKNOWN');
  });
});
