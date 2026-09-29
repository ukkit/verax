// Types for a parsed CAS. Deliberately no PII fields: the investor's name, PAN, email, address, nominees and advisor
// codes are never parsed, and folio numbers are only ever kept masked. See docs/SECURITY.md.

/** One text run from pdf.js, in PDF points (origin bottom-left, so a larger `y` is higher on the page). */
export interface TextItem {
  page: number;
  str: string;
  x: number;
  y: number;
  /** Width in points. */
  w: number;
}

export interface Segment {
  s: string;
  x0: number;
  x1: number;
}

/** Items that sit on one baseline, merged into segments left to right. */
export interface Line {
  page: number;
  y: number;
  segs: Segment[];
  text: string;
}

/** Who generated the statement. `UNKNOWN` still parsed as a CAMS-layout statement; treat it as beta. */
export type SourceKind = 'CAMS' | 'KFINTECH' | 'UNKNOWN';

export type TransactionType =
  | 'PURCHASE'
  | 'PURCHASE_SIP'
  | 'REDEMPTION'
  | 'DIVIDEND_PAYOUT'
  | 'DIVIDEND_REINVEST'
  | 'SWITCH_IN'
  | 'SWITCH_IN_MERGER'
  | 'SWITCH_OUT'
  | 'SWITCH_OUT_MERGER'
  | 'STT_TAX'
  | 'STAMP_DUTY_TAX'
  | 'TDS_TAX'
  | 'SEGREGATION'
  | 'GIFT_IN'
  | 'GIFT_OUT'
  | 'REVERSAL'
  | 'MISC'
  | 'UNKNOWN';

export interface Transaction {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  description: string;
  type: TransactionType;
  amount: number | null;
  units: number | null;
  nav: number | null;
  /** Running unit balance printed by the statement after this row. */
  balance: number | null;
  dividendRate: number | null;
  /** Counterparty folio of a gift transfer, masked. */
  giftFolio: string | null;
}

/** The statement's own valuation line for a scheme. */
export interface Valuation {
  date: string | null;
  nav: number | null;
  value: number | null;
  cost: number | null;
}

export interface Scheme {
  name: string;
  /** From the statement's scheme header; null when the statement does not print one. */
  isin: string | null;
  /** Registrar that services the scheme (CAMS, KFINTECH, ...). */
  rta: string;
  rtaCode: string;
  open: number;
  /** Closing unit balance printed by the statement; null when it was not found. */
  close: number | null;
  /** Opening balance plus every transaction's units. */
  closeCalculated: number;
  valuation: Valuation;
  transactions: Transaction[];
  /** False when the running balances or the closing balance do not add up; such a scheme must not enter any total. */
  reconciled: boolean;
  warnings: string[];
}

export interface Folio {
  /** Position in the statement (f1, f2, ...); never derived from the folio number. */
  id: string;
  amc: string;
  /** Last four digits only, e.g. "••••8901". */
  folioMasked: string;
  schemes: Scheme[];
}

export interface Statement {
  source: SourceKind;
  period: { from: string; to: string } | null;
  folios: Folio[];
  /** Problems that are not tied to one scheme, e.g. a scheme block that could not be read at all. */
  warnings: string[];
}
