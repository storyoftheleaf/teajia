import { describe, expect, it } from 'vitest';
import { freightSelection } from './freightModel';
const rates = [{ currency: 'Yuan', rateToUSD: 7 }];
describe('freight selection boundary', () => {
  it('follows the shop by saving null even when the cost currency is unknown', () => {
    expect(freightSelection('shop', '', 'UNKNOWN', rates)).toEqual({ storedRate: null, error: null });
  });
  it('converts USD per kg back into the tea currency through its alias', () => {
    expect(freightSelection('custom', '12', 'CNY', rates)).toEqual({ storedRate: 84, error: null });
  });
  it('preserves an explicit zero', () => {
    expect(freightSelection('custom', '0', 'Yuan', rates)).toEqual({ storedRate: 0, error: null });
  });
  it('refuses empty, negative, nonfinite and missing currency rates', () => {
    for (const value of ['', ' ', '-1', 'Infinity', 'bad']) expect(freightSelection('custom', value, 'Yuan', rates).error).toBeTruthy();
    expect(freightSelection('custom', '10', 'UNKNOWN', rates).error).toContain('UNKNOWN');
  });
  it('uses the established unrecorded currency convention', () => {
    expect(freightSelection('custom', '12', 'UNK', rates)).toEqual({ storedRate: 12, error: null });
  });
});
