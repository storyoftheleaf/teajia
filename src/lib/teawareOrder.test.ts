import { describe, expect, it } from 'vitest';
import { teawareOrderSizes, teawareRemaining, teawareUnitPrice } from './teawareOrder';

describe('piece-counted teaware orders', () => {
  it('offers repeat orders from the remaining stock across all cart lines', () => {
    const ware = { id: 'six-cups', stock_g: 6 };
    const cart = [{ id: ware.id, quantityGrams: 2 }, { id: 'other-pot', quantityGrams: 5 }];
    expect(teawareOrderSizes(teawareRemaining(ware, cart))).toEqual([1, 2, 3, 4]);
    cart.push({ id: ware.id, quantityGrams: 3 });
    expect(teawareOrderSizes(teawareRemaining(ware, cart))).toEqual([1]);
    cart.push({ id: ware.id, quantityGrams: 1 });
    expect(teawareOrderSizes(teawareRemaining(ware, cart))).toEqual([]);
  });

  it('keeps an unstated price distinct from a supplied zero or a legacy piece price', () => {
    expect(teawareUnitPrice({})).toBeNull();
    expect(teawareUnitPrice({ price_50g: '2.75' })).toBe(2.75);
    expect(teawareUnitPrice({ pricePerUnit: '0', price_50g: '2.75' })).toBe(0);
  });
});
