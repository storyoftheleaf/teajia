import type { InvoicePayment } from '../../lib/api';

/**
 * The judgement behind "I've sent payment", kept out of the component.
 *
 * A customer report is not a payment. It moves no money and settles nothing
 * until the tea house confirms it against the transfer, so every function here
 * is written to keep that boundary visible: the amount defaults to what is
 * still outstanding rather than to the invoice total, an existing report is
 * surfaced before another one can be sent, and no wording in this file uses a
 * settlement verb.
 */

/** The cents tolerance the claim endpoint allows above the outstanding balance. */
export const CLAIM_TOLERANCE_USD = 0.01;

export function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatUsd(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

/**
 * Whether this order has anything left to report against.
 *
 * Three absences, one answer: no payment block at all (the request has not been
 * priced yet), no published transfer details behind it (there was never a way
 * to send the money), or nothing outstanding (there is no balance to speak
 * about). In all three the surface renders nothing: no disabled control, no
 * line explaining an absence.
 */
export function shouldOfferPaymentClaim(payment?: InvoicePayment | null): boolean {
  if (!payment) return false;
  if (!payment.has_methods) return false;
  return outstandingUsd(payment) > 0;
}

export function outstandingUsd(payment?: InvoicePayment | null): number {
  const raw = Number(payment?.outstanding_usd);
  return Number.isFinite(raw) ? roundUsd(raw) : 0;
}

export function pendingClaimCount(payment?: InvoicePayment | null): number {
  const raw = Number(payment?.claims_pending);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

/**
 * What the amount field starts on.
 *
 * The outstanding balance, never the invoice total: after a confirmed part
 * payment those two differ, and a form that opens on the total invites a
 * customer to report money they did not send.
 */
export function defaultClaimAmount(payment?: InvoicePayment | null): number {
  return outstandingUsd(payment);
}

export type ClaimAmountCheck =
  | { ok: true; amount: number }
  | { ok: false; error: string };

export function validateClaimAmount(raw: string, outstanding: number): ClaimAmountCheck {
  const trimmed = raw.trim().replace(/,/g, '');
  if (!trimmed) return { ok: false, error: 'Enter the amount you sent.' };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false, error: 'Enter the amount you sent.' };
  }
  const amount = roundUsd(parsed);
  if (amount > roundUsd(outstanding) + CLAIM_TOLERANCE_USD) {
    return {
      ok: false,
      error: `That is more than the ${formatUsd(outstanding)} outstanding on this order.`,
    };
  }
  return { ok: true, amount };
}

/**
 * The one gate on sending.
 *
 * A double tap on a slow connection would otherwise file the same transfer
 * twice, and a customer cannot see the duplicate to withdraw it. `sending`
 * covers the tap that lands while the first request is in the air; `sent`
 * covers the tap that lands after it has returned.
 */
export function canSendClaim(state: { sending: boolean; sent: boolean }): boolean {
  return !state.sending && !state.sent;
}

/** The store this order came from, read back off the link the worker built. */
export function accountSlugFromPayUrl(payUrl?: string | null): string | null {
  if (!payUrl) return null;
  try {
    const url = new URL(payUrl, 'https://teajia.com');
    return url.searchParams.get('account');
  } catch {
    return null;
  }
}

/**
 * The person being paid, read back off the link the worker built.
 *
 * It is the path segment, not a query parameter, because the recipient is who
 * the payment page IS rather than something it was told. Compared against the
 * page's own slug, it is what stops a customer's order being summarised above a
 * different tea master's bank details on a hand-edited link.
 */
export function recipientSlugFromPayUrl(payUrl?: string | null): string | null {
  if (!payUrl) return null;
  try {
    const url = new URL(payUrl, 'https://teajia.com');
    const match = url.pathname.match(/^\/people\/([^/]+)\/pay\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * The reference the payment page will print, read back off the link the worker
 * built.
 *
 * It is the invoice number, which is a fresh number from the account's own
 * sequence and is NOT the order's ref_number. Anything comparing what an order
 * says about itself against what a payment page says has to compare these two,
 * or it compares two identifiers that never match and concludes every order is
 * the wrong one.
 */
export function referenceFromPayUrl(payUrl?: string | null): string | null {
  if (!payUrl) return null;
  try {
    const url = new URL(payUrl, 'https://teajia.com');
    return url.searchParams.get('reference');
  } catch {
    return null;
  }
}

/**
 * The line shown when a report is already waiting.
 *
 * Deliberately says nothing about the order being paid, settled, cleared or
 * complete, because none of those is true: someone has said they sent money
 * and nobody has checked yet.
 */
export function pendingClaimNotice(recipientName?: string | null): string {
  const who = recipientName?.trim();
  return who
    ? `A payment report is with ${who}, waiting to be checked against the transfer.`
    : 'A payment report is waiting to be checked against the transfer.';
}

/** The line shown immediately after a report is accepted. */
export function reportedClaimNotice(amount: number, recipientName?: string | null): string {
  const who = recipientName?.trim();
  return who
    ? `Reported: ${formatUsd(amount)}. ${who} will confirm it once the transfer is seen.`
    : `Reported: ${formatUsd(amount)}. It will be confirmed once the transfer is seen.`;
}

/** Shown at the top of the form when a report is already pending. */
export const DUPLICATE_CLAIM_WARNING =
  'A report is already waiting to be checked. Only send another if you made a second transfer.';
