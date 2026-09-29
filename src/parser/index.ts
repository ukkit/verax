import { extractItems, type PdfLib } from './extract';
import { parseStatement } from './cams';
import type { Statement } from './types';

export { ParseError, type ParseErrorCode } from './errors';
export { parseStatement } from './cams';
export type * from './types';

/** Opens a statement PDF and parses it. The password is used once and not retained. */
export async function parsePdf(lib: PdfLib, data: Uint8Array, password: string | undefined, onProgress?: (page: number, total: number) => void): Promise<Statement> {
  return parseStatement(await extractItems(lib, data, password, onProgress));
}
