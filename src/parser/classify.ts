// Ported from casparser (https://github.com/codereverser/casparser), parsers/_classify.py.
// MIT License, Copyright (c) 2020 Sandeep Somasekharan. See NOTICE.
import type { TransactionType } from './types';
import { maskFolio, parseNumber } from './text';

// An IDCW / dividend line carries the per-unit rupee value. Whether it was reinvested is detected separately: with a
// lazy `.*?` on both sides of an optional group the engine settles on the first complete match and never fills the
// group, so "Reinvestment of IDCW @ Rs..." leaked through as a payout. A plain substring search is unambiguous.
const DIVIDEND_RE = /(?:div\.|dividend|idcw).*?@\s*rs\.\s*([\d.]+)(?:\s+per\s+unit)?/is;
const REINVEST_RE = /reinvest/i;

// Systematic Transfer Plan is a switch by another name. CAMS prints "Systematic Transfer Plan Switch In/Out", which
// the "switch" keyword already catches, but KFintech prints it letter-spaced as "S T P In/Out (...)".
const STP_RE = /\bs\s*t\s*p\b|systematic\s+transfer/i;

// Counterparty folio in a gift transfer. KFintech punctuates it with a colon, CAMS with a dot.
const GIFT_FOLIO_RE = /Folio\s+No\s*[:.]\s*(\d+)/i;

const REVERSAL_RE = /reversal|rejection|dishonoured|mismatch|insufficient\s+balance|payment\s+not\s+received/i;

export interface Classification {
  type: TransactionType;
  dividendRate: number | null;
}

/** Classifies a transaction from its description and the sign of its units. */
export function classify(description: string, units: number | null): Classification {
  const d = description.toLowerCase();
  const dividend = DIVIDEND_RE.exec(d);
  if (dividend) {
    return { type: REINVEST_RE.test(d) ? 'DIVIDEND_REINVEST' : 'DIVIDEND_PAYOUT', dividendRate: parseNumber(dividend[1]) };
  }

  let type: TransactionType;
  if (units === null) {
    type = d.includes('stt') ? 'STT_TAX' : d.includes('stamp') ? 'STAMP_DUTY_TAX' : d.includes('tds') ? 'TDS_TAX' : 'MISC';
  } else if (units > 0) {
    if (d.includes('gift')) type = 'GIFT_IN';
    else if (d.includes('switch') || STP_RE.test(d)) type = d.includes('merger') ? 'SWITCH_IN_MERGER' : 'SWITCH_IN';
    else if (d.includes('segregat')) type = 'SEGREGATION';
    else if (d.includes('sip') || d.includes('systematic') || /instal+ment/i.test(d) || /sys.+?invest/is.test(d)) type = 'PURCHASE_SIP';
    else type = 'PURCHASE';
  } else if (units < 0) {
    if (d.includes('gift')) type = 'GIFT_OUT';
    else if (REVERSAL_RE.test(d)) type = 'REVERSAL';
    else if (d.includes('switch') || STP_RE.test(d)) type = d.includes('merger') ? 'SWITCH_OUT_MERGER' : 'SWITCH_OUT';
    else type = 'REDEMPTION';
  } else type = 'UNKNOWN';
  return { type, dividendRate: null };
}

const FOLIO_NUMBER_RE = /(Folio\s+No\s*[:.]\s*)(\d+(?:\s*\/\s*\d+)?)/gi;

/** Masks any folio number a description mentions ("Gifting of units-TO Folio No: 55443322110"), so no other account's
 *  number is kept in full. */
export const maskFolioNumbers = (description: string): string => description.replace(FOLIO_NUMBER_RE, (_, label: string, number: string) => `${label}${maskFolio(number)}`);

/** Payment and bank references in a description (UTR, UPI, cheque, folio numbers) are runs of 8 or more digits. They are
 *  not needed for any calculation and can identify a transaction or an account, so only the last four are kept. */
const LONG_NUMBER_RE = /\d{8,}/g;

/** Everything in a description that could identify an account or a payment, masked. */
export const maskDescription = (description: string): string => maskFolioNumbers(description).replace(LONG_NUMBER_RE, (run) => `••••${run.slice(-4)}`);

/** The other folio named in a gift description, masked to its last four digits, or null. */
export function giftFolio(description: string): string | null {
  const match = GIFT_FOLIO_RE.exec(description);
  return match?.[1] ? maskFolio(match[1]) : null;
}
