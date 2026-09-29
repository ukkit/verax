// One parse request, from message to response. Kept separate from the worker entry so it can be tested without a worker.
import { logError } from '../../proxy/log';
import { internalError, ParseError } from './errors';
import type { PdfLib } from './extract';
import { parsePdf } from './index';
import type { ParseRequest, ParseResponse } from './protocol';

export async function runParse(lib: PdfLib, request: ParseRequest, post: (message: ParseResponse) => void): Promise<void> {
  try {
    const statement = await parsePdf(lib, new Uint8Array(request.data), request.password, (page, total) => post({ type: 'progress', page, total }));
    post({ type: 'result', statement });
  } catch (error) {
    // Only the error's name and message are logged, never any statement text.
    if (!(error instanceof ParseError)) logError('parse_failed', { error });
    const { code, message } = error instanceof ParseError ? error : internalError();
    post({ type: 'error', code, message });
  }
}
