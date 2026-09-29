import { useState } from 'preact/hooks';
import { plot, rangeStart, type Box } from '../domain/chart';
import type { Trade } from '../domain/holdings';
import { formatDate, formatRupees } from './format';
import { useHistory } from './useHistory';

const RANGES = [['1Y', '1 year'], ['3Y', '3 years'], ['ALL', 'Since first purchase']] as const;
const BOX: Box = { width: 1000, height: 300, left: 64, bottom: 30, pad: 14 };

/** NAV history of one fund as an SVG line, with a marker for each purchase and sale. */
export function NavChart({ schemeCode, trades }: { schemeCode: number; trades: Trade[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number][0]>('1Y');
  const today = new Date().toISOString().slice(0, 10);
  const firstTrade = trades[0]?.date ?? today;
  const state = useHistory(schemeCode, rangeStart(range, today, firstTrade));
  const drawn = state.phase === 'ready' ? plot(state.points, trades, BOX) : null;

  return (
    <div class="chart">
      <div class="ranges" role="group" aria-label="Chart range">
        {RANGES.map(([id, label]) => (
          <button type="button" key={id} class={id === range ? 'tab current' : 'tab'} aria-pressed={id === range} onClick={() => setRange(id)}>
            {label}
          </button>
        ))}
      </div>
      {state.phase === 'loading' && <p class="msg" role="status">Loading the NAV history…</p>}
      {state.phase === 'error' && <p class="msg error" role="alert">{state.message}</p>}
      {state.phase === 'ready' && !drawn && <p class="msg">There is not enough NAV history in this range to draw a chart.</p>}
      {drawn && (
        <>
          <svg viewBox={`0 0 ${BOX.width} ${BOX.height}`} role="img" aria-label={`NAV from ${formatDate(drawn.from)} to ${formatDate(drawn.to)}, between ${formatRupees(drawn.min)} and ${formatRupees(drawn.max)}`}>
            <text x={BOX.left - 6} y={BOX.pad + 4} text-anchor="end" class="axis">{formatRupees(drawn.max)}</text>
            <text x={BOX.left - 6} y={BOX.height - BOX.bottom} text-anchor="end" class="axis">{formatRupees(drawn.min)}</text>
            <text x={BOX.left} y={BOX.height - 8} class="axis">{formatDate(drawn.from)}</text>
            <text x={BOX.width - BOX.pad} y={BOX.height - 8} text-anchor="end" class="axis">{formatDate(drawn.to)}</text>
            <line x1={BOX.left} x2={BOX.width - BOX.pad} y1={BOX.height - BOX.bottom} y2={BOX.height - BOX.bottom} class="grid" />
            <polyline class="nav-line" fill="none" points={drawn.line.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} />
            {drawn.markers.map((m, i) => (
              <circle key={i} cx={m.x} cy={m.y} r="4.5" class={m.side === 'buy' ? 'mark buy' : 'mark sell'}>
                <title>{`${m.side === 'buy' ? 'Bought' : 'Sold'} on ${formatDate(m.date)}, NAV ${formatRupees(m.nav)}`}</title>
              </circle>
            ))}
          </svg>
          <p class="hint">
            <span class="dot buy" /> purchase <span class="dot sell" /> sale
          </p>
        </>
      )}
    </div>
  );
}
