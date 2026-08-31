import React from 'react';
import type { InvoicePayment } from '../../lib/api';

/**
 * The payment block the worker attaches to every invoice-shaped response.
 *
 * `pay_url` is already absolute and already carries the amount, currency,
 * reference and store, so no surface rebuilds it and no surface appends to it.
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
export const PayOrderAction: React.FC<PayOrderActionProps> = ({ payment, reference, className }) => {
  const payUrl = payment?.pay_url;
  if (!payUrl) return null;

  const recipient = payment?.recipient_name?.trim();
  const label = recipient ? `Pay ${recipient}` : 'Pay for this order';

  return (
    <div
      data-testid="order-pay-action"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className || ''}`.trim()}
    >
      <a
        href={payUrl}
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
