// Dev tool: runs the production parser on a real statement in Node and writes the parsed result as JSON.
// The output holds financial data: it stays in tools/parser-oracle/out/ (gitignored) and run.sh deletes it. Prints a
// status line only. The password comes from the CAS_PW environment variable.
import { readFileSync, writeFileSync } from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ParseError } from '../../src/parser/errors';
import type { PdfLib } from '../../src/parser/extract';
import { parsePdf } from '../../src/parser/index';

const [pdfPath, outPath] = process.argv.slice(2);
if (!pdfPath || !outPath) {
  console.log('usage: parse <statement.pdf> <out.json>');
  process.exit(2);
}

const started = performance.now();
try {
  const statement = await parsePdf(pdfjs as unknown as PdfLib, new Uint8Array(readFileSync(pdfPath)), process.env.CAS_PW);
  writeFileSync(outPath, JSON.stringify(statement));
  const schemes = statement.folios.flatMap((f) => f.schemes);
  const rows = schemes.reduce((n, s) => n + s.transactions.length, 0);
  console.log(`parser ok: source ${statement.source}, ${statement.folios.length} folios, ${schemes.length} schemes, ${rows} transactions, ${schemes.filter((s) => !s.reconciled).length} not reconciled, ${Math.round(performance.now() - started)} ms`);
} catch (error) {
  console.log(`parser FAILED: ${error instanceof ParseError ? `${error.code}: ${error.message}` : String(error).slice(0, 120)}`);
  process.exit(1);
}
