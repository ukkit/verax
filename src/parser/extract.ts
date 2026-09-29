// The pdf.js adapter: opens a PDF (with a password if needed) and returns its text as positioned items.
// pdf.js is passed in rather than imported so the browser build (worker) and Node's legacy build (tests, tools) share this.
import { logError } from '../../proxy/log';
import { internalError, ParseError, passwordIncorrect, passwordRequired, unreadablePdf } from './errors';
import type { TextItem } from './types';

/** The small part of pdf.js this module uses. */
export interface PdfLib {
  getDocument(source: Record<string, unknown>): PdfLoadingTask;
}
/** Cleanup belongs to the loading task, not the document. */
export interface PdfLoadingTask {
  promise: Promise<PdfDocument>;
  destroy(): Promise<void>;
}
export interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
}
export interface PdfPage {
  getTextContent(): Promise<{ items: Array<{ str?: string; transform?: number[]; width?: number }> }>;
}

// pdf.js reports a password problem as PasswordException with code 1 (needed) or 2 (incorrect).
const NEED_PASSWORD = 1;

/** Turns whatever pdf.js threw into the message the user should see. */
export function mapPdfError(error: unknown): ParseError {
  if (error instanceof ParseError) return error;
  const { name, code } = (error ?? {}) as { name?: string; code?: number };
  if (name === 'PasswordException') return code === NEED_PASSWORD ? passwordRequired() : passwordIncorrect();
  if (name === 'InvalidPDFException' || name === 'MissingPDFException' || name === 'FormatError') return unreadablePdf();
  // Unexpected: the user sees a generic message, so keep the real one in the log (name and message only).
  logError('pdf_read_failed', { error });
  return internalError();
}

/** Reads every text run on every page. `password` is used to open the document and is not kept. */
export async function extractItems(lib: PdfLib, data: Uint8Array, password: string | undefined, onProgress?: (page: number, total: number) => void): Promise<TextItem[]> {
  // isEvalSupported off: pdf.js has had code-execution bugs through font handling, and our CSP forbids eval anyway.
  const task = lib.getDocument({ data, password: password || undefined, isEvalSupported: false, disableFontFace: true, verbosity: 0 });
  let doc: PdfDocument;
  try {
    doc = await task.promise;
  } catch (error) {
    await task.destroy();
    throw mapPdfError(error);
  }
  try {
    const items: TextItem[] = [];
    for (let page = 1; page <= doc.numPages; page++) {
      const content = await (await doc.getPage(page)).getTextContent();
      for (const item of content.items) {
        if (typeof item.str !== 'string' || !item.str.trim() || !item.transform) continue;
        items.push({ page, str: item.str, x: item.transform[4] ?? 0, y: item.transform[5] ?? 0, w: item.width ?? 0 });
      }
      onProgress?.(page, doc.numPages);
    }
    return items;
  } catch (error) {
    throw mapPdfError(error);
  } finally {
    await task.destroy();
  }
}
