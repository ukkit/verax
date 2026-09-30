import { useState } from 'preact/hooks';
import type { Statement } from './parser/types';
import { ProfileView } from './ui/ProfileView';
import { UnlockScreen } from './ui/UnlockScreen';
import { UploadForm } from './ui/UploadForm';
import { useIdleLock, useVault } from './ui/useVault';
import { VaultBar } from './ui/VaultBar';

interface Profile {
  /** New for every upload or unlock, so a replaced profile starts fresh. */
  id: number;
  label: string;
  statement: Statement;
}

let nextId = 0;
const toSaved = (profiles: Profile[]) => profiles.map(({ label, statement }) => ({ label, statement }));

export function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const vault = useVault();

  function change(next: Profile[], activate: number | null) {
    setProfiles(next);
    setActiveId(activate);
    setAdding(false);
    void vault.save(toSaved(next));
  }

  // A profile uploaded again under the same name is replaced: the newest statement wins.
  function add(label: string, statement: Statement) {
    const profile = { id: nextId++, label, statement };
    change([...profiles.filter((p) => p.label.toLowerCase() !== label.toLowerCase()), profile], profile.id);
  }

  function remove(id: number) {
    const rest = profiles.filter((p) => p.id !== id);
    change(rest, rest[0]?.id ?? null);
  }

  // Locking drops every statement from memory; only the encrypted copy remains.
  function lock() {
    vault.lock();
    setProfiles([]);
    setActiveId(null);
    setAdding(false);
  }
  useIdleLock(vault.status === 'unlocked', vault.autoLockMinutes, lock);

  async function unlock(passphrase: string) {
    const restored = (await vault.unlock(passphrase)).map((p) => ({ id: nextId++, ...p }));
    setProfiles(restored);
    setActiveId(restored[0]?.id ?? null);
  }

  const active = profiles.find((p) => p.id === activeId);
  const locked = vault.status === 'locked';
  return (
    <>
      <main>
        <div class="masthead">
          <h1>
            <img src="/favicon.svg" alt="" width="28" height="28" />
            Verax
          </h1>
          <p class="tagline">The true return on your mutual funds.</p>
        </div>
        <p class="lede">Import your CAS (Consolidated Account Statement) to see what it holds. Your statement is read in this browser and never leaves your device.</p>
        <VaultBar
          status={vault.status}
          problem={vault.problem}
          autoLockMinutes={vault.autoLockMinutes}
          hasProfiles={profiles.length > 0}
          onEnable={(passphrase) => vault.enable(passphrase, toSaved(profiles))}
          onLock={lock}
          onForget={vault.forget}
          onAutoLock={(minutes) => void vault.setAutoLock(minutes, toSaved(profiles))}
        />
        {locked && <UnlockScreen onUnlock={unlock} onForget={vault.forget} />}
        {!locked && profiles.length > 0 && (
          <nav class="tabs" aria-label="Profiles">
            {profiles.map((p) => (
              <button type="button" key={p.id} class={p.id === active?.id && !adding ? 'tab current' : 'tab'} aria-current={p.id === active?.id && !adding ? 'page' : undefined} onClick={() => { setActiveId(p.id); setAdding(false); }}>
                {p.label}
              </button>
            ))}
            <button type="button" class={adding ? 'tab current' : 'tab'} onClick={() => setAdding(true)}>
              + Add profile
            </button>
          </nav>
        )}
        {!locked && vault.status !== 'checking' && (adding || !active) && <UploadForm onParsed={add} onCancel={active ? () => setAdding(false) : undefined} />}
        {!locked && active && !adding && <ProfileView key={active.id} label={active.label} statement={active.statement} onClear={() => remove(active.id)} />}
      </main>
      <footer>
        NAVs from mfnav.in (sourced from AMFI). Figures are informational only and not investment advice. Verify with your AMC or CAS before acting.
      </footer>
    </>
  );
}
