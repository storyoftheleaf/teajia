import { describe, expect, it } from 'vitest';
import { addPricingFields } from '../src/productPricing';
import type { FreightDefaults } from '../src/shippingRate';
import { mapAdminProduct } from '../../src/admin/productAdapter';

// The books keep part grams. The Stock page reads the exact balance; the shop
// and every other reader keep the whole-gram figure they always had.

const rates = new Map([['USD', 1], ['Yuan', 7]]);
const defaults: FreightDefaults = { shopPerKgUsd: 85 / 7, services: new Map(), shipments: {} } as unknown as FreightDefaults;
const tea = { id: 'yiwu', type: 'Sheng', form: 'Loose', cost_amount: 700, cost_currency: 'Yuan', quantity_purchased: 1000, shipping_rate_per_kg: null, fixed_retail_price_usd: null, stock_grams: 12.5 };

describe('part grams on the Stock page', () => {
  it('keeps whole grams in stock_grams and the true balance beside it', () => {
    const priced = addPricingFields(tea, rates, defaults);
    expect(priced.stock_grams).toBe(13);
    expect(priced.stock_grams_exact).toBe(12.5);
  });

  it('keeps the exact balance on a fixed-price tea too', () => {
    const priced = addPricingFields({ ...tea, fixed_retail_price_usd: 1 }, rates, defaults);
    expect(priced.stock_grams_exact).toBe(12.5);
  });

  it('shows the Stock page the exact balance, and falls back to whole grams', () => {
    expect(mapAdminProduct({ id: 'a', stock_grams: 13, stock_grams_exact: 12.5 }).stockGrams).toBe(12.5);
    expect(mapAdminProduct({ id: 'b', stock_grams: 13 }).stockGrams).toBe(13);
  });
});
