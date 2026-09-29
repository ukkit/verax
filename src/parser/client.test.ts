import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseStatementFile, PARSE_TIMEOUT_MS } from './client';
import type { ParseRequest, ParseResponse } from './protocol';
import type { Statement } from './types';

class FakeWorker {
  static last: FakeWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  terminated = false;
  sent: ParseRequest | null = null;
  constructor() {
    FakeWorker.last = this;
  }
  postMessage(request: ParseRequest) {
    this.sent = request;
  }
  terminate() {
    this.terminated = true;
  }
  emit(data: unknown) {
    this.onmessage?.({ data });
  }
}

const file = () => ({ arrayBuffer: async () => new ArrayBuffer(8) }) as unknown as File;
const statement = { source: 'CAMS', period: null, folios: [], warnings: [] } as Statement;
/** Starts a parse and waits until it has reached the worker. */
async function start(onProgress?: (page: number, total: number) => void) {
  const result = parseStatementFile(file(), 'Secret123', onProgress);
  await vi.waitFor(() => expect(FakeWorker.last?.sent).not.toBeNull());
  return { result, worker: FakeWorker.last };
}

beforeEach(() => vi.stubGlobal('Worker', FakeWorker));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('parseStatementFile', () => {
  it('sends the file and password to a fresh worker, reports progress, resolves with the statement and terminates the worker', async () => {
    const progress = vi.fn();
    const { result, worker } = await start(progress);
    expect(worker.sent?.password).toBe('Secret123');
    worker.emit({ type: 'progress', page: 1, total: 3 } satisfies ParseResponse);
    worker.emit({ type: 'result', statement } satisfies ParseResponse);
    await expect(result).resolves.toBe(statement);
    expect(progress).toHaveBeenCalledWith(1, 3);
    expect(worker.terminated).toBe(true);
  });

  it('rejects with the worker’s user-facing error and terminates it', async () => {
    const { result, worker } = await start();
    worker.emit({ type: 'error', code: 'PASSWORD_INCORRECT', message: 'That password did not open the PDF.' } satisfies ParseResponse);
    await expect(result).rejects.toMatchObject({ code: 'PASSWORD_INCORRECT', message: 'That password did not open the PDF.' });
    expect(worker.terminated).toBe(true);
  });

  it('ignores a message that is not part of the protocol, logs only its keys, and keeps waiting', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, worker } = await start();
    worker.emit({ sourceName: 'worker', targetName: 'main', action: 'ready', data: null });
    expect(worker.terminated).toBe(false);
    expect(JSON.parse(String(spy.mock.calls[0]![0]))).toEqual({ level: 'error', event: 'worker_unexpected_message', keys: ['sourceName', 'targetName', 'action', 'data'] });
    worker.emit({ type: 'result', statement });
    await expect(result).resolves.toBe(statement);
  });

  it('turns a crashed worker into a generic error and terminates it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, worker } = await start();
    worker.onerror?.({ message: 'boom' });
    await expect(result).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(worker.terminated).toBe(true);
  });

  it('gives up on a worker that never answers', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();
    const pending = parseStatementFile(file(), 'x');
    const settled = expect(pending).rejects.toMatchObject({ code: 'INTERNAL', message: expect.stringContaining('taking far too long') });
    await vi.advanceTimersByTimeAsync(PARSE_TIMEOUT_MS + 1);
    await settled;
    expect(FakeWorker.last.terminated).toBe(true);
  });
});
