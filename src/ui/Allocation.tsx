import { allocate, type Slice } from '../domain/allocation';
import type { ValuedPosition } from '../valuation/value';
import { formatRupees } from './format';

const UNKNOWN = 'Not classified';

function Bars({ title, slices }: { title: string; slices: Slice[] }) {
  return (
    <div>
      <h3>{title}</h3>
      <ul class="bars">
        {slices.map((s) => (
          <li key={s.label}>
            <span class="bar-label">{s.label}</span>
            <span class="bar" role="img" aria-label={`${(s.share * 100).toFixed(1)}%`}>
              <span style={{ width: `${(s.share * 100).toFixed(1)}%` }} />
            </span>
            <span class="bar-value">
              {(s.share * 100).toFixed(1)}% · {formatRupees(s.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Where the current value sits: by category (from mfnav.in) and by fund house. Only valued schemes count. */
export function Allocation({ open }: { open: ValuedPosition[] }) {
  const value = (v: ValuedPosition): number => v.value ?? 0;
  const byCategory = allocate(open, (v) => v.quote?.category ?? UNKNOWN, value);
  if (byCategory.length === 0) return null;
  return (
    <section class="allocation" aria-label="Allocation">
      <Bars title="By category" slices={byCategory} />
      <Bars title="By fund house" slices={allocate(open, (v) => v.position.amc, value)} />
    </section>
  );
}
