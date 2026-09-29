import { describe, expect, it } from 'vitest';
import type { Statement } from '../parser/types';
import { unseal, WrongPassphraseError } from './crypto';
import { createVault, MIN_PASSPHRASE, type Payload, type VaultRecord, type VaultStorage } from './vault';

// A few iterations keep the tests quick; the derivation is the same code path.
const ITER = 10;
const PASS = 'correct horse battery staple';

const memory = (): VaultStorage & { record: VaultRecord | null; writes: number } => {
  const s = {
    record: null as VaultRecord | null,
    writes: 0,
    read: async () => s.record,
    write: async (r: VaultRecord) => { s.record = r; s.writes++; },
    clear: async () => { s.record = null; },
  };
  return s;
};

const statement: Statement = { source: 'CAMS', period: { from: '2020-04-01', to: '2026-09-17' }, warnings: [], folios: [{ id: 'f1', amc: 'Sample Mutual Fund', folioMasked: '••••1234', schemes: [] }] };
const payload: Payload = { profiles: [{ label: 'Asha', statement }], autoLockMinutes: 5 };

describe('vault', () => {
  it('round-trips a payload through the passphrase', async () => {
    const storage = memory();
    const vault = createVault(storage, ITER);
    await vault.create(PASS, payload);
    expect(await vault.exists()).toBe(true);
    expect((await vault.unlock(PASS)).payload).toEqual(payload);
  });

  it('stores no plaintext', async () => {
    const storage = memory();
    await createVault(storage, ITER).create(PASS, payload);
    const raw = new TextDecoder('latin1').decode(storage.record!.data);
    expect(raw).not.toContain('Asha');
    expect(raw).not.toContain('1234');
    expect(JSON.stringify(Object.keys(storage.record!))).not.toContain('Asha');
  });

  it('rejects a wrong passphrase and a tampered record with the same error', async () => {
    const storage = memory();
    const vault = createVault(storage, ITER);
    await vault.create(PASS, payload);
    await expect(vault.unlock('another passphrase!')).rejects.toBeInstanceOf(WrongPassphraseError);
    storage.record!.data[0] = storage.record!.data[0]! ^ 1;
    await expect(vault.unlock(PASS)).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it('uses a new IV for every save and keeps the salt', async () => {
    const storage = memory();
    const vault = createVault(storage, ITER);
    const session = await vault.create(PASS, payload);
    const first = storage.record!;
    await session.save({ ...payload, autoLockMinutes: 15 });
    expect(storage.writes).toBe(2);
    expect(storage.record!.iv).not.toEqual(first.iv);
    expect(storage.record!.salt).toEqual(first.salt);
    expect((await vault.unlock(PASS)).payload.autoLockMinutes).toBe(15);
  });

  it('saves through a session opened by unlock', async () => {
    const storage = memory();
    const vault = createVault(storage, ITER);
    await vault.create(PASS, payload);
    const { session } = await vault.unlock(PASS);
    await session.save({ profiles: [], autoLockMinutes: 1 });
    expect((await vault.unlock(PASS)).payload).toEqual({ profiles: [], autoLockMinutes: 1 });
  });

  it('refuses a short passphrase and an existing vault', async () => {
    const vault = createVault(memory(), ITER);
    await expect(vault.create('x'.repeat(MIN_PASSPHRASE - 1), payload)).rejects.toThrow(/at least 12/);
    await vault.create(PASS, payload);
    await expect(vault.create(PASS, payload)).rejects.toThrow(/already saved/);
  });

  it('forgets everything', async () => {
    const storage = memory();
    const vault = createVault(storage, ITER);
    await vault.create(PASS, payload);
    await vault.forget();
    expect(await vault.exists()).toBe(false);
    await expect(vault.unlock(PASS)).rejects.toThrow(/Nothing is saved/);
  });

  it('refuses a record from a newer version', async () => {
    const storage = memory();
    const vault = createVault(storage, ITER);
    await vault.create(PASS, payload);
    (storage.record as { version: number }).version = 2;
    await expect(vault.unlock(PASS)).rejects.toThrow(/newer version/);
  });

  it('cannot be opened with an unrelated key', async () => {
    const storage = memory();
    await createVault(storage, ITER).create(PASS, payload);
    const key = await crypto.subtle.importKey('raw', new Uint8Array(32), 'AES-GCM', false, ['decrypt']);
    await expect(unseal(key, storage.record!.iv, storage.record!.data)).rejects.toBeInstanceOf(WrongPassphraseError);
  });
});
