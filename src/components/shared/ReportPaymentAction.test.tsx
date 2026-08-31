import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { InvoicePayment } from '../../lib/api';
import { ReportPaymentAction } from './ReportPaymentAction';

function payment(over: Partial<InvoicePayment> = {}): InvoicePayment {
  return {
    recipient_slug: 'adrian',
    recipient_name: 'Adrian',
    pay_url: 'https://teajia.com/people/adrian/pay?account=teajia-bali&amount=40.00',
    has_methods: true,
    total_usd: 84,
    paid_usd: 44,
    outstanding_usd: 40,
    claims_pending: 0,
    ...over,
  };
}

const source = { kind: 'account', invoiceId: 'inv_1' } as const;

describe('ReportPaymentAction', () => {
  it('offers the report as a quiet line, never as a second solid button', () => {
    const html = renderToStaticMarkup(<ReportPaymentAction payment={payment()} source={source} />);
    expect(html).toContain("I&#x27;ve sent payment");
    expect(html).not.toContain('cta-solid');
  });

  it('renders nothing when the request has not been priced yet', () => {
    expect(renderToStaticMarkup(<ReportPaymentAction payment={null} source={source} />)).toBe('');
  });

  it('renders nothing when the tea master published no transfer details', () => {
    const html = renderToStaticMarkup(
      <ReportPaymentAction payment={payment({ has_methods: false, pay_url: null })} source={source} />,
    );
    expect(html).toBe('');
  });

  it('renders nothing when there is no balance left to speak about', () => {
    const html = renderToStaticMarkup(
      <ReportPaymentAction payment={payment({ outstanding_usd: 0, pay_url: null })} source={source} />,
    );
    expect(html).toBe('');
  });

  it('says a report is waiting, and does not read as paid', () => {
    const html = renderToStaticMarkup(
      <ReportPaymentAction payment={payment({ claims_pending: 1 })} source={source} />,
    );
    expect(html).toContain('waiting to be checked against the transfer');
    expect(html).toContain('Report another transfer');
    for (const word of ['paid', 'settled', 'cleared', 'complete']) {
      expect(html.toLowerCase()).not.toContain(`>${word}`);
    }
  });
});
