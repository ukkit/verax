import { useState } from 'preact/hooks';
import type { Statement } from './parser/types';
import { NavLookup } from './ui/NavLookup';
import { ProfileView } from './ui/ProfileView';
import { UploadForm } from './ui/UploadForm';

interface Profile {
  /** New for every upload, so a replaced profile starts fresh. */
  id: number;
  label: string;
  statement: Statement;
}

let nextId = 0;

export function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  // A profile uploaded again under the same name is replaced: the newest statement wins.
  function add(label: string, statement: Statement) {
    const profile = { id: nextId++, label, statement };
    setProfiles((prev) => [...prev.filter((p) => p.label.toLowerCase() !== label.toLowerCase()), profile]);
    setActiveId(profile.id);
    setAdding(false);
  }

  function remove(id: number) {
    const rest = profiles.filter((p) => p.id !== id);
    setProfiles(rest);
    setActiveId(rest[0]?.id ?? null);
  }

  const active = profiles.find((p) => p.id === activeId);
  return (
    <>
      <main>
        <h1>Verax</h1>
        <p class="tagline">The true return on your funds.</p>
        <p class="lede">Open your CAS to see what it holds. Your statement is read in this browser and never leaves your device.</p>
        {profiles.length > 0 && (
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
        {(adding || !active) && <UploadForm onParsed={add} onCancel={active ? () => setAdding(false) : undefined} />}
        {active && !adding && <ProfileView key={active.id} label={active.label} statement={active.statement} onClear={() => remove(active.id)} />}
        <NavLookup />
      </main>
      <footer>
        NAVs from mfnav.in (sourced from AMFI). Figures are informational only and not investment advice. Verify with your AMC or CAS before acting.
      </footer>
    </>
  );
}
