import { describe, expect, it } from 'vitest';
import { parseStatement } from './cams';
import { summarize } from './summary';
import { buildItems, sampleSpec } from './testing/fixtures';

describe('summarize', () => {
  it('lists one row per scheme with its folio and AMC', () => {
    const summary = summarize(parseStatement(buildItems(sampleSpec())));
    expect(summary.folioCount).toBe(2);
    expect(summary.rows.map((r) => [r.amc, r.folioMasked, r.scheme.rtaCode])).toEqual([
      ['Sample Alpha Mutual Fund', '••••8901', 'ALPHFG'],
      ['Sample Beta Mutual Fund', '••••7766', 'BETADB'],
      ['Sample Beta Mutual Fund', '••••7766', 'BETALQ'],
    ]);
    expect(new Set(summary.rows.map((r) => r.key)).size).toBe(3);
    expect(summary.excluded).toEqual([]);
  });

  it('lists the schemes that failed the balance check', () => {
    const spec = sampleSpec();
    spec.amcs[0]!.folios[0]!.schemes[0]!.close = 1;
    const summary = summarize(parseStatement(buildItems(spec)));
    expect(summary.excluded.map((r) => r.scheme.rtaCode)).toEqual(['ALPHFG']);
  });
});
