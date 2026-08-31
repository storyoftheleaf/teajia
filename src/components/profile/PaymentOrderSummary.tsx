import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { PaymentOrderSummaryData } from './types';

/**
 * Which order the money is for, for a customer who arrived from their own
 * order page carrying their tracking token.
 *
 * It holds no figures of its own, and that is the decision worth keeping. The
 * amount above is the OUTSTANDING balance, which after shipping or a confirmed
 * part payment is not the order estimate, so an estimate printed a hairline
 * below it would be read as an error in the number about to be transferred.
 * The amount block answers how much. This one answers which order. Neither
 * answers both.
 *
 * Renders nothing rather than anything uncertain: no token, a failed lookup, a
 * stale token, an order that disagrees with the reference on this page. A
 * customer mid transfer must never be told that something on the payment page
 * failed, when the amount, the reference and the bank details are all present
 * and all correct.
 */
export function PaymentOrderSummary({ summary }: { summary: PaymentOrderSummaryData | null }) {
  if (!summary || summary.lines.length === 0) return null;

  // Six lines is about where a list stops being recognisable at a glance and
  // starts pushing the transfer methods off the screen. Past that, five plus a
  // count. The threshold is six rather than five so an order of exactly six
  // never renders "and 1 more items" in place of the line it is hiding.
  const shown = summary.lines.length > 6 ? summary.lines.slice(0, 5) : summary.lines;
  const remaining = summary.lines.length - shown.length;

  return (
    <div data-testid="payment-order-summary" className="border-t border-tea-border pt-5 sm:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>This payment covers</p>
        {summary.placedOn && (
          <p className="text-ui-12 text-tea-text-dim">Placed {summary.placedOn}</p>
        )}
      </div>
      <ul className="mt-3 space-y-1.5">
        {shown.map((line, index) => (
          <li
            key={`${line.name}-${index}`}
            className="flex items-baseline justify-between gap-4 text-ui-13 text-tea-text"
          >
            {/* Truncated rather than wrapped, and never allowed to widen the
                row: a long tea name must not be the reason this page scrolls
                sideways on a phone. */}
            <span className="min-w-0 flex-1 truncate">{line.name}</span>
            <span className="shrink-0 font-mono tabular-nums text-tea-text-sec">{line.quantity}</span>
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <p className="mt-2.5 text-ui-12 text-tea-text-dim">and {remaining} more items</p>
      )}
    </div>
  );
}

export default PaymentOrderSummary;
