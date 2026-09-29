import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PdfDocument, PdfLib } from './extract';
import type { ParseResponse } from './protocol';
import { runParse } from './run';
import { buildItems, sampleSpec } from './testing/fixtures';
import type { TextItem } from './types';

afterEach(() => vi.restoreAllMocks());

/** A pdf.js stand-in that serves the given items as pages. */
function libFromItems(items: TextItem[]): PdfLib {
  const pages = Math.max(...items.map((i) => i.page));
  const doc: PdfDocument = {
    numPages: pages,
    getPage: async (n) => ({ getTextContent: async () => ({ items: items.filter((i) => i.page === n).map((i) => ({ str: i.str, transform: [1, 0, 0, 1, i.x, i.y], width: i.w })) }) }),
  };
  return { getDocument: () => ({ promise: Promise.resolve(doc), destroy: async () => {} }) };
}
const rejectingLib = (error: Error): PdfLib => ({ getDocument: () => ({ promise: Promise.reject(error), destroy: async () => {} }) });

async function run(lib: PdfLib): Promise<ParseResponse[]> {
  const posted: ParseResponse[] = [];
  await runParse(lib, { data: new ArrayBuffer(4), password: 'x' }, (m) => posted.push(m));
  return posted;
}

describe('runParse', () => {
  it('posts progress and then the parsed statement', async () => {
    const posted = await run(libFromItems(buildItems(sampleSpec())));
    expect(posted[0]).toMatchObject({ type: 'progress', page: 1 });
    const last = posted[posted.length - 1]!;
    expect(last.type).toBe('result');
    expect(last.type === 'result' && last.statement.folios).toHaveLength(2);
  });

  it('posts a user-facing error for a known failure', async () => {
    const wrongPassword = Object.assign(new Error('x'), { name: 'PasswordException', code: 2 });
    const [message] = await run(rejectingLib(wrongPassword));
    expect(message).toMatchObject({ type: 'error', code: 'PASSWORD_INCORRECT' });
  });

  it('logs an unexpected failure from the PDF layer once, and posts the generic error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const [message] = await run(rejectingLib(new TypeError('weird')));
    expect(message).toMatchObject({ type: 'error', code: 'INTERNAL' });
    expect(spy).toHaveBeenCalledOnce();
    expect(JSON.parse(String(spy.mock.calls[0]![0])).event).toBe('pdf_read_failed');
  });
});
