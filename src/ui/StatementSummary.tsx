import type { SourceKind, Statement } from '../parser/types';
import { summarize } from '../parser/summary';
import { formatDate, formatRupees, formatUnits } from './format';

const BETA: Record<Exclude<SourceKind, 'CAMS'>, string> = {
  KFINTECH: 'This looks like a KFintech statement. Support for KFintech statements is in beta: please check the figures below against your statement.',
  UNKNOWN: 'The issuer of this statement could not be identified, so it was read as a CAMS-style statement. Support is in beta: please check the figures below against your statement.',
};

export function StatementSummary({ statement, onClear }: { statement: Statement; onClear: () => void }) {
  const { rows, excluded, folioCount } = summarize(statement);
  return (
    <section class="panel" aria-labelledby="summary-heading">
      <div class="panel-head">
        <h2 id="summary-heading">Your statement</h2>
        <button type="button" class="secondary" onClick={onClear}>
          Clear
        </button>
      </div>
      <p class="hint">
        {statement.period ? `${formatDate(statement.period.from)} to ${formatDate(statement.period.to)} · ` : ''}
        {rows.length} {rows.length === 1 ? 'scheme' : 'schemes'} in {folioCount} {folioCount === 1 ? 'folio' : 'folios'}. Held in this browser only; it is gone when you clear it or close the tab.
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
      {excluded.length > 0 && (
        <div class="banner error" role="alert">
          <strong>
            {excluded.length} {excluded.length === 1 ? 'scheme' : 'schemes'} failed the balance check and will be left out of every total:
          </strong>
          <ul>
            {excluded.map((row) => (
              <li key={row.key}>
                {row.scheme.name} (folio {row.folioMasked})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div class="table-wrap">
        <table class="schemes">
          <thead>
            <tr>
              <th scope="col">Scheme</th>
              <th scope="col">Folio</th>
              <th scope="col" class="num">
                Closing units
              </th>
              <th scope="col" class="num">
                Value on statement
              </th>
              <th scope="col" class="num">
                Transactions
              </th>
              <th scope="col">Check</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, amc, folioMasked, scheme }) => (
              <tr key={key} class={scheme.reconciled ? '' : 'excluded'}>
                <td data-label="Scheme">
                  <strong>{scheme.name}</strong>
                  <span class="sub">{amc}</span>
                </td>
                <td data-label="Folio">{folioMasked}</td>
                <td data-label="Closing units" class="num">
                  {scheme.close === null ? '—' : formatUnits(scheme.close)}
                </td>
                <td data-label="Value on statement" class="num">
                  {scheme.valuation.value === null ? '—' : formatRupees(scheme.valuation.value)}
                  {scheme.valuation.date && <span class="sub">{formatDate(scheme.valuation.date)}</span>}
                </td>
                <td data-label="Transactions" class="num">
                  {scheme.transactions.length}
                </td>
                <td data-label="Check">
                  {scheme.reconciled ? (
                    <span class="ok">✓ Balances add up</span>
                  ) : (
                    <details>
                      <summary class="bad">Left out: see why</summary>
                      <ul>
                        {scheme.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
