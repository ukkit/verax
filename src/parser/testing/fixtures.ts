// Builds synthetic statements as pdf.js text items, in CAMS-style geometry. Every name, folio, PAN and amount here is
// invented. Test-only: nothing in the app imports this module.
import type { TextItem } from '../types';

export const COLUMN_EDGES = { amount: 373, units: 430, price: 489, balance: 567 };
const DATE_X = 40;
const DESC_X = 100;
const LINE_STEP = 11;
/** Wrapped description lines sit closer than ordinary lines. */
const WRAP_STEP = 9;
const TOP = 800;
const BOTTOM = 60;

/** Approximate Helvetica metrics at 8pt, used for both right-alignment and the generated PDF. */
export const textWidth = (s: string): number =>
  [...s].reduce((w, c) => w + (/[0-9]/.test(c) ? 4.448 : /[.,]/.test(c) ? 2.224 : /[()]/.test(c) ? 2.664 : c === ' ' ? 2.224 : 4.6), 0);

export interface TxnSpec {
  date: string;
  desc: string;
  amount?: number | null;
  units?: number | null;
  price?: number | null;
  /** Printed running balance. Filled in from the units when omitted. */
  balance?: number | null;
  /** A second line of description directly under the row. */
  wrap?: string;
  /** Print the date twice ~0.7pt apart (KFintech's overlay). */
  twin?: boolean;
  /** Skip the price column (older templates). */
  noPrice?: boolean;
}

export interface SchemeSpec {
  /** Lines between the folio/holder lines and the column header, e.g. the wrapped scheme header. */
  header: string[];
  open?: number;
  txns: TxnSpec[];
  /** Printed closing balance. Filled in from the rows when omitted. */
  close?: number;
  footer?: string[];
  /** Skip the column header block. */
  noColumnHeader?: boolean;
}

export interface FolioSpec {
  line: string;
  /** Printed on the line after the folio. */
  holder?: string;
  schemes: SchemeSpec[];
}

export interface CasSpec {
  marker?: string | null;
  title?: string;
  period?: [string, string];
  investor?: string[];
  amcs: { name: string; folios: FolioSpec[] }[];
  linesPerPage?: number;
}

const fmt = (n: number, places: number): string => {
  const [int, frac] = Math.abs(n).toFixed(places).split('.');
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '(' : ''}${grouped}${frac ? `.${frac}` : ''}${n < 0 ? ')' : ''}`;
};

export function buildItems(spec: CasSpec): TextItem[] {
  const items: TextItem[] = [];
  const period = spec.period ?? ['01-Apr-2020', '17-Sep-2026'];
  const perPage = spec.linesPerPage ?? 1000;
  let page = 1;
  let y = TOP;
  let linesOnPage = 0;

  const put = (str: string, x: number, at = y) => items.push({ page, str, x, y: at, w: textWidth(str) });
  const putRight = (n: number | null | undefined, edge: number, places: number) => {
    if (n === null || n === undefined) return;
    const str = fmt(n, places);
    put(str, edge - textWidth(str));
  };
  const next = (step = LINE_STEP) => {
    if (linesOnPage >= perPage) {
      page++;
      y = TOP;
      linesOnPage = 0;
      put(`${period[0]} To ${period[1]}`, DATE_X);
      y -= LINE_STEP;
    }
    y -= step;
    linesOnPage++;
  };
  const text = (str: string, x = DATE_X) => {
    next();
    put(str, x);
  };

  if (spec.marker !== null) items.push({ page: 1, str: spec.marker ?? 'CAMSCASWS', x: 15, y: 300, w: 40 });
  put(spec.title ?? 'Consolidated Account Statement', DATE_X);
  y -= LINE_STEP;
  put(`${period[0]} To ${period[1]}`, DATE_X);
  for (const line of spec.investor ?? []) text(line);

  for (const amc of spec.amcs) {
    text(amc.name);
    for (const folio of amc.folios) {
      for (const scheme of folio.schemes) {
        text(folio.line);
        if (folio.holder) text(folio.holder);
        for (const line of scheme.header) text(line);
        if (!scheme.noColumnHeader) {
          text('Date Transaction Amount Units Price Unit');
          put('Balance', COLUMN_EDGES.balance - 30);
          text('(INR) (INR)');
        }
        const open = scheme.open ?? 0;
        text(`Opening Unit Balance: ${fmt(open, 3)}`);

        let running = open;
        for (const t of scheme.txns) {
          running += t.units ?? 0;
          next();
          put(t.date, DATE_X);
          if (t.twin) put(t.date, DATE_X, y + 0.7);
          put(t.desc, DESC_X);
          putRight(t.amount, COLUMN_EDGES.amount, 2);
          putRight(t.units, COLUMN_EDGES.units, 3);
          if (!t.noPrice) putRight(t.price, COLUMN_EDGES.price, 4);
          putRight(t.balance === undefined ? (t.units == null ? null : running) : t.balance, COLUMN_EDGES.balance, 3);
          if (t.wrap) {
            next(WRAP_STEP);
            put(t.wrap, DESC_X);
          }
        }
        text(`Closing Unit Balance: ${fmt(scheme.close ?? running, 3)}`);
        for (const line of scheme.footer ?? []) text(line);
      }
    }
  }
  return items;
}

/** A scheme header on one line, in the layout CAMS prints. */
export const schemeLine = (code: string, name: string, isin: string, advisor = 'DIRECT') => `${code}-${name} - ISIN: ${isin}(Advisor: ${advisor}) Registrar : CAMS`;

export const footer = (nav: number, value: number, cost: number, date = '17-Sep-2026') => [`NAV on ${date}: INR ${fmt(nav, 4)}`, `Total Cost Value: ${fmt(cost, 2)}`, `Market Value on ${date}: INR ${fmt(value, 2)}`];

/** A statement that exercises most of the grammar. All data is invented. */
export function sampleSpec(overrides: Partial<CasSpec> = {}): CasSpec {
  return {
    investor: ['JANE Q SAMPLE', 'Email Id: user@example.com', 'Mobile: 9000000000', '12 Example Street, Sampletown'],
    amcs: [
      {
        name: 'Sample Alpha Mutual Fund',
        folios: [
          {
            line: 'Folio No: 12345678901 / 63   PAN: ABCDE1234F   KYC: OK   PAN: OK',
            holder: 'JANE Q SAMPLE',
            schemes: [
              {
                header: [schemeLine('ALPHFG', 'Sample Alpha Flexi Cap Fund - Direct Plan - Growth', 'INF000A01AB3')],
                txns: [
                  { date: '05-Jan-2021', desc: 'Purchase', amount: 5000, units: 100, price: 50, wrap: undefined },
                  { date: '05-Feb-2021', desc: 'Systematic Investment Purchase', amount: 5000, units: 90.909, price: 55.0001, wrap: 'Instalment 2/24' },
                  { date: '05-Feb-2021', desc: '*** Stamp Duty ***', amount: 0.25 },
                  { date: '15-Mar-2021', desc: 'Redemption', amount: -2500, units: -40, price: 62.5 },
                  { date: '15-Mar-2021', desc: '*** STT Paid ***', amount: 0.63 },
                  { date: '20-Apr-2021', desc: 'Purchase', amount: 123456.5, units: 1000, price: 123.4565 },
                ],
                footer: footer(70.1234, 77_138.25, 133_956.5),
              },
            ],
          },
        ],
      },
      {
        name: 'Sample Beta Mutual Fund',
        folios: [
          {
            line: 'Folio No: 99887766',
            holder: 'ANNE-MARIE SAMPLE',
            schemes: [
              {
                header: [
                  'BETADB-Sample Beta Dynamic Bond Fund - Regular Plan - IDCW - ISIN:',
                  'INF000B01CD7 (Advisor: ARN-12345) Registrar : CAMS',
                ],
                txns: [
                  { date: '01-Jun-2021', desc: 'Purchase', amount: 10000, units: 500, price: 20 },
                  { date: '30-Jun-2021', desc: 'IDCW Reinvestment @ Rs. 0.25 per unit', amount: 125, units: 6.25, price: 20 },
                  { date: '31-Jul-2021', desc: 'IDCW Paid @ Rs. 0.30 per unit', amount: 150 },
                  { date: '02-Aug-2021', desc: 'Switch Out - To Sample Beta Liquid Fund', amount: -5000, units: -240, price: 20.8333 },
                ],
                footer: footer(21.5, 5_663.44, 5_000),
              },
              {
                header: [schemeLine('BETALQ', 'Sample Beta Liquid Fund - Direct Plan - Growth', 'INF000B01EF1')],
                txns: [
                  { date: '02-Aug-2021', desc: 'Switch In - From Sample Beta Dynamic Bond Fund', amount: 5000, units: 4.8, price: 1041.6667 },
                  { date: '10-Sep-2021', desc: 'S T P In (Instalment 1/6)', amount: 1000, units: 0.95, price: 1052.6316 },
                  { date: '11-Oct-2021', desc: 'Gifting of units-TO Folio No: 55443322110', amount: -1000, units: -0.95, price: 1052.6316 },
                ],
                footer: footer(1060.5, 5090.4, 5000),
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}
