import type { Totals as TotalsData } from '../valuation/value';
import { formatPercent, formatRupees, formatSignedRupees, trend } from './format';

/** The portfolio headline: the return (XIRR) first, then value, gain and today's change. */
export function Totals({ totals, hasClosed }: { totals: TotalsData; hasClosed: boolean }) {
  return (
    <dl class="totals">
      <div class="lead">
        <dt>Return (XIRR)</dt>
        <dd class={totals.xirr === null ? '' : trend(totals.xirr)}>{totals.xirr === null ? '—' : formatPercent(totals.xirr)}</dd>
        <span class="sub">a year, counting closed positions</span>
      </div>
      <div>
        <dt>Current value</dt>
        <dd>{formatRupees(totals.value)}</dd>
      </div>
      <div>
        <dt>Invested</dt>
        <dd>{formatRupees(totals.invested)}</dd>
      </div>
      <div>
        <dt>Gain</dt>
        <dd class={trend(totals.gain)}>{formatSignedRupees(totals.gain)}</dd>
        {totals.returnPct !== null && <span class="sub">{formatPercent(totals.returnPct)}</span>}
      </div>
      <div>
        <dt>Change on the latest NAV</dt>
        <dd class={trend(totals.dayChange)}>{formatSignedRupees(totals.dayChange)}</dd>
      </div>
      {hasClosed && (
        <div>
          <dt>Realised gain</dt>
          <dd class={trend(totals.realised)}>{formatSignedRupees(totals.realised)}</dd>
        </div>
      )}
    </dl>
  );
}
