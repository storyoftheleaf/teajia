import { describe, expect, it } from 'vitest';
import { clearPriceLine, freightClearPreview } from './freightModel';
const rates = [{ currency: 'Yuan', rateToUSD: 7 }] as never;
// 700 yuan for a kilo is $100, ten cents a gram before freight.
const tea = { type: 'Dark', costAmount: 700, costCurrency: 'Yuan', quantityPurchased: 1000 } as const;

describe('clearing a tea’s own freight rate', () => {
  it('prices the tea at its own rate now and at what it would follow once cleared', () => {
    // Own rate 84 yuan = $12/kg; cleared, it follows $10/kg.
    const preview = freightClearPreview({ ...tea, shippingRatePerKg: 84 }, rates, 10);
    expect(preview.ownPerKgUsd).toBeCloseTo(12, 6);
    expect(preview.before).toBeCloseTo((0.1 + 0.012) * 3, 6);
    expect(preview.after).toBeCloseTo((0.1 + 0.01) * 3, 6);
    expect(clearPriceLine(preview)).toBe('$0.34 → $0.33 a gram');
  });
  it('keeps a typed zero as free freight, not as nothing said', () => {
    const preview = freightClearPreview({ ...tea, shippingRatePerKg: 0 }, rates, 10);
    expect(preview.ownPerKgUsd).toBe(0);
    expect(preview.before).toBeCloseTo(0.3, 6);
  });
  it('declines to price without an exchange rate instead of reading yuan as dollars', () => {
    const preview = freightClearPreview({ ...tea, costCurrency: 'HKD', shippingRatePerKg: 84 }, rates, 10);
    expect(preview).toMatchObject({ before: null, after: null });
    expect(clearPriceLine(preview)).toBe('Retail cannot be calculated yet.');
  });
});
