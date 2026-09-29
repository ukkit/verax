import { describe, expect, it } from 'vitest';
import { findPii, isBinary, looksLikePdf } from './pii.mjs';

// Build "real-looking" values at runtime so this file itself passes the repo scan.
const realPan = ['QWERT', '9876', 'Z'].join('');
const realEmail = ['jane.doe', 'gmail.com'].join('@');

describe('findPii', () => {
  it('flags PAN-shaped values and masks them', () => {
    const hits = findPii(`holder pan ${realPan} end`);
    expect(hits).toEqual([{ kind: 'pan', line: 1, sample: 'QW***' }]);
  });

  it('flags real-looking emails with the right line number', () => {
    const hits = findPii(`ok\ncontact ${realEmail}\n`);
    expect(hits).toEqual([{ kind: 'email', line: 2, sample: 'ja***' }]);
  });

  it('allows documented placeholders', () => {
    expect(findPii('ABCDE1234F and AAAAA0000A and user@example.com and noreply@anthropic.com')).toEqual([]);
  });

  it('does not mistake ISINs, fund codes or scheme names for PANs', () => {
    expect(findPii('INF209KA12Z1 119551 Aditya Birla Sun Life Banking PSU Debt Fund')).toEqual([]);
  });
});

describe('file type checks', () => {
  it('detects PDF content by magic bytes, whatever the extension', () => {
    expect(looksLikePdf(Buffer.from('%PDF-1.7 ...'))).toBe(true);
    expect(looksLikePdf(Buffer.from('hello'))).toBe(false);
  });

  it('detects binary content', () => {
    expect(isBinary(Buffer.from([0x41, 0x00, 0x42]))).toBe(true);
    expect(isBinary(Buffer.from('plain text'))).toBe(false);
  });
});
