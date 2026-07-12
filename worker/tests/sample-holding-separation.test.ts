import { describe, expect, it } from 'vitest';
import { decodeStockMovement, movementDelta } from '../src/inventoryDomain';
import { createEmptySample, createEmptySampleSet } from '../../src/samples/types';

describe('sample holding separation', () => {
  it('keeps operational portions independent from physical Inventory holdings', () => {
    const portion = createEmptySample('set-1');
    expect(portion.inventoryHoldingProductId).toBeUndefined();
    expect(portion.productId).toBeUndefined();
    expect(portion.grams).toBe(10);
  });

  it('preserves an explicit holding link without reusing the graduated product link', () => {
    const portion = createEmptySample('set-1', { inventoryHoldingProductId: 'holding-1' });
    expect(portion.inventoryHoldingProductId).toBe('holding-1');
    expect(portion.productId).toBeUndefined();
  });

  it.each(['sourcing', 'customer-gifted', 'event', 'panel'] as const)(
    'preserves the %s operational purpose',
    (purpose) => expect(createEmptySampleSet({ purpose }).purpose).toBe(purpose),
  );

  it('records linked holding use only through an explicit sample_use movement', () => {
    const movement = decodeStockMovement({
      movement_type: 'sample_use', quantity: 8, unit: 'g', expected_balance: 30,
      idempotency_key: 'sample:portion-1:holding-1', note: 'Portion: Spring panel',
    });
    expect(movementDelta(movement, 30)).toBe(-8);
    expect(movement).toMatchObject({ movement_type: 'sample_use', quantity: 8 });
  });
});
