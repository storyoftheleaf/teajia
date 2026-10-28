import { describe, expect, it } from 'vitest';
import { canonicalImportToCompassValues, normalizeCanonicalImportRecord } from '../src/curateImportCanonical';
import { acquisitionLine, ledgerLineTotal } from '../../src/components/TeaCompass/acquisitionPricing';
import { createEmptyEntry } from '../../src/components/TeaCompass/types';

describe('supplier quote to Library to acquisition', () => {
  it('retains a quoted amount even while its grams are still unknown', () => {
    const values = canonicalImportToCompassValues(normalizeCanonicalImportRecord({ priceAmountExact: '12.50', currency: 'CNY', category: 'tea' }));
    expect(values.price_amount).toBe('12.5');
    expect(values.price_per_unit_grams).toBeUndefined();
  });
  it.each([
    { priceBasis: 'per_pack', priceAmountExact: '380', packWeight: 500, weightUnit: 'g', packCount: 2, lineCostExact: '760', unitCostExact: '0.76' },
    { priceBasis: 'line_total', priceAmountExact: '760', packWeight: 500, weightUnit: 'g', packCount: 2, lineCostExact: '760', unitCostExact: '0.76' },
    { priceBasis: 'per_pack', priceAmountExact: '760', packWeight: 1, weightUnit: 'kg', packCount: 1, lineCostExact: '760', unitCostExact: '0.76' },
  ])('preserves economic equivalence for $priceBasis $weightUnit', (input) => {
    const values = canonicalImportToCompassValues(normalizeCanonicalImportRecord({ ...input, currency: 'CNY', category: 'tea' }));
    const entry = { ...createEmptyEntry(), priceAmount: Number(values.price_amount), pricePerUnitGrams: Number(values.price_per_unit_grams) };
    expect(ledgerLineTotal(acquisitionLine(entry, 250))).toBe(190);
  });
});
