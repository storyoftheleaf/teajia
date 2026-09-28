import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { api } from '../lib/api';
import { buildOrderMessage } from '../lib/whatsapp';
import { resolveContactChannels } from '../lib/contact';
import { useShopPrice } from '../components/shop/shopPrice';
import { PayOrderAction } from '../components/shared/PayOrderAction';
import { ReportPaymentAction } from '../components/shared/ReportPaymentAction';
import { shouldOfferPaymentClaim } from '../components/shared/paymentClaimDomain';
import { OrderJourneyStatus } from '../components/shared/OrderJourneyStatus';
import { normalizeJourney, showsPaymentActions } from '../components/shared/orderJourneyDomain';
import { createAsyncResultGuard, loadTrackingRequest, trackingItemQuantity } from '../lib/orderTrackingDomain';
import { TYPOGRAPHY_CLASSES } from '../designTokens';

const inputClass =
  'w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors';

const OrderStatusPage: React.FC = () => {
  const { ref: trackingToken } = useParams<{ ref: string }>();
  const navigate = useNavigate();

  const [inquiry, setInquiry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [lookupToken, setLookupToken] = useState('');
  // Bumped when the customer reports a payment, so the page picks up the
  // pending-claim count the worker now holds rather than the one it loaded with.
  const [reloadKey, setReloadKey] = useState(0);

  // Above the loading early return, as every hook in this app must be. The
  // basket that produced this order was quoted in the reader's currency, so the
  // receipt for it has to be too: calling the raw dollar formatter here meant a
  // reader who checked out in Rupiah came back to a dollar total.
  const shopPrice = useShopPrice();

  useEffect(() => {
    if (!trackingToken) {
      setInquiry(null);
      setNotFound(false);
      setUnavailable(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    setUnavailable(false);
    setInquiry(null);
    const guard = createAsyncResultGuard();
    loadTrackingRequest(() => api.inquiries.getByTrackingToken(trackingToken))
      .then((result) => {
        if (!guard.isCurrent()) return;
        if (result.status === 'found') setInquiry(result.inquiry);
        setNotFound(result.status === 'missing');
        setUnavailable(result.status === 'unavailable');
        setLoading(false);
      });
    return () => guard.cancel();
  }, [trackingToken, reloadKey]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const next = lookupToken.trim();
    if (!next) return;
    navigate(`/order/${encodeURIComponent(next)}`);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-3 pb-nav-gap">
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-2 border-tea-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  let items: any[] = [];
  try {
    const parsed = inquiry?.items_json ? JSON.parse(inquiry.items_json) : [];
    items = Array.isArray(parsed) ? parsed : [];
  } catch {
    items = [];
  }
  // The stage the worker derived from the order itself, replacing the four
  // fixed words this page used to read off a column Adrian sets by hand in a
  // different place from where he works the order.
  const derivedJourney = normalizeJourney(inquiry?.journey);
  const journey = inquiry?.order?.status === 'Draft'
    ? { stage: 'received' as const, label: 'Request received', detail: 'Your request is saved. We’ll review the tea, payment and shipping with you.', at: null }
    : inquiry?.order?.shipping_status === 'shipped'
      ? { stage: 'sent' as const, label: 'Shipped', detail: derivedJourney?.detail ?? null, at: inquiry.order.shipped_at ?? derivedJourney?.at ?? null }
      : derivedJourney;
  // Two gates, and both must open. The balance rules from round two decide
  // whether there is anything to settle; the stage decides whether settling it
  // is still a thing this order can do at all.
  const offersPayment =
    inquiry?.order?.status !== 'Draft' &&
    showsPaymentActions(journey, inquiry?.payment) &&
    Boolean(inquiry?.payment?.pay_url || shouldOfferPaymentClaim(inquiry?.payment));
  const formatStoredUsd = (amount: number) => {
    const safe = Number.isFinite(amount) ? amount : 0;
    if (inquiry?.currency === shopPrice.code) return shopPrice.total(safe);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(safe);
  };

  const orderChat = inquiry && trackingToken ? resolveContactChannels({
    whatsappNumber: inquiry.contact?.whatsapp,
    message: buildOrderMessage({
      type: 'inquiry', ref: inquiry.ref_number,
      invoiceNumber: inquiry.order?.invoice_number || inquiry.invoice_number,
      trackingUrl: `${window.location.origin}/order/${encodeURIComponent(trackingToken)}`,
      customerLocation: inquiry.order?.shipping_destination || inquiry.shipping_destination,
      items: items.map(item => ({ name: item.name, variant: item.variant, quantity: item.packGrams ?? item.quantityGrams,
        packs: item.packs ?? 1, unit: item.category === 'tea' ? 'g' : ' pcs',
        price: formatStoredUsd(Number(item.totalPrice)), total: formatStoredUsd(Number(item.totalPrice)) })),
      subtotal: formatStoredUsd(Number(inquiry.total_estimate_usd)), total: formatStoredUsd(Number(inquiry.total_estimate_usd)),
    }),
  }).whatsapp : null;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-3 pb-nav-gap space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="tap-target inline-flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors"
        aria-label="Back"
      >
        <ArrowLeft size={14} />
        <span className="text-ui-12">Back</span>
      </button>

      {/* Header */}
      <div>
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Track your order</h1>
        <p className="label-caps text-tea-text-dim mt-1">Order status lookup</p>
      </div>

      {/* Lookup form */}
      <form onSubmit={handleLookup} className="bg-tea-surface border border-tea-border rounded-xl p-5 space-y-3">
        <label htmlFor="order-ref" className="block text-ui-12 text-tea-text-sec">
          Private tracking code
        </label>
        <div className="flex gap-2">
          <input
            id="order-ref"
            type="text"
            value={lookupToken}
            onChange={(e) => setLookupToken(e.target.value)}
            placeholder={trackingToken || 'Paste your private tracking code'}
            className={inputClass}
            autoComplete="off"
          />
          <button
            type="submit"
            className="tap-target inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Search size={14} />
            Look up
          </button>
        </div>
        {trackingToken && (
          <p className="text-ui-12 text-tea-text-dim">
            Looking up a private tracking link
          </p>
        )}
      </form>

      {unavailable && (
        <div role="alert" className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Order status is temporarily unavailable</h2>
          <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text-sec mt-2`}>
            We could not load your order. Keep this link and try again. You do not need to send another request.
          </p>
          <button type="button" onClick={() => setReloadKey(key => key + 1)} className="tap-target mt-4 inline-flex px-4 py-2 rounded-md cta-solid text-ui-13">
            Try again
          </button>
        </div>
      )}

      {/* Not found */}
      {notFound && (
        <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Order not found</h2>
          <p className="text-ui-12 text-tea-text-sec mt-1 leading-relaxed">
            We could not find a request for this code. Open the private order link from your saved request or message. If you already sent an order, ask us in that conversation before sending another.
          </p>
        </div>
      )}

      {/* Invoice block, §21 */}
      {inquiry && !notFound && !unavailable && (
        <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <h3 className="h3">Order {inquiry.ref_number}</h3>
            {/* Placed, and only placed. The stage the order is at now is the
                journey block below, which is derived rather than typed. */}
            <span className="label-caps text-tea-text-dim">
              Placed{' '}
              {new Date(inquiry?.created_at || Date.now()).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          {(inquiry.order?.invoice_number || inquiry.invoice_number) && <p className="text-ui-13 text-tea-text-sec">Invoice {inquiry.order?.invoice_number || inquiry.invoice_number}</p>}
          {(inquiry.order?.shipping_destination || inquiry.shipping_destination) && <p className="text-ui-13 text-tea-text-sec">Delivery: {inquiry.order?.shipping_destination || inquiry.shipping_destination}</p>}
          {(inquiry.order?.tracking_number || inquiry.tracking_number) && <p className="text-ui-13 text-tea-text-sec">Tracking: {inquiry.order?.tracking_number || inquiry.tracking_number}</p>}

          {/* Line items */}
          <div className="border-t border-tea-border">
            {items.map((item: any) => (
              <div
                key={item.lineKey || `${item.id}:${item.packGrams ?? item.quantityGrams}`}
                className="flex justify-between items-baseline py-2 text-ui-14 text-tea-text border-b border-tea-border last:border-0"
              >
                <span className="flex-1 truncate">{item.name}</span>
                <span className="text-tea-text-sec text-ui-13 mx-4 font-mono tabular-nums">
                  {trackingItemQuantity(item)}
                </span>
                <span className="font-mono tabular-nums w-20 text-right">
                  {formatStoredUsd(Number(item.totalPrice))}
                </span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex justify-between items-baseline pt-3 mt-2 border-t border-tea-border">
            <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text`}>Requested tea subtotal estimate</span>
            <span className="font-mono text-ui-17 text-tea-text tabular-nums">
              {formatStoredUsd(Number(inquiry?.total_estimate_usd || 0))}
            </span>
          </div>

          <p className="text-ui-11 text-tea-text-dim mt-2">
            Requested display currency: {inquiry.currency || 'USD'}
          </p>

          {inquiry.order && inquiry.payment && <dl className="mt-4 border-t border-tea-border pt-3 space-y-1 text-ui-13">
            <div className="flex justify-between gap-4"><dt className="text-tea-text-sec">Invoice total</dt><dd className="num text-tea-text">{formatStoredUsd(Number(inquiry.payment.total_usd))}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-tea-text-sec">Paid</dt><dd className="num text-tea-text">{formatStoredUsd(Number(inquiry.payment.paid_usd))}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-tea-text-sec">Balance</dt><dd className="num text-tea-text">{formatStoredUsd(Number(inquiry.payment.outstanding_usd))}</dd></div>
          </dl>}

          {orderChat && <div className="mt-5 space-y-2">
            <a className="checkout-tracking-link" href={orderChat.href} target="_blank" rel="noopener noreferrer">Discuss this order on WhatsApp</a>
            <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec`}>Your order details and invoice link are filled in. Tap Send in WhatsApp so the tea house can reply.</p>
          </div>}

          {/* The line that used to sit here promised a WhatsApp conversation
              about availability and pricing whatever had happened to the order,
              so it was still promising it after the tea had been posted. The
              stage below says what is actually true, and says it once. */}
          {(journey || offersPayment) && (
            <div className="mt-5 pt-5 border-t border-tea-border">
              <OrderJourneyStatus journey={journey}>
                {offersPayment && (
                  <div className="space-y-4">
                    <PayOrderAction payment={inquiry.payment} reference={inquiry.ref_number} trackingToken={trackingToken} />
                    {/* The quieter half: what a customer does after the transfer has
                        left their bank. Reached by a tracking token, never a login, so
                        it knocks on the public claim door. */}
                    {trackingToken && (
                      <ReportPaymentAction
                        payment={inquiry.payment}
                        source={{ kind: 'tracking', trackingToken }}
                        onReported={() => setReloadKey(k => k + 1)}
                      />
                    )}
                  </div>
                )}
              </OrderJourneyStatus>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrderStatusPage;
