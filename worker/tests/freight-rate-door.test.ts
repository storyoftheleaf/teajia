import { describe, expect, it } from 'vitest';
import { freightRateWriteRefusal } from '../src/freightRateDoor';

// Freight rates are typed in Logistics, not through the product doors (Adrian, 2026-11-27).
describe('a tea\'s own freight rate at the product doors', () => {
  it('lets a new tea arrive with no rate, and refuses one with a rate, zero included', () => {
    expect(freightRateWriteRefusal({ cost_amount: 5 }, 'create')).toBeNull();
    expect(freightRateWriteRefusal({ shipping_rate_per_kg: null }, 'create')).toBeNull();
    for (const rate of [85, 0, '12']) expect(freightRateWriteRefusal({ shipping_rate_per_kg: rate }, 'create')).toMatch(/Logistics/);
  });
  it('always allows clearing on an edit', () => {
    expect(freightRateWriteRefusal({ shipping_rate_per_kg: null }, { shipping_rate_per_kg: 40, cost_currency: 'Yuan' })).toBeNull();
    expect(freightRateWriteRefusal({ shipping_rate_per_kg: '' }, { shipping_rate_per_kg: 40, cost_currency: 'Yuan' })).toBeNull();
  });
  it('allows a number only to carry an existing rate across a cost-currency change', () => {
    const held = { shipping_rate_per_kg: 84, cost_currency: 'Yuan' };
    expect(freightRateWriteRefusal({ shipping_rate_per_kg: 12, cost_currency: 'USD' }, held)).toBeNull();
    // Same money under another spelling is not a change.
    expect(freightRateWriteRefusal({ shipping_rate_per_kg: 90, cost_currency: 'CNY' }, held)).toMatch(/Logistics/);
    expect(freightRateWriteRefusal({ shipping_rate_per_kg: 90 }, held)).toMatch(/Logistics/);
    // A tea following its service or the shop default cannot be given one.
    expect(freightRateWriteRefusal({ shipping_rate_per_kg: 12, cost_currency: 'USD' }, { shipping_rate_per_kg: null, cost_currency: 'Yuan' })).toMatch(/Logistics/);
    expect(freightRateWriteRefusal({ shipping_rate_per_kg: 12, cost_currency: 'USD' }, null)).toMatch(/Logistics/);
  });
});
