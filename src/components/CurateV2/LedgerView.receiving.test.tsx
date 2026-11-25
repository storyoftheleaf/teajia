import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { LedgerView } from './LedgerView';
import { SHOP_ORDERS_KEY } from './shopOrders';
import { LIBRARY_RECEIPTS_KEY } from '../../lib/libraryPurchaseState';

vi.mock('../../admin/hooks/usePrivateQueryScope', () => ({
  usePrivateQueryScope: () => ({ key: ['shop', 'owner', 0], ready: true }),
}));
vi.mock('../../lib/store', async importOriginal => ({
  ...await importOriginal<typeof import('../../lib/store')>(),
  useAppStore: Object.assign(
    (select: (state: unknown) => unknown) => select({ activeAccountId: 'shop', activeUserId: 'owner' }),
    {
      getState: () => ({ activeAccountId: 'shop', activeUserId: 'owner' }),
      subscribe: () => () => {},
    },
  ),
}));

describe('mounted Curate V2 recorded-purchase receiving details', () => {
  it('shows authoritative known received and due quantities instead of blanks or order-only data', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData([...SHOP_ORDERS_KEY, 'shop', 'owner', 0], [{
      id: 'purchase-1', vendorName: 'Fixture Tea Works', vendorId: null, status: 'ordered',
      currency: 'Yuan', totalUsd: 70, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z',
      items: [{ id: 'shop-line-0', name: 'Known Partial Tea', pricePerUnit: 1, priceIsPerGram: true,
        currency: 'Yuan', quantityGrams: 100, productId: 'product-1', addedAt: '2026-11-01T00:00:00Z' }],
      unreadableLines: false, notes: null, shipMode: null, trackingNumber: null, receiptId: 'receipt-1',
    }]);
    client.setQueryData([...LIBRARY_RECEIPTS_KEY, 'shop', 'owner', 0], [{ id: 'receipt-1', state: 'partially_received', source_kind: 'purchase', lines: [{ id: 'receipt-line-1', product_id: 'product-1', product_name: 'Known Partial Tea',
      expected_quantity: 100, received_quantity: 40, cancelled_quantity: 0, unit: 'g', intended_purpose: 'working' }] }]);

    const html = renderToStaticMarkup(
      <MemoryRouter><QueryClientProvider client={client}>
        <LedgerView embedded />
      </QueryClientProvider></MemoryRouter>,
    );
    expect(html).toContain('Fixture Tea Works');
    expect(html).toContain('40 g received');
    expect(html).toContain('60 g due');
  });

  it('names an explicitly unmatched authoritative receipt instead of inventing zero quantities or receiving', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData([...SHOP_ORDERS_KEY, 'shop', 'owner', 0], [{
      id: 'purchase-unmatched', vendorName: 'Unmatched Tea Works', vendorId: null, status: 'ordered',
      currency: 'Yuan', totalUsd: null, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z', receiptId: 'receipt-unmatched',
      items: [{ id: 'shop-line-unmatched', name: 'Unmatched Tea', pricePerUnit: 0, priceIsPerGram: true, unpriced: true,
        currency: 'Yuan', quantityGrams: 100, productId: 'product-missing', purchaseReceiptLineId: 'saved-line-missing', addedAt: '2026-11-01T00:00:00Z' }],
      unreadableLines: false, notes: null, shipMode: null, trackingNumber: null,
    }]);
    client.setQueryData([...LIBRARY_RECEIPTS_KEY, 'shop', 'owner', 0], [{ id: 'receipt-unmatched', state: 'partially_received', source_kind: 'purchase', lines: [{ id: 'different-line', product_id: 'product-missing', product_name: 'Different line',
      expected_quantity: 100, received_quantity: 0, cancelled_quantity: 0, unit: 'g', intended_purpose: 'working' }] }]);

    const html = renderToStaticMarkup(<MemoryRouter><QueryClientProvider client={client}><LedgerView embedded /></QueryClientProvider></MemoryRouter>);
    expect(html).toContain('Receipt unavailable');
    expect(html).not.toContain('0 g received');
    expect(html).not.toContain('Receive 100g');
  });
});
