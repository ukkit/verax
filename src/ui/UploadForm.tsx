import { useState } from 'preact/hooks';
import { parseStatementFile } from '../parser/client';
import { ParseError } from '../parser/errors';
import type { Statement } from '../parser/types';

type State = { phase: 'idle' } | { phase: 'reading'; page: number; total: number } | { phase: 'error'; message: string };

const isPdf = (file: File) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

export function UploadForm({ onParsed, onCancel }: { onParsed: (label: string, statement: Statement) => void; onCancel?: () => void }) {
  const [label, setLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [dragging, setDragging] = useState(false);

  function choose(chosen: File | undefined) {
    if (!chosen) return;
    if (!isPdf(chosen)) return setState({ phase: 'error', message: 'That file is not a PDF. Choose the statement PDF you received from CAMS or KFintech.' });
    setFile(chosen);
    setState({ phase: 'idle' });
  }

  async function read(event: Event) {
    event.preventDefault();
    if (!file || !label.trim()) return;
    const used = password;
    setPassword(''); // the password is only ever held for one attempt
    setState({ phase: 'reading', page: 0, total: 0 });
    try {
      const statement = await parseStatementFile(file, used, (page, total) => setState({ phase: 'reading', page, total }));
      onParsed(label.trim(), statement);
    } catch (error) {
      if (error instanceof ParseError) return setState({ phase: 'error', message: error.message });
      console.error('statement_read_failed', { error });
      setState({ phase: 'error', message: 'Reading the statement failed unexpectedly. Reload the page and try again.' });
    }
  }

  const reading = state.phase === 'reading';
  return (
    <section class="panel" aria-labelledby="statement-heading">
      <h2 id="statement-heading">Your statement</h2>
      <p class="hint">Choose your CAMS or KFintech “Detailed” statement (PDF). It is read in this browser and is never uploaded.</p>

      <form
        onSubmit={read}
        class={dragging ? 'drop dragging' : 'drop'}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          choose(e.dataTransfer?.files[0]);
        }}
      >
        <label for="profile-label">Whose statement is this? (a name for this profile)</label>
        <input id="profile-label" type="text" value={label} onInput={(e) => setLabel((e.target as HTMLInputElement).value)} maxLength={30} autocomplete="off" disabled={reading} />

        <label for="statement-file">Statement PDF (or drop it here)</label>
        <input id="statement-file" type="file" accept="application/pdf,.pdf" onChange={(e) => choose((e.target as HTMLInputElement).files?.[0])} disabled={reading} />
        {file && <p class="picked">Selected: {file.name}</p>}

        <label for="statement-password">PDF password, if it has one</label>
        <input id="statement-password" type="password" value={password} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} autocomplete="off" spellcheck={false} disabled={reading} />
        <p class="hint">Usually your PAN in capital letters, or the one you chose when you requested the statement. It is used once to open the file and is not kept.</p>

        <button type="submit" disabled={!file || !label.trim() || reading}>
          {reading ? 'Reading…' : 'Read statement'}
        </button>
        {onCancel && (
          <button type="button" class="secondary" onClick={onCancel} disabled={reading}>
            Cancel
          </button>
        )}
      </form>

      {reading && (
        <p class="msg" role="status">
          {state.total ? `Reading page ${state.page} of ${state.total}…` : 'Opening the file…'}
        </p>
      )}
      {state.phase === 'error' && (
        <p class="msg error" role="alert">
          {state.message}
        </p>
      )}
    </section>
  );
}
