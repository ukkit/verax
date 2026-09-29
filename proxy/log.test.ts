import { afterEach, describe, expect, it, vi } from 'vitest';
import { logError } from './log';

afterEach(() => vi.restoreAllMocks());

const logged = (spy: ReturnType<typeof vi.spyOn>) => JSON.parse(String(spy.mock.calls[0]?.[0]));

describe('logError', () => {
  it('writes one JSON line with the event and its context', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('request_failed', { method: 'GET', path: '/api/funds/1' });
    expect(spy).toHaveBeenCalledOnce();
    expect(logged(spy)).toEqual({ level: 'error', event: 'request_failed', method: 'GET', path: '/api/funds/1' });
  });

  it('serialises an Error to its name and message, without a stack trace', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('boom', { error: new TypeError('fetch failed') });
    expect(logged(spy).error).toEqual({ name: 'TypeError', message: 'fetch failed' });
  });

  it('accepts a non-Error throwable and works with no context', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('odd', { error: 'plain string' });
    expect(logged(spy).error).toBe('plain string');
    logError('bare');
    expect(JSON.parse(String(spy.mock.calls[1]?.[0]))).toEqual({ level: 'error', event: 'bare' });
  });
});
