import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAppStore, selectHasBundle } from '../../lib/store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type {
  WholesaleOrderDetail,
  WholesaleOrderItem,
  WholesaleOrderStatus,
  WholesaleTransitionBody,
} from '../../types';

// ── WholesaleOrderTimeline — Surface 9 per docs/NETWORK_UI_BRIEF.md ──────────
//
// /admin/network/wholesale/:orderId/timeline
// Both buyer and supplier see this same page (role-adaptive action affordances).
// Status is the heading. One sentence answers "what's happening?".
// Diary-entry timeline. No pills, no progress bars, no toasts for routine actions.
// Sell bundle required.

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

function formatAmount(amount: number | null | undefined, currency: string): string {
  if (amount == null) return '';
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusWord(status: WholesaleOrderStatus): string {
  return status.toUpperCase();
}

// Build carrier tracking URL (best-effort)
function trackingUrl(carrier: string | null, trackingNumber: string): string | null {
  if (!carrier || !trackingNumber) return null;
  const c = carrier.toLowerCase();
  if (c.includes('pos indonesia') || c.includes('pos indo')) {
    return `https://www.posindonesia.co.id/en/tracking?awb=${encodeURIComponent(trackingNumber)}`;
  }
  if (c.includes('dhl')) {
    return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(trackingNumber)}`;
  }
  if (c.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
  }
  if (c.includes('ups')) {
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
  }
  if (c.includes('auspost') || c.includes('australia post')) {
    return `https://auspost.com.au/mypost/track/details/${encodeURIComponent(trackingNumber)}`;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status sentences — diary-entry register
// ─────────────────────────────────────────────────────────────────────────────

function currentStateSentence(
  status: WholesaleOrderStatus,
  role: 'buyer' | 'supplier',
  order: WholesaleOrderDetail['order'],
  supplier: WholesaleOrderDetail['supplier'],
  buyer: WholesaleOrderDetail['buyer'],
): React.ReactNode {
  const supplierName = supplier.name;
  const buyerName = buyer.name;

  switch (status) {
    case 'draft':
      return role === 'buyer' ? (
        <>This order is still a draft.</>
      ) : (
        <>This draft has not been submitted yet.</>
      );

    case 'submitted':
      return role === 'buyer' ? (
        <>You sent this to {supplierName} on {formatDate(order.submitted_at)}. Awaiting his confirmation.</>
      ) : (
        <>{buyerName} sent this on {formatDate(order.submitted_at)}. Confirm or reply with adjustments.</>
      );

    case 'replied':
      return role === 'buyer' ? (
        <>{supplierName} replied with adjustments on {formatDate(order.replied_at)}. Review the note and resubmit.</>
      ) : (
        <>You replied with adjustments on {formatDate(order.replied_at)}. Awaiting {buyerName}'s response.</>
      );

    case 'confirmed':
      return role === 'buyer' ? (
        <>{supplierName} confirmed your order on {formatDate(order.confirmed_at)}. They'll ship within the week and update with tracking when it goes out.</>
      ) : (
        <>You confirmed {buyerName}'s order on {formatDate(order.confirmed_at)}. Ship when ready and add tracking.</>
      );

    case 'shipped':
      return role === 'buyer' ? (
        <>
          {supplierName} shipped your order on {formatDate(order.shipped_at)}
          {order.carrier ? ` with ${order.carrier}` : ''}.{' '}
          {order.tracking_number ? (
            <>
              Tracking:{' '}
              {trackingUrl(order.carrier, order.tracking_number) ? (
                <a
                  href={trackingUrl(order.carrier, order.tracking_number)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-tea-text-sec hover:text-tea-gold transition-colors underline underline-offset-2 decoration-1"
                >
                  {order.tracking_number}
                </a>
              ) : (
                <span className="font-mono">{order.tracking_number}</span>
              )}
              .
            </>
          ) : null}
        </>
      ) : (
        <>You marked this shipped on {formatDate(order.shipped_at)}. {buyerName} will mark received when it arrives.</>
      );

    case 'received':
      return role === 'buyer' ? (
        <>You marked this received on {formatDate(order.received_at)}. Stock is in your inventory.</>
      ) : (
        <>{buyerName} marked this received on {formatDate(order.received_at)}. Closed.</>
      );

    case 'cancelled': {
      const cancelDate = formatDate(order.cancelled_at);
      const cancelledBy =
        order.cancelled_by_account_id === supplier.id ? supplierName
        : order.cancelled_by_account_id === buyer.id ? buyerName
        : 'a party';
      return (
        <>
          Cancelled on {cancelDate} by {cancelledBy}.
          {order.cancel_reason ? ` Reason: ${order.cancel_reason}` : ''}
        </>
      );
    }

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

const Skeleton: React.FC = () => (
  <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-[640px] mx-auto animate-pulse space-y-6">
    <div className="space-y-2">
      <div className="h-[32px] w-2/3 bg-tea-surface rounded-[2px]" />
      <div className="h-[12px] w-1/2 bg-tea-surface rounded-[2px]" />
    </div>
    <div className="h-[17px] w-4/5 bg-tea-surface rounded-[2px]" />
    <div className="space-y-3 pt-4 border-t border-tea-border">
      <div className="h-[14px] w-full bg-tea-surface rounded-[2px]" />
      <div className="h-[14px] w-5/6 bg-tea-surface rounded-[2px]" />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Hairline divider
// ─────────────────────────────────────────────────────────────────────────────

const Divider: React.FC<{ className?: string }> = ({ className = 'my-6' }) => (
  <hr className={`border-tea-border ${className}`} />
);

// ─────────────────────────────────────────────────────────────────────────────
// Action area — supplier on submitted state
// ─────────────────────────────────────────────────────────────────────────────

interface SupplierConfirmAreaProps {
  orderId: string;
  onTransitioned: () => void;
}

const SupplierConfirmArea: React.FC<SupplierConfirmAreaProps> = ({ orderId, onTransitioned }) => {
  const [mode, setMode] = useState<'idle' | 'confirm' | 'reply'>('idle');
  const [shippingAmount, setShippingAmount] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');
  const [replyNotes, setReplyNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const body: WholesaleTransitionBody = { to: 'confirmed' };
      if (shippingAmount.trim()) {
        body.shipping_amount = parseFloat(shippingAmount.trim());
      }
      if (supplierNotes.trim()) {
        body.supplier_notes = supplierNotes.trim();
      }
      await api.wholesale.transition(orderId, body);
      onTransitioned();
    } catch (err: unknown) {
      setError("Couldn't transition. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.wholesale.transition(orderId, {
        to: 'replied',
        supplier_notes: replyNotes.trim() || undefined,
      });
      onTransitioned();
    } catch (err: unknown) {
      setError("Couldn't transition. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Divider />
      {error && (
        <p className="text-tea-text-sec italic text-ui-13 mb-4 leading-[1.6]">{error}</p>
      )}

      {mode === 'idle' && (
        <div className="flex items-baseline gap-6 text-ui-14">
          <button
            type="button"
            onClick={() => setMode('confirm')}
            className="font-display tracking-[0.04em] text-tea-text-sec hover:text-tea-gold transition-colors"
          >
            Confirm this order
          </button>
          <button
            type="button"
            onClick={() => setMode('reply')}
            className="text-tea-text-sec hover:text-tea-text transition-colors"
          >
            Reply with adjustments
          </button>
        </div>
      )}

      {mode === 'confirm' && (
        <div className="space-y-5">
          <div className="text-tea-text-sec text-ui-12 uppercase tracking-[0.1em]">Confirm this order</div>
          <div className="space-y-4">
            <div>
              <label className="text-tea-text-sec text-ui-12 block mb-1.5" htmlFor="shipping-amount">
                Shipping amount
              </label>
              <input
                id="shipping-amount"
                type="number"
                min="0"
                step="0.01"
                value={shippingAmount}
                onChange={e => setShippingAmount(e.target.value)}
                placeholder="0.00"
                className="bg-transparent border-b border-tea-border focus:border-tea-gold outline-none font-mono text-ui-14 text-tea-text py-1 w-40 transition-colors placeholder:text-tea-text-dim"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="text-tea-text-sec text-ui-12 block mb-1.5" htmlFor="confirm-notes">
                Note (optional)
              </label>
              <textarea
                id="confirm-notes"
                value={supplierNotes}
                onChange={e => setSupplierNotes(e.target.value)}
                placeholder="Anything the buyer should know about the confirmation?"
                rows={2}
                disabled={submitting}
                className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-body text-ui-14 py-1.5 italic transition-colors resize-none placeholder:text-tea-text-dim"
              />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <button
              type="button"
              onClick={() => setMode('idle')}
              disabled={submitting}
              className="text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="font-display tracking-[0.04em] text-ui-14 text-tea-text-sec hover:text-tea-gold transition-colors disabled:text-tea-text-dim"
            >
              {submitting ? 'Confirming…' : 'Confirm order'}
            </button>
          </div>
        </div>
      )}

      {mode === 'reply' && (
        <div className="space-y-5">
          <div className="text-tea-text-sec text-ui-12 uppercase tracking-[0.1em]">Reply with adjustments</div>
          <div>
            <label className="text-tea-text-sec text-ui-12 block mb-1.5" htmlFor="reply-notes">
              Your note
            </label>
            <textarea
              id="reply-notes"
              value={replyNotes}
              onChange={e => setReplyNotes(e.target.value)}
              placeholder="What needs adjusting? The buyer will see this and can resubmit."
              rows={3}
              disabled={submitting}
              className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-body text-ui-14 py-1.5 italic transition-colors resize-none placeholder:text-tea-text-dim"
            />
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <button
              type="button"
              onClick={() => setMode('idle')}
              disabled={submitting}
              className="text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReply}
              disabled={submitting || !replyNotes.trim()}
              className="font-display tracking-[0.04em] text-ui-14 text-tea-text-sec hover:text-tea-gold transition-colors disabled:text-tea-text-dim"
            >
              {submitting ? 'Sending…' : 'Send reply'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Action area — supplier on confirmed state (update tracking + ship)
// ─────────────────────────────────────────────────────────────────────────────

interface SupplierShipAreaProps {
  orderId: string;
  onTransitioned: () => void;
}

const SupplierShipArea: React.FC<SupplierShipAreaProps> = ({ orderId, onTransitioned }) => {
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shipNotes, setShipNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShip = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const body: WholesaleTransitionBody = {
        to: 'shipped',
        carrier: carrier.trim() || undefined,
        tracking_number: trackingNumber.trim() || undefined,
        supplier_notes: shipNotes.trim() || undefined,
      };
      await api.wholesale.transition(orderId, body);
      onTransitioned();
    } catch (err: unknown) {
      setError("Couldn't transition. Try again.");
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div>
      <Divider />
      <div className="text-tea-text-sec text-ui-12 uppercase tracking-[0.1em] mb-5">Update tracking</div>
      {error && (
        <p className="text-tea-text-sec italic text-ui-13 mb-4 leading-[1.6]">{error}</p>
      )}
      <div className="space-y-4">
        <div className="flex items-baseline gap-4 flex-wrap">
          <label className="text-tea-text-sec text-ui-13 w-28 shrink-0" htmlFor="carrier-input">
            Carrier
          </label>
          <input
            id="carrier-input"
            type="text"
            value={carrier}
            onChange={e => setCarrier(e.target.value)}
            placeholder="Pos Indonesia, DHL, …"
            disabled={submitting}
            className="bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text text-ui-14 py-1 flex-1 min-w-[160px] transition-colors placeholder:text-tea-text-dim"
          />
        </div>
        <div className="flex items-baseline gap-4 flex-wrap">
          <label className="text-tea-text-sec text-ui-13 w-28 shrink-0" htmlFor="tracking-input">
            Tracking #
          </label>
          <input
            id="tracking-input"
            type="text"
            value={trackingNumber}
            onChange={e => setTrackingNumber(e.target.value)}
            placeholder="JT9482-AU"
            disabled={submitting}
            className="bg-transparent border-b border-tea-border focus:border-tea-gold outline-none font-mono text-ui-14 text-tea-text py-1 flex-1 min-w-[160px] transition-colors placeholder:text-tea-text-dim"
          />
        </div>
        <div className="flex items-baseline gap-4 flex-wrap">
          <label className="text-tea-text-sec text-ui-13 w-28 shrink-0" htmlFor="ship-notes">
            Note
          </label>
          <input
            id="ship-notes"
            type="text"
            value={shipNotes}
            onChange={e => setShipNotes(e.target.value)}
            placeholder="Optional"
            disabled={submitting}
            className="bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text text-ui-14 italic py-1 flex-1 min-w-[160px] transition-colors placeholder:text-tea-text-dim"
          />
        </div>
      </div>

      {!confirmOpen ? (
        <div className="mt-5">
          {/* Inline validation hint when fields are empty — surfaces the requirement
              before the user clicks Confirm and gets a generic 400 from the worker. */}
          {(!carrier.trim() || !trackingNumber.trim()) && (
            <p className="text-tea-text-sec italic text-ui-13 leading-[1.6] mb-3">
              {!carrier.trim() && !trackingNumber.trim()
                ? 'Carrier and tracking number are required to mark shipped.'
                : !carrier.trim()
                ? 'Carrier is required to mark shipped.'
                : 'Tracking number is required to mark shipped.'}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!carrier.trim() || !trackingNumber.trim()}
              className="font-display tracking-[0.04em] text-ui-14 text-tea-text-sec hover:text-tea-gold transition-colors disabled:text-tea-text-dim disabled:cursor-not-allowed"
            >
              Mark as shipped
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <p className="text-tea-text-sec italic text-ui-13 leading-[1.6]">
            Confirm: mark as shipped
            {trackingNumber ? ` with tracking ${trackingNumber} via ${carrier}` : ''}?
          </p>
          <div className="flex items-baseline justify-between gap-4">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
              className="text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleShip}
              disabled={submitting}
              className="font-display tracking-[0.04em] text-ui-14 text-tea-text-sec hover:text-tea-gold transition-colors disabled:text-tea-text-dim"
            >
              {submitting ? 'Marking…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Action area — buyer on shipped state (mark as received)
// ─────────────────────────────────────────────────────────────────────────────

interface BuyerReceiveAreaProps {
  orderId: string;
  onTransitioned: () => void;
}

const BuyerReceiveArea: React.FC<BuyerReceiveAreaProps> = ({ orderId, onTransitioned }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReceive = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.wholesale.transition(orderId, { to: 'received' });
      onTransitioned();
    } catch (err: unknown) {
      setError("Couldn't transition. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Divider />
      {error && (
        <p className="text-tea-text-sec italic text-ui-13 mb-4 leading-[1.6]">{error}</p>
      )}
      <p className="text-tea-text-sec text-ui-14 leading-[1.6] mb-5 italic">
        Mark as received when it arrives.
      </p>
      {!confirmOpen ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="font-display tracking-[0.04em] text-ui-14 text-tea-text-sec hover:text-tea-gold transition-colors"
          >
            Mark as received
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-tea-text-sec italic text-ui-13 leading-[1.6]">
            Confirm: mark as received? Stock will be in your inventory.
          </p>
          <div className="flex items-baseline justify-between gap-4">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
              className="text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReceive}
              disabled={submitting}
              className="font-display tracking-[0.04em] text-ui-14 text-tea-text-sec hover:text-tea-gold transition-colors disabled:text-tea-text-dim"
            >
              {submitting ? 'Marking…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Action area — buyer on submitted >7 days (nudge or cancel)
// ─────────────────────────────────────────────────────────────────────────────

interface BuyerStuckAreaProps {
  orderId: string;
  supplierName: string;
  onTransitioned: () => void;
}

const BuyerStuckArea: React.FC<BuyerStuckAreaProps> = ({ orderId, supplierName, onTransitioned }) => {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [nudgeMsg, setNudgeMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleNudge = async () => {
    setNudgeLoading(true);
    setError(null);
    try {
      await api.wholesale.nudge(orderId);
      setNudgeMsg(`Nudge sent. ${supplierName} will see it.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('429') || msg.toLowerCase().includes('throttl')) {
        setNudgeMsg(`You already nudged in the last 24 hours. ${supplierName} will see it.`);
      } else {
        setError("Couldn't send nudge. Try again.");
      }
    } finally {
      setNudgeLoading(false);
    }
  };

  const handleCancel = async () => {
    setCancelLoading(true);
    setError(null);
    try {
      await api.wholesale.transition(orderId, {
        to: 'cancelled',
        cancel_reason: cancelReason.trim() || undefined,
      });
      onTransitioned();
    } catch (err: unknown) {
      setError("Couldn't transition. Try again.");
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div>
      <Divider />
      {nudgeMsg && (
        <p className="text-tea-text-sec italic text-ui-13 mb-4 leading-[1.6]">{nudgeMsg}</p>
      )}
      {error && (
        <p className="text-tea-text-sec italic text-ui-13 mb-4 leading-[1.6]">{error}</p>
      )}
      {!cancelOpen ? (
        <div>
          <p className="text-tea-text-sec italic text-ui-14 mb-4 leading-[1.6]">
            It's been 7 days. You can nudge {supplierName} or cancel and start over.
          </p>
          <div className="flex items-baseline gap-6 text-ui-14">
            {!nudgeMsg && (
              <button
                type="button"
                onClick={handleNudge}
                disabled={nudgeLoading}
                className="text-tea-text-sec hover:text-tea-gold transition-colors font-display tracking-[0.04em] disabled:text-tea-text-dim"
              >
                {nudgeLoading ? 'Sending…' : 'Send a nudge →'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel order →
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-tea-text-sec italic text-ui-13 leading-[1.6]">
            Cancel this order?
          </p>
          <div>
            <label className="text-tea-text-sec text-ui-12 block mb-1.5" htmlFor="cancel-reason">
              Reason (optional)
            </label>
            <textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Let the supplier know why."
              rows={2}
              disabled={cancelLoading}
              className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-body text-ui-14 py-1.5 italic transition-colors resize-none placeholder:text-tea-text-dim"
            />
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <button
              type="button"
              onClick={() => setCancelOpen(false)}
              disabled={cancelLoading}
              className="text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelLoading}
              className="font-display tracking-[0.04em] text-ui-14 text-tea-text-sec hover:text-tea-gold transition-colors disabled:text-tea-text-dim"
            >
              {cancelLoading ? 'Cancelling…' : 'Confirm cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Cancel text-link — available in pre-ship states for both parties
// ─────────────────────────────────────────────────────────────────────────────

interface CancelLinkProps {
  orderId: string;
  onTransitioned: () => void;
}

const CancelLink: React.FC<CancelLinkProps> = ({ orderId, onTransitioned }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.wholesale.transition(orderId, {
        to: 'cancelled',
        cancel_reason: reason.trim() || undefined,
      });
      onTransitioned();
    } catch (err: unknown) {
      setError("Couldn't transition. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
      >
        Cancel order
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-tea-text-sec italic text-ui-13 leading-[1.6]">{error}</p>
      )}
      <p className="text-tea-text-sec italic text-ui-13 leading-[1.6]">Cancel this order?</p>
      <div>
        <label className="text-tea-text-sec text-ui-12 block mb-1.5" htmlFor="cancel-link-reason">
          Reason (optional)
        </label>
        <textarea
          id="cancel-link-reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="A brief note helps the other party."
          rows={2}
          disabled={loading}
          className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-body text-ui-14 py-1.5 italic transition-colors resize-none placeholder:text-tea-text-dim"
        />
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={loading}
          className="text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="font-display tracking-[0.04em] text-ui-14 text-tea-text-sec hover:text-tea-gold transition-colors disabled:text-tea-text-dim"
        >
          {loading ? 'Cancelling…' : 'Confirm cancel'}
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Timeline events builder
// ─────────────────────────────────────────────────────────────────────────────

interface TimelineEvent {
  iso: string;
  sentence: string;
  note?: string | null;
}

function buildTimeline(
  order: WholesaleOrderDetail['order'],
  supplier: WholesaleOrderDetail['supplier'],
  buyer: WholesaleOrderDetail['buyer'],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (order.cancelled_at) {
    const cancelledBy =
      order.cancelled_by_account_id === supplier.id ? supplier.name
      : order.cancelled_by_account_id === buyer.id ? buyer.name
      : 'A party';
    events.push({
      iso: order.cancelled_at,
      sentence: `${cancelledBy} cancelled this order.`,
      note: order.cancel_reason || null,
    });
  }

  if (order.received_at) {
    events.push({
      iso: order.received_at,
      sentence: `${buyer.name} marked this received.`,
    });
  }

  if (order.shipped_at) {
    const trackingPart = order.tracking_number
      ? ` Tracking ${order.tracking_number}.`
      : '';
    const carrierPart = order.carrier ? ` with ${order.carrier}` : '';
    events.push({
      iso: order.shipped_at,
      sentence: `${supplier.name} shipped this${carrierPart}.${trackingPart}`,
      note: order.supplier_notes && order.confirmed_at && order.shipped_at > order.confirmed_at
        ? null // supplier_notes attached to confirm event
        : null,
    });
  }

  if (order.confirmed_at) {
    const shippingPart = order.shipping_amount != null
      ? ` Shipping estimated ${order.currency} ${order.shipping_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
      : '';
    events.push({
      iso: order.confirmed_at,
      sentence: `${supplier.name} confirmed.${shippingPart}`,
      note: order.supplier_notes || null,
    });
  }

  if (order.replied_at) {
    events.push({
      iso: order.replied_at,
      sentence: `${supplier.name} replied with adjustments.`,
      note: order.supplier_notes || null,
    });
  }

  if (order.submitted_at) {
    const subtotalPart = order.subtotal_amount != null
      ? ` ${order.currency} ${order.subtotal_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + shipping.`
      : '';
    events.push({
      iso: order.submitted_at,
      sentence: `${buyer.name} submitted this order.${subtotalPart}`,
      note: order.buyer_notes || null,
    });
  }

  // Sort reverse chronological
  return events.sort((a, b) => b.iso.localeCompare(a.iso));
}

// ─────────────────────────────────────────────────────────────────────────────
// Order summary rows
// ─────────────────────────────────────────────────────────────────────────────

interface OrderSummaryProps {
  items: WholesaleOrderItem[];
  order: WholesaleOrderDetail['order'];
}

const OrderSummary: React.FC<OrderSummaryProps> = ({ items, order }) => {
  const { currency, subtotal_amount, shipping_amount, total_amount } = order;

  return (
    <div>
      <Divider />
      <div className="space-y-2 mb-4">
        {items.map(item => (
          <div key={item.id} className="flex items-baseline justify-between gap-4 flex-wrap">
            <div className="flex items-baseline gap-4 flex-1 min-w-0">
              <span className="font-sans text-ui-11 uppercase tracking-[0.1em] text-tea-text leading-[1.4] min-w-0">
                {item.profile_name?.toUpperCase() ?? 'TEA'}
              </span>
              <span className="font-mono text-ui-12 text-tea-text-sec shrink-0">
                {item.grams.toLocaleString()} g
              </span>
            </div>
            <span className="font-mono text-ui-13 text-tea-text shrink-0">
              {formatAmount(item.line_total, item.unit_price_currency || currency)}
            </span>
          </div>
        ))}
      </div>

      <Divider className="my-3" />

      <div className="space-y-1.5">
        {subtotal_amount != null && (
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-sans text-ui-11 uppercase tracking-[0.1em] text-tea-text-sec">Subtotal</span>
            <span className="font-mono text-ui-13 text-tea-text">{formatAmount(subtotal_amount, currency)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-sans text-ui-11 uppercase tracking-[0.1em] text-tea-text-sec">
            {shipping_amount != null ? 'Shipping (added on confirm)' : 'Shipping'}
          </span>
          <span className="font-mono text-ui-13 text-tea-text">
            {shipping_amount != null ? formatAmount(shipping_amount, currency) : 'Estimated by supplier on confirm'}
          </span>
        </div>
        {total_amount != null && (
          <div className="flex items-baseline justify-between gap-4 pt-1">
            <span className="font-sans text-ui-11 uppercase tracking-[0.1em] text-tea-text">Total</span>
            <span className="font-mono text-ui-13 text-tea-text font-medium">{formatAmount(total_amount, currency)}</span>
          </div>
        )}
      </div>

      <p className="text-tea-text-sec italic text-ui-11 mt-4 leading-[1.5]">
        Currency snapshot at submission: {currency}.
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export const WholesaleOrderTimeline: React.FC = () => {
  const hasSell = useAppStore(s => selectHasBundle(s, 'sell'));
  const accountId = useAppStore(s => s.activeAccountId ?? '');
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();

  const [detail, setDetail] = useState<WholesaleOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.wholesale.getOrder(orderId);
      setDetail(data);
      setNotFound(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
        setNotFound(true);
      } else {
        setError("Couldn't reach the server. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { void load(); }, [load]);

  // Bundle gate
  if (!hasSell) {
    return (
      <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-[640px] mx-auto">
        <p className="text-tea-text-sec italic text-ui-15 leading-[1.65]">
          This page requires the Sell bundle. Ask your owner.
        </p>
      </div>
    );
  }

  if (loading) return <Skeleton />;

  if (notFound) {
    return (
      <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-[640px] mx-auto">
        <p className="text-tea-text-sec italic text-ui-15 leading-[1.65]">
          This order doesn't exist or you don't have access.
        </p>
        <button
          type="button"
          onClick={() => navigate('/admin/network?tab=wholesale')}
          className="mt-4 text-ui-14 text-tea-text-sec hover:text-tea-text transition-colors font-display tracking-[0.04em]"
        >
          ← Back to wholesale orders
        </button>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-[640px] mx-auto">
        <p className="text-tea-text-sec italic text-ui-15 leading-[1.65]">{error}</p>
      </div>
    );
  }

  if (!detail) return null;

  const { order, supplier, buyer, items } = detail;

  const role: 'buyer' | 'supplier' =
    order.buyer_account_id === accountId ? 'buyer' : 'supplier';

  const status = order.status;

  // Determine if buyer is stuck (submitted >7 days, no confirm)
  const isStuck = status === 'submitted' && role === 'buyer' && (() => {
    if (!order.submitted_at) return false;
    const submittedMs = new Date(order.submitted_at).getTime();
    return Date.now() - submittedMs > 7 * 24 * 60 * 60 * 1000;
  })();

  // Cancellable states (before shipped)
  const isCancellable = ['draft', 'submitted', 'confirmed', 'replied'].includes(status);

  // Build timestamps for header
  const timestampParts: string[] = [];
  if (order.submitted_at) timestampParts.push(`Submitted ${formatDate(order.submitted_at)}`);
  if (order.replied_at) timestampParts.push(`Replied ${formatDate(order.replied_at)}`);
  if (order.confirmed_at) timestampParts.push(`Confirmed ${formatDate(order.confirmed_at)}`);
  if (order.shipped_at) timestampParts.push(`Shipped ${formatDate(order.shipped_at)}`);
  if (order.received_at) timestampParts.push(`Received ${formatDate(order.received_at)}`);
  if (order.cancelled_at) timestampParts.push(`Cancelled ${formatDate(order.cancelled_at)}`);

  const timelineEvents = buildTimeline(order, supplier, buyer);

  return (
    <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-[640px] mx-auto">

      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate('/admin/network?tab=wholesale')}
        className="text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors mb-6 block font-display tracking-[0.04em]"
      >
        ← Wholesale
      </button>

      {/* Header — status as heading */}
      <header className="mb-8">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-2`}>
          WHOLESALE ORDER · {statusWord(status)}
        </h1>
        {timestampParts.length > 0 && (
          <p className="text-tea-text-sec text-ui-12 mb-4 leading-[1.5]">
            {timestampParts.join(' · ')}
          </p>
        )}
        <div className="space-y-1 text-ui-14">
          <div className="flex gap-6">
            <span className="text-tea-text-sec w-20 shrink-0">Supplier</span>
            <span className="text-tea-text">{supplier.name}</span>
          </div>
          <div className="flex gap-6">
            <span className="text-tea-text-sec w-20 shrink-0">Buyer</span>
            <span className="text-tea-text">{buyer.name}</span>
          </div>
        </div>
      </header>

      {/* Current state block — most prominent thing after the header */}
      <p className="font-body text-ui-17 text-tea-text leading-[1.7] mb-2">
        {currentStateSentence(status, role, order, supplier, buyer)}
      </p>

      {/* Draft defensive link for buyer */}
      {status === 'draft' && role === 'buyer' && (
        <button
          type="button"
          onClick={() => navigate(`/admin/network/wholesale/${orderId}`)}
          className="text-ui-14 text-tea-text-sec hover:text-tea-gold transition-colors font-display tracking-[0.04em]"
        >
          Edit this draft →
        </button>
      )}

      {/* Replied — buyer link to draft view */}
      {status === 'replied' && role === 'buyer' && (
        <button
          type="button"
          onClick={() => navigate(`/admin/network/wholesale/${orderId}`)}
          className="text-ui-14 text-tea-text-sec hover:text-tea-gold transition-colors font-display tracking-[0.04em] mt-2 block"
        >
          Review and resubmit →
        </button>
      )}

      {/* Action areas */}
      {status === 'submitted' && role === 'supplier' && (
        <SupplierConfirmArea orderId={orderId!} onTransitioned={load} />
      )}

      {status === 'confirmed' && role === 'supplier' && (
        <SupplierShipArea orderId={orderId!} onTransitioned={load} />
      )}

      {status === 'shipped' && role === 'buyer' && (
        <BuyerReceiveArea orderId={orderId!} onTransitioned={load} />
      )}

      {isStuck && (
        <BuyerStuckArea orderId={orderId!} supplierName={supplier.name} onTransitioned={load} />
      )}

      {/* Cancel text-link — pre-ship states, not when stuck area already shows */}
      {isCancellable && status !== 'cancelled' && !isStuck && !(status === 'submitted' && role === 'supplier') && (
        <div className="mt-6">
          <CancelLink orderId={orderId!} onTransitioned={load} />
        </div>
      )}

      {/* Order summary */}
      <OrderSummary items={items} order={order} />

      {/* Shipping address */}
      {order.shipping_address && (
        <>
          <Divider />
          <div className="text-tea-text-sec text-ui-11 uppercase tracking-[0.1em] mb-3">Shipping to</div>
          <p className="text-tea-text text-ui-14 leading-[1.65] whitespace-pre-line">{order.shipping_address}</p>
        </>
      )}

      {/* Buyer's note to supplier */}
      {order.buyer_notes && (
        <>
          <Divider />
          <div className="text-tea-text-sec text-ui-11 uppercase tracking-[0.1em] mb-3">
            Note to {supplier.name}
          </div>
          <p className="font-body italic text-tea-text text-ui-15 leading-[1.65]">
            "{order.buyer_notes}"
          </p>
        </>
      )}

      {/* Supplier confirmation note */}
      {order.supplier_notes && (
        <>
          <Divider />
          <div className="text-tea-text-sec text-ui-11 uppercase tracking-[0.1em] mb-3">
            {supplier.name}'s note
          </div>
          <p className="font-body italic text-tea-text text-ui-15 leading-[1.65]">
            "{order.supplier_notes}"
          </p>
        </>
      )}

      {/* Timeline */}
      {timelineEvents.length > 0 && (
        <>
          <Divider />
          <div className="text-tea-text-sec text-ui-11 uppercase tracking-[0.1em] mb-5">Timeline</div>
          <div className="space-y-6">
            {timelineEvents.map((ev, i) => (
              <div key={i}>
                <div className="font-mono text-ui-12 text-tea-text-sec mb-1">
                  {formatDateTime(ev.iso)}
                </div>
                <p className="text-tea-text text-ui-14 leading-[1.6]">{ev.sentence}</p>
                {ev.note && (
                  <p className="font-body italic text-tea-text-sec text-ui-13 mt-1 leading-[1.6]">
                    "{ev.note}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Invoice references — only after received */}
      {status === 'received' && (order.invoice_id_supplier || order.invoice_id_buyer) && (
        <>
          <Divider />
          <div className="text-tea-text-sec text-ui-11 uppercase tracking-[0.1em] mb-5">Invoices</div>
          <div className="space-y-3">
            {order.invoice_id_supplier && (
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-tea-text-sec text-ui-13">{supplier.name}'s outgoing invoice</span>
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-ui-12 text-tea-text-sec">{order.invoice_id_supplier}</span>
                  {/* No /admin/invoices/:id route yet — land in the orders list with the
                      invoice id as the search query so the user can find it. */}
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/activity?tab=orders&search=${encodeURIComponent(order.invoice_id_supplier!)}`)}
                    className="text-tea-text-sec hover:text-tea-gold text-ui-13 transition-colors"
                  >
                    Open →
                  </button>
                </div>
              </div>
            )}
            {order.invoice_id_buyer && (
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-tea-text-sec text-ui-13">Your incoming invoice</span>
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-ui-12 text-tea-text-sec">{order.invoice_id_buyer}</span>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/activity?tab=orders&search=${encodeURIComponent(order.invoice_id_buyer!)}`)}
                    className="text-tea-text-sec hover:text-tea-gold text-ui-13 transition-colors"
                  >
                    Open →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
