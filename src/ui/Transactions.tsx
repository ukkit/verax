import { useMemo, useState } from 'preact/hooks';
import { filterRows, transactionRows, TYPE_LABELS, type TransactionFilter } from '../domain/transactions';
import type { Statement, TransactionType } from '../parser/types';
import { formatDate, formatRupees, formatUnits } from './format';

const FIRST = 50;
const MORE = 100;

/** Every parsed transaction, with filters for scheme, type and dates. Rows are added in steps so a long history stays quick. */
export function Transactions({ statement }: { statement: Statement }) {
  const all = useMemo(() => transactionRows(statement), [statement]);
  const schemes = useMemo(() => [...new Map(all.map((r) => [r.schemeKey, r])).values()].sort((a, b) => a.schemeName.localeCompare(b.schemeName)), [all]);
  const types = useMemo(() => [...new Set(all.map((r) => r.transaction.type))].sort((a, b) => TYPE_LABELS[a].localeCompare(TYPE_LABELS[b])), [all]);
  const [filter, setFilter] = useState<TransactionFilter>({});
  const [shown, setShown] = useState(FIRST);
  const rows = useMemo(() => filterRows(all, filter), [all, filter]);
  const change = (patch: TransactionFilter) => {
    setFilter((prev) => ({ ...prev, ...patch }));
    setShown(FIRST);
  };
  const text = (e: Event) => (e.target as HTMLInputElement | HTMLSelectElement).value;

  return (
    <div class="transactions">
      <div class="filters">
        <label>
          Scheme
          <select value={filter.schemeKey ?? ''} onChange={(e) => change({ schemeKey: text(e) || undefined })}>
            <option value="">All schemes</option>
            {schemes.map((r) => (
              <option key={r.schemeKey} value={r.schemeKey}>{r.schemeName} ({r.folioMasked})</option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select value={filter.type ?? ''} onChange={(e) => change({ type: (text(e) || undefined) as TransactionType | undefined })}>
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" value={filter.from ?? ''} onInput={(e) => change({ from: text(e) || undefined })} />
        </label>
        <label>
          To
          <input type="date" value={filter.to ?? ''} onInput={(e) => change({ to: text(e) || undefined })} />
        </label>
      </div>
      <p class="hint" role="status">
        {rows.length} of {all.length} transactions.
      </p>
      <div class="table-wrap">
        <table class="schemes">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Scheme</th>
              <th scope="col">Type</th>
              <th scope="col" class="num">Units</th>
              <th scope="col" class="num">NAV</th>
              <th scope="col" class="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map(({ schemeKey, schemeName, folioMasked, transaction: t }, i) => (
              <tr key={`${schemeKey}-${t.date}-${i}`}>
                <td data-label="Date">{formatDate(t.date)}</td>
                <td data-label="Scheme">
                  {schemeName}
                  <span class="sub">folio {folioMasked}</span>
                </td>
                <td data-label="Type">
                  {TYPE_LABELS[t.type]}
                  <span class="sub">{t.description}</span>
                </td>
                <td data-label="Units" class="num">{t.units === null ? '—' : formatUnits(t.units)}</td>
                <td data-label="NAV" class="num">{t.nav === null ? '—' : formatRupees(t.nav)}</td>
                <td data-label="Amount" class="num">{t.amount === null ? '—' : formatRupees(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown && (
        <button type="button" class="secondary" onClick={() => setShown((n) => n + MORE)}>
          Show {Math.min(MORE, rows.length - shown)} more
        </button>
      )}
    </div>
  );
}
