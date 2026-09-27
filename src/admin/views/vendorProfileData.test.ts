import { describe, expect, it } from 'vitest';
import type { PurchaseOrder } from '../../lib/api';
import type { InventoryReceipt } from '../types';
import { recordedCost, vendorPurchaseOrders, vendorReceipts, type VendorProductRow } from './vendorProfileData';

describe('vendor profile data contracts', () => {
  it('reads raw supplied-product cost in its recorded currency', () => {
    const product: VendorProductRow = {
      id: 'p1', product_name: 'Raw tea', given_name: null, chinese_name: null, type: 'Puer',
      image_url: null, origin_country: 'China', origin_region: 'Yunnan', stock_grams: 600,
      status: 'active', cost_amount: 120, cost_currency: 'CNY',
    };
    expect(recordedCost(product)).toBe('120 CNY');
    expect(recordedCost({ ...product, cost_amount: null })).toBeNull();
    expect(recordedCost({ ...product, cost_currency: 'UNK' })).toBeNull();
  });

  it('matches orders by vendor ID, with exact name fallback only for legacy rows', () => {
    const row = (id: string, vendor_id: string | null, vendor_name: string) => ({ id, vendor_id, vendor_name }) as PurchaseOrder;
    const orders = [row('id', 'v1', 'Old name'), row('other-id', 'v2', 'Target Vendor'), row('legacy', null, ' target vendor '), row('partial', null, 'Target Vendor West')];
    expect(vendorPurchaseOrders(orders, 'v1', 'Target Vendor').map(o => o.id)).toEqual(['id', 'legacy']);
  });

  it('matches receipts by exact vendor name', () => {
    const receipts = [{ id: 'r1', vendor_name: 'Target Vendor' }, { id: 'r2', vendor_name: 'Target Vendor West' }] as InventoryReceipt[];
    expect(vendorReceipts(receipts, ' target vendor ').map(r => r.id)).toEqual(['r1']);
  });
});
