// Detection helpers for the repo scan (see scan-pii.mjs). Public repo, so nothing that identifies a
// person or a real statement may be committed: no PDFs, no PAN numbers, no real email addresses.

/** Obvious placeholder PANs that documentation and tests may use. */
export const ALLOWED_PANS = new Set(['ABCDE1234F', 'AAAAA0000A']);

const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g;
const ALLOWED_EMAIL = /(^noreply@|@example\.(?:com|org|net)$|@users\.noreply\.github\.com$|^git@github\.com$)/i;

const mask = (value) => `${value.slice(0, 2)}***`;

/** @returns {{kind: 'pan' | 'email', line: number, sample: string}[]} */
export function findPii(text) {
  const hits = [];
  text.split('\n').forEach((lineText, index) => {
    for (const match of lineText.matchAll(PAN_RE)) {
      if (!ALLOWED_PANS.has(match[0])) hits.push({ kind: 'pan', line: index + 1, sample: mask(match[0]) });
    }
    for (const match of lineText.matchAll(EMAIL_RE)) {
      if (!ALLOWED_EMAIL.test(match[0])) hits.push({ kind: 'email', line: index + 1, sample: mask(match[0]) });
    }
  });
  return hits;
}

/** True for PDF content regardless of file name. */
export function looksLikePdf(buffer) {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

export function isBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0);
}
