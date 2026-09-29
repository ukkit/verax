// The vault: every profile's parsed statement, encrypted under one passphrase and kept in browser storage, only when the
// user opts in. The passphrase is used once to derive a key and is never stored; the key stays in memory, non-extractable,
// while the vault is unlocked. Locking drops it.
//
// Deviation from PRD §9, which says "random salt and IV per write": the salt is per vault and the IV per write. A new salt
// would need the passphrase again on every save, and the passphrase is deliberately not kept.
import type { Statement } from '../parser/types';
import { deriveKey, ITERATIONS, randomBytes, seal, unseal } from './crypto';

export { WrongPassphraseError } from './crypto';

export const MIN_PASSPHRASE = 12;
export const AUTO_LOCK_MINUTES = [1, 5, 15, 60] as const;

export interface SavedProfile {
  label: string;
  statement: Statement;
}

export interface Payload {
  profiles: SavedProfile[];
  autoLockMinutes: number;
}

/** What is written to storage: no plaintext, only what is needed to derive the key and decrypt. */
export interface VaultRecord {
  version: 1;
  iterations: number;
  salt: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  data: Uint8Array<ArrayBuffer>;
}

export interface VaultStorage {
  read: () => Promise<VaultRecord | null>;
  write: (record: VaultRecord) => Promise<void>;
  clear: () => Promise<void>;
}

/** An unlocked vault: it can save, and nothing else. */
export interface Session {
  save: (payload: Payload) => Promise<void>;
}

const json = new TextEncoder();

function session(storage: VaultStorage, key: CryptoKey, salt: Uint8Array<ArrayBuffer>, iterations: number): Session {
  return {
    async save(payload) {
      const { iv, data } = await seal(key, json.encode(JSON.stringify(payload)));
      await storage.write({ version: 1, iterations, salt, iv, data });
    },
  };
}

export function createVault(storage: VaultStorage, iterations = ITERATIONS) {
  return {
    exists: async (): Promise<boolean> => (await storage.read()) !== null,

    /** Starts a vault with `payload`. Refuses a short passphrase, and never overwrites an existing vault. */
    async create(passphrase: string, payload: Payload): Promise<Session> {
      if (passphrase.length < MIN_PASSPHRASE) throw new Error(`The passphrase must be at least ${MIN_PASSPHRASE} characters.`);
      if (await storage.read()) throw new Error('Data is already saved on this device. Unlock it, or forget it first.');
      const salt = randomBytes(16);
      const opened = session(storage, await deriveKey(passphrase, salt, iterations), salt, iterations);
      await opened.save(payload);
      return opened;
    },

    /** Opens the vault. Throws WrongPassphraseError for a wrong passphrase or a damaged record. */
    async unlock(passphrase: string): Promise<{ session: Session; payload: Payload }> {
      const record = await storage.read();
      if (!record) throw new Error('Nothing is saved on this device.');
      if (record.version !== 1) throw new Error('The saved data was written by a newer version of Verax. Open it there, or forget it here.');
      const key = await deriveKey(passphrase, record.salt, record.iterations);
      const payload = JSON.parse(new TextDecoder().decode(await unseal(key, record.iv, record.data))) as Payload;
      return { session: session(storage, key, record.salt, record.iterations), payload };
    },

    /** Deletes the saved data. */
    forget: (): Promise<void> => storage.clear(),
  };
}

export type Vault = ReturnType<typeof createVault>;
