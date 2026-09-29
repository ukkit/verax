// Splits a portfolio's current value into shares by a label (category, AMC).

export interface Slice {
  label: string;
  value: number;
  /** Fraction of the total (0.25 = 25%). */
  share: number;
}

/** Groups `items` by `label`, largest first. Items with no positive value are left out. */
export function allocate<T>(items: readonly T[], label: (item: T) => string, value: (item: T) => number): Slice[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    const v = value(item);
    if (v > 0) totals.set(label(item), (totals.get(label(item)) ?? 0) + v);
  }
  const whole = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals].map(([name, v]) => ({ label: name, value: v, share: v / whole })).sort((a, b) => b.value - a.value);
}
