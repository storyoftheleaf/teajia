import { describe, expect, it } from 'vitest';
import { quoteUsCheckoutShipping } from '../src/usCheckoutShipping';

describe('US checkout shipping', () => {
  const tea = [{ quantity: 120, quantity_unit: 'g' }, { quantity: 30, quantity_unit: 'g' }];

  it('charges once per kilogram of packed weight, rounded to cents', () => {
    expect(quoteUsCheckoutShipping(tea, '39.95', '75', '500')).toEqual({ usd: 8.99, packedGrams: 225 });
    expect(quoteUsCheckoutShipping(tea, '40', '0', '150')).toEqual({ usd: 6, packedGrams: 150 });
  });

  it('requires an explicit positive rate and a known eligible packing profile', () => {
    expect(quoteUsCheckoutShipping(tea, undefined, '75', '500')).toBeNull();
    expect(quoteUsCheckoutShipping(tea, '0', '75', '500')).toBeNull();
    expect(quoteUsCheckoutShipping(tea, '40', undefined, '500')).toBeNull();
    expect(quoteUsCheckoutShipping(tea, '40', '75', '200')).toBeNull();
    expect(quoteUsCheckoutShipping([{ quantity: 2, quantity_unit: 'unit' }], '40', '75', '500')).toBeNull();
  });
});
