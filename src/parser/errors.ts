// Every failure the user can hit while opening a statement, with a message that says what failed and what to do.

export type ParseErrorCode =
  | 'PASSWORD_REQUIRED'
  | 'PASSWORD_INCORRECT'
  | 'UNSUPPORTED_STATEMENT'
  | 'NOT_A_STATEMENT'
  | 'UNREADABLE_PDF'
  | 'INTERNAL';

export class ParseError extends Error {
  constructor(
    readonly code: ParseErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

const PASSWORD_HINT = 'For CAMS and KFintech statements it is usually your PAN in capital letters, or the password you chose when you requested it.';

export const passwordRequired = () => new ParseError('PASSWORD_REQUIRED', `This PDF is password-protected. Enter its password. ${PASSWORD_HINT}`);
export const passwordIncorrect = () => new ParseError('PASSWORD_INCORRECT', `That password did not open the PDF. Check it and try again. ${PASSWORD_HINT}`);
export const unreadablePdf = () =>
  new ParseError('UNREADABLE_PDF', 'This file could not be read as a PDF. It may be damaged or only partly downloaded; download it again and retry.');
export const notAStatement = () =>
  new ParseError(
    'NOT_A_STATEMENT',
    'No CAMS or KFintech statement was found in this PDF. Verax reads the "Detailed" Consolidated Account Statement; a summary or another document will not work.',
  );

export function unsupportedStatement(kind: 'NSDL' | 'CDSL' | 'SUMMARY'): ParseError {
  const what = { NSDL: 'an NSDL demat statement', CDSL: 'a CDSL demat statement', SUMMARY: 'a "Summary" statement (it has no transactions)' }[kind];
  return new ParseError(
    'UNSUPPORTED_STATEMENT',
    `This is ${what}. Verax reads the CAMS or KFintech "Detailed" Consolidated Account Statement. Request one with the "Detailed" option and try again.`,
  );
}

export const internalError = () =>
  new ParseError(
    'INTERNAL',
    'Reading the statement failed unexpectedly. Reload the page and try again. If it happens again, open an issue and describe the steps, but do not attach the statement.',
  );
