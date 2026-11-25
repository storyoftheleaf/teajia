import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inventoryExportRows } from './exportRows';
import { MOBILE_COL_PX } from './mobileColumnWidths';
import type { Product } from '../../types';

describe('inventory export rows', () => {
  const tea = {
    id: 't1', type: 'Oolong', productName: 'Rock', givenName: 'Rock', stockGrams: 10, costAmount: 5, costCurrency: 'Yuan',
    shippingRatePerKg: undefined, isPublic: true, shownInShop: false, costCurrencySource: undefined,
  } as unknown as Product;

  it('starts with the id and says when a currency was only the default', () => {
    const [row] = inventoryExportRows([tea]);
    expect(Object.keys(row)[0]).toBe('ID');
    expect(row['Cost currency stated?']).toBe('no, may be the default');
    expect(row['Ship rate source']).toBe('shop');
    expect(row.Public).toBe('yes');
    expect(row['In shop']).toBe('no');
  });

  it('keeps the product column pinned wider than the numbers', () => {
    expect(MOBILE_COL_PX.productName).toBeGreaterThan(MOBILE_COL_PX.stockGrams);
  });

  it('lives outside InventoryView so that file stays under its size snapshot', () => {
    const view = readFileSync(new URL('../InventoryView.tsx', import.meta.url), 'utf8');
    expect(view).not.toContain("'Cost currency stated?'");
    expect(view).not.toContain('productName: 158');
    expect(view.split('\n').length).toBeLessThanOrEqual(3489);
  });
});
