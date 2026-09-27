import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';

vi.mock('react-router-dom', () => ({ useParams: () => ({ vendorId: 'vendor-1' }), useNavigate: () => vi.fn() }));
vi.mock('../hooks/usePrivateQueryScope', () => ({ usePrivateQueryScope: () => ({ ready: true, key: ['account-1', 'user-1', 1] }) }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === 'vendor' ? { id: 'vendor-1', name: 'Target Vendor', tags: [], contacts: [] }
      : queryKey[0] === 'vendor-products' ? [{
          id: 'tea-1', product_name: 'Worker tea', given_name: 'Yunnan tea', chinese_name: null,
          type: 'Puer', image_url: null, origin_country: 'China', origin_region: 'Yunnan',
          stock_grams: 500, status: 'Active', cost_amount: 88, cost_currency: 'CNY',
        }]
      : queryKey[0] === 'purchase-orders' ? [
          { id: 'po-1', vendor_id: 'vendor-1', vendor_name: 'Target Vendor', total_usd: 50, status: 'pending', created_at: '2026-09-01' },
          { id: 'po-2', vendor_id: 'vendor-2', vendor_name: 'Target Vendor', total_usd: 90, status: 'pending', created_at: '2026-09-01' },
        ]
      : queryKey[0] === 'inventory-receipts-all' ? [{ id: 'receipt-1', vendor_name: 'Target Vendor', source_kind: 'purchase', state: 'ordered', lines: [] }]
      : [{ id: 'sale-1', customer_name: 'Target Vendor', invoice_number: 'SALE-1' }],
    isLoading: false,
  }),
}));

import { VendorProfileView } from './VendorProfileView';

describe('vendor profile route', () => {
  it('renders raw product cost with its currency and real purchase history only', () => {
    const html = renderToString(<VendorProfileView />);
    expect(html).toContain('Yunnan tea');
    expect(html).toContain('88 CNY');
    expect(html).toContain('Purchase order');
    expect(html).toContain('Inventory receipt');
    expect(html).not.toContain('SALE-1');
    expect(html).not.toContain('$90.00');
    expect(html).not.toContain('Avg cost/g');
  });
});
