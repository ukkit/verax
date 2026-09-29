import type { ParseErrorCode } from './errors';
import type { Statement } from './types';

export interface ParseRequest {
  data: ArrayBuffer;
  /** Held by the worker for the length of one parse; the worker is terminated afterwards. */
  password: string;
}

export type ParseResponse =
  | { type: 'progress'; page: number; total: number }
  | { type: 'result'; statement: Statement }
  | { type: 'error'; code: ParseErrorCode; message: string };
