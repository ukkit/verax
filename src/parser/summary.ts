// What the UI needs from a parsed statement: one row per scheme, and which schemes failed the balance check.
import type { Scheme, Statement } from './types';

export interface SchemeRow {
  key: string;
  amc: string;
  folioMasked: string;
  scheme: Scheme;
}

export interface Summary {
  rows: SchemeRow[];
  /** Schemes that failed the balance check; they must stay out of every total. */
  excluded: SchemeRow[];
  folioCount: number;
}

export function summarize(statement: Statement): Summary {
  const rows = statement.folios.flatMap((folio) => folio.schemes.map((scheme, n) => ({ key: `${folio.id}-${n}`, amc: folio.amc, folioMasked: folio.folioMasked, scheme })));
  return { rows, excluded: rows.filter((row) => !row.scheme.reconciled), folioCount: statement.folios.length };
}
