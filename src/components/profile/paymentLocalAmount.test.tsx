import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PaymentChooser } from './PaymentChooser';
import {
  buildPaymentPageUrl,
  formatLocalAmount,
  localAmountNote,
  normalizeLocalAmount,
  parsePaymentContext,
} from './profileDomain';
import type { PaymentContext, PaymentLocalAmount, PaymentMethod } from './types';

const method: PaymentMethod = {
  id: 'pm-1',
  account_id: null,
  method_type: 'bank_transfer',
  label: 'Bank transfer',
  recipient_name: 'Adrian Rasmussen',
  account_identifier: '1234567890',
  instructions: null,
  external_url: null,
  qr_image_url: null,
  position: 0,
  is_published: true,
};

const local: PaymentLocalAmount = {
  currency: 'IDR',
  amount: '651000',
  rate: 16275,
  as_of: '2026-08-30T07:00:00.000Z',
};

function context(over: Partial<PaymentContext> = {}): PaymentContext {
  return { amount: '40.00', currency: 'USD', reference: 'TJ-1042', display: 'IDR', errors: [], ...over };
}

function render(over: { context?: PaymentContext; local?: PaymentLocalAmount | null } = {}) {
  const ctx = over.context ?? context();
  return renderToStaticMarkup(
    <PaymentChooser
      contributorName="Adrian Rasmussen"
      methods={[method]}
      destination="https://teajia.com/people/adrian/pay"
      context={ctx}
      local={over.local === undefined ? local : over.local}
    />,
  );
}

describe('the local currency parameter is held to the same bar as the others', () => {
  it('accepts a supported currency the order is not already priced in', () => {
    expect(parsePaymentContext(new URLSearchParams('amount=40.00&currency=USD&display=IDR'))).toEqual({
      amount: '40.00',
      currency: 'USD',
      reference: null,
      display: 'IDR',
      errors: [],
    });
  });

  it('refuses a hostile display parameter the way it refuses a hostile currency', () => {
    const parsed = parsePaymentContext(new URLSearchParams('amount=40.00&currency=USD&display=<script>'));
    expect(parsed.display).toBeNull();
    expect(parsed.errors).toHaveLength(1);

    const invented = parsePaymentContext(new URLSearchParams('display=DOGE'));
    expect(invented.display).toBeNull();
    expect(invented.errors).toHaveLength(1);

    // A hundred-character code, an empty one, and one with a currency smuggled
    // into it are all the same answer.
    expect(parsePaymentContext(new URLSearchParams('display=' + 'A'.repeat(100))).display).toBeNull();
    expect(parsePaymentContext(new URLSearchParams('display=IDR%20USD')).display).toBeNull();
  });

  it('drops a display currency the order is already priced in, without complaining', () => {
    const parsed = parsePaymentContext(new URLSearchParams('amount=40.00&currency=USD&display=usd'));
    expect(parsed.display).toBeNull();
    expect(parsed.errors).toEqual([]);
  });

  it('carries the currency across the store tabs, which rebuild the link', () => {
    const url = buildPaymentPageUrl('adrian', 'teajia-bali', 'https://teajia.com', context());
    expect(url).toContain('display=IDR');
    expect(buildPaymentPageUrl('adrian', null, 'https://teajia.com', context({ display: null })))
      .not.toContain('display');
  });
});

describe('an approximation that cannot be trusted is not shown', () => {
  it('refuses a conversion in a currency nobody supports', () => {
    expect(normalizeLocalAmount({ ...local, currency: 'DOGE' })).toBeNull();
    expect(normalizeLocalAmount({ ...local, currency: '' })).toBeNull();
  });

  it('refuses a zero, negative or unreadable figure rather than printing about zero', () => {
    expect(normalizeLocalAmount({ ...local, amount: '0' })).toBeNull();
    expect(normalizeLocalAmount({ ...local, amount: '-651000' })).toBeNull();
    expect(normalizeLocalAmount({ ...local, amount: 'lots' })).toBeNull();
    expect(normalizeLocalAmount({ ...local, rate: 0 })).toBeNull();
  });

  it('refuses a conversion that cannot say when its rate was taken', () => {
    // The honesty of the figure rests entirely on the moment behind it.
    expect(normalizeLocalAmount({ ...local, as_of: '' })).toBeNull();
    expect(normalizeLocalAmount({ ...local, as_of: 'yesterday' })).toBeNull();
  });

  it('refuses anything that is not a conversion at all', () => {
    expect(normalizeLocalAmount(null)).toBeNull();
    expect(normalizeLocalAmount(undefined)).toBeNull();
    expect(normalizeLocalAmount('IDR 651000')).toBeNull();
  });

  it('accepts a whole one', () => {
    expect(normalizeLocalAmount({ currency: 'idr', amount: ' 651000 ', rate: 16275, as_of: local.as_of }))
      .toEqual(local);
  });
});

describe('the dollar figure stays the debt', () => {
  it('groups the local figure so seven digits can be read', () => {
    const formatted = formatLocalAmount(local);
    expect(formatted).toContain('IDR');
    // Whatever the reader's locale groups with, it is not a bare run of digits.
    expect(formatted).not.toContain('651000');
  });

  it('names the dollar amount as the amount owed, under every approximation', () => {
    const note = localAmountNote(local, { amount: '40.00', currency: 'USD' });
    expect(note).toContain('approximation');
    expect(note).toContain('USD 40.00 is the amount owed');
  });

  it('renders the approximation beside the dollar figure, labelled', () => {
    const html = render();
    expect(html).toContain('USD 40.00');
    expect(html).toContain('About');
    expect(html).toContain('IDR');
    expect(html).toContain('is the amount owed');
  });

  it('lets the dollar figure be copied and the approximation not', () => {
    const html = render();
    expect(html).toContain('Copy amount');
    expect(html).not.toContain('Copy about');
  });
});

describe('a null conversion renders nothing extra', () => {
  it('adds no line, no placeholder and no explanation of the absence', () => {
    const html = render({ local: null });
    expect(html).toContain('USD 40.00');
    expect(html).not.toContain('About');
    expect(html).not.toContain('approximation');
    expect(html).not.toContain('IDR');
  });

  it('says nothing when the link carried no amount to convert', () => {
    const html = render({ context: context({ amount: null, display: null }), local: null });
    expect(html).not.toContain('approximation');
  });

  it('will not print an approximation with no dollar figure beside it', () => {
    // The number would silently become the amount the customer thinks they owe.
    const html = render({ context: context({ amount: null }), local });
    expect(html).not.toContain('About');
    expect(html).not.toContain('651');
  });

  it('holds its shape when only the helpers are asked', () => {
    expect(formatLocalAmount(null)).toBeNull();
    expect(localAmountNote(null, { amount: '40.00', currency: 'USD' })).toBeNull();
  });
});
