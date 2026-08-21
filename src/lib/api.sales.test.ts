import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

const emptyStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 };

afterEach(() => vi.unstubAllGlobals());

describe('sales API clients', () => {
  it('uses the product filter and grant mutation contract', async () => {
    vi.stubGlobal('localStorage', emptyStorage);
    vi.stubGlobal('sessionStorage', emptyStorage);
    const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify([]), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetch);

    await api.sales.listGrants('product/1');
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/sales/grants?product_id=product%2F1'),
      expect.anything(),
    );

    const terms = {
      product_id: 'product/1', seller_user_id: 'seller-1', price_floor: 0.3,
      owner_share_type: 'percent' as const, owner_share_value: 70, quantity_limit: 100,
      starts_at: null, expires_at: null,
    };
    await api.sales.createGrant(terms);
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/api/sales/grants'), expect.objectContaining({
      method: 'POST', body: JSON.stringify(terms),
    }));

    await api.sales.updateGrant('grant/1', { owner_share_value: 75 });
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/api/sales/grants/grant%2F1'), expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ owner_share_value: 75 }),
    }));

    await api.sales.revokeGrant('grant/1');
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/api/sales/grants/grant%2F1'), expect.objectContaining({ method: 'DELETE' }));
  });

  it('loads eligible products and settlement operations', async () => {
    vi.stubGlobal('localStorage', emptyStorage);
    vi.stubGlobal('sessionStorage', emptyStorage);
    const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify([]), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetch);

    await api.sales.eligibleProducts();
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/api/sales/eligible-products'), expect.anything());
    await api.sales.listSettlements({ mine: true });
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/api/sales/settlements?mine=1'), expect.anything());
    await api.sales.markSettlementPaid('settlement/1');
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/api/sales/settlements/settlement%2F1'), expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ status: 'paid' }),
    }));
  });
});
