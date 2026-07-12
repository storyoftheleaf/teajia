import { describe, expect, it } from 'vitest';
import { deriveReceiptState, decodeInventoryReceipt, remainingReceiptQuantity } from '../src/inventoryDomain';

describe('inventory receipts', () => {
  it('validates grams and units and preserves provenance', () => {
    expect(decodeInventoryReceipt({ product_id: 'p1', quantity: 100, unit: 'g', intended_purpose: 'working', source_kind: 'invoice', source_ref: 'INV-4' })).toMatchObject({ quantity: 100, unit: 'g', source_ref: 'INV-4' });
    expect(() => decodeInventoryReceipt({ product_id: 'p1', quantity: 1.5, unit: 'unit', intended_purpose: 'sample', source_kind: 'vendor' })).toThrow(/whole/);
  });

  it('derives planned through cancelled without treating expected as on hand', () => {
    expect(deriveReceiptState('planned', 10, 0, 0)).toBe('planned');
    expect(deriveReceiptState('ordered', 10, 0, 0)).toBe('ordered');
    expect(deriveReceiptState('in_transit', 10, 0, 0)).toBe('in_transit');
    expect(deriveReceiptState('in_transit', 10, 4, 0)).toBe('partially_received');
    expect(remainingReceiptQuantity(10, 4, 2)).toBe(4);
    expect(deriveReceiptState('in_transit', 10, 10, 0)).toBe('received');
    expect(deriveReceiptState('ordered', 10, 0, 10)).toBe('cancelled');
  });
});
