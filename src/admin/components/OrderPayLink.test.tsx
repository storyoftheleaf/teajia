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
        }}
      />,
    );
    expect(html).toContain('Paid to Adrian');
    expect(html).toContain('Copy pay link');
    expect(html).toContain('https://teajia.com/people/adrian/pay?amount=84.00');
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
    expect(html).toContain('Mei has not published transfer details');
    expect(html).toContain('their own profile page, under Payment methods');
    expect(html).not.toContain('Copy pay link');
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
