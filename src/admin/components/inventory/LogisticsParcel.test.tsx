import { describe, expect, it } from 'vitest';
import { parcelPaidCost } from './LogisticsParcel';
import type { LogisticsPurchaseLine } from '../../../lib/logisticsTypes';
const line = { expected_quantity: 2000, original_cost_amount: 150 } as LogisticsPurchaseLine;
describe('paid cost belonging to each parcel', () => {
  it('prorates the purchase cost to the quantity at this location', () => {
    expect(parcelPaidCost(line, 500)).toBe(37.5);
    expect(parcelPaidCost(line, 1000)).toBe(75);
  });
  it('keeps unknown costs unknown and deliberate zero costs zero', () => {
    expect(parcelPaidCost({ ...line, original_cost_amount: null }, 500)).toBeNull();
    expect(parcelPaidCost({ ...line, original_cost_amount: 0 }, 500)).toBe(0);
    expect(parcelPaidCost({ ...line, expected_quantity: 0 }, 500)).toBeNull();
  });
});
