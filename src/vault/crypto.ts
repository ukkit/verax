// WebCrypto helpers for the vault: a passphrase becomes an AES-256-GCM key through PBKDF2-SHA256. The key is
// non-extractable, so it can be used but never read back. No dependency; everything is the platform's.

/** OWASP's 2023 figure for PBKDF2-HMAC-SHA256. Stored with each vault, so it can be raised later. */
export const ITERATIONS = 600_000;

const text = new TextEncoder();
/** Binds every ciphertext to this format, so a record from elsewhere fails to open. */
const AAD = text.encode('verax-vault-v1');

export class WrongPassphraseError extends Error {
  constructor() {
    super('That passphrase did not open the saved data. Check it and try again.');
  }
}

export const randomBytes = (length: number): Uint8Array<ArrayBuffer> => crypto.getRandomValues(new Uint8Array(length));

export async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', text.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Encrypts with a fresh random IV. The IV is not secret and is returned with the ciphertext. */
export async function seal(key: CryptoKey, plaintext: Uint8Array<ArrayBuffer>): Promise<{ iv: Uint8Array<ArrayBuffer>; data: Uint8Array<ArrayBuffer> }> {
  const iv = randomBytes(12);
  return { iv, data: new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, plaintext)) };
}

/** Decrypts and authenticates. A wrong key and a tampered record fail the same way, on purpose. */
export async function unseal(key: CryptoKey, iv: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, data));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'OperationError') throw new WrongPassphraseError();
    throw error;
  }
}
