import { describe, expect, it } from 'vitest';
import type { PurchaseOrder } from '../../lib/api';
import type { InventoryReceipt } from '../types';
import { recordedCost, vendorEconomics, vendorPurchaseOrders, vendorReceipts, type PricedProductRow, type VendorProductRow } from './vendorProfileData';

const supplied = (id: string, stock_grams = 500): VendorProductRow => ({
  id, product_name: id, given_name: null, chinese_name: null, type: 'Puer', image_url: null,
  origin_country: 'China', origin_region: 'Yunnan', stock_grams, status: 'Active', cost_amount: 88, cost_currency: 'CNY',
});
const priced = (id: string, cost_amount = 88): PricedProductRow => ({
  id, type: 'Puer', cost_amount, cost_currency: 'CNY', cost_currency_source: 'stated',
  cost_per_gram_usd: 0.13, quantity_purchased: 100, quantity_units: null, stock_grams: 500,
});

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

  it('restores cost, average cost per gram, and stock value from scoped pricing and the shared rate', () => {
    expect(vendorEconomics([supplied('tea-1')], [priced('tea-1')], [{ currency: 'Yuan', rateToUSD: 8 }])).toEqual({
      totalCostUsd: 11, avgCostPerGramUsd: 0.13, stockValueUsd: 65,
    });
  });

  it('keeps an unknown exchange rate or missing priced row unavailable instead of summing mixed currencies', () => {
    const rows = [supplied('tea-1'), supplied('tea-2')];
    expect(vendorEconomics(rows, [priced('tea-1'), priced('tea-2')], [])).toEqual({
      totalCostUsd: null, avgCostPerGramUsd: null, stockValueUsd: null,
    });
    expect(vendorEconomics(rows, [priced('tea-1')], [{ currency: 'Yuan', rateToUSD: 8 }])).toEqual({
      totalCostUsd: null, avgCostPerGramUsd: null, stockValueUsd: null,
    });
  });

  it('keeps a deliberately recorded zero cost visible', () => {
    expect(vendorEconomics([supplied('sample', 0)], [{ ...priced('sample', 0), cost_per_gram_usd: 0 }], [{ currency: 'Yuan', rateToUSD: 8 }])).toEqual({
      totalCostUsd: 0, avgCostPerGramUsd: 0, stockValueUsd: 0,
    });
  });
});
