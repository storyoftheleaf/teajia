import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OrderPayLink } from './OrderPayLink';

describe('OrderPayLink', () => {
  it('offers the copy control and names the recipient when a link exists', () => {
    const html = renderToStaticMarkup(
      <OrderPayLink
        layout="block"
        invoiceNumber="TJ-0001"
        payment={{
          recipient_slug: 'adrian',
          recipient_name: 'Adrian',
          pay_url: 'https://teajia.com/people/adrian/pay?amount=84.00',
          has_methods: true,
          total_usd: 84,
          paid_usd: 0,
          outstanding_usd: 84,
          claims_pending: 0,
          tea_line_count: 3,
        }}
      />,
    );
    expect(html).toContain('Pay to Adrian · $84.00 due');
    expect(html).toContain('Share payment link</h4>');
    expect(html).toContain('Copy link');
    expect(html).toContain(encodeURIComponent('https://teajia.com/people/adrian/pay?amount=84.00'));
  });

  it('explains the missing link instead of rendering a button', () => {
    const html = renderToStaticMarkup(
      <OrderPayLink
        layout="block"
        payment={{
          recipient_slug: 'mei',
          recipient_name: 'Mei',
          pay_url: null,
          has_methods: false,
          total_usd: 84,
          paid_usd: 0,
          outstanding_usd: 84,
          claims_pending: 0,
        }}
      />,
    );
    expect(html).toContain('Add payment methods on Mei’s profile to share a link.');
    expect(html).not.toContain('Copy link');
    expect(html).not.toContain('<button');
  });

  it('says so inline on a dense row when there is no link', () => {
    const html = renderToStaticMarkup(
      <OrderPayLink
        layout="inline"
        payment={{
          recipient_slug: 'mei',
          recipient_name: 'Mei',
          pay_url: null,
          has_methods: false,
          total_usd: 84,
          paid_usd: 0,
          outstanding_usd: 84,
          claims_pending: 0,
        }}
      />,
    );
    expect(html).toContain('Pay to Mei');
    expect(html).toContain('no transfer details');
    expect(html).not.toContain('<button');
  });

  it('renders nothing when the order carries no payment object', () => {
    expect(renderToStaticMarkup(<OrderPayLink payment={null} />)).toBe('');
  });
});
