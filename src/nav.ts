// Client for the same-origin NAV proxy (see proxy/core.ts). Public fund data only.
import { createLimiter } from './rateLimit';

// mfnav.in allows 120 requests a minute per IP, shared by everyone using this deployment. Stay well under it from this
// browser; a call waits only when the last minute is full.
export const MAX_REQUESTS_PER_MINUTE = 60;
const acquire = createLimiter(MAX_REQUESTS_PER_MINUTE, 60_000);

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

/** The proxy explains its own refusals in `{ error }`; this adds that to the message. A body that is not the proxy's JSON adds nothing. */
async function proxyReason(res: Response): Promise<string> {
  try {
    const { error } = (await res.json()) as { error?: unknown };
    return typeof error === 'string' && error ? `: ${error}.` : '.';
  } catch (parseError) {
    if (parseError instanceof SyntaxError) return '.'; // an HTML or empty error page from the host, not from the proxy
    throw parseError;
  }
}

async function getJson<T>(path: string): Promise<T> {
  await acquire();
  let res: Response;
  try {
    res = await fetch(path, { headers: { accept: 'application/json' } });
  } catch {
    throw new NavError('Could not reach the server. Check your connection.', 0);
  }
  if (res.status === 404) throw new NavError('No fund found.', 404);
  if (res.status === 429) throw new NavError('NAV service is rate limiting requests. Try again in a minute.', 429);
  if (!res.ok) throw new NavError(`NAV service error (${res.status})${await proxyReason(res)}`, res.status);
  return (await res.json()) as T;
}

export const getFund = (schemeCode: number): Promise<Fund> => getJson<Fund>(`/api/funds/${schemeCode}`);

export const searchFunds = (query: string, pageSize = 10): Promise<SearchResult> =>
  getJson<SearchResult>(`/api/funds/search?${new URLSearchParams({ q: query, page_size: String(pageSize) })}`);

export interface NavPoint {
  /** ISO date. */
  date: string;
  nav: number;
}

interface HistoryPage {
  data: { nav_date: string; nav: number }[];
  total: number;
}

const HISTORY_PAGE_SIZE = 1000;

/** Every NAV from `start` (ISO date) to today, oldest first. mfnav.in pages its history, so this follows the pages. */
export async function getHistory(schemeCode: number, start: string): Promise<NavPoint[]> {
  const points: NavPoint[] = [];
  for (let page = 1; ; page++) {
    const query = new URLSearchParams({ start_date: start, page_size: String(HISTORY_PAGE_SIZE), page: String(page) });
    const body = await getJson<HistoryPage>(`/api/nav/${schemeCode}?${query}`);
    points.push(...body.data.map((d) => ({ date: d.nav_date, nav: d.nav })));
    if (body.data.length === 0 || points.length >= body.total) break;
  }
  return points.reverse();
}
