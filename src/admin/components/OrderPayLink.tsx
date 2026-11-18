import React from 'react';
import { Link2, Check } from 'lucide-react';
import type { InvoicePayment } from '../types';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { useToast } from './Toast';

/**
 * The one place the admin renders an order's pay link.
 *
 * Adrian sells through a network of tea masters, so two facts belong on every
 * order: whose transfer details the customer will land on, and whether that
 * person has published any. The worker resolves both and hands back a built
 * URL, so nothing here composes one.
 *
 * A recipient with no published transfer details carries `has_methods: false`
 * and a null `pay_url`. That case gets words, never a dead or greyed-out
 * button: the operator needs to know it is the tea master's profile that is
 * missing something, not the order.
 *
 * Three renderings, one source of truth. The dense list rows use the recipient
 * line and the icon button separately, because a table row is 36px and a
 * mobile card is not; modals use the block. All of them share this file's copy
 * text and this file's clipboard handler.
 */

function recipientOf(payment: InvoicePayment): string | null {
  return payment.recipient_name?.trim() || null;
}

/** Clipboard write plus the copied-for-two-seconds state both buttons show. */
function usePayLinkCopy(payment: InvoicePayment | null | undefined, invoiceNumber?: string) {
  const { showToast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const payUrl = payment?.pay_url ?? null;

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = React.useCallback(async () => {
    if (!payUrl) return;
    try {
      await navigator.clipboard.writeText(payUrl);
      setCopied(true);
      showToast(
        invoiceNumber ? `Pay link for ${invoiceNumber} copied.` : 'Pay link copied.',
        'success',
      );
    } catch (err) {
      const detail = err instanceof Error && err.message ? `: ${err.message}` : '.';
      showToast(`Could not copy the pay link${detail}`, 'error');
    }
  }, [payUrl, invoiceNumber, showToast]);

  return { copy, copied, payUrl };
}

/**
 * Who gets paid, in one truncating line. Says so plainly when that person has
 * published nothing, which is the row's whole explanation for the missing
 * button beside it.
 */
export const OrderPayRecipientLine: React.FC<{
  payment?: InvoicePayment | null;
  className?: string;
}> = ({ payment, className = '' }) => {
  if (!payment) return null;
  const recipient = recipientOf(payment);
  return (
    <span className={`block truncate text-tea-text-sec ${className}`}>
      Pay to {recipient || 'this store'}
      {payment.hold_expired ? (
        <span className="text-tea-text-sec"> · Stock hold expired</span>
      ) : !payment.pay_url && !payment.has_methods ? (
        <span className="text-tea-text-dim">, no transfer details</span>
      ) : null}
    </span>
  );
};

/**
 * Icon-only copy control, matching the icon-only action buttons it sits beside
 * in the orders table. Renders nothing at all when there is no link.
 */
export const OrderPayCopyButton: React.FC<{
  payment?: InvoicePayment | null;
  invoiceNumber?: string;
}> = ({ payment, invoiceNumber }) => {
  const { copy, copied, payUrl } = usePayLinkCopy(payment, invoiceNumber);
  if (!payUrl) return null;
  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? 'Pay link copied' : 'Copy pay link'}
      aria-label={copied ? 'Pay link copied' : 'Copy pay link'}
      className="tap-target inline-flex items-center justify-center px-1.5 py-1 rounded-md text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated transition-colors"
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
    </button>
  );
};

/** WhatsApp deep link carrying the pay link, to the customer's number when the order has one. */
export function payLinkWhatsAppHref(payUrl: string, invoiceNumber?: string | null, phone?: string | null): string {
  const digits = (phone ?? '').replace(/[^0-9]/g, '');
  const text = invoiceNumber ? `Here is the pay link for ${invoiceNumber}: ${payUrl}` : `Here is the pay link: ${payUrl}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

interface OrderPayLinkProps {
  payment?: InvoicePayment | null;
  /** Used in the copied-confirmation toast, so the operator knows which order it was. */
  invoiceNumber?: string;
  /** The customer's WhatsApp number, when the order carries one, so Share opens their chat. */
  customerWhatsapp?: string | null;
  /**
   * `inline` is the dense card form: the recipient line plus a small labelled
   * copy control. `block` is the detail form used in modals, where there is
   * room for both share actions.
   */
  layout?: 'inline' | 'block';
  className?: string;
}

export const OrderPayLink: React.FC<OrderPayLinkProps> = ({
  payment,
  invoiceNumber,
  customerWhatsapp,
  layout = 'inline',
  className = '',
}) => {
  const { copy, copied, payUrl } = usePayLinkCopy(payment, invoiceNumber);

  // No recipient resolved at all: nothing truthful to say on this order.
  if (!payment) return null;

  const recipient = recipientOf(payment);

  if (layout === 'inline') {
    return (
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 ${className}`}>
        <OrderPayRecipientLine payment={payment} className="text-ui-11 min-w-0" />
        {payUrl && (
          <button
            type="button"
            onClick={copy}
            className="tap-target flex items-center gap-1 text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec hover:text-tea-text transition-colors"
          >
            {copied ? <Check size={11} aria-hidden="true" /> : <Link2 size={11} aria-hidden="true" />}
            {copied ? 'Copied' : 'Pay link'}
          </button>
        )}
      </div>
    );
  }

  return (
    <section aria-label="Share payment link" className={`bg-tea-surface border border-tea-border rounded-md p-3 ${className}`}>
      <h4 className={`${T.h3} text-tea-text`}>Share payment link</h4>
      {payUrl ? (
        <>
          <p className="mt-1 text-ui-13 text-tea-text-sec">
            Pay to {recipient || 'this store'}{payment.outstanding_usd > 0 ? ` · $${payment.outstanding_usd.toFixed(2)} due` : ''}
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3">
            <a
              href={payLinkWhatsAppHref(payUrl, invoiceNumber, customerWhatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-tap items-center text-ui-13 text-tea-text hover:text-tea-gold"
              data-testid="pay-link-whatsapp"
            >
              Send on WhatsApp
            </a>
            <button type="button" onClick={copy} className="inline-flex min-h-tap items-center gap-1.5 text-ui-13 text-tea-text hover:text-tea-gold">
              {copied ? <Check size={14} aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </>
      ) : (
        <p className="mt-1 text-ui-13 text-tea-text-sec">
          {payment.hold_expired ? 'The stock hold expired. Confirm availability before asking for payment.'
            : !payment.has_methods ? `Add payment methods on ${recipient ? `${recipient}’s profile` : 'the recipient’s profile'} to share a link.`
            : 'No payment link is available for this order.'}
        </p>
      )}
    </section>
  );
};
