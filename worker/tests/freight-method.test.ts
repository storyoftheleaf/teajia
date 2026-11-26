import { describe, expect, it } from 'vitest';
import { addPricingFields } from '../src/productPricing';
import { freightDefaultFor, methodRatesFromRoutes, type FreightDefaults } from '../src/shippingRate';

// Suitcase, Airmail or Boat (migration 0148): a tea with a method prices its
// freight at that route, a tea without one keeps the shop rate, and a rate
// typed on the tea still wins over both.

const rates = new Map([['USD', 1], ['Yuan', 7]]);
const lookup = (c: string) => rates.get(c);

const defaults: FreightDefaults = {
  shopPerKgUsd: 85 / 7,
  methodPerKgUsd: methodRatesFromRoutes([
    { mode: 'sea', rate_per_kg: 21, rate_currency: 'Yuan' },
    { mode: 'sea', rate_per_kg: 999, rate_currency: 'Yuan' }, // a later route of the same mode is not the one read
    { mode: 'suitcase', rate_per_kg: 0, rate_currency: 'Yuan' },
    { mode: 'air', rate_per_kg: null, rate_currency: null },
  ], lookup),
};

// 700 yuan for 1,000 g: 0.10 USD a gram before freight.
const tea = { type: 'Sheng', cost_amount: 700, cost_currency: 'Yuan', quantity_purchased: 1000, shipping_rate_per_kg: null, fixed_retail_price_usd: null, stock_grams: 100 };
const retail = (extra: Record<string, unknown>) => addPricingFields({ ...tea, ...extra }, rates, defaults).retail_price_per_gram_usd;

describe('freight method', () => {
  it('reads each method from its oldest rated route', () => {
    expect(defaults.methodPerKgUsd).toEqual({ sea: 3, suitcase: 0 });
  });

  it('keeps the shop rate for a tea with no method, so no price moves until one is picked', () => {
    expect(retail({ freight_method: null })).toBe(Math.round((0.1 + 85 / 7 / 1000) * 3 * 100) / 100);
    expect(retail({})).toBe(retail({ freight_method: null }));
  });

  it('prices a Boat tea at the boat route and a Suitcase tea at its zero', () => {
    expect(retail({ freight_method: 'sea' })).toBe(Math.round((0.1 + 0.003) * 3 * 100) / 100);
    expect(retail({ freight_method: 'suitcase' })).toBe(0.3);
  });

  it('falls back to the shop rate when the chosen method has no rated route', () => {
    expect(freightDefaultFor('air', defaults)).toBe(defaults.shopPerKgUsd);
    expect(retail({ freight_method: 'air' })).toBe(retail({ freight_method: null }));
  });

  it('lets a rate typed on the tea win over its method', () => {
    expect(retail({ freight_method: 'sea', shipping_rate_per_kg: 70 })).toBe(Math.round((0.1 + 0.01) * 3 * 100) / 100);
  });

  it('declines rather than guesses when a route rate cannot be converted', () => {
    const unconvertible = methodRatesFromRoutes([{ mode: 'sea', rate_per_kg: 5, rate_currency: 'XYZ' }], lookup);
    expect(unconvertible).toEqual({ sea: null });
    expect(addPricingFields({ ...tea, freight_method: 'sea' }, rates, { shopPerKgUsd: 1, methodPerKgUsd: unconvertible }).retail_price_per_gram_usd).toBeNull();
  });
});
