import type { VaultRecord, VaultStorage } from './vault';

const DB = 'verax';
const STORE = 'vault';
const KEY = 'v1';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`Saving on this device is not available in this browser (${request.error?.message ?? 'storage refused'}).`));
  });
}

async function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = act(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Reading or writing the saved data failed (${request.error?.message ?? 'unknown error'}).`));
    });
  } finally {
    db.close();
  }
}

/** The vault's one record in IndexedDB. It holds ciphertext only. */
export const idbStorage: VaultStorage = {
  read: async () => ((await run<VaultRecord | undefined>('readonly', (s) => s.get(KEY))) ?? null),
  write: async (record) => void (await run('readwrite', (s) => s.put(record, KEY))),
  clear: async () => void (await run('readwrite', (s) => s.delete(KEY))),
};
