import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OrderAttributionView } from './OrderAttribution';

const detail = {
  invoice_id: 'invoice-1',
  seller_name: 'Rayi',
  payment_recipient_name: 'Barry',
  payment_recipient_kind: 'person' as const,
  fulfilled_by_name: 'Adrian',
  fulfilled_at: '2026-08-11T00:00:00Z',
  settlement_visibility: 'full' as const,
  items: [
    { line_item_id: 'line-1', product_id: 'tea-1', stock_owner_name: 'Barry', settlement_status: 'owed' as const },
    { line_item_id: 'line-2', product_id: 'tea-2', stock_owner_name: 'Teajia', settlement_status: 'paid' as const },
  ],
};

describe('OrderAttributionView', () => {
  it('renders seller, stock owner, fulfiller, payment recipient and a mixed settlement state', () => {
    const html = renderToStaticMarkup(<OrderAttributionView mode="ready" detail={detail} onRetry={() => {}} />);
    for (const label of ['Seller', 'Stock owner', 'Fulfilled by', 'Payment recipient', 'Settlement']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('Rayi');
    expect(html).toContain('Barry + Teajia');
    expect(html).toContain('Adrian');
    expect(html).toContain('Mixed');
  });

  it('renders loading and retryable error states', () => {
    expect(renderToStaticMarkup(<OrderAttributionView mode="loading" detail={null} onRetry={() => {}} />))
      .toContain('Loading sales attribution');
    const error = renderToStaticMarkup(<OrderAttributionView mode="error" detail={null} onRetry={() => {}} />);
    expect(error).toContain('Sales attribution could not be loaded');
    expect(error).toContain('Retry');
  });

  it('labels restricted fulfilled settlements without leaking participant data', () => {
    const html = renderToStaticMarkup(<OrderAttributionView
      mode="ready"
      detail={{ ...detail, settlement_visibility: 'restricted', items: detail.items.map(item => ({ ...item, settlement_status: null })) }}
      onRetry={() => {}}
    />);
    expect(html).toContain('Private');
    expect(html).not.toContain('Owed');
    expect(html).not.toContain('Paid');
  });

  it('keeps a fulfilled restricted settlement private when the fulfiller was not recorded', () => {
    const html = renderToStaticMarkup(<OrderAttributionView
      mode="ready"
      detail={{
        ...detail,
        fulfilled_by_name: null,
        settlement_visibility: 'restricted',
        items: detail.items.map(item => ({ ...item, settlement_status: null })),
      }}
      onRetry={() => {}}
    />);
    expect(html).toContain('Private');
    expect(html).not.toContain('Not created');
  });

  it('does not guess missing seller, fulfiller, payment recipient, or custom-line stock ownership', () => {
    const html = renderToStaticMarkup(<OrderAttributionView
      mode="ready"
      detail={{
        ...detail,
        seller_name: null,
        fulfilled_by_name: null,
        payment_recipient_name: null,
        payment_recipient_kind: 'unrecorded',
        items: [{ line_item_id: 'custom', product_id: null, stock_owner_name: null, settlement_status: null }],
      }}
      onRetry={() => {}}
    />);
    expect(html).toContain('No inventory');
    expect(html.match(/Not recorded/g)?.length).toBe(3);
    expect(html).not.toContain('Account stock');
  });

  it('distinguishes account, mixed, and absent payment recipients', () => {
    for (const [kind, label] of [
      ['account', 'Teajia'],
      ['mixed', 'Mixed recipients'],
      ['none', 'No stock recipient'],
    ] as const) {
      const html = renderToStaticMarkup(<OrderAttributionView
        mode="ready"
        detail={{ ...detail, payment_recipient_kind: kind, payment_recipient_name: kind === 'account' ? 'Teajia' : null }}
        onRetry={() => {}}
      />);
      expect(html).toContain(label);
    }
  });
});
