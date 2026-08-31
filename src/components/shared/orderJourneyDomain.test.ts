import { describe, expect, it } from 'vitest';
import type { InvoicePayment, OrderJourney } from '../../lib/api';
import {
  JOURNEY_TONE_CLASS,
  formatStageDate,
  hasJourney,
  journeyTone,
  normalizeJourney,
  showsPaymentActions,
  showsStageDate,
  stageDateline,
} from './orderJourneyDomain';

type Stage = OrderJourney['stage'];

const ALL_STAGES: Stage[] = [
  'received',
  'confirmed',
  'awaiting_payment',
  'part_paid',
  'paid',
  'sent',
  'closed',
];

function journey(over: Partial<OrderJourney> = {}): OrderJourney {
  return {
    stage: 'awaiting_payment',
    label: 'Waiting for payment',
    detail: 'The tea is set aside for you until the transfer arrives.',
    at: '2026-08-24T09:15:00.000Z',
    ...over,
  };
}

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

describe('every stage says something, including the ones nobody looks at', () => {
  it.each(ALL_STAGES)('reads %s back whole', stage => {
    const parsed = normalizeJourney(journey({ stage }));
    expect(parsed).not.toBeNull();
    expect(parsed?.stage).toBe(stage);
    expect(hasJourney(parsed)).toBe(true);
    // The words are the worker's. Nothing in this layer rewrites or replaces
    // them, so whatever it wrote is what the customer reads.
    expect(parsed?.label).toBe('Waiting for payment');
  });

  it('carries part_paid through with its own label and detail intact', () => {
    const parsed = normalizeJourney(
      journey({ stage: 'part_paid', label: 'Part paid', detail: 'USD 40.00 is still outstanding.' }),
    );
    expect(parsed).toEqual({
      stage: 'part_paid',
      label: 'Part paid',
      detail: 'USD 40.00 is still outstanding.',
      at: '2026-08-24T09:15:00.000Z',
    });
  });

  it('carries closed through rather than treating it as an absence', () => {
    const parsed = normalizeJourney(journey({ stage: 'closed', label: 'Closed', detail: null }));
    expect(parsed?.stage).toBe('closed');
    expect(hasJourney(parsed)).toBe(true);
    expect(parsed?.detail).toBeNull();
  });

  it('gives every stage a tone, and gives none of them the bronze', () => {
    for (const stage of ALL_STAGES) {
      const tone = journeyTone(stage);
      expect(JOURNEY_TONE_CLASS[tone]).toBeTruthy();
      expect(JOURNEY_TONE_CLASS[tone]).not.toContain('gold');
    }
    expect(journeyTone('sent')).toBe('settled');
    expect(journeyTone('paid')).toBe('settled');
    expect(journeyTone('closed')).toBe('over');
    expect(journeyTone('part_paid')).toBe('open');
  });
});

describe('a date that reassures, never a clock counting against someone', () => {
  it('dates the stages that record something done', () => {
    expect(showsStageDate('confirmed')).toBe(true);
    expect(showsStageDate('paid')).toBe(true);
    expect(showsStageDate('sent')).toBe(true);
    expect(showsStageDate('closed')).toBe(true);
  });

  it('leaves the waiting stages undated', () => {
    // "Waiting for payment since 3 March" is a dunning letter, and "Request
    // received, 3 March" reads as six days of nothing happening.
    expect(showsStageDate('received')).toBe(false);
    expect(showsStageDate('awaiting_payment')).toBe(false);
    expect(showsStageDate('part_paid')).toBe(false);
    expect(stageDateline(journey({ stage: 'awaiting_payment' }))).toBeNull();
  });

  it('renders a dateline for a settled stage', () => {
    expect(stageDateline(journey({ stage: 'sent' }))).toBeTruthy();
  });

  it('says nothing rather than something unreadable', () => {
    expect(formatStageDate(null)).toBeNull();
    expect(formatStageDate('')).toBeNull();
    expect(formatStageDate('not a date')).toBeNull();
    expect(stageDateline(journey({ stage: 'sent', at: null }))).toBeNull();
    expect(stageDateline(null)).toBeNull();
  });
});

describe('a stage nobody wrote never becomes a status word', () => {
  it('refuses a stage outside the seven', () => {
    expect(normalizeJourney(journey({ stage: 'refunded' as Stage }))).toBeNull();
    expect(normalizeJourney({ stage: 'RECEIVED', label: 'Received', detail: null, at: null })).toBeNull();
  });

  it('refuses a journey with no words in it', () => {
    expect(normalizeJourney({ stage: 'received', label: '   ', detail: null, at: null })).toBeNull();
    expect(normalizeJourney({ stage: 'received', label: 42, detail: null, at: null })).toBeNull();
  });

  it('refuses anything that is not a journey at all', () => {
    expect(normalizeJourney(null)).toBeNull();
    expect(normalizeJourney(undefined)).toBeNull();
    expect(normalizeJourney('received')).toBeNull();
    expect(normalizeJourney([])).toBeNull();
    expect(hasJourney(null)).toBe(false);
  });

  it('drops an unusable detail or date rather than failing the whole stage', () => {
    expect(normalizeJourney({ stage: 'sent', label: 'Sent', detail: '  ', at: 7 })).toEqual({
      stage: 'sent',
      label: 'Sent',
      detail: null,
      at: null,
    });
  });
});

describe('payment controls appear and disappear with the stage', () => {
  it('shows them while an order is waiting to be paid', () => {
    expect(showsPaymentActions(journey({ stage: 'awaiting_payment' }), payment())).toBe(true);
    expect(showsPaymentActions(journey({ stage: 'part_paid' }), payment())).toBe(true);
    expect(showsPaymentActions(journey({ stage: 'confirmed' }), payment())).toBe(true);
  });

  it('never offers a transfer against a closed order', () => {
    // Absolute, and it does not consult the balance: whatever ended the order,
    // inviting money against it would be taking money for nothing.
    expect(showsPaymentActions(journey({ stage: 'closed' }), payment())).toBe(false);
    expect(showsPaymentActions(journey({ stage: 'closed' }), payment({ outstanding_usd: 40 }))).toBe(false);
  });

  it('leaves a settled order with nothing to pay, through the balance rules', () => {
    // A paid or sent order normally has no pay_url and a zero balance, so the
    // controls have already gone before the stage is consulted.
    const settled = payment({ pay_url: null, paid_usd: 84, outstanding_usd: 0 });
    expect(showsPaymentActions(journey({ stage: 'sent' }), settled)).toBe(true);
    expect(settled.pay_url).toBeNull();
    expect(settled.outstanding_usd).toBe(0);
  });

  it('still lets a customer pay a real debt on an order that was already posted', () => {
    // Adrian posts the tea before the transfer clears. Hiding the way to send
    // the balance would force the customer to ask for it.
    expect(showsPaymentActions(journey({ stage: 'sent' }), payment({ outstanding_usd: 40 }))).toBe(true);
  });

  it('shows nothing when there is no payment block at all', () => {
    expect(showsPaymentActions(journey({ stage: 'received' }), null)).toBe(false);
    expect(showsPaymentActions(journey({ stage: 'received' }), undefined)).toBe(false);
  });

  it('stays permissive when the response carries no stage', () => {
    // A cached order from before this field existed must not lose its button.
    expect(showsPaymentActions(null, payment())).toBe(true);
    expect(showsPaymentActions(undefined, payment())).toBe(true);
  });
});
