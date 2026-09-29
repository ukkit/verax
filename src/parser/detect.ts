// Ported from casparser (https://github.com/codereverser/casparser), parsers/detect.py.
// MIT License, Copyright (c) 2020 Sandeep Somasekharan. See NOTICE.
//
// The issuer is identified from unambiguous marker text in the first two pages.
import { unsupportedStatement } from './errors';
import type { SourceKind, TextItem } from './types';

const CAS_KIND_RE = /consolidated\s+account\s+(statement|summary)/i;

/** Identifies who generated the statement. Throws for NSDL / CDSL demat statements and for CAMS / KFintech
 *  "Summary" statements, which carry no transactions. An unmarked statement returns UNKNOWN and is still attempted. */
export function detectSource(items: TextItem[]): SourceKind {
  const text = items
    .filter((item) => item.page <= 2)
    .map((item) => item.str)
    .join(' ');

  if (text.includes('NSDL Consolidated Account Statement') || text.includes('About NSDL')) throw unsupportedStatement('NSDL');
  if (text.includes('Central Depository Services (India) Limited')) throw unsupportedStatement('CDSL');
  if (CAS_KIND_RE.exec(text)?.[1]?.toLowerCase() === 'summary') throw unsupportedStatement('SUMMARY');

  if (text.includes('CAMSCASWS')) return 'CAMS';
  if (text.includes('KFINCASWS')) return 'KFINTECH';
  return 'UNKNOWN';
}
