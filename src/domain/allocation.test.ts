import { describe, expect, it } from 'vitest';
import { allocate } from './allocation';

describe('allocate', () => {
  const items = [{ k: 'Equity', v: 300 }, { k: 'Debt', v: 100 }, { k: 'Equity', v: 100 }, { k: 'Gold', v: 0 }, { k: 'Debt', v: -5 }];

  it('sums by label, largest first, as shares of the total', () => {
    expect(allocate(items, (i) => i.k, (i) => i.v)).toEqual([
      { label: 'Equity', value: 400, share: 0.8 },
      { label: 'Debt', value: 100, share: 0.2 },
    ]);
  });

  it('is empty when nothing has value', () => {
    expect(allocate([], (i: { k: string }) => i.k, () => 0)).toEqual([]);
  });
});
