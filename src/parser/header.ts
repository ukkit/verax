// Ported from casparser (https://github.com/codereverser/casparser), parsers/cams_detailed.py.
// MIT License, Copyright (c) 2020 Sandeep Somasekharan. See NOTICE.
//
// A scheme's header is the only part of a statement that wraps unpredictably. Everything around it (the folio line,
// "Opening Unit Balance", the closing footer) is a single line that never wraps. So the parser collects every line of
// the region between two such anchors and this module reads the whole region at once, extracting each field with its
// own search. A stray line can then spoil at most the one field whose pattern it happens to match.
import { TXN_HEADER_LABELS, TXN_MIN_HITS } from './constants';

export interface SchemeHeader {
  name: string;
  isin: string | null;
  rta: string;
  rtaCode: string;
}

const RTA_TOKEN_RE = /\b(CAMS|KFINTECH|KFIN|KARVY)\b/i;
const INLINE_ISIN_RE = /[-\s]*ISIN\s*:\s*([A-Z0-9]+)/i;
const INLINE_ADVISOR_RE = /[-\s]*\(\s*Advisor\s*:\s*([^)]+?)\)/gi;
const REGISTRAR_LABEL_RE = /Registrar\s*:\s*(\S+)/i;
/** A full mutual fund ISIN is INF + 8 alphanumerics + a check digit. A value that wrapped across the "Registrar :"
 *  label arrives truncated (e.g. "INF769K"), so it is only trusted when complete. */
const FULL_ISIN_RE = /^INF[0-9A-Z]{8}\d$/;
const ISIN_ANYWHERE_RE = /\bINF[0-9A-Z]{8}\d\b/;

const HEADER_MARKER_RE = /Registrar\s*:|Advisor\s*:|ISIN\s*:|Nominee\s+\d|\bARN-?\d+\b|\bINA\d+\b/i;
// "<code>-<name>". The code may contain spaces ("127 CPGPG-Motilal...") and must contain a letter, which separates a
// real scheme line from "Entry Load - NIL" (space before the dash) and "01-Jan-1990" (digits only).
const SCHEME_CODE_RE = /^\s*(?=[A-Z0-9 ]{0,40}[A-Z])[A-Z0-9]+(?: [A-Z0-9]+)*-/i;
// A marker with nothing after it means its value continues on the next line.
const TRAILING_MARKER_RE = /(Registrar\s*:|Advisor\s*:|ISIN\s*:|\(\s*Advisor\s*:)\s*$/i;
const NAME_EXCISE_ISIN_RE = /[-\s]*ISIN\s*:\s*INF[A-Z0-9]*/gi;
const NAME_TERMINATOR_RE = /\(\s*Advisor\s*:|Registrar\s*:?|Nominee\s+\d|\bARN-?\d+\b|\bINA\d+\b|\b(?:CAMS|KFINTECH|KFIN|KARVY)\b/i;
const HOLDER_NAME_CHARS_RE = /^[A-Z][A-Za-z .'&-]*$/;

/** Strips "(formerly ...)", "(Demat ...)" trailers, collapses whitespace and trims trailing punctuation. */
export function cleanSchemeName(scheme: string): string {
  return scheme
    .replace(/\((formerly|erstwhile)[\s\S]+?\)/gi, '')
    .trim()
    .replace(/\((Demat|Non-Demat)[\s\S]*/i, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-zA-Z0-9_)]+$/, '')
    .trim();
}

/** True for a line made of the transaction table's column labels ("Date Transaction Amount Units Price Unit Balance"). */
export function isTransactionHeaderLine(text: string): boolean {
  return text.split(/\s+/).filter((w) => TXN_HEADER_LABELS.has(w)).length >= TXN_MIN_HITS;
}

const isHeaderLine = (text: string): boolean => HEADER_MARKER_RE.test(text) || RTA_TOKEN_RE.test(text) || SCHEME_CODE_RE.test(text);

/** The investor's name, printed on the line after the folio. A name may contain a hyphen ("ANNE-MARIE SMITH") and so
 *  look like a "<code>-" scheme line; it is recognised only to be skipped, and never read or kept. */
function looksLikeHolderName(text: string): boolean {
  const t = text.split(/\s+/).filter(Boolean).join(' ');
  const words = t.split(' ');
  if (words.length < 2 || words.length > 8 || t.length > 80) return false;
  if (!HOLDER_NAME_CHARS_RE.test(t)) return false;
  if (!words.every((w) => w === '&' || /^[A-Z]/.test(w))) return false;
  if (isTransactionHeaderLine(t)) return false;
  return !(HEADER_MARKER_RE.test(t) || RTA_TOKEN_RE.test(t));
}

const expectsContinuation = (text: string): boolean => {
  if (TRAILING_MARKER_RE.test(text.trim())) return true;
  const advisor = /\(\s*Advisor\s*:/i.exec(text);
  return advisor !== null && !text.slice(advisor.index + advisor[0].length).includes(')');
};

function findSchemeLine(lines: string[]): number | null {
  for (let k = 0; k < lines.length; k++) {
    const line = lines[k]!;
    if (!SCHEME_CODE_RE.test(line) || looksLikeHolderName(line)) continue;
    // "ARN" is a distributor's registration prefix, never a scheme code: "ARN-28283)" is an advisor value that wrapped.
    if (line.split('-')[0]!.trim().toUpperCase() === 'ARN') continue;
    return k;
  }
  return null;
}

/** Indices of the lines that form the (possibly wrapped) header: marker lines, and whatever a dangling marker continues onto. */
function headerMembers(lines: string[]): number[] {
  const members: number[] = [];
  let forced = false;
  lines.forEach((line, i) => {
    if (forced || isHeaderLine(line)) {
      members.push(i);
      forced = expectsContinuation(line);
    } else forced = false;
  });
  return members;
}

interface Candidate {
  lines: string[];
  schemeLine: number;
  members: number[];
  headerText: string;
}

/** A region holds a scheme only if it has a scheme line AND a "Registrar" label: a hyphenated word in trailing
 *  disclaimer text can look like "<code>-" but never comes with one. */
function candidate(region: string[]): Candidate | null {
  const lines = region.map((l) => l.trim()).filter(Boolean);
  const schemeLine = findSchemeLine(lines);
  if (schemeLine === null) return null;
  const members = headerMembers(lines);
  const headerText = members.map((k) => lines[k]!).join(' ');
  return headerText.includes('Registrar') ? { lines, schemeLine, members, headerText } : null;
}

/** True when the region holds a scheme header that was never closed by its "Opening Unit Balance" anchor. */
export const hasSchemeHeader = (region: string[]): boolean => candidate(region) !== null;

/** Reads a scheme header out of the lines collected between two anchors; null when the region holds no scheme. */
export function readSchemeHeader(region: string[]): SchemeHeader | null {
  const found = candidate(region);
  if (!found) return null;
  const { lines, schemeLine, members, headerText } = found;

  const line = lines[schemeLine]!;
  const dash = line.indexOf('-');
  const rtaCode = line.slice(0, dash).trim();
  // The name is the scheme line after "<code>-" plus any header lines that follow it, cut at the first annotation.
  let name = [line.slice(dash + 1), ...members.filter((k) => k > schemeLine).map((k) => lines[k]!)].join(' ');
  name = name.replace(INLINE_ADVISOR_RE, '').replace(NAME_EXCISE_ISIN_RE, '');
  const cut = NAME_TERMINATOR_RE.exec(name);
  const cleaned = cleanSchemeName(cut ? name.slice(0, cut.index) : name);

  let isin = INLINE_ISIN_RE.exec(headerText)?.[1]?.trim() ?? null;
  if (!isin || !FULL_ISIN_RE.test(isin)) isin = ISIN_ANYWHERE_RE.exec(headerText)?.[0] ?? null;

  const rta = RTA_TOKEN_RE.exec(headerText)?.[1]?.toUpperCase() ?? REGISTRAR_LABEL_RE.exec(headerText)?.[1]?.trim() ?? 'CAMS';
  return { name: cleaned, isin, rta, rtaCode };
}
