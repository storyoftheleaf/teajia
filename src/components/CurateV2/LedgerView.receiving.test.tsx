import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { LedgerView } from './LedgerView';
import { SHOP_ORDERS_KEY, shopOrderOf } from './shopOrders';
import type { PurchaseOrder } from '../../lib/api';
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
    const workerRow = { id: 'purchase-unmatched', account_id: 'shop', vendor_name: 'Unmatched Tea Works', vendor_id: null, vendor_contact: null,
      items_json: JSON.stringify([{ product_name: 'Unmatched Tea', product_id: 'product-missing', quantity: 100, receipt_line_id: 'saved-line-missing' }]),
      total_usd: null, display_currency: 'Yuan', status: 'ordered', message_text: null, notes: null, receipt_id: 'receipt-unmatched',
      created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-02T00:00:00Z' } as PurchaseOrder;
    expect(workerRow.receipt_id).toBe('receipt-unmatched');
    expect(JSON.parse(workerRow.items_json)[0].receipt_line_id).toBe('saved-line-missing');
    client.setQueryData([...SHOP_ORDERS_KEY, 'shop', 'owner', 0], [shopOrderOf(workerRow)]);
    client.setQueryData([...LIBRARY_RECEIPTS_KEY, 'shop', 'owner', 0], [{ id: 'receipt-unmatched', state: 'partially_received', source_kind: 'purchase', lines: [{ id: 'different-line', product_id: 'product-missing', product_name: 'Different line',
      expected_quantity: 100, received_quantity: 0, cancelled_quantity: 0, unit: 'g', intended_purpose: 'working' }] }]);

    const html = renderToStaticMarkup(<MemoryRouter><QueryClientProvider client={client}><LedgerView embedded /></QueryClientProvider></MemoryRouter>);
    expect(html).toContain('Receipt unavailable');
    expect(html).not.toContain('0 g received');
    expect(html).not.toContain('Receive 100g');
  });

  it('keeps each known line quantity identifiable in a multi-line recorded order', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const workerRow = { id: 'purchase-many', account_id: 'shop', vendor_name: 'Two Line Tea', vendor_id: null, vendor_contact: null,
      items_json: JSON.stringify([
        { product_name: 'First Tea', product_id: 'product-first', quantity: 100, receipt_line_id: 'line-first' },
        { product_name: 'Second Tea', product_id: 'product-second', quantity: 200, receipt_line_id: 'line-second' },
      ]), total_usd: null, display_currency: 'Yuan', status: 'ordered', message_text: null, notes: null, receipt_id: 'receipt-many',
      created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-02T00:00:00Z' } as PurchaseOrder;
    client.setQueryData([...SHOP_ORDERS_KEY, 'shop', 'owner', 0], [shopOrderOf(workerRow)]);
    client.setQueryData([...LIBRARY_RECEIPTS_KEY, 'shop', 'owner', 0], [{ id: 'receipt-many', state: 'partially_received', source_kind: 'purchase', lines: [
      { id: 'line-first', product_id: 'product-first', product_name: 'First Tea', expected_quantity: 100, received_quantity: 10, cancelled_quantity: 0, unit: 'g', intended_purpose: 'working' },
      { id: 'line-second', product_id: 'product-second', product_name: 'Second Tea', expected_quantity: 200, received_quantity: 40, cancelled_quantity: 10, unit: 'g', intended_purpose: 'working' },
    ] }]);
    const html = renderToStaticMarkup(<MemoryRouter><QueryClientProvider client={client}><LedgerView embedded /></QueryClientProvider></MemoryRouter>);
    expect(html).toContain('First Tea: 10 g received · 90 g due');
    expect(html).toContain('Second Tea: 40 g received · 150 g due');
  });

  it('keeps a pending-proposal-only order on its prior ordered path', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const workerRow = { id: 'purchase-pending', account_id: 'shop', vendor_name: 'Pending Tea', vendor_id: null, vendor_contact: null,
      items_json: JSON.stringify([{ product_name: 'Waiting Tea', product_id: 'product-waiting', compass_entry_id: 'entry-waiting', quantity: 100 }]),
      total_usd: null, display_currency: 'Yuan', status: 'ordered', message_text: null, notes: null, receipt_id: null,
      created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-02T00:00:00Z' } as PurchaseOrder;
    client.setQueryData([...SHOP_ORDERS_KEY, 'shop', 'owner', 0], [shopOrderOf(workerRow)]);
    client.setQueryData(['library-purchase-history', 'shop', 'owner', 0], { pending: [{ id: 'proposal', compass_entry_id: 'entry-waiting', product_id: 'product-waiting', quantity: 100, unit: 'g', status: 'pending', acquisition_kind: 'purchase', idempotency_key: 'order:purchase-pending:entry-waiting' }] });
    const html = renderToStaticMarkup(<MemoryRouter><QueryClientProvider client={client}><LedgerView embedded /></QueryClientProvider></MemoryRouter>);
    expect(html).toContain('<span>ordered</span>');
    expect(html).not.toContain('Receipt unavailable');
    expect(html).not.toContain('received');
    expect(html).not.toContain(' due');
  });
});
