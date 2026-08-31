import type { InvoicePayment, OrderJourney } from '../../lib/api';

/**
 * The judgement behind what a customer is told about where their order stands.
 *
 * The page this replaces read four fixed words off `inquiries.status`, a column
 * Adrian sets by hand somewhere other than where he works the order, so a tea
 * that had been priced, paid for and posted still read "Inquiry received". The
 * worker now derives the stage from the invoice, the ledger and the fulfilment
 * date, and this file holds the two decisions the client still owns: whether
 * the date the stage began helps or nags, and whether payment controls belong
 * on the surface at all.
 *
 * The words themselves are the worker's. Nothing here writes a label or a
 * detail line, and nothing here rewrites one it dislikes, so the order speaks
 * with one voice wherever it is read.
 */

/** Re-exported so the surfaces name the shape once. The API owns the type. */
export type { OrderJourney };

export type OrderJourneyStage = OrderJourney['stage'];

const STAGES: readonly OrderJourneyStage[] = [
  'received',
  'confirmed',
  'awaiting_payment',
  'part_paid',
  'paid',
  'sent',
  'closed',
];

/**
 * Read a journey off a response without trusting it.
 *
 * The tracking page is reached by a token from anywhere, the order pages read
 * a cache that may predate this field, and an unknown stage must not become a
 * status word nobody wrote. An unreadable journey is no journey: the surfaces
 * then say nothing about the stage rather than guessing at one.
 */
export function normalizeJourney(raw: unknown): OrderJourney | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  const stage = value.stage;
  if (typeof stage !== 'string') return null;
  if (!STAGES.includes(stage as OrderJourneyStage)) return null;

  const label = typeof value.label === 'string' ? value.label.trim() : '';
  if (!label) return null;

  const detail = typeof value.detail === 'string' && value.detail.trim() ? value.detail.trim() : null;
  const at = typeof value.at === 'string' && value.at.trim() ? value.at.trim() : null;

  return { stage: stage as OrderJourneyStage, label, detail, at };
}

/**
 * Whether the date this stage began reassures, or counts against someone.
 *
 * A date on a stage that records something done is a receipt: confirmed, paid,
 * sent, closed all answer "when did that happen". A date on a stage that is
 * still waiting is a clock. "Waiting for payment since 3 March" is a dunning
 * letter, and "Request received, 3 March" reads as an admission that nothing
 * has been done in six days. Those three stages carry their label alone.
 */
export function showsStageDate(stage: OrderJourneyStage): boolean {
  return stage === 'confirmed' || stage === 'paid' || stage === 'sent' || stage === 'closed';
}

/**
 * The dateline under the stage, or nothing.
 *
 * A bare date, the way a dateline sits under a headline, because every word
 * that could introduce it ("since", "updated", "as of") is either wrong on one
 * of the four stages or is the worker's wording to write, not this file's.
 */
export function formatStageDate(at: string | null | undefined): string | null {
  if (!at) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** The dateline for a whole journey, absent on the stages that would nag. */
export function stageDateline(journey: OrderJourney | null | undefined): string | null {
  if (!journey) return null;
  if (!showsStageDate(journey.stage)) return null;
  return formatStageDate(journey.at);
}

/**
 * How settled the stage is, for the one place a list has room for a tone.
 *
 * No gold: this is a status word, not a badge or an active row, and the house
 * reserves the bronze for those. Settled reads at full text weight, an order
 * that is over recedes, everything in between sits at the secondary tone.
 */
export type OrderJourneyTone = 'settled' | 'open' | 'over';

export function journeyTone(stage: OrderJourneyStage): OrderJourneyTone {
  if (stage === 'paid' || stage === 'sent') return 'settled';
  if (stage === 'closed') return 'over';
  return 'open';
}

export const JOURNEY_TONE_CLASS: Record<OrderJourneyTone, string> = {
  settled: 'text-tea-text',
  open: 'text-tea-text-sec',
  over: 'text-tea-text-dim',
};

/**
 * Whether payment controls belong on this surface at all.
 *
 * Two rules, and the second is the one worth stating. A closed order is over:
 * void, refused, withdrawn, whatever ended it, and inviting a transfer against
 * it would take money for nothing. That gate is absolute and does not consult
 * the balance.
 *
 * Every other stage defers to the balance, which is the honest reading of
 * "someone at `sent` should not see payment controls". In the ordinary case a
 * sent order is a paid order, its outstanding is zero, and the controls are
 * already gone. In the case where Adrian posted the tea before the transfer
 * cleared, the customer still owes money and hiding the way to send it would
 * force them to ask for it. So the stage never suppresses a real debt; only a
 * closed order does.
 *
 * A missing journey is permissive on purpose. The balance rules that shipped
 * in round two are correct on their own, and a surface reading a response from
 * before this field existed must not lose its pay button.
 */
export function showsPaymentActions(
  journey: OrderJourney | null | undefined,
  payment: InvoicePayment | null | undefined,
): boolean {
  if (journey?.stage === 'closed') return false;
  return Boolean(payment);
}

/**
 * Whether the journey block has anything to say.
 *
 * Used so a surface can drop the whole block, its border and its spacing,
 * rather than reserve an empty frame for a status it does not have.
 */
export function hasJourney(journey: OrderJourney | null | undefined): journey is OrderJourney {
  return Boolean(journey && journey.label);
}
