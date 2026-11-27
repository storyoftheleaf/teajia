import { describe, expect, it } from 'vitest';
import { estimateVolume, learnPackingSizes, packingKindFor, type PackingLine } from './packingSizes';
import { freightFor, serviceRatesFromRows } from './freightSource';

// Packed sizes learn from every shipment: like is with like. The same item's
// history first, then similar items, then the planning allowance.

const bill = (billed: number, confirmed = true) => ({ basis: 'm3' as const, rate: 1000, billed_quantity: billed, total_amount: null, currency: 'Yuan', confirmed });
const line = (over: Partial<PackingLine>): PackingLine => ({
  shipment_id: 's1', product_id: 'yiwu', kind: 'loose_tea', unit: 'g', quantity: 1000, volume_m3: null, volume_estimated: true, freight: null, ...over,
});

describe('learned packing sizes', () => {
  it('starts from the planning allowance when nothing has shipped', () => {
    expect(estimateVolume({ product_id: 'yiwu', kind: 'loose_tea', quantity: 1000, unit: 'g' })).toMatchObject({ volume_m3: 0.008, basis: 'allowance' });
  });

  it('learns a measured box for that item, and for items like it', () => {
    const sizes = learnPackingSizes([line({ volume_m3: 0.005, volume_estimated: false })]);
    expect(estimateVolume({ product_id: 'yiwu', kind: 'loose_tea', quantity: 2000, unit: 'g' }, sizes)).toMatchObject({ volume_m3: 0.01, basis: 'this item', samples: 1 });
    expect(estimateVolume({ product_id: 'other-tea', kind: 'loose_tea', quantity: 1000, unit: 'g' }, sizes)).toMatchObject({ volume_m3: 0.005, basis: 'like items' });
    // A different kind still has nothing like it to learn from.
    expect(estimateVolume({ product_id: 'cake', kind: 'pressed_tea', quantity: 1000, unit: 'g' }, sizes).basis).toBe('allowance');
  });

  it('shares a confirmed per-cubic-metre bill across the unmeasured lines in proportion', () => {
    // Allowances say 0.008 + 0.003 = 0.011 m³; the bill charged 0.022, so each is twice the allowance.
    const sizes = learnPackingSizes([
      line({ product_id: 'yiwu', freight: bill(0.022) }),
      line({ product_id: 'cake', kind: 'pressed_tea', freight: bill(0.022) }),
    ]);
    expect(sizes.byItem['yiwu|g'].m3PerUnit * 1000).toBeCloseTo(0.016, 9);
    expect(sizes.byItem['cake|g'].m3PerUnit * 1000).toBeCloseTo(0.006, 9);
  });

  it('gives the unmeasured lines what the measured ones leave of the bill', () => {
    const sizes = learnPackingSizes([
      line({ product_id: 'pot', kind: 'teapot', unit: 'unit', quantity: 1, volume_m3: 0.01, volume_estimated: false, freight: bill(0.03) }),
      line({ product_id: 'yiwu', freight: bill(0.03) }),
    ]);
    expect(sizes.byItem['pot|unit'].m3PerUnit).toBeCloseTo(0.01, 9);
    expect(sizes.byItem['yiwu|g'].m3PerUnit * 1000).toBeCloseTo(0.02, 9);
  });

  it('learns nothing from an unconfirmed bill or an all-estimated shipment', () => {
    expect(learnPackingSizes([line({ freight: bill(0.05, false) })])).toEqual({ byItem: {}, byKind: {} });
    expect(learnPackingSizes([line({ volume_m3: 0.02, volume_estimated: true })])).toEqual({ byItem: {}, byKind: {} });
  });

  it('weights every shipment by what it carried', () => {
    const sizes = learnPackingSizes([
      line({ shipment_id: 'a', quantity: 1000, volume_m3: 0.004, volume_estimated: false }),
      line({ shipment_id: 'b', quantity: 3000, volume_m3: 0.024, volume_estimated: false }),
    ]);
    // 0.028 m³ over 4 kg is 0.007 m³ a kilo, from two shipments.
    expect(sizes.byItem['yiwu|g']).toEqual({ m3PerUnit: 0.028 / 4000, samples: 2 });
  });

  it('tells loose from pressed and names teaware', () => {
    expect(packingKindFor({ unit: 'g', form: 'Cake' })).toBe('pressed_tea');
    expect(packingKindFor({ unit: 'g', form: 'Loose' })).toBe('loose_tea');
    expect(packingKindFor({ unit: 'unit', name: 'Jianshui gaiwan' })).toBe('gaiwan');
  });

  it('prices a per-cubic-metre service with the size this tea has taught', () => {
    const services = serviceRatesFromRows([{ id: 'boat', basis: 'm3', rate: 700, currency: 'Yuan', active: 1, name: 'Boat', logistics_company_name: 'GZ' }], () => 7);
    const packing = learnPackingSizes([line({ volume_m3: 0.005, volume_estimated: false })]);
    const tea = { id: 'yiwu', form: 'Loose', freight_service_id: 'boat' };
    expect(freightFor(tea, { shopPerKgUsd: 1, services, shipments: {} }).perKgUsd).toBeCloseTo(100 * 0.008, 9);
    expect(freightFor(tea, { shopPerKgUsd: 1, services, shipments: {}, packing }).perKgUsd).toBeCloseTo(100 * 0.005, 9);
  });
});
