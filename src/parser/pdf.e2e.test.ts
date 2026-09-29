import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { parseStatement } from './cams';
import type { PdfLib } from './extract';
import { parsePdf } from './index';
import { buildPdf } from './testing/pdf';
import { buildItems, sampleSpec } from './testing/fixtures';

// The one test that runs the real pdf.js: a synthetic statement written as a PDF, read back, and parsed.
const lib = pdfjs as unknown as PdfLib;

describe('parsePdf with the real pdf.js', () => {
  it('reads a generated PDF to exactly the same statement as parsing its items directly', async () => {
    const items = buildItems(sampleSpec({ linesPerPage: 30 }));
    const statement = await parsePdf(lib, buildPdf(items), undefined);
    expect(statement).toEqual(parseStatement(items));
    expect(statement.folios).toHaveLength(2);
    expect(statement.folios.flatMap((f) => f.schemes).every((s) => s.reconciled)).toBe(true);
  });

  it('reports progress for every page', async () => {
    const items = buildItems(sampleSpec({ linesPerPage: 30 }));
    const seen: number[] = [];
    await parsePdf(lib, buildPdf(items), undefined, (page) => seen.push(page));
    expect(seen).toEqual(Array.from({ length: Math.max(...items.map((i) => i.page)) }, (_, n) => n + 1));
  });

  it('says a garbled file is unreadable rather than crashing', async () => {
    await expect(parsePdf(lib, new TextEncoder().encode('this is not a pdf'), undefined)).rejects.toMatchObject({ code: 'UNREADABLE_PDF' });
  });

  it('says a real PDF that is not a statement is not a statement', async () => {
    const letter = buildPdf([{ page: 1, str: 'Dear customer, thank you for your letter.', x: 40, y: 700, w: 200 }]);
    await expect(parsePdf(lib, letter, undefined)).rejects.toMatchObject({ code: 'NOT_A_STATEMENT' });
  });
});
