// Dev tool: values a real statement with the production code and compares it with the statement's own figures.
// Prints counts and percentages only: no names, folios, ISINs or rupee amounts. The password comes from CAS_PW.
import { readFileSync } from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildPortfolio } from '../../src/domain/holdings';
import type { PdfLib } from '../../src/parser/extract';
import { parsePdf } from '../../src/parser/index';
import type { Valuation } from '../../src/parser/types';
import { NavError, type Fund } from '../../src/nav';
import { createNavSource } from '../../src/valuation/navSource';
import { fetchQuotes } from '../../src/valuation/quotes';
import { valuePortfolio } from '../../src/valuation/value';

const [pdfPath] = process.argv.slice(2);
if (!pdfPath) {
  console.log('usage: check <statement.pdf>');
  process.exit(2);
}

// Node has no CORS limit, so the tool asks mfnav.in directly instead of through the proxy.
const get = async <T>(path: string): Promise<T> => {
  const res = await fetch(`https://mfnav.in${path}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new NavError(`NAV service error (${res.status}).`, res.status);
  return (await res.json()) as T;
};
const source = createNavSource({
  searchFunds: (q) => get(`/api/funds/search?${new URLSearchParams({ q, page_size: '10' })}`),
  getFund: (code) => get<Fund>(`/api/funds/${code}`),
});

const pct = (ours: number, theirs: number): string => (theirs === 0 ? 'n/a' : `${(((ours - theirs) / theirs) * 100).toFixed(3)}%`);
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

const statement = await parsePdf(pdfjs as unknown as PdfLib, new Uint8Array(readFileSync(pdfPath)), process.env.CAS_PW);
const portfolio = buildPortfolio(statement);
const schemes = statement.folios.flatMap((f) => f.schemes.map((s, i) => [`${f.id}:${i}`, s] as const));
const printed = new Map<string, Valuation>(schemes.map(([id, s]) => [id, s.valuation]));

const started = performance.now();
const quotes = await fetchQuotes(portfolio.open, source);
const seconds = ((performance.now() - started) / 1000).toFixed(1);
const valued = valuePortfolio(portfolio, quotes);

// Only schemes that print both a value and a cost can be compared.
const comparable = portfolio.open.filter((p) => printed.get(p.id)?.value != null && printed.get(p.id)?.cost != null);
const statementValue = sum(comparable.map((p) => printed.get(p.id)!.value!));
const statementCost = sum(comparable.map((p) => printed.get(p.id)!.cost!));
const atStatementNav = sum(comparable.map((p) => (p.statementNav ? p.units * p.statementNav.nav : NaN)));
const liveValue = sum(valued.open.filter((v) => comparable.includes(v.position)).map((v) => v.value ?? NaN));

console.log(`schemes: ${portfolio.open.length} open, ${portfolio.closed.length} closed, ${portfolio.excluded.length} excluded, ${comparable.length} comparable with the statement`);
for (const reason of new Set(portfolio.excluded.map((e) => e.reason))) console.log(`  excluded: ${portfolio.excluded.filter((e) => e.reason === reason).length} × ${reason}`);
console.log(`live NAV: ${valued.open.filter((v) => v.quote?.from === 'mfnav').length} of ${portfolio.open.length} from mfnav.in, ${valued.open.filter((v) => v.quote?.from === 'statement').length} on the statement NAV, ${valued.totals.unvalued} unvalued, ${seconds} s`);
console.log(`cost, FIFO vs statement:            ${pct(sum(comparable.map((p) => p.invested)), statementCost)}   (target: within 0.1%)`);
console.log(`value at the statement's own NAVs:  ${pct(atStatementNav, statementValue)}   (target: within 0.1%)`);
console.log(`value at today's live NAVs:         ${pct(liveValue, statementValue)}   (informational: the NAV dates differ)`);
console.log(`portfolio XIRR: ${valued.totals.xirr === null ? 'n/a' : `${(valued.totals.xirr * 100).toFixed(2)}%`}`);
