import { describe, expect, it } from 'vitest';
import { teaPurchaseQuote } from './shopPurchase';
import type { InventoryItem } from '../types';

const tea = (overrides: Partial<InventoryItem> = {}) => ({
  id: 'tea', category: 'tea', name: 'Tea', variant: '', type: 'Red', year: '', origin: '',
  stock_g: 200, price_per_gram: '0.21', cost_price: '0', ...overrides,
}) as InventoryItem;

describe('a purchasable catalogue pack', () => {
  it('includes handling and the same whole-dollar rounding as the cart', () => {
    expect(teaPurchaseQuote(tea(), 50)).toMatchObject({ grams: 50, totalUsd: 13 });
  });
  it('offers remaining stock instead of an unavailable default pack', () => {
    expect(teaPurchaseQuote(tea({ stock_g: 20 }), 50)).toMatchObject({ grams: 20, totalUsd: 7 });
  });
  it('offers whole sealed units and never a partial remainder', () => {
    const boxed = tea({ form: 'Box', pieceWeightG: 100, soldInWholeUnits: true, stock_g: 250 });
    expect(teaPurchaseQuote(boxed, 50)).toMatchObject({ grams: 100, totalUsd: 21, unitGrams: 100 });
    expect(teaPurchaseQuote(boxed, 250)?.grams).toBe(200);
  });
  it('declines stock below the smallest order and unknown prices', () => {
    expect(teaPurchaseQuote(tea({ stock_g: 5 }))).toBeNull();
    expect(teaPurchaseQuote(tea({ stock_g: 0 }))).toBeNull();
    expect(teaPurchaseQuote(tea({ price_per_gram: undefined }))).toBeNull();
    expect(teaPurchaseQuote(tea({ form: 'Box', pieceWeightG: 100, soldInWholeUnits: true, stock_g: 50 }))).toBeNull();
  });
  it('keeps the whole-piece price without charging handling', () => {
    expect(teaPurchaseQuote(tea({ form: 'Cake', pieceWeightG: 200 }), 200)?.totalUsd).toBe(42);
  });
});
