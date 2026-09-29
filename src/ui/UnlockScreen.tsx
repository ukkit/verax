import { useState } from 'preact/hooks';
import { WrongPassphraseError } from '../vault/vault';

/** Shown instead of the profiles while saved data is locked. */
export function UnlockScreen({ onUnlock, onForget }: { onUnlock: (passphrase: string) => Promise<void>; onForget: () => Promise<void> }) {
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);

  async function submit(event: Event) {
    event.preventDefault();
    const used = passphrase;
    setPassphrase('');
    setBusy(true);
    setMessage('');
    try {
      await onUnlock(used);
    } catch (error) {
      if (!(error instanceof WrongPassphraseError)) console.error('unlock_failed', { error });
      setMessage(error instanceof Error ? error.message : 'Unlocking failed unexpectedly. Reload the page and try again.');
      setBusy(false);
    }
  }

  return (
    <section class="panel" aria-labelledby="unlock-heading">
      <h2 id="unlock-heading">Unlock your saved statements</h2>
      <p class="hint">They are stored encrypted on this device. Enter the passphrase you chose. It is used once to open them and is not kept.</p>
      <form onSubmit={submit} class="drop">
        <label for="unlock-passphrase">Passphrase</label>
        <input id="unlock-passphrase" type="password" value={passphrase} onInput={(e) => setPassphrase((e.target as HTMLInputElement).value)} autocomplete="off" spellcheck={false} disabled={busy} />
        <button type="submit" disabled={!passphrase || busy}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
      {message && (
        <p class="msg error" role="alert">
          {message}
        </p>
      )}
      <p class="hint">
        Forgot it? It cannot be recovered. {confirming ? 'Delete the saved statements from this device?' : 'You can delete the saved statements and upload again.'}{' '}
        {confirming ? (
          <>
            <button type="button" class="secondary" onClick={() => onForget().catch((e) => setMessage(e instanceof Error ? e.message : 'Deleting failed.'))}>
              Yes, delete them
            </button>{' '}
            <button type="button" class="secondary" onClick={() => setConfirming(false)}>
              Keep them
            </button>
          </>
        ) : (
          <button type="button" class="secondary" onClick={() => setConfirming(true)}>
            Delete saved statements
          </button>
        )}
      </p>
    </section>
  );
}
