import { useMemo, useState } from 'preact/hooks';
import { buildPortfolio } from '../domain/holdings';
import { summarize } from '../parser/summary';
import type { SourceKind, Statement } from '../parser/types';
import type { Overrides } from '../valuation/quotes';
import { staleIds, valuePortfolio } from '../valuation/value';
import { formatDate } from './format';
import { Allocation } from './Allocation';
import { ClosedTable, OpenTable } from './HoldingsTable';
import { Totals } from './Totals';
import { Transactions } from './Transactions';
import { useQuotes } from './useQuotes';

const BETA: Record<Exclude<SourceKind, 'CAMS'>, string> = {
  KFINTECH: 'This looks like a KFintech statement. Support for KFintech statements is in beta: please check the figures below against your statement.',
  UNKNOWN: 'The issuer of this statement could not be identified, so it was read as a CAMS-style statement. Support is in beta: please check the figures below against your statement.',
};

export function ProfileView({ label, statement, onClear }: { label: string; statement: Statement; onClear: () => void }) {
  const { rows, folioCount } = useMemo(() => summarize(statement), [statement]);
  const portfolio = useMemo(() => buildPortfolio(statement), [statement]);
  const [overrides, setOverrides] = useState<Overrides>(new Map());
  const { quotes, error } = useQuotes(portfolio.open, overrides);
  const valued = useMemo(() => (quotes ? valuePortfolio(portfolio, quotes) : null), [portfolio, quotes]);
  const stale = useMemo(() => (valued ? staleIds(valued.open) : new Set<string>()), [valued]);

  return (
    <section class="panel" aria-labelledby="profile-heading">
      <div class="panel-head">
        <h2 id="profile-heading">{label}</h2>
        <button type="button" class="secondary" onClick={onClear}>
          Remove this profile
        </button>
      </div>
      <p class="hint">
        {statement.period ? `${formatDate(statement.period.from)} to ${formatDate(statement.period.to)} · ` : ''}
        {rows.length} {rows.length === 1 ? 'scheme' : 'schemes'} in {folioCount} {folioCount === 1 ? 'folio' : 'folios'}. Held in this browser only; it is gone when you remove it or close the tab.
      </p>

      {statement.source !== 'CAMS' && (
        <p class="banner" role="status">
          {BETA[statement.source]}
        </p>
      )}
      {statement.warnings.length > 0 && (
        <div class="banner error" role="alert">
          <strong>Some of the statement could not be read.</strong>
          <ul>
            {statement.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      {portfolio.excluded.length > 0 && (
        <div class="banner error" role="alert">
          <strong>
            {portfolio.excluded.length} {portfolio.excluded.length === 1 ? 'scheme is' : 'schemes are'} left out of every total:
          </strong>
          <ul>
            {portfolio.excluded.map((e) => (
              <li key={`${e.folioId}-${e.name}`}>
                {e.name} (folio {e.folioMasked}): {e.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p class="msg error" role="alert">
          {error}
        </p>
      )}
      {!valued && !error && (
        <p class="msg" role="status">
          Fetching today’s NAVs…
        </p>
      )}
      {valued && (
        <>
          {valued.totals.unvalued > 0 && (
            <p class="banner error" role="alert">
              {valued.totals.unvalued} {valued.totals.unvalued === 1 ? 'scheme has' : 'schemes have'} no NAV and {valued.totals.unvalued === 1 ? 'is' : 'are'} left out of the totals. Enter a scheme code in its row.
            </p>
          )}
          <Totals totals={valued.totals} hasClosed={valued.closed.length > 0} />
          <OpenTable rows={valued.open} stale={stale} onOverride={(id, code) => setOverrides((prev) => new Map(prev).set(id, code))} />
          <Allocation open={valued.open} />
          {valued.closed.length > 0 && (
            <details class="closed">
              <summary>Closed positions ({valued.closed.length})</summary>
              <ClosedTable rows={valued.closed} />
            </details>
          )}
        </>
      )}
      <details class="closed">
        <summary>Transactions</summary>
        <Transactions statement={statement} />
      </details>
    </section>
  );
}
