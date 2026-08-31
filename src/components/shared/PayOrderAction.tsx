import React from 'react';
import type { InvoicePayment } from '../../lib/api';
import { rememberPayOrderToken, sameOriginPayUrl } from './payOrderHandoff';
import { referenceFromPayUrl } from './paymentClaimDomain';

/**
 * The payment block the worker attaches to every invoice-shaped response.
 *
 * `pay_url` already carries the amount, currency, reference and store, so no
 * surface rebuilds it and no surface adds a query parameter to it. One thing
 * is now done to it before it is followed: its origin is replaced with the
 * one the customer is already on, because the worker builds the link against
 * its own APP_URL and the handoff below is per origin. Path and query are
 * untouched.
 * It is null whenever `has_methods` is false, which is the only signal a
 * customer surface needs: no link, no control.
 *
 * The type is the API's own, not a second copy of it: one shape, one name.
 */
export type OrderPayment = InvoicePayment;

export interface PayOrderActionProps {
  /** The `payment` object off the order. Null before an inquiry has been priced. */
  payment?: OrderPayment | null;
  /** Order or invoice reference, shown beside the button so it can be quoted on a transfer. */
  reference?: string | null;
  /** Layout hook for the surface placing it. */
  className?: string;
  /**
   * The customer's private tracking token, on the one surface that holds it:
   * their own order page. Passed explicitly rather than read from the route so
   * that carrying it is a visible decision at every call site, and so the
   * account surfaces, which reach orders through a login instead, keep passing
   * nothing.
   *
   * It is never appended to the link. It is written to session storage under
   * this order's reference, and the payment page reads it back to show which
   * order the money is for. Anything in the URL would be printed as a QR code
   * and copied by a share button on the page it lands on.
   */
  trackingToken?: string | null;
}

/**
 * One pay control, used on every customer order surface.
 *
 * It renders nothing at all when there is nothing to pay: no disabled button,
 * no empty state, no line explaining an absence. A customer who cannot pay yet
 * is not told about a payment page they have no use for.
 *
 * The reference sits beside the button because it is the only thing that ties
 * an incoming bank transfer back to an order. A customer may need to read it,
 * and may need to type it into a banking app.
 */
export const PayOrderAction: React.FC<PayOrderActionProps> = ({ payment, reference, className, trackingToken }) => {
  const payUrl = sameOriginPayUrl(payment?.pay_url);
  if (!payUrl) return null;

  const recipient = payment?.recipient_name?.trim();
  const label = recipient ? `Pay ${recipient}` : 'Pay for this order';
  // Keyed on the reference the payment page will read out of its own address,
  // not on the one displayed here: those are the invoice number and the order
  // number, and they are different strings. Keying on the wrong one would hand
  // a token to a page that then decides it belongs to a different order.
  const handoffReference = referenceFromPayUrl(payment?.pay_url);

  return (
    <div
      data-testid="order-pay-action"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className || ''}`.trim()}
    >
      <a
        href={payUrl}
        onClick={() => rememberPayOrderToken(handoffReference, trackingToken)}
        data-testid="order-pay-link"
        className="inline-flex min-h-11 items-center justify-center px-4 py-2 rounded-md cta-solid text-ui-13 font-semibold transition-colors"
      >
        {label}
      </a>
      {reference && (
        <p className="text-ui-12 text-tea-text-sec min-w-0">
          Quote{' '}
          <span className="font-mono text-tea-text break-all">{reference}</span>{' '}
          with your transfer so it can be matched to this order.
        </p>
      )}
    </div>
  );
};

export default PayOrderAction;
