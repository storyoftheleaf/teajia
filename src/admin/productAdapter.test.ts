import { INVENTORY_TEA_TYPES } from '../wisdom/vocabulary';
import { buildProductUpdatePayload } from './productUpdatePayload';
import { describe, expect, it } from 'vitest';
import { mapAdminProduct } from './productAdapter';

describe('admin product API boundary', () => {
  it('keeps inherited freight distinct from a deliberate zero override and threshold', () => {
    const product = mapAdminProduct({
      id: 'tea-1', product_name: 'Tea', type: 'Pu-erh', status: 'Active',
      shipping_rate_per_kg: null, fixed_retail_price_usd: 0, low_stock_threshold: 0,
    });
    expect(product.shippingRatePerKg).toBeNull();
    expect(product.fixedRetailPriceUSD).toBe(0);
    expect(product.lowStockThreshold).toBe(0);
  });

  it('preserves a tea-owned free freight rate and missing optional values', () => {
    const freeFreight = mapAdminProduct({ shipping_rate_per_kg: 0 });
    const missing = mapAdminProduct({});
    expect(freeFreight.shippingRatePerKg).toBe(0);
    expect(missing.fixedRetailPriceUSD).toBeNull();
    expect(missing.lowStockThreshold).toBe(100);
  });
});

it('consolidates legacy Puer names while keeping raw and ripe separate', () => {
  const types = ['Sheng', 'Sheng Puer', 'Shou', 'Shou Puer', 'Shu'];
  const products = types.map((type, index) => mapAdminProduct({ id: String(index), type }));
  expect(products.map(p => p.type)).toEqual(['Sheng Puer', 'Sheng Puer', 'Shou Puer', 'Shou Puer', 'Shou Puer']);
  expect(new Set(products.map(p => p.type)).size).toBe(2);
  expect(new Set(products.map(p => p.id)).size).toBe(5);
  expect(mapAdminProduct({ type: 'Pu-erh' }).type).toBe('Pu-erh');
});

it('offers and saves the same full Puer labels', () => {
  expect(INVENTORY_TEA_TYPES).toContain('Sheng Puer');
  expect(INVENTORY_TEA_TYPES).toContain('Shou Puer');
  expect(INVENTORY_TEA_TYPES).not.toContain('Sheng');
  expect(INVENTORY_TEA_TYPES).not.toContain('Shou');
  for (const value of ['Sheng', 'Sheng Puer', 'Shou', 'Shou Puer']) {
    expect(buildProductUpdatePayload('type', value)?.type).toBe(mapAdminProduct({ type: value }).type);
  }
});
