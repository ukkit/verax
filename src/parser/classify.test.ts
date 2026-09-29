import { describe, expect, it } from 'vitest';
import { classify, giftFolio, maskDescription, maskFolioNumbers } from './classify';
import type { TransactionType } from './types';

describe('classify', () => {
  const cases: Array<[string, number | null, TransactionType]> = [
    ['Purchase', 100, 'PURCHASE'],
    ['Systematic Investment Purchase', 10, 'PURCHASE_SIP'],
    ['Purchase - Instalment 5/24', 10, 'PURCHASE_SIP'],
    ['Purchase - Installment 5/24', 10, 'PURCHASE_SIP'],
    ['SIP Purchase', 10, 'PURCHASE_SIP'],
    ['Sys. Investment', 10, 'PURCHASE_SIP'],
    ['Redemption', -10, 'REDEMPTION'],
    ['Switch In - From Some Fund', 5, 'SWITCH_IN'],
    ['Switch Out - To Some Fund', -5, 'SWITCH_OUT'],
    ['Switch In - Merger', 5, 'SWITCH_IN_MERGER'],
    ['Switch Out - Merger', -5, 'SWITCH_OUT_MERGER'],
    ['Systematic Transfer Plan Switch In', 5, 'SWITCH_IN'],
    ['S T P In (Instalment 1/6)', 5, 'SWITCH_IN'],
    ['S T P Out (Instalment 1/6)', -5, 'SWITCH_OUT'],
    ['Segregated portfolio units', 5, 'SEGREGATION'],
    ['Gift of units', 5, 'GIFT_IN'],
    ['Gift of units', -5, 'GIFT_OUT'],
    ['Purchase Rejection - Payment not received', -5, 'REVERSAL'],
    ['Purchase dishonoured', -5, 'REVERSAL'],
    ['*** STT Paid ***', null, 'STT_TAX'],
    ['*** Stamp Duty ***', null, 'STAMP_DUTY_TAX'],
    ['*** TDS Deducted ***', null, 'TDS_TAX'],
    ['***Registration of Nominee***', null, 'MISC'],
    ['Whatever', 0, 'UNKNOWN'],
  ];
  it.each(cases)('%s (units %s) is %s', (description, units, type) => {
    expect(classify(description, units).type).toBe(type);
  });

  it('reads the dividend rate and tells payout from reinvestment', () => {
    expect(classify('IDCW Paid @ Rs. 0.30 per unit', null)).toEqual({ type: 'DIVIDEND_PAYOUT', dividendRate: 0.3 });
    expect(classify('Dividend Reinvestment @ Rs. 1.25', 4)).toEqual({ type: 'DIVIDEND_REINVEST', dividendRate: 1.25 });
    expect(classify('IDCW - Reinvest @ Rs. 2 per unit', 4).type).toBe('DIVIDEND_REINVEST');
    expect(classify('Div. Payout @ Rs. 0.5', null).type).toBe('DIVIDEND_PAYOUT');
  });

  it('treats a switch mentioned in a tax row as the tax it is', () => {
    expect(classify('*** STT on switch ***', null).type).toBe('STT_TAX');
  });
});

describe('folio numbers in descriptions', () => {
  it('reads the counterparty folio from either registrar style, masked', () => {
    expect(giftFolio('Gifting of units-TO Folio No: 12345678901')).toBe('••••8901');
    expect(giftFolio('Gift From Folio No.87654321')).toBe('••••4321');
    expect(giftFolio('Purchase')).toBeNull();
  });

  it('masks every folio number, with or without a sub-account suffix', () => {
    expect(maskFolioNumbers('Gift TO Folio No: 12345678901 / 63 done')).toBe('Gift TO Folio No: ••••8901 done');
    expect(maskFolioNumbers('From Folio No.87654321')).toBe('From Folio No.••••4321');
    expect(maskFolioNumbers('Nothing to hide')).toBe('Nothing to hide');
  });
});

describe('maskDescription', () => {
  it('keeps only the last four digits of payment and bank references', () => {
    expect(maskDescription('Purchase - UPI Ref 402512345678 done')).toBe('Purchase - UPI Ref ••••5678 done');
    expect(maskDescription('Cheque No 123456789')).toBe('Cheque No ••••6789');
    expect(maskDescription('NEFT 20250901123456789012')).toBe('NEFT ••••9012');
  });

  it('leaves the short numbers a description needs: instalments, rates and dates', () => {
    for (const text of ['Instalment 12/24', 'IDCW @ Rs. 0.25 per unit', 'Effective from 01-Apr-2019', 'Cheque No 123456', 'Units 1,234.567']) expect(maskDescription(text)).toBe(text);
  });

  it('still masks the folio rule first', () => {
    expect(maskDescription('Gifting of units-TO Folio No: 12345678901')).toBe('Gifting of units-TO Folio No: ••••8901');
  });
});
