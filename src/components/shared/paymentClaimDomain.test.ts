import { describe, expect, it } from 'vitest';
import type { InvoicePayment } from '../../lib/api';
import {
  DUPLICATE_CLAIM_WARNING,
  accountSlugFromPayUrl,
  canSendClaim,
  defaultClaimAmount,
  outstandingUsd,
  pendingClaimCount,
  pendingClaimNotice,
  reportedClaimNotice,
  shouldOfferPaymentClaim,
  validateClaimAmount,
} from './paymentClaimDomain';

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

describe('what the form opens on', () => {
  it('defaults to the outstanding balance, not the invoice total', () => {
    // The invoice is 84 and 44 of it is confirmed. A form that opened on the
    // total would invite a customer to report money they did not send.
    expect(defaultClaimAmount(payment())).toBe(40);
    expect(defaultClaimAmount(payment())).not.toBe(84);
  });

  it('rounds a stray floating-point balance to cents', () => {
    expect(defaultClaimAmount(payment({ outstanding_usd: 40.005 }))).toBe(40.01);
  });

  it('reads zero from a missing or unusable balance', () => {
    expect(outstandingUsd(null)).toBe(0);
    expect(outstandingUsd(payment({ outstanding_usd: Number.NaN }))).toBe(0);
  });
});

describe('when there is nothing to pay, nothing renders', () => {
  it('says no when the order carries no payment block at all', () => {
    expect(shouldOfferPaymentClaim(null)).toBe(false);
    expect(shouldOfferPaymentClaim(undefined)).toBe(false);
  });

  it('says no when the tea master has published no transfer details', () => {
    expect(shouldOfferPaymentClaim(payment({ has_methods: false }))).toBe(false);
  });

  it('says no when the balance is zero or already over-covered', () => {
    expect(shouldOfferPaymentClaim(payment({ outstanding_usd: 0 }))).toBe(false);
    expect(shouldOfferPaymentClaim(payment({ outstanding_usd: -5 }))).toBe(false);
  });

  it('says yes only when a balance stands behind published details', () => {
    expect(shouldOfferPaymentClaim(payment())).toBe(true);
  });

  it('still says yes when a report is already pending on the balance', () => {
    expect(shouldOfferPaymentClaim(payment({ claims_pending: 1 }))).toBe(true);
  });
});

describe('the amount a customer can report', () => {
  it('rejects an empty or nonsense amount without naming a total', () => {
    expect(validateClaimAmount('', 40)).toEqual({ ok: false, error: 'Enter the amount you sent.' });
    expect(validateClaimAmount('  ', 40).ok).toBe(false);
    expect(validateClaimAmount('abc', 40).ok).toBe(false);
    expect(validateClaimAmount('0', 40).ok).toBe(false);
    expect(validateClaimAmount('-10', 40).ok).toBe(false);
  });

  it('accepts a part payment and a full one', () => {
    expect(validateClaimAmount('12.50', 40)).toEqual({ ok: true, amount: 12.5 });
    expect(validateClaimAmount('40', 40)).toEqual({ ok: true, amount: 40 });
  });

  it('allows a cent of tolerance and refuses more than the balance', () => {
    expect(validateClaimAmount('40.01', 40).ok).toBe(true);
    const over = validateClaimAmount('50', 40);
    expect(over.ok).toBe(false);
    expect(over.ok === false && over.error).toContain('$40.00');
  });

  it('reads a thousands separator the way a customer types it', () => {
    expect(validateClaimAmount('1,240.00', 2000)).toEqual({ ok: true, amount: 1240 });
  });
});

describe('a report is never a payment', () => {
  it('says a report is waiting, and never that the order is settled', () => {
    const line = pendingClaimNotice('Adrian');
    expect(line).toBe('A payment report is with Adrian, waiting to be checked against the transfer.');
    for (const word of ['paid', 'settled', 'cleared', 'complete']) {
      expect(line.toLowerCase()).not.toContain(word);
    }
  });

  it('drops the name rather than inventing one', () => {
    expect(pendingClaimNotice(null)).toBe('A payment report is waiting to be checked against the transfer.');
    expect(pendingClaimNotice('   ')).toBe('A payment report is waiting to be checked against the transfer.');
  });

  it('confirms receipt of the report, not of the money', () => {
    const line = reportedClaimNotice(40, 'Adrian');
    expect(line).toBe('Reported: $40.00. Adrian will confirm it once the transfer is seen.');
    for (const word of ['paid', 'settled', 'cleared', 'complete']) {
      expect(line.toLowerCase()).not.toContain(word);
    }
  });

  it('discourages a second report rather than silently taking it', () => {
    expect(pendingClaimCount(payment({ claims_pending: 2 }))).toBe(2);
    expect(pendingClaimCount(payment())).toBe(0);
    expect(pendingClaimCount(null)).toBe(0);
    expect(DUPLICATE_CLAIM_WARNING).toContain('already waiting');
    expect(DUPLICATE_CLAIM_WARNING).toContain('second transfer');
  });
});

describe('sending exactly once', () => {
  it('allows the first tap', () => {
    expect(canSendClaim({ sending: false, sent: false })).toBe(true);
  });

  it('refuses the tap that lands while the first is in the air', () => {
    expect(canSendClaim({ sending: true, sent: false })).toBe(false);
  });

  it('refuses the tap that lands after the report was accepted', () => {
    expect(canSendClaim({ sending: false, sent: true })).toBe(false);
  });
});

describe('which store the transfer details belong to', () => {
  it('reads the store back off the link the worker built', () => {
    expect(accountSlugFromPayUrl(payment().pay_url)).toBe('teajia-bali');
  });

  it('returns nothing rather than guessing', () => {
    expect(accountSlugFromPayUrl(null)).toBeNull();
    expect(accountSlugFromPayUrl('https://teajia.com/people/adrian/pay')).toBeNull();
    expect(accountSlugFromPayUrl('not a url at all')).toBeNull();
  });
});
