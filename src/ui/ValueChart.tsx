import { useMemo, useState } from 'preact/hooks';
import { plotLines, yearTicks, type Box } from '../domain/chart';
import type { Position } from '../domain/holdings';
import { sampleDates, timeline, type TimelinePoint } from '../domain/timeline';
import { chartInputs, fetchHistories, type ChartInputs } from '../valuation/timeline';
import type { PositionQuote } from '../valuation/quotes';
import { navSource } from '../valuation/session';
import { formatCompactRupees, formatDate, formatRupees } from './format';

const BOX: Box = { width: 1000, height: 320, left: 64, bottom: 30, pad: 14 };

type State =
  | { phase: 'idle' }
  | { phase: 'loading'; done: number; total: number }
  | { phase: 'ready'; points: TimelinePoint[]; approximate: ChartInputs['approximate']; left: ChartInputs['left'] }
  | { phase: 'error'; message: string };

/** How much was invested against what it was worth, month by month, from the first purchase to today. Loaded on request. */
export function ValueChart({ positions, quotes }: { positions: readonly Position[]; quotes: ReadonlyMap<string, PositionQuote> }) {
  const [state, setState] = useState<State>({ phase: 'idle' });
  const codes = useMemo(() => new Map([...quotes].flatMap(([id, q]) => (q.quote?.schemeCode != null ? [[id, q.quote.schemeCode] as [string, number]] : []))), [quotes]);

  async function load() {
    setState({ phase: 'loading', done: 0, total: positions.length });
    try {
      const histories = await fetchHistories(positions, codes, navSource, (done, total) => setState({ phase: 'loading', done, total }));
      const today = new Date().toISOString().slice(0, 10);
      const { inputs, approximate, left } = chartInputs(positions, histories, new Map([...quotes].map(([id, q]) => [id, q.quote ? { date: q.quote.date, nav: q.quote.nav } : null])));
      const first = inputs.map((p) => p.steps[0]!.date).sort()[0];
      const points = first ? timeline(inputs, sampleDates(first, today)) : [];
      setState({ phase: 'ready', points, approximate, left });
    } catch (error) {
      console.error('timeline_failed', { error });
      setState({ phase: 'error', message: 'Loading the history failed unexpectedly. Reload the page and try again.' });
    }
  }

  const plotted = state.phase === 'ready' ? plotLines([state.points.map((p) => ({ date: p.date, value: p.invested })), state.points.map((p) => ({ date: p.date, value: p.value }))], BOX) : null;
  const last = state.phase === 'ready' ? state.points[state.points.length - 1] : undefined;

  return (
    <section class="value-chart" aria-labelledby="value-heading">
      <h3 id="value-heading">Invested and worth over the years</h3>
      {state.phase === 'idle' && (
        <>
          <p class="hint">Loads each fund’s NAV history (a few dozen requests for a large portfolio, so it takes a little while). Closed funds are included, because you held them then.</p>
          <button type="button" class="secondary" onClick={load}>
            Show over time
          </button>
        </>
      )}
      {state.phase === 'loading' && (
        <p class="msg" role="status">
          Loading NAV history… {state.done} of {state.total} funds. Requests are paced to stay under mfnav.in’s limit, so a large portfolio can take a few minutes.
        </p>
      )}
      {state.phase === 'error' && (
        <p class="msg error" role="alert">
          {state.message}
        </p>
      )}
      {state.phase === 'ready' && !plotted && state.left.length === 0 && <p class="msg">There is no history to draw for these funds yet.</p>}
      {state.phase === 'ready' && plotted && last && (
        <>
          <svg viewBox={`0 0 ${BOX.width} ${BOX.height}`} role="img" aria-label={`Invested ${formatRupees(last.invested)} and worth ${formatRupees(last.value)} on ${formatDate(last.date)}, from ${formatDate(plotted.from)}`}>
            <text x={BOX.left - 6} y={BOX.pad + 4} text-anchor="end" class="axis">{formatCompactRupees(plotted.max)}</text>
            <text x={BOX.left - 6} y={BOX.height - BOX.bottom} text-anchor="end" class="axis">₹0</text>
            <line x1={BOX.left} x2={BOX.width - BOX.pad} y1={BOX.height - BOX.bottom} y2={BOX.height - BOX.bottom} class="grid" />
            <text x={BOX.left} y={BOX.height - 8} class="axis">{formatDate(plotted.from)}</text>
            {yearTicks(plotted.from, plotted.to, BOX).map((t) => (
              <text key={t.label} x={t.x} y={BOX.height - 8} text-anchor="middle" class="axis">{t.label}</text>
            ))}
            <polyline class="line-value" fill="none" points={plotted.lines[1]!.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} />
            <polyline class="line-invested" fill="none" points={plotted.lines[0]!.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} />
            {state.points.map((p, i) => (
              <circle key={p.date} cx={plotted.lines[1]![i]!.x} cy={plotted.lines[1]![i]!.y} r="5" class="hit">
                <title>{`${formatDate(p.date)}: invested ${formatRupees(p.invested)}, worth ${formatRupees(p.value)}`}</title>
              </circle>
            ))}
          </svg>
          <p class="hint">
            <span class="dot value" /> worth then <span class="dot invested" /> invested (cost of the units held). Today: {formatRupees(last.value)} worth, {formatRupees(last.invested)} invested.
          </p>
        </>
      )}
      {state.phase === 'ready' && state.approximate.length > 0 && (
        <div class="banner" role="status">
          <strong>
            {state.approximate.length} {state.approximate.length === 1 ? 'fund is' : 'funds are'} drawn from the NAVs on your statement, so the worth line is approximate.
          </strong>{' '}
          Their NAV history could not be loaded, so each is valued at the NAV of its latest transaction and stays flat until the next one.
          <ul>
            {[...new Set(state.approximate.map((a) => a.reason))].map((reason) => (
              <li key={reason}>
                {reason} ({state.approximate.filter((a) => a.reason === reason).length})
              </li>
            ))}
          </ul>
          <details>
            <summary>Which funds</summary>
            <ul>
              {state.approximate.map((a) => (
                <li key={a.position.id}>
                  {a.position.name} (folio {a.position.folioMasked})
                </li>
              ))}
            </ul>
          </details>{' '}
          <button type="button" class="secondary" onClick={load}>
            Try again
          </button>
        </div>
      )}
      {state.phase === 'ready' && state.left.length > 0 && (
        <div class="banner error" role="alert">
          <strong>
            {state.left.length} {state.left.length === 1 ? 'fund is' : 'funds are'} left out of this chart, with no NAV history and no NAV on the statement:
          </strong>
          <ul>
            {state.left.map((m) => (
              <li key={m.position.id}>
                {m.position.name} (folio {m.position.folioMasked}): {m.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
