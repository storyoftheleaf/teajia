import { describe, expect, it } from 'vitest';
import { decodeInventoryPurposeWrite, effectiveInventoryPurpose } from '../src/inventoryDomain';
import { receiptRequest, ReceiptDb } from './helpers/receiptHarness';

describe('inventory purpose compatibility', () => {
  it('prefers canonical purpose and reports legacy conflicts', () => {
    expect(effectiveInventoryPurpose({ inventory_purpose: 'personal', is_sample: 1, is_personal: 0 }))
      .toEqual({ purpose: 'personal', conflict: true, source: 'canonical' });
  });

  it('falls back deterministically for legacy sample, personal, and working rows', () => {
    expect(effectiveInventoryPurpose({ is_sample: 1, is_personal: 0 }).purpose).toBe('sample');
    expect(effectiveInventoryPurpose({ is_sample: 0, is_personal: 1 }).purpose).toBe('personal');
    expect(effectiveInventoryPurpose({ is_sample: 0, is_personal: 0 }).purpose).toBe('working');
    expect(effectiveInventoryPurpose({ is_sample: 1, is_personal: 1 })).toMatchObject({ purpose: 'sample', conflict: true });
  });

  it('dual-writes canonical purpose and legacy flags for single and CSV creation', () => {
    expect(decodeInventoryPurposeWrite({ inventory_purpose: 'sample' })).toEqual({
      inventory_purpose: 'sample', is_sample: 1, is_personal: 0,
    });
    expect(decodeInventoryPurposeWrite({ is_personal: true })).toEqual({
      inventory_purpose: 'personal', is_sample: 0, is_personal: 1,
    });
    expect(() => decodeInventoryPurposeWrite({ inventory_purpose: 'sale' })).toThrow(/inventory_purpose/);
  });

  it('mirrors canonical purpose and known-stock state for single create and update', async () => {
    const db = ReceiptDb.seeded();
    const created = await receiptRequest(db, '/api/products', { method: 'POST', body: JSON.stringify({ product_name: 'Mirror Tea', type: 'Oolong', inventory_purpose: 'sample', stock_grams: 0 }) });
    expect(created.status).toBe(201);
    const { id } = await created.json() as any;
    expect(db.products.get(id)).toMatchObject({ inventory_purpose: 'sample', is_sample: 1, is_personal: 0 });
    expect(db.listings.get(`list_${id}`)).toMatchObject({ inventory_purpose: 'sample', stock_known_at: db.products.get(id)?.stock_known_at });
    expect((await receiptRequest(db, `/api/products/${id}`, { method: 'PUT', body: JSON.stringify({ inventory_purpose: 'personal', stock_grams: 5 }) })).status).toBe(200);
    expect(db.listings.get(`list_${id}`)).toMatchObject({ inventory_purpose: 'personal', is_personal: 1, is_sample: 0, stock_grams: 5 });
  });

  it('mirrors canonical purpose and known-stock state for bulk/CSV create', async () => {
    const db = ReceiptDb.seeded();
    const response = await receiptRequest(db, '/api/products/bulk', { method: 'POST', body: JSON.stringify({ products: [{ product_name: 'CSV Tea', type: 'Red', inventory_purpose: 'working', stock_grams: 25 }] }) });
    expect(response.status).toBe(200);
    const product = [...db.products.values()].find(row => row.product_name === 'CSV Tea')!;
    expect(db.listings.get(`list_${product.id}`)).toMatchObject({ inventory_purpose: 'working', stock_known_at: product.stock_known_at, stock_grams: 25 });
  });
});
