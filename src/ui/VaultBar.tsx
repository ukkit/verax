import { useState } from 'preact/hooks';
import type { VaultStatus } from './useVault';
import { AUTO_LOCK_MINUTES, MIN_PASSPHRASE } from '../vault/vault';

interface Props {
  status: VaultStatus;
  problem: string | null;
  autoLockMinutes: number;
  hasProfiles: boolean;
  onEnable: (passphrase: string) => Promise<void>;
  onLock: () => void;
  onForget: () => Promise<void>;
  onAutoLock: (minutes: number) => void;
}

function RememberForm({ onEnable }: { onEnable: (passphrase: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: Event) {
    event.preventDefault();
    if (first.length < MIN_PASSPHRASE) return setMessage(`Use at least ${MIN_PASSPHRASE} characters.`);
    if (first !== second) return setMessage('The two passphrases are different.');
    const used = first;
    setFirst('');
    setSecond('');
    setBusy(true);
    setMessage('');
    try {
      await onEnable(used);
    } catch (error) {
      console.error('remember_failed', { error });
      setMessage(error instanceof Error ? error.message : 'Saving failed unexpectedly. Reload the page and try again.');
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button type="button" class="secondary" onClick={() => setOpen(true)}>
        Remember on this device
      </button>
    );
  return (
    <form onSubmit={submit} class="drop">
      <p class="hint">
        Your statements are encrypted with a passphrase and saved in this browser, so you do not have to upload them again. The passphrase is not stored anywhere, so <strong>if you forget it the saved data cannot be recovered</strong>; you would upload the statements again. Do not use this on a shared computer.
      </p>
      <label for="remember-1">Passphrase (at least {MIN_PASSPHRASE} characters)</label>
      <input id="remember-1" type="password" value={first} onInput={(e) => setFirst((e.target as HTMLInputElement).value)} autocomplete="new-password" spellcheck={false} disabled={busy} />
      <label for="remember-2">Type it again</label>
      <input id="remember-2" type="password" value={second} onInput={(e) => setSecond((e.target as HTMLInputElement).value)} autocomplete="new-password" spellcheck={false} disabled={busy} />
      <div class="row">
        <button type="submit" disabled={busy || !first}>
          {busy ? 'Saving…' : 'Save encrypted'}
        </button>
        <button type="button" class="secondary" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
      {message && (
        <p class="msg error" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}

/** The saved-data controls above the profiles: turn it on, or lock, set the auto-lock time and delete once it is on. */
export function VaultBar({ status, problem, autoLockMinutes, hasProfiles, onEnable, onLock, onForget, onAutoLock }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState('');
  if (status === 'checking' || status === 'locked') return null;
  if (status === 'unavailable')
    return (
      <p class="hint" role="status">
        {problem ?? 'Saving on this device is not available in this browser.'} Your statements stay in memory only.
      </p>
    );
  return (
    <div class="vaultbar">
      {status === 'none' && hasProfiles && <RememberForm onEnable={onEnable} />}
      {status === 'unlocked' && (
        <>
          <span class="ok">✓ Saved on this device, encrypted</span>
          <button type="button" class="secondary" onClick={onLock}>
            Lock now
          </button>
          <label class="inline">
            Lock after
            <select value={autoLockMinutes} onChange={(e) => onAutoLock(Number((e.target as HTMLSelectElement).value))}>
              {AUTO_LOCK_MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m === 60 ? '1 hour' : `${m} ${m === 1 ? 'minute' : 'minutes'}`} idle
                </option>
              ))}
            </select>
          </label>
          {confirming ? (
            <>
              <button type="button" class="secondary" onClick={() => onForget().then(() => setConfirming(false), (e) => setFailure(e instanceof Error ? e.message : 'Deleting failed.'))}>
                Yes, delete saved data
              </button>
              <button type="button" class="secondary" onClick={() => setConfirming(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button type="button" class="secondary" onClick={() => setConfirming(true)}>
              Stop saving and delete
            </button>
          )}
        </>
      )}
      {(problem || failure) && (
        <p class="msg error" role="alert">
          {problem ?? failure}
        </p>
      )}
    </div>
  );
}
