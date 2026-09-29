// Client for the same-origin NAV proxy (see proxy/core.ts). Public fund data only.

export interface Fund {
  scheme_code: number;
  scheme_name: string;
  fund_house: string;
  plan_type: string;
  option_type: string;
  isin: string | null;
  category: string;
  sub_category: string | null;
  latest_nav?: number;
  latest_nav_date?: string;
  latest_day_change_pct?: number | null;
}

export interface SearchResult {
  results: Fund[];
  total: number;
  page: number;
  page_size: number;
}

export class NavError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function getJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { headers: { accept: 'application/json' } });
  } catch {
    throw new NavError('Could not reach the server. Check your connection.', 0);
  }
  if (res.status === 404) throw new NavError('No fund found.', 404);
  if (res.status === 429) throw new NavError('NAV service is rate limiting requests. Try again in a minute.', 429);
  if (!res.ok) throw new NavError(`NAV service error (${res.status}).`, res.status);
  return (await res.json()) as T;
}

export const getFund = (schemeCode: number): Promise<Fund> => getJson<Fund>(`/api/funds/${schemeCode}`);

export const searchFunds = (query: string, pageSize = 10): Promise<SearchResult> =>
  getJson<SearchResult>(`/api/funds/search?${new URLSearchParams({ q: query, page_size: String(pageSize) })}`);

/** A plain number is a scheme code; anything else (ISIN, name) goes to search. */
export const isSchemeCode = (input: string): boolean => /^\d{3,8}$/.test(input.trim());

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 4 });
export const formatInr = (value: number): string => inr.format(value);
