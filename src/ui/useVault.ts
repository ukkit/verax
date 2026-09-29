import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { idbStorage } from '../vault/idbStorage';
import { createVault, type SavedProfile, type Session } from '../vault/vault';

export type VaultStatus = 'checking' | 'unavailable' | 'none' | 'locked' | 'unlocked';

const vault = createVault(idbStorage);
export const DEFAULT_AUTO_LOCK = 5;

/**
 * The opt-in encrypted store. Status moves none -> unlocked (Remember) -> locked (lock, auto-lock, reload) -> unlocked
 * (passphrase). Passphrases are passed straight through and never held. `save` does nothing unless unlocked.
 */
export function useVault() {
  const [status, setStatus] = useState<VaultStatus>('checking');
  const [autoLockMinutes, setAutoLockMinutes] = useState(DEFAULT_AUTO_LOCK);
  const [problem, setProblem] = useState<string | null>(null);
  const session = useRef<Session | null>(null);

  useEffect(() => {
    vault.exists().then(
      (exists) => setStatus(exists ? 'locked' : 'none'),
      (error) => {
        console.error('vault_unavailable', { error });
        setProblem(error instanceof Error ? error.message : 'Saving on this device is not available in this browser.');
        setStatus('unavailable');
      },
    );
  }, []);

  const save = useCallback(async (profiles: SavedProfile[], minutes = autoLockMinutes): Promise<void> => {
    if (!session.current) return;
    try {
      await session.current.save({ profiles, autoLockMinutes: minutes });
      setProblem(null);
    } catch (error) {
      console.error('vault_save_failed', { error });
      setProblem(`Could not save to this device: ${error instanceof Error ? error.message : 'unknown error'}. What you see now is not saved.`);
    }
  }, [autoLockMinutes]);

  return {
    status,
    autoLockMinutes,
    problem,
    save,
    /** Starts saving `profiles` under a new passphrase. Throws if the passphrase is too short. */
    async enable(passphrase: string, profiles: SavedProfile[]): Promise<void> {
      session.current = await vault.create(passphrase, { profiles, autoLockMinutes });
      setProblem(null);
      setStatus('unlocked');
    },
    /** Opens the saved data and returns its profiles. Throws WrongPassphraseError for a wrong passphrase. */
    async unlock(passphrase: string): Promise<SavedProfile[]> {
      const opened = await vault.unlock(passphrase);
      session.current = opened.session;
      setAutoLockMinutes(opened.payload.autoLockMinutes);
      setProblem(null);
      setStatus('unlocked');
      return opened.payload.profiles;
    },
    lock(): void {
      session.current = null;
      setStatus('locked');
    },
    async forget(): Promise<void> {
      await vault.forget();
      session.current = null;
      setProblem(null);
      setStatus('none');
    },
    async setAutoLock(minutes: number, profiles: SavedProfile[]): Promise<void> {
      setAutoLockMinutes(minutes);
      await save(profiles, minutes);
    },
  };
}

/** Calls `onLock` after `minutes` without a keypress, click, touch or scroll. Checked on a timer and on tab focus, so a sleeping laptop locks on wake. */
export function useIdleLock(active: boolean, minutes: number, onLock: () => void): void {
  const last = useRef(Date.now());
  const lock = useRef(onLock);
  lock.current = onLock;
  useEffect(() => {
    if (!active) return;
    last.current = Date.now();
    const touch = () => (last.current = Date.now());
    const check = () => {
      if (Date.now() - last.current >= minutes * 60_000) lock.current();
    };
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener('visibilitychange', check);
    const timer = setInterval(check, 10_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener('visibilitychange', check);
      clearInterval(timer);
    };
  }, [active, minutes]);
}
