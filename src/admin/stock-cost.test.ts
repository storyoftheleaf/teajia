import { describe, expect, it } from 'vitest';
import { mapAdminProduct } from './productAdapter';
import { calculatePricing } from './utils';

describe('Stock purchase cost remains an entered fact', () => {
  it('keeps unknown and explicitly free costs distinct after an API read', () => {
    expect(mapAdminProduct({ cost_amount: null }).costAmount).toBeNull();
    expect(mapAdminProduct({ cost_amount: 0 }).costAmount).toBe(0);
  });
  it('does not turn an unknown cost into a freight-only retail quote', () => {
    expect(calculatePricing(null as never, 85, 100, 'USD', [], false).suggestedRetailUSD).toBe(0);
  });
});
