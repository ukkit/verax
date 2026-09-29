import { describe, expect, it, vi } from 'vitest';
import type { Fund } from '../nav';
import { NavError } from '../nav';
import { createNavSource } from './navSource';

const fund = (code: number): Fund => ({ scheme_code: code, scheme_name: 'Sample Fund', fund_house: 'Sample', plan_type: 'Direct', option_type: 'Growth', isin: null, category: 'Equity', sub_category: null, latest_nav: 10, latest_nav_date: '2025-01-01' });

describe('createNavSource', () => {
  it('looks an ISIN up once however many callers ask', async () => {
    const searchFunds = vi.fn(async () => ({ results: [fund(7)] }));
    const source = createNavSource({ searchFunds, getFund: async (c) => fund(c) });
    expect(await Promise.all([source.schemeCode('INF000A01234'), source.schemeCode('INF000A01234')])).toEqual([7, 7]);
    expect(searchFunds).toHaveBeenCalledTimes(1);
  });

  it('returns null when the ISIN matches no fund or several', async () => {
    const source = createNavSource({ searchFunds: async (q) => ({ results: q === 'none' ? [] : [fund(1), fund(2)] }), getFund: async (c) => fund(c) });
    expect(await source.schemeCode('none')).toBeNull();
    expect(await source.schemeCode('many')).toBeNull();
  });

  it('does not cache a failure', async () => {
    const getFund = vi.fn().mockRejectedValueOnce(new NavError('down', 500)).mockResolvedValueOnce(fund(7));
    const source = createNavSource({ searchFunds: async () => ({ results: [] }), getFund });
    await expect(source.fund(7)).rejects.toThrow('down');
    expect((await source.fund(7)).scheme_code).toBe(7);
    expect(getFund).toHaveBeenCalledTimes(2);
  });
});
