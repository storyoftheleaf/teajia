import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  OrderClaimsFlag,
  OrderPaymentsPanelView,
  defaultRecordAmount,
  describePaymentRow,
  orderPaymentTotals,
  validateRecordAmount,
} from './OrderPayments';
import type { InvoicePayment, InvoicePaymentRecord } from '../types';

const payment = (over: Partial<InvoicePayment> = {}): InvoicePayment => ({
  recipient_slug: 'adrian',
  recipient_name: 'Adrian',
  pay_url: 'https://teajia.com/people/adrian/pay?amount=44.00',
  has_methods: true,
  total_usd: 84,
  paid_usd: 40,
  outstanding_usd: 44,
  claims_pending: 0,
  ...over,
});

const row = (over: Partial<InvoicePaymentRecord> = {}): InvoicePaymentRecord => ({
  id: 'pay_1',
  invoice_id: 'inv_1',
  amount_usd: 44,
  status: 'claimed',
  claimed_by: 'customer',
  claimed_at: '2026-08-30 09:15:00',
  created_at: '2026-08-30 09:15:00',
  ...over,
});

const view = (props: Partial<React.ComponentProps<typeof OrderPaymentsPanelView>> = {}) =>
  renderToStaticMarkup(
    <OrderPaymentsPanelView
      payment={payment()}
      rows={[]}
      mode="ready"
      pendingRowId={null}
      recording={false}
      recordError={null}
      onRetry={() => {}}
      onRequestConfirm={() => {}}
      onReject={() => {}}
      onRecord={() => {}}
      {...props}
    />,
  );

describe('describePaymentRow', () => {
  it('never lets a customer report count as money', () => {
    const claim = describePaymentRow(row());
    expect(claim.source).toBe('Reported by customer');
    expect(claim.state).toBe('Awaiting confirmation');
    expect(claim.countsAsPaid).toBe(false);
    expect(claim.awaiting).toBe(true);
  });

  it('marks an operator record as confirmed money', () => {
    const recorded = describePaymentRow(row({ claimed_by: 'operator', status: 'confirmed' }));
    expect(recorded.source).toBe('Recorded by you');
    expect(recorded.state).toBe('Confirmed');
    expect(recorded.countsAsPaid).toBe(true);
  });

  it('keeps a rejected report visible without counting it', () => {
    const rejected = describePaymentRow(row({ status: 'rejected' }));
    expect(rejected.state).toBe('Rejected');
    expect(rejected.countsAsPaid).toBe(false);
    expect(rejected.awaiting).toBe(false);
  });
});

describe('OrderPaymentsPanelView', () => {
  it('draws a customer report as awaiting, not as paid', () => {
    const html = view({ rows: [row()], payment: payment({ claims_pending: 1 }) });
    expect(html).toContain('Reported by the customer');
    expect(html).toContain('Awaiting confirmation');
    expect(html).toContain('Nothing changes on the order until you confirm it.');
    // The reported 44.00 is not folded into Paid: that figure is the server's
    // confirmed total and stays at 40.00 while the report is outstanding.
    expect(html).toContain('$40.00');
    expect(html).toContain('$44.00');
    expect(html).not.toContain('Reported by customer · Confirmed');
  });

  it('offers both a reject and a confirm on a report', () => {
    const html = view({ rows: [row()] });
    expect(html).toContain('Reject');
    expect(html).toContain('Confirm payment');
  });

  it('shows the three numbers', () => {
    const html = view();
    expect(html).toContain('Total');
    expect(html).toContain('Paid');
    expect(html).toContain('Outstanding');
  });

  it('defaults the record field to the outstanding balance, not the total', () => {
    const html = view();
    expect(html).toContain('value="44.00"');
    expect(html).not.toContain('value="84.00"');
  });

  it('offers no record form once nothing is outstanding', () => {
    const html = view({ payment: payment({ paid_usd: 84, outstanding_usd: 0 }) });
    expect(html).toContain('Nothing outstanding on this order.');
    expect(html).not.toContain('Record a payment');
  });

  it('says plainly when an order has no payments yet', () => {
    const html = view({ rows: [] });
    expect(html).toContain('No payments recorded on this order yet.');
  });
});

describe('defaultRecordAmount', () => {
  it('is the outstanding balance after a part payment, not the invoice total', () => {
    expect(defaultRecordAmount(payment())).toBe('44.00');
  });

  it('is empty when the order is settled', () => {
    expect(defaultRecordAmount(payment({ paid_usd: 84, outstanding_usd: 0 }))).toBe('');
  });
});

describe('validateRecordAmount', () => {
  it('refuses an amount above the outstanding balance', () => {
    expect(validateRecordAmount('84.00', 44)).toContain('more than the $44.00 outstanding');
  });

  it('allows the exact balance, and a rounding cent over it', () => {
    expect(validateRecordAmount('44.00', 44)).toBeNull();
    expect(validateRecordAmount('44.005', 44)).toBeNull();
  });

  it('refuses nothing, zero, and a non-number', () => {
    expect(validateRecordAmount('', 44)).toBe('Enter an amount.');
    expect(validateRecordAmount('0', 44)).toBe('Enter an amount above zero.');
    expect(validateRecordAmount('-5', 44)).toBe('Enter an amount above zero.');
    expect(validateRecordAmount('forty', 44)).toBe('Enter an amount as a number.');
  });
});

describe('orderPaymentTotals', () => {
  it('reads the server figures', () => {
    expect(orderPaymentTotals(payment())).toEqual({
      total: 84, paid: 40, outstanding: 44, claimsPending: 0,
    });
  });

  it('never reports a negative balance', () => {
    expect(orderPaymentTotals(payment({ outstanding_usd: -3 })).outstanding).toBe(0);
  });

  it('falls back to total minus paid on a response that carries no balance', () => {
    const legacy = { recipient_slug: null, recipient_name: null, pay_url: null, has_methods: false } as unknown as InvoicePayment;
    expect(orderPaymentTotals(legacy)).toEqual({ total: 0, paid: 0, outstanding: 0, claimsPending: 0 });
  });
});

describe('OrderClaimsFlag', () => {
  it('marks an order with reports and stays silent otherwise', () => {
    expect(renderToStaticMarkup(<OrderClaimsFlag payment={payment({ claims_pending: 2 })} />))
      .toContain('2 reported');
    expect(renderToStaticMarkup(<OrderClaimsFlag payment={payment()} />)).toBe('');
    expect(renderToStaticMarkup(<OrderClaimsFlag payment={null} />)).toBe('');
  });
});
