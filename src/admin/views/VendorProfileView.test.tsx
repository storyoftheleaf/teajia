import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ vendorId: 'vendor-1' }),
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => React.createElement('a', { href: to, ...rest }, children),
}));
vi.mock('../hooks/usePrivateQueryScope', () => ({ usePrivateQueryScope: () => ({ ready: true, key: ['account-1', 'user-1', 1] }) }));
vi.mock('../hooks/useAdminData', () => ({ useRates: () => ({ data: [{ currency: 'Yuan', rateToUSD: 8 }] }) }));
vi.mock('@tanstack/react-query', () => ({
  // The face photo button refreshes vendor lists after a save.
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === 'vendor' ? { id: 'vendor-1', name: 'Target Vendor', tags: [], contacts: [] }
      : queryKey[0] === 'vendor-products' ? [{
          id: 'tea-1', product_name: 'Worker tea', given_name: 'Yunnan tea', chinese_name: null,
          type: 'Puer', image_url: null, origin_country: 'China', origin_region: 'Yunnan',
          stock_grams: 500, status: 'Active', cost_amount: 88, cost_currency: 'CNY', cost_currency_source: 'stated',
          quantity_purchased: 100, quantity_units: null, cost_per_gram_usd: 0.13,
        }]
      : queryKey[0] === 'purchase-orders' ? [
          { id: 'po-1', vendor_id: 'vendor-1', vendor_name: 'Target Vendor', total_usd: 0, status: 'pending', created_at: '2026-09-01' },
          { id: 'po-2', vendor_id: 'vendor-2', vendor_name: 'Target Vendor', total_usd: 90, status: 'pending', created_at: '2026-09-01' },
        ]
      : queryKey[0] === 'vendor-sales' ? [{
          line_id: 'line-1', invoice_id: 'inv-9', invoice_number: 'INV-9', status: 'Paid', created_at: '2026-10-02 10:00:00',
          customer_id: 'cust-7', customer_name: 'Mei', product_id: 'tea-1', product_name: 'Yunnan tea',
          quantity: 50, quantity_unit: 'g', price_at_sale: 0.5,
        }]
      : queryKey[0] === 'vendor-own-orders' ? [{ id: 'own-1', invoice_number: 'OWN-3', status: 'Paid', created_at: '2026-10-05', computed_total: 40, shipping_cost_usd: 0 }]
      : queryKey[0] === 'vendor-curate-teas' ? { entries: [
          { id: 'entry-1', name: '2019 Mahei', type: 'Sheng', year: 2019, status: 'want' },
          { id: 'entry-2', name: 'Stocked twin', draft_product_id: 'tea-1', status: 'in_stock' },
        ] }
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
    expect(html).toContain('Total cost');
    expect(html).toContain('$11');
    expect(html).toContain('Avg cost/g');
    expect(html).toContain('$0.130');
    expect(html).toContain('Stock value');
    expect(html).toContain('$65');
    expect(html).toMatch(/\$<!-- -->0\.00<!-- --> USD/);
    expect(html).not.toContain('SALE-1');
    expect(html).not.toContain('$90.00');
  });

  it('shows who bought their teas, and what the vendor bought from the shop', () => {
    const html = renderToString(<VendorProfileView />);
    expect(html).toContain('Their teas, sold');
    expect(html).toContain('href="/admin/people/cust-7"');
    expect(html).toContain('Mei');
    expect(html).toContain('$25.00');
    expect(html).toContain('Bought from you');
    expect(html).toContain('#OWN-3');
    expect(html).toContain('$40.00');
  });

  it('opens every row: teas in Stock, receipts and orders on their own screens, invoices in Activity', () => {
    const html = renderToString(<VendorProfileView />);
    expect(html).toContain('href="/admin/stock?panel=tea-1"');
    expect(html).toContain('href="/admin/purchase-orders?purchaseId=po-1"');
    expect(html).toContain('href="/admin/stock?receipt=receipt-1"');
    expect(html).toContain('href="/admin/activity?tab=orders&amp;search=INV-9"');
    expect(html).toContain('href="/admin/activity?tab=orders&amp;search=OWN-3"');
    expect(html).toContain('href="/admin/compass?entry=entry-1"');
    expect(html).not.toContain('Stocked twin');
    expect(html).toContain('href="/wisdom/region/yunnan"');
  });

  it('reads in order: numbers, teas, Curate, bought from them, sold', () => {
    const html = renderToString(<VendorProfileView />);
    const at = (text: string) => html.indexOf(text);
    expect(at('At a glance')).toBeLessThan(at('Products supplied'));
    expect(at('Products supplied')).toBeLessThan(at('In Curate'));
    expect(at('In Curate')).toBeLessThan(at('Bought from them'));
    expect(at('Bought from them')).toBeLessThan(at('Their teas, sold'));
  });

  it('has no notes section when nothing is written', () => {
    expect(renderToString(<VendorProfileView />)).not.toContain('data-testid="vendor-notes"');
  });

  it('makes the details editable where they sit', () => {
    const html = renderToString(<VendorProfileView />);
    expect(html).toContain('aria-label="Edit name"');
    expect(html).toContain('aria-label="Edit address"');
    expect(html).toContain('Add contact');
  });
});
