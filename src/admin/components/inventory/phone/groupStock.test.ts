import { describe, expect, it } from 'vitest';

import type { Product } from '../../../types';
import { groupStock, isLow, isUnchecked, onHand } from './groupStock';

function tea(over: Partial<Product>): Product {
  return {
    id: over.productName ?? 'x',
    productName: 'Tea',
    type: 'Oolong',
    vendor: 'Lidia',
    stockGrams: 0,
    lowStockThreshold: 100,
    pricePerGramUSD: 1,
    ...over,
  } as Product;
}

describe('phone stock grouping', () => {
  it('groups by supplier, biggest supplier first, nothing-recorded last', () => {
    const groups = groupStock([
      tea({ productName: 'a', vendor: 'Master Bo' }),
      tea({ productName: 'b', vendor: '' }),
      tea({ productName: 'c', vendor: 'Lidia' }),
      tea({ productName: 'd', vendor: 'Lidia' }),
    ], 'vendor');
    expect(groups.map(g => g.label)).toEqual(['Lidia', 'Master Bo', 'No supplier recorded']);
  });

  it('keeps the incoming order inside a group, so the chosen sort still holds', () => {
    const groups = groupStock([
      tea({ productName: 'second', vendor: 'Lidia' }),
      tea({ productName: 'first', vendor: 'Lidia' }),
    ], 'vendor');
    expect(groups[0].products.map(p => p.productName)).toEqual(['second', 'first']);
  });

  it('sums grams, value at the selling price, low and unchecked', () => {
    const [g] = groupStock([
      tea({ productName: 'a', stockGrams: 900, pricePerGramUSD: 1.17 }),
      tea({ productName: 'b', stockGrams: 65, pricePerGramUSD: 1, stockVerifiedAt: '2026-10-01T00:00:00Z' }),
      tea({ productName: 'c', stockGrams: 0, pricePerGramUSD: 2 }),
      tea({ productName: 'd', stockGrams: 100, pricePerGramUSD: 1, fixedRetailPriceUSD: 3 }),
    ], 'vendor');
    expect(g.onHand).toBe(1065);
    expect(g.retailValueUsd).toBeCloseTo(900 * 1.17 + 65 + 300);
    expect(g.low).toBe(2); // 65 g and 100 g, both at or under 100; 0 g is sold out, not low
    expect(g.unchecked).toBe(2); // the 0 g tea has nothing to count
  });

  it('counts teaware in pieces, not grams', () => {
    const ware = tea({ type: 'Teaware', stockGrams: 999, quantityUnits: 3 });
    expect(onHand(ware)).toBe(3);
    expect(isLow(tea({ stockGrams: 0 }))).toBe(false);
    expect(isUnchecked(tea({ stockGrams: 0 }))).toBe(false);
  });

  it('treats "Lidia" and "lidia" as one supplier, labelled the way most of her teas spell it', () => {
    const groups = groupStock([
      tea({ productName: 'a', vendor: 'Lidia' }),
      tea({ productName: 'b', vendor: 'Lidia ' }),
      tea({ productName: 'c', vendor: 'lidia' }),
    ], 'vendor');
    expect(groups.map(g => [g.label, g.count])).toEqual([['Lidia', 3]]);
  });

  it('groups by stage in the lifecycle order, archived last', () => {
    const groups = groupStock([
      tea({ productName: 'gone', status: 'Archived' }),
      tea({ productName: 'live', status: 'Active', isPublic: true, shownInShop: true, stockGrams: 100 }),
    ], 'stage');
    expect(groups[groups.length - 1].label).toBe('Archived');
  });

  it('groups by kind and by nothing', () => {
    const list = [tea({ productName: 'a', type: 'Dark' }), tea({ productName: 'b', type: 'Oolong' }), tea({ productName: 'c', type: 'Oolong' })];
    expect(groupStock(list, 'type').map(g => [g.label, g.count])).toEqual([['Oolong', 2], ['Dark', 1]]);
    expect(groupStock(list, 'none').map(g => g.count)).toEqual([3]);
  });
});
