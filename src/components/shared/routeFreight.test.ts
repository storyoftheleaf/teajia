import { describe, expect, it } from 'vitest';
import type { ExchangeRate } from '../../admin/types';
import type { LedgerLineItem } from '../../lib/ledgerStore';
import { billedKg, estimateOrderFreight, type EstimateService, type ShippingRoute } from './routeFreight';

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
const route = (r: Partial<ShippingRoute>): ShippingRoute => ({ id: 'r', mode: 'air', carrier: null, destination: null, packing_percent: null, billing_step_kg: null, minimum_kg: null, ...r });
const service = (s: Partial<EstimateService>): EstimateService => ({ id: 's', name: 'Airmail', logistics_company_name: 'GZ', mode: 'air', basis: 'kg', rate: 85, currency: 'Yuan', active: true, ...s });

describe('basket freight from logistics services', () => {
  it('billed kilos: packing, then the step rounded up, then the minimum', () => {
    expect(billedKg(2.5, route({ packing_percent: 20, billing_step_kg: 1 }))).toBe(3);
    expect(billedKg(1, route({ billing_step_kg: 0.5 }))).toBe(1);
    expect(billedKg(1.2, route({ minimum_kg: 5 }))).toBe(5);
    expect(billedKg(0, route({ minimum_kg: 5 }))).toBe(0);
  });

  it('with no services, air follows the shop default exactly as before', () => {
    const f = estimateOrderFreight({ currency: 'Yuan' as never, items: [cakes(7)] }, [], [], rates, SHOP_USD);
    expect(f.amount).toBeCloseTo(2.499 * 85, 1);
    expect(f.packing).toBe(false);
    expect(f.modes).toEqual(['air']);
  });

  it('an air service priced a kilo sets the rate; the route still adds packing and its 1 kg step', () => {
    const f = estimateOrderFreight({ currency: 'Yuan' as never, items: [cakes(7)] }, [route({ packing_percent: 35, billing_step_kg: 1 })], [service({ rate: 60 })], rates, SHOP_USD);
    expect(f.amount).toBeCloseTo(4 * 60, 5);
    expect(f.packing).toBe(true);
  });

  it('takes the dearest air service, so a free suitcase never pulls the estimate under', () => {
    const f = estimateOrderFreight({ currency: 'Yuan' as never, items: [cakes(7)] }, [], [service({ id: 'bag', name: 'My suitcase', rate: 0 }), service({ rate: 90 })], rates, SHOP_USD);
    expect(f.amount).toBeCloseTo(2.499 * 90, 1);
  });

  it('ignores fixed-price services, inactive services and the other mode', () => {
    const f = estimateOrderFreight({ currency: 'Yuan' as never, items: [cakes(7)] }, [],
      [service({ basis: 'fixed', rate: 500 }), service({ id: 'old', rate: 999, active: false }), service({ id: 'boat', mode: 'sea', rate: 999 })], rates, SHOP_USD);
    expect(f.amount).toBeCloseTo(2.499 * 85, 1);
  });

  it('boat with no service is not estimated, never zero', () => {
    const f = estimateOrderFreight({ currency: 'Yuan' as never, items: [cakes(1, 'boat')] }, [route({ mode: 'sea' })], [], rates, SHOP_USD);
    expect(f.amount).toBeNull();
    expect(f.modes).toEqual(['sea']);
  });

  it('a service priced in dollars is converted to the order money', () => {
    const f = estimateOrderFreight({ currency: 'Yuan' as never, items: [cakes(14, 'boat')] }, [route({ mode: 'sea', minimum_kg: 5 })], [service({ mode: 'sea', rate: 2, currency: 'USD' })], rates, SHOP_USD);
    expect(f.amount).toBeCloseTo(5 * 2 * 7, 5);
  });

  it('Both is estimated as air, so the figure never comes in under', () => {
    const both = estimateOrderFreight({ currency: 'Yuan' as never, items: [cakes(2, 'both')] }, [], [], rates, SHOP_USD);
    const air = estimateOrderFreight({ currency: 'Yuan' as never, items: [cakes(2, 'air')] }, [], [], rates, SHOP_USD);
    expect(both.amount).toBe(air.amount);
  });
});
