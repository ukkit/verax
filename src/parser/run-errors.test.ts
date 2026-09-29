import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PdfLib } from './extract';
import type { ParseResponse } from './protocol';

// A bug in the parser itself (not in pdf.js) must be logged and reported, not swallowed.
vi.mock('./index', () => ({ parsePdf: vi.fn().mockRejectedValue(new RangeError('parser bug')) }));

afterEach(() => vi.restoreAllMocks());

describe('runParse: a failure outside the PDF layer', () => {
  it('logs it as structured JSON and tells the user generically', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { runParse } = await import('./run');
    const posted: ParseResponse[] = [];
    await runParse({} as PdfLib, { data: new ArrayBuffer(1), password: 'x' }, (m) => posted.push(m));
    expect(posted).toEqual([{ type: 'error', code: 'INTERNAL', message: expect.stringContaining('failed unexpectedly') }]);
    expect(JSON.parse(String(spy.mock.calls[0]![0]))).toMatchObject({ event: 'parse_failed', error: { name: 'RangeError', message: 'parser bug' } });
  });
});
