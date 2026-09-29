// Live NAV lookups for the session: ISIN -> scheme code -> latest NAV. Every answer is cached by its key and concurrent
// requests for one key share a single call. A failed call is never cached, so a retry asks again.
import { getFund, searchFunds, type Fund } from '../nav';

export interface NavApi {
  searchFunds: (query: string) => Promise<{ results: Fund[] }>;
  getFund: (schemeCode: number) => Promise<Fund>;
}

export interface NavSource {
  /** The scheme code for an ISIN, or null when mfnav.in has no single match. */
  schemeCode: (isin: string) => Promise<number | null>;
  fund: (schemeCode: number) => Promise<Fund>;
}

function memoised<K, V>(load: (key: K) => Promise<V>): (key: K) => Promise<V> {
  const cache = new Map<K, Promise<V>>();
  return (key) => {
    let pending = cache.get(key);
    if (!pending) {
      pending = load(key);
      cache.set(key, pending);
      pending.catch(() => cache.delete(key));
    }
    return pending;
  };
}

export const createNavSource = (api: NavApi = { searchFunds: (q) => searchFunds(q), getFund }): NavSource => ({
  schemeCode: memoised(async (isin: string) => {
    const { results } = await api.searchFunds(isin);
    // A dividend-reinvestment ISIN finds the same scheme, so several hits for one code still count as one match.
    const codes = new Set(results.map((fund) => fund.scheme_code));
    return codes.size === 1 ? [...codes][0]! : null;
  }),
  fund: memoised(api.getFund),
});
