import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParseError } from './errors';
import { extractItems, mapPdfError, type PdfDocument, type PdfLib, type PdfLoadingTask } from './extract';

afterEach(() => vi.restoreAllMocks());

const pdfError = (name: string, code?: number) => Object.assign(new Error('pdf.js says no'), { name, code });

describe('mapPdfError', () => {
  it('tells a missing password from a wrong one, and says what to do', () => {
    const needed = mapPdfError(pdfError('PasswordException', 1));
    const wrong = mapPdfError(pdfError('PasswordException', 2));
    expect([needed.code, wrong.code]).toEqual(['PASSWORD_REQUIRED', 'PASSWORD_INCORRECT']);
    expect(needed.message).toMatch(/password-protected.*PAN/);
    expect(wrong.message).toMatch(/did not open.*try again/);
  });

  it('maps damaged or missing PDFs to one clear message', () => {
    for (const name of ['InvalidPDFException', 'MissingPDFException', 'FormatError']) expect(mapPdfError(pdfError(name)).code).toBe('UNREADABLE_PDF');
  });

  it('turns anything else into an internal error, shows the user only the generic message, and logs the real one', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = mapPdfError(new TypeError('Cannot read properties of undefined'));
    expect(error.code).toBe('INTERNAL');
    expect(error.message).not.toContain('Cannot read');
    expect(JSON.parse(String(spy.mock.calls[0]![0]))).toEqual({ level: 'error', event: 'pdf_read_failed', error: { name: 'TypeError', message: 'Cannot read properties of undefined' } });
  });

  it('passes a ParseError through unchanged', () => {
    const own = new ParseError('NOT_A_STATEMENT', 'x');
    expect(mapPdfError(own)).toBe(own);
  });
});

const fakeDoc = (pages: Array<Array<{ str?: string; transform?: number[]; width?: number }>>, overrides: Partial<PdfDocument> = {}): PdfDocument => ({
  numPages: pages.length,
  getPage: async (n) => ({ getTextContent: async () => ({ items: pages[n - 1]! }) }),
  ...overrides,
});
/** Like pdf.js: getDocument returns a loading task with the promise and the destroy. */
let lastTask: PdfLoadingTask & { destroy: ReturnType<typeof vi.fn> };
const libFor = (doc: PdfDocument | Error): PdfLib & { getDocument: ReturnType<typeof vi.fn> } => ({
  getDocument: vi.fn(() => {
    lastTask = { promise: doc instanceof Error ? Promise.reject(doc) : Promise.resolve(doc), destroy: vi.fn().mockResolvedValue(undefined) };
    return lastTask;
  }),
});

describe('extractItems', () => {
  it('returns positioned items page by page, skipping blanks and marked-content entries, and reports progress', async () => {
    const doc = fakeDoc([[{ str: 'Hello', transform: [1, 0, 0, 1, 40, 700], width: 24 }, { str: '   ', transform: [1, 0, 0, 1, 1, 1] }, {}], [{ str: 'Page two', transform: [1, 0, 0, 1, 10, 20], width: 30 }]]);
    const progress = vi.fn();
    const items = await extractItems(libFor(doc), new Uint8Array(), undefined, progress);
    expect(items).toEqual([
      { page: 1, str: 'Hello', x: 40, y: 700, w: 24 },
      { page: 2, str: 'Page two', x: 10, y: 20, w: 30 },
    ]);
    expect(progress.mock.calls).toEqual([[1, 2], [2, 2]]);
    expect(lastTask.destroy).toHaveBeenCalledOnce();
  });

  it('opens the document with eval disabled, and treats an empty password as none', async () => {
    const lib = libFor(fakeDoc([[]]));
    await extractItems(lib, new Uint8Array([1]), '', undefined);
    expect(lib.getDocument.mock.calls[0]![0]).toMatchObject({ password: undefined, isEvalSupported: false });
    await extractItems(lib, new Uint8Array([1]), 'SECRET1', undefined);
    expect(lib.getDocument.mock.calls[1]![0]).toMatchObject({ password: 'SECRET1' });
  });

  it('maps a password failure at open time, and still cleans up the loading task', async () => {
    await expect(extractItems(libFor(pdfError('PasswordException', 2)), new Uint8Array(), 'wrong', undefined)).rejects.toMatchObject({ code: 'PASSWORD_INCORRECT' });
    expect(lastTask.destroy).toHaveBeenCalledOnce();
  });

  it('still cleans up when reading a page fails', async () => {
    const doc = fakeDoc([[]], { getPage: async () => Promise.reject(new Error('boom')) });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(extractItems(libFor(doc), new Uint8Array(), undefined, undefined)).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(lastTask.destroy).toHaveBeenCalledOnce();
  });
});
