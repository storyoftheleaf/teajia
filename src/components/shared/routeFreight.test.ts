import { describe, expect, it } from 'vitest';
import type { ExchangeRate } from '../../admin/types';
import type { LedgerLineItem } from '../../lib/ledgerStore';
import { billedKg, estimateOrderFreight, type ShippingRoute } from './routeFreight';

const rates = [
  { currency: 'USD', rateToUSD: 1 },
  { currency: 'Yuan', rateToUSD: 7 },
] as unknown as ExchangeRate[];
// The shop rate is 85 yuan a kilo; in dollars at 7 to the dollar.
const SHOP_USD = 85 / 7;
const cakes = (n: number, shipBy?: LedgerLineItem['shipBy']): LedgerLineItem => ({
  id: `l${n}${shipBy}`, name: 'Cake', form: 'Cake', quantityUnits: n, unitWeightGrams: 357,
  pricePerUnit: 900, priceIsPerGram: false, currency: 'Yuan' as never, addedAt: '', shipBy,
});
const route = (r: Partial<ShippingRoute>): ShippingRoute => ({ id: 'r', mode: 'air', carrier: null, destination: null, rate_per_kg: null, rate_currency: null, packing_percent: null, billing_step_kg: null, minimum_kg: null, ...r });

describe('freight from shipping routes', () => {
  it('billed kilos: packing, then the step rounded up, then the minimum', () => {
    expect(billedKg(2.5, route({ packing_percent: 20, billing_step_kg: 1 }))).toBe(3);
    expect(billedKg(1, route({ billing_step_kg: 0.5 }))).toBe(1);
    expect(billedKg(1.2, route({ minimum_kg: 5 }))).toBe(5);
    expect(billedKg(0, route({ minimum_kg: 5 }))).toBe(0);
  });

  it('with no routes, air follows the shop rate exactly as before', () => {
    const f = estimateOrderFreight({ currency: 'Yuan' as never, items: [cakes(7)] }, [], rates, SHOP_USD);
    expect(f.amount).toBeCloseTo(2.499 * 85, 1);
    expect(f.packing).toBe(false);
    expect(f.modes).toEqual(['air']);
  });

  it('an air route with packing and a 1 kg step: 2.5 kg of tea is billed as 4 kg', () => {
    const f = estimateOrderFreight({ currency: 'Yuan' as never, items: [cakes(7)] }, [route({ rate_per_kg: 85, rate_currency: 'Yuan', packing_percent: 35, billing_step_kg: 1 })], rates, SHOP_USD);
    expect(f.amount).toBeCloseTo(4 * 85, 5);
    expect(f.packing).toBe(true);
  });

  it('boat with no rate is not estimated, never zero', () => {
    const f = estimateOrderFreight({ currency: 'Yuan' as never, items: [cakes(1, 'boat')] }, [route({ mode: 'sea' })], rates, SHOP_USD);
    expect(f.amount).toBeNull();
    expect(f.modes).toEqual(['sea']);
  });

  it('a route priced in dollars is converted to the order money', () => {
    const f = estimateOrderFreight({ currency: 'Yuan' as never, items: [cakes(14, 'boat')] }, [route({ mode: 'sea', rate_per_kg: 2, rate_currency: 'USD', minimum_kg: 5 })], rates, SHOP_USD);
    expect(f.amount).toBeCloseTo(5 * 2 * 7, 5);
  });

  it('Both is estimated as air, so the figure never comes in under', () => {
    const both = estimateOrderFreight({ currency: 'Yuan' as never, items: [cakes(2, 'both')] }, [], rates, SHOP_USD);
    const air = estimateOrderFreight({ currency: 'Yuan' as never, items: [cakes(2, 'air')] }, [], rates, SHOP_USD);
    expect(both.amount).toBe(air.amount);
  });
});
