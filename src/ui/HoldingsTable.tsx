import { useState } from 'preact/hooks';
import { isSchemeCode } from '../nav';
import type { ValuedPosition } from '../valuation/value';
import { NavChart } from './NavChart';
import { formatDate, formatPercent, formatRupees, formatSignedRupees, formatUnits, trend } from './format';

const dash = '—';

/** Asks for the mfnav.in scheme code of a fund that could not be matched by ISIN. */
function CodeForm({ onSubmit }: { onSubmit: (code: number) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  return (
    <form
      class="override"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isSchemeCode(text)) return setError('A scheme code is 3 to 8 digits. Look it up in the box at the bottom of the page.');
        setError('');
        onSubmit(Number(text.trim()));
      }}
    >
      <input type="text" inputMode="numeric" value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} aria-label="mfnav.in scheme code" placeholder="Scheme code" autocomplete="off" />
      <button type="submit" class="secondary">
        Use
      </button>
      {error && <span class="sub bad">{error}</span>}
    </form>
  );
}

function SchemeCell({ v, onOverride, charted, onChart }: { v: ValuedPosition; onOverride?: (id: string, code: number) => void; charted?: boolean; onChart?: () => void }) {
  return (
    <td data-label="Scheme">
      <strong>{v.position.name}</strong>
      <span class="sub">
        {v.position.amc} · folio {v.position.folioMasked}
      </span>
      {v.issue && <span class="sub warn">{v.issue}</span>}
      {v.issue && onOverride && <CodeForm onSubmit={(code) => onOverride(v.position.id, code)} />}
      {onChart && v.quote?.schemeCode != null && (
        <button type="button" class="link" aria-expanded={charted} onClick={onChart}>
          {charted ? 'Hide NAV chart' : 'NAV chart'}
        </button>
      )}
    </td>
  );
}

export function OpenTable({ rows, stale, onOverride }: { rows: ValuedPosition[]; stale: ReadonlySet<string>; onOverride: (id: string, code: number) => void }) {
  const [charted, setCharted] = useState<string | null>(null);
  return (
    <div class="table-wrap">
      <table class="schemes">
        <thead>
          <tr>
            <th scope="col">Scheme</th>
            <th scope="col" class="num">Units</th>
            <th scope="col" class="num">Avg cost</th>
            <th scope="col" class="num">Invested</th>
            <th scope="col" class="num">Value</th>
            <th scope="col" class="num">Gain</th>
            <th scope="col" class="num">Latest change</th>
            <th scope="col" class="num">XIRR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <>
            <tr key={v.position.id} class={v.value === null ? 'excluded' : ''}>
              <SchemeCell v={v} onOverride={onOverride} charted={charted === v.position.id} onChart={() => setCharted(charted === v.position.id ? null : v.position.id)} />
              <td data-label="Units" class="num">{formatUnits(v.position.units)}</td>
              <td data-label="Avg cost" class="num">{v.position.avgCost === null ? dash : formatRupees(v.position.avgCost)}</td>
              <td data-label="Invested" class="num">{formatRupees(v.position.invested)}</td>
              <td data-label="Value" class="num">
                {v.value === null ? dash : formatRupees(v.value)}
                {v.quote && (
                  <span class="sub">
                    NAV {formatRupees(v.quote.nav)} · {formatDate(v.quote.date)}
                    {v.quote.from === 'statement' && ' (statement)'}
                    {stale.has(v.position.id) && <span class="badge" title="This NAV is older than the newest NAV in your portfolio">Older NAV</span>}
                  </span>
                )}
              </td>
              <td data-label="Gain" class={`num ${v.gain === null ? '' : trend(v.gain)}`}>
                {v.gain === null ? dash : formatSignedRupees(v.gain)}
                {v.gainPct !== null && <span class="sub">{formatPercent(v.gainPct)}</span>}
              </td>
              <td data-label="Latest change" class={`num ${v.dayChange === null ? '' : trend(v.dayChange)}`}>{v.dayChange === null ? dash : formatSignedRupees(v.dayChange)}</td>
              <td data-label="XIRR" class="num">{v.xirr === null ? dash : formatPercent(v.xirr)}</td>
            </tr>
            {charted === v.position.id && v.quote?.schemeCode != null && (
              <tr class="chart-row">
                <td colSpan={8}>
                  <NavChart schemeCode={v.quote.schemeCode} trades={v.position.trades} />
                </td>
              </tr>
            )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClosedTable({ rows }: { rows: ValuedPosition[] }) {
  return (
    <div class="table-wrap">
      <table class="schemes">
        <thead>
          <tr>
            <th scope="col">Scheme</th>
            <th scope="col" class="num">Realised gain</th>
            <th scope="col" class="num">XIRR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.position.id}>
              <SchemeCell v={v} />
              <td data-label="Realised gain" class={`num ${trend(v.position.realised)}`}>{formatSignedRupees(v.position.realised)}</td>
              <td data-label="XIRR" class="num">{v.xirr === null ? dash : formatPercent(v.xirr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
