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
