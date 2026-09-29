// XIRR: the annual rate r that makes the dated cash flows sum to zero, discounting on actual days / 365.
// Newton's method first, bisection when Newton strays or fails to converge.

export interface CashFlow {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Negative for money the investor paid in, positive for money received or the current value. */
  amount: number;
}

const DAY_MS = 86_400_000;
const TOLERANCE = 1e-9;
const MIN_RATE = -0.999999;
const MAX_RATE = 1000;

const dayNumber = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;

/** Annual rate as a fraction (0.12 = 12%), or null when there is no solution (no inflow or no outflow, or no sign change). */
export function xirr(flows: readonly CashFlow[]): number | null {
  if (!flows.some((f) => f.amount < 0) || !flows.some((f) => f.amount > 0)) return null;
  const first = Math.min(...flows.map((f) => dayNumber(f.date)));
  const terms = flows.map((f) => ({ amount: f.amount, years: (dayNumber(f.date) - first) / 365 }));
  const npv = (r: number): number => terms.reduce((sum, t) => sum + t.amount / (1 + r) ** t.years, 0);
  const slope = (r: number): number => terms.reduce((sum, t) => sum - (t.years * t.amount) / (1 + r) ** (t.years + 1), 0);

  let rate = 0.1;
  for (let i = 0; i < 50; i++) {
    const value = npv(rate);
    const next = rate - value / slope(rate);
    if (!Number.isFinite(next) || next <= MIN_RATE || next >= MAX_RATE) break;
    if (Math.abs(next - rate) < TOLERANCE) return next;
    rate = next;
  }
  return bisect(npv);
}

function bisect(npv: (r: number) => number): number | null {
  let lo = MIN_RATE;
  let hi = MAX_RATE;
  const atLo = npv(lo);
  if (!Number.isFinite(atLo) || !Number.isFinite(npv(hi)) || Math.sign(atLo) === Math.sign(npv(hi))) return null;
  for (let i = 0; i < 200 && hi - lo > TOLERANCE; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(npv(mid)) === Math.sign(npv(lo))) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
