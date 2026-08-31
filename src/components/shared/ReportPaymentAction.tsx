import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { PaymentMethod } from '../profile/types';
import type { OrderPayment } from './PayOrderAction';
import {
  DUPLICATE_CLAIM_WARNING,
  accountSlugFromPayUrl,
  canSendClaim,
  defaultClaimAmount,
  formatUsd,
  outstandingUsd,
  pendingClaimCount,
  pendingClaimNotice,
  reportedClaimNotice,
  shouldOfferPaymentClaim,
  validateClaimAmount,
} from './paymentClaimDomain';

/**
 * Which door this surface knocks on.
 *
 * The public tracking page is reached by a tracking token and no login, so it
 * uses the public claim route. The two account surfaces are behind a session
 * and address the invoice directly. One component, two doors, because the
 * customer is doing the same thing at both of them.
 */
export type ReportPaymentSource =
  | { kind: 'tracking'; trackingToken: string }
  | { kind: 'account'; invoiceId: string };

export interface ReportPaymentActionProps {
  payment?: OrderPayment | null;
  source: ReportPaymentSource;
  /** Called once a report is accepted, so a surface can refresh its own copy of the order. */
  onReported?: () => void;
  className?: string;
}

const fieldClass =
  'w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors';

const OTHER_METHOD = 'Another way';

/**
 * "I've sent payment": the quiet half of the payment pair.
 *
 * Paying is the thing the customer came to do and keeps the solid button.
 * This is what they do afterwards, so it opens as a line of text under it and
 * only becomes a form once they say they have something to report.
 *
 * Nothing here settles anything. The report is a message that money is on its
 * way, and every word in it is chosen so a customer cannot read a confirmation
 * into a button they pressed themselves.
 */
export const ReportPaymentAction: React.FC<ReportPaymentActionProps> = ({
  payment,
  source,
  onReported,
  className,
}) => {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [methodsFailed, setMethodsFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentAmount, setSentAmount] = useState<number | null>(null);
  // The tap that lands while the request is still in the air never reaches the
  // network: state updates are batched, so the flag alone is not enough.
  const inFlight = useRef(false);

  const outstanding = outstandingUsd(payment);
  const recipient = payment?.recipient_name?.trim() || null;
  const pending = pendingClaimCount(payment);
  const sent = sentAmount !== null;

  const openForm = useCallback(() => {
    setAmount(defaultClaimAmount(payment).toFixed(2));
    setReference('');
    setError(null);
    setOpen(true);
  }, [payment]);

  // The methods are fetched only once the customer opens the form. An order
  // list would otherwise fire one request per row for a list nobody opened.
  useEffect(() => {
    if (!open || methods || methodsFailed) return;
    const slug = payment?.recipient_slug;
    if (!slug) { setMethodsFailed(true); return; }
    let live = true;
    api.profile
      .getPublicPaymentMethods(slug, accountSlugFromPayUrl(payment?.pay_url))
      .then(res => {
        if (!live) return;
        const rows = res.methods.filter(m => m.is_published);
        if (rows.length === 0) { setMethodsFailed(true); return; }
        setMethods(rows);
        setMethod(rows[0].label);
      })
      .catch(() => { if (live) setMethodsFailed(true); });
    return () => { live = false; };
  }, [open, methods, methodsFailed, payment?.recipient_slug, payment?.pay_url]);

  if (!shouldOfferPaymentClaim(payment)) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current || !canSendClaim({ sending, sent })) return;

    const checked = validateClaimAmount(amount, outstanding);
    if (!checked.ok) { setError(checked.error); return; }

    const chosen = method.trim();
    const body = {
      amount: checked.amount,
      currency: 'USD',
      method: chosen && chosen !== OTHER_METHOD ? chosen : undefined,
      reference: reference.trim() || undefined,
    };

    inFlight.current = true;
    setSending(true);
    setError(null);

    const request = source.kind === 'tracking'
      ? api.inquiries.reportPayment(source.trackingToken, body)
      : api.me.reportOrderPayment(source.invoiceId, body);

    void request
      .then(() => {
        setSentAmount(checked.amount);
        setOpen(false);
        onReported?.();
      })
      .catch((err: unknown) => {
        inFlight.current = false;
        const detail = err instanceof Error ? err.message : '';
        setError(detail || 'That report could not be sent. Please try again in a moment.');
      })
      .finally(() => setSending(false));
  };

  const notice = sent
    ? reportedClaimNotice(sentAmount, recipient)
    : pending > 0
      ? pendingClaimNotice(recipient)
      : null;

  return (
    <div
      data-testid="order-payment-claim"
      className={`flex flex-col gap-3 ${className || ''}`.trim()}
    >
      {notice && (
        <p data-testid="order-payment-claim-notice" className="text-ui-12 text-tea-text-sec">
          {notice}
        </p>
      )}

      {!open && !sent && (
        <p className="m-0">
          <button
            type="button"
            data-testid="order-payment-claim-open"
            onClick={openForm}
            className="tap-target inline-flex items-center text-ui-13 text-tea-text-sec underline decoration-tea-border underline-offset-4 hover:text-tea-text transition-colors"
          >
            {pending > 0 ? 'Report another transfer' : "I've sent payment"}
          </button>
        </p>
      )}

      {open && (
        <form
          onSubmit={handleSubmit}
          data-testid="order-payment-claim-form"
          className="flex flex-col gap-4 rounded-xl border border-tea-border bg-tea-elevated p-4"
        >
          {pending > 0 && (
            <p data-testid="order-payment-claim-duplicate" className="text-ui-12 text-tea-text-sec">
              {DUPLICATE_CLAIM_WARNING}
            </p>
          )}

          <div>
            <label htmlFor={`${fieldId}-amount`} className="block text-ui-12 text-tea-text-sec mb-1.5">
              Amount sent
            </label>
            {/* Capped, because a figure is short. A money field stretched to
                the column width reads as a text box that happens to hold a
                number, and the right-aligned amount drifts away from its label. */}
            <div className="flex items-center gap-2 max-w-[12rem]">
              <span aria-hidden="true" className="text-ui-12 text-tea-text-dim">USD</span>
              <input
                id={`${fieldId}-amount`}
                data-testid="order-payment-claim-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={e => { setAmount(e.target.value); setError(null); }}
                className={`${fieldClass} min-h-11 text-right font-mono`}
              />
            </div>
            <p className="text-ui-12 text-tea-text-dim mt-1.5">
              Outstanding on this order: {formatUsd(outstanding)}
            </p>
          </div>

          <div>
            <label htmlFor={`${fieldId}-method`} className="block text-ui-12 text-tea-text-sec mb-1.5">
              How you sent it
            </label>
            {methods && methods.length > 0 ? (
              <select
                id={`${fieldId}-method`}
                data-testid="order-payment-claim-method"
                value={method}
                onChange={e => setMethod(e.target.value)}
                className={`${fieldClass} min-h-11`}
              >
                {methods.map(m => (
                  <option key={m.id} value={m.label}>{m.label}</option>
                ))}
                <option value={OTHER_METHOD}>{OTHER_METHOD}</option>
              </select>
            ) : (
              <input
                id={`${fieldId}-method`}
                data-testid="order-payment-claim-method"
                type="text"
                value={method}
                onChange={e => setMethod(e.target.value)}
                placeholder="Bank transfer, Wise, and so on"
                className={`${fieldClass} min-h-11`}
              />
            )}
          </div>

          <div>
            <label htmlFor={`${fieldId}-reference`} className="block text-ui-12 text-tea-text-sec mb-1.5">
              Reference or note, if you have one
            </label>
            <input
              id={`${fieldId}-reference`}
              data-testid="order-payment-claim-reference"
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              className={`${fieldClass} min-h-11`}
            />
          </div>

          {error && (
            <p role="alert" data-testid="order-payment-claim-error" className="text-ui-12 text-tea-text-sec">
              {error}
            </p>
          )}

          <p className="text-ui-12 text-tea-text-dim m-0">
            This tells the tea house to look for your transfer. Nothing changes on the order
            until it has been checked.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null); }}
              className="tap-target inline-flex items-center px-2 py-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="order-payment-claim-send"
              disabled={sending}
              className="inline-flex min-h-11 items-center justify-center px-4 py-2 rounded-md cta-solid text-ui-13 font-semibold transition-colors disabled:opacity-60"
            >
              {sending ? 'Sending' : recipient ? `Let ${recipient} know` : 'Let the tea house know'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ReportPaymentAction;
