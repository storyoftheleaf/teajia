import { describe, expect, it } from 'vitest';
import { parseExtractResult } from './PhotoCapture';

describe('a scanned price tag keeps its money', () => {
  it('reads NT$, yuan and HK$ from the label into the shop\'s keys', () => {
    expect(parseExtractResult({ costAmount: 1800, costCurrency: 'TWD' }).currency).toBe('NT');
    expect(parseExtractResult({ costAmount: 380, costCurrency: 'CNY' }).currency).toBe('Yuan');
    expect(parseExtractResult({ costAmount: 500, costCurrency: 'HK$' }).currency).toBe('HKD');
  });
  it('says nothing about currency when the label had no price', () => {
    expect(parseExtractResult({ costCurrency: 'CNY' }).currency).toBeUndefined();
  });
});
