import { describe, expect, it } from 'vitest';
import { createAsyncResultGuard, loadTrackingRequest, trackingItemQuantity } from './orderTrackingDomain';

describe('order tracking stale response guard', () => {
  it('prevents an older request from applying after cleanup', () => {
    const older = createAsyncResultGuard();
    expect(older.isCurrent()).toBe(true);

    older.cancel();

    expect(older.isCurrent()).toBe(false);
    expect(createAsyncResultGuard().isCurrent()).toBe(true);
  });
});

describe('guest tracking recovery', () => {
  it('distinguishes a real 404 from offline and server failures, then recovers on retry', async () => {
    expect(await loadTrackingRequest(async () => null)).toEqual({ status: 'missing' });
    for (const error of [new TypeError('Failed to fetch'), new Error('503')]) {
      expect(await loadTrackingRequest(async () => { throw error; })).toEqual({ status: 'unavailable' });
    }
    const inquiry = { ref_number: 'TJ-123' };
    expect(await loadTrackingRequest(async () => inquiry)).toEqual({ status: 'found', inquiry });
  });

  it('preserves requested packing and reads older rows as a single weight', () => {
    expect(trackingItemQuantity({ category: 'tea', quantityGrams: 50, packGrams: 25, packs: 2 })).toBe('2 × 25g');
    expect(trackingItemQuantity({ category: 'tea', quantityGrams: 50 })).toBe('50g');
    expect(trackingItemQuantity({ category: 'tea', quantityGrams: 50, packGrams: 25, packs: 0 })).toBe('50g');
    expect(trackingItemQuantity({ category: 'teaware', quantityGrams: 2 })).toBe('×2');
  });
});
