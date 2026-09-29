// Ported from casparser (https://github.com/codereverser/casparser), parsers/cams_detailed.py.
// MIT License, Copyright (c) 2020 Sandeep Somasekharan. See NOTICE.
//
// Every row of a statement prints the running unit balance after it, so the statement carries its own checksum. A
// parse that dropped or garbled a row still looks fine, which makes it the most dangerous failure; this catches it.
import { classify, giftFolio } from './classify';
import { round } from './text';
import type { Scheme } from './types';

const TOLERANCE = 0.005;

/** Some templates print a reversal with cosmetic parentheses around the units although the real sign is the opposite.
 *  The running balance is unambiguous, so where `prev - units == balance` rather than `prev + units`, flip the sign of
 *  the units and amount and classify the row again. A no-op for rows that already agree with the balance. */
export function fixSigns(scheme: Scheme): void {
  let previous = scheme.open;
  for (const t of scheme.transactions) {
    if (t.units === null || t.balance === null) continue;
    if (Math.abs(previous + t.units - t.balance) > TOLERANCE && Math.abs(previous - t.units - t.balance) <= TOLERANCE) {
      t.units = -t.units;
      if (t.amount !== null) t.amount = -t.amount;
      const { type, dividendRate } = classify(t.description, t.units);
      t.type = type;
      t.dividendRate = dividendRate;
      t.giftFolio = type === 'GIFT_IN' || type === 'GIFT_OUT' ? giftFolio(t.description) : null;
    }
    previous = t.balance;
  }
  scheme.closeCalculated = scheme.transactions.reduce((sum, t) => sum + (t.units ?? 0), scheme.open);
}

const units = (value: number) => round(value, 3).toFixed(3);

/** One warning per discontinuity in the running balance, plus one if the closing balance does not match. After a
 *  mismatch the running total resyncs to the statement's own figure, so a single missing row gives one warning
 *  instead of cascading onto every row after it. */
export function reconcile(scheme: Scheme): string[] {
  const warnings: string[] = [];
  let running = scheme.open;
  for (const t of scheme.transactions) {
    if (t.units !== null) running += t.units;
    if (t.balance === null) continue;
    if (Math.abs(running - t.balance) > TOLERANCE) {
      warnings.push(`Unit balance stops adding up at ${t.date}: the rows give ${units(running)} units but the statement prints ${units(t.balance)}. A row may be missing or misread.`);
      running = t.balance;
    }
  }
  if (scheme.close === null) warnings.push('The closing unit balance was not found, so this scheme cannot be checked.');
  else if (Math.abs(running - scheme.close) > TOLERANCE) {
    warnings.push(`Closing balance mismatch: the rows give ${units(running)} units but the statement prints ${units(scheme.close)}. A row may be missing or misread.`);
  }
  return warnings;
}
