// Main-thread side: hands the file and password to a fresh worker and terminates it when done, so neither the
// password nor the extracted text outlives the parse.
import { logError } from '../../proxy/log';
import { internalError, ParseError } from './errors';
import type { ParseRequest, ParseResponse } from './protocol';
import type { Statement } from './types';

/** A statement that takes longer than this to read is stuck, not slow. */
export const PARSE_TIMEOUT_MS = 120_000;

const isKnown = (message: unknown): message is ParseResponse => {
  const type = (message as { type?: unknown } | null)?.type;
  return type === 'progress' || type === 'result' || type === 'error';
};

export async function parseStatementFile(file: File, password: string, onProgress?: (page: number, total: number) => void): Promise<Statement> {
  const data = await file.arrayBuffer();
  return new Promise<Statement>((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const finish = (settle: () => void) => {
      clearTimeout(timer);
      worker.terminate();
      settle();
    };
    const timer = setTimeout(() => {
      logError('worker_timeout', { afterMs: PARSE_TIMEOUT_MS });
      finish(() => reject(new ParseError('INTERNAL', 'Reading the statement is taking far too long, so it was stopped. Reload the page and try again.')));
    }, PARSE_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data;
      // Log the shape, never the content, of anything unexpected and keep waiting for a real answer.
      if (!isKnown(message)) return logError('worker_unexpected_message', { keys: Object.keys((message as object) ?? {}) });
      if (message.type === 'progress') return onProgress?.(message.page, message.total);
      finish(() => (message.type === 'result' ? resolve(message.statement) : reject(new ParseError(message.code, message.message))));
    };
    worker.onerror = (event) => {
      logError('worker_failed', { message: event.message });
      finish(() => reject(internalError()));
    };
    worker.postMessage({ data, password } satisfies ParseRequest, [data]);
  });
}
