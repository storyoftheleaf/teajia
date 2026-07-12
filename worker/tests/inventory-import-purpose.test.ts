import { describe, expect, it } from 'vitest';
import {
  decodeInventoryImportRow,
  inventoryImportIdempotencyKey,
  inventoryImportProductId,
  summarizeInventoryImport,
} from '../src/inventoryDomain';

describe('structured inventory import', () => {
  it('maps an explicit purpose and keeps legacy personal compatibility', () => {
    expect(decodeInventoryImportRow({ product_name: 'Field tea', type: 'Oolong', inventory_purpose: 'sample', stock_grams: 10 }, 0).purpose).toBe('sample');
    expect(decodeInventoryImportRow({ product_name: 'Old tea', type: 'Sheng', is_personal: true, stock_grams: 5 }, 1).purpose).toBe('personal');
  });

  it('applies a working default and reports editable required-field issues', () => {
    const row = decodeInventoryImportRow({ product_name: '', type: '', stock_grams: 12 }, 2, { purpose: 'working' });
    expect(row.purpose).toBe('working');
    expect(row.issues).toEqual(['Missing Type', 'Missing Name']);
    expect(row.canImport).toBe(false);
  });

  it('previews exactly one opening balance movement for a physical line', () => {
    const row = decodeInventoryImportRow({ product_name: 'Cup', type: 'Teaware', quantity_units: 2, inventory_purpose: 'personal' }, 0);
    expect(row.openingBalance).toEqual({ quantity: 2, unit: 'unit', before: 0, after: 2 });
    expect(row.movements).toHaveLength(1);
    expect(row.movements[0]).toMatchObject({ movement_type: 'receipt', quantity: 2, unit: 'unit' });
  });

  it('distinguishes absent stock, explicit zero, and malformed stock', () => {
    expect(decodeInventoryImportRow({ product_name: 'Later tea', type: 'White' }, 0)).toMatchObject({ stockSpecified: false, openingBalance: null, issues: [] });
    expect(decodeInventoryImportRow({ product_name: 'Sold out tea', type: 'White', stock_grams: 0 }, 1)).toMatchObject({ stockSpecified: true, stockValue: 0, openingBalance: null, issues: [] });
    expect(decodeInventoryImportRow({ product_name: 'Broken tea', type: 'White', stock_grams: 'twelve-ish' }, 2)).toMatchObject({ canImport: false, issues: ['Invalid Stock'] });
  });

  it('uses a stable line idempotency key scoped to receipt label and content', () => {
    const row = { product_name: 'Tea', type: 'Green', stock_grams: 20, inventory_purpose: 'working' };
    const a = inventoryImportIdempotencyKey('invoice-88', row, 3);
    expect(inventoryImportIdempotencyKey('invoice-88', row, 3)).toBe(a);
    expect(inventoryImportIdempotencyKey('invoice-89', row, 3)).not.toBe(a);
  });

  it('reserves the same product identity for every retry of an import line', () => {
    const key = inventoryImportIdempotencyKey('invoice-88', { product_name: 'Tea', type: 'Green', stock_grams: 20 }, 0);
    expect(inventoryImportProductId('account-a', key)).toBe(inventoryImportProductId('account-a', key));
    expect(inventoryImportProductId('account-b', key)).not.toBe(inventoryImportProductId('account-a', key));
    expect(inventoryImportProductId('account-a', key)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('returns exact ready, issue, and physical counts', () => {
    const rows = [
      decodeInventoryImportRow({ product_name: 'Tea', type: 'Green', stock_grams: 20 }, 0),
      decodeInventoryImportRow({ product_name: '', type: 'White', stock_grams: 5 }, 1),
      decodeInventoryImportRow({ product_name: 'Note only', type: 'Misc' }, 2),
    ];
    expect(summarizeInventoryImport(rows)).toEqual({ total: 3, ready: 2, issues: 1, physical: 2 });
  });
});
