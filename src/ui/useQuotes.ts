import { useEffect, useState } from 'preact/hooks';
import type { Position } from '../domain/holdings';
import { navSource as source } from '../valuation/session';
import { fetchQuotes, type PositionQuote } from '../valuation/quotes';

/** Live NAVs for open positions. `quotes` is null until the first lookup finishes; `error` is set only for an unexpected failure. */
export function useQuotes(positions: readonly Position[]): { quotes: Map<string, PositionQuote> | null; error: string | null } {
  const [state, setState] = useState<{ quotes: Map<string, PositionQuote> | null; error: string | null }>({ quotes: null, error: null });
  useEffect(() => {
    let current = true;
    fetchQuotes(positions, source).then(
      (quotes) => current && setState({ quotes, error: null }),
      (error) => {
        console.error('quotes_failed', { error });
        if (current) setState({ quotes: null, error: 'Looking up NAVs failed unexpectedly. Reload the page and try again; if it keeps happening, check the browser console.' });
      },
    );
    return () => {
      current = false;
    };
  }, [positions]);
  return state;
}
