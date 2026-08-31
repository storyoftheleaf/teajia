import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useShopPrice } from '../components/shop/shopPrice';
import { PayOrderAction } from '../components/shared/PayOrderAction';
import { ReportPaymentAction } from '../components/shared/ReportPaymentAction';
import { shouldOfferPaymentClaim } from '../components/shared/paymentClaimDomain';
import { OrderJourneyStatus } from '../components/shared/OrderJourneyStatus';
import { normalizeJourney, showsPaymentActions } from '../components/shared/orderJourneyDomain';
import { createAsyncResultGuard } from '../lib/orderTrackingDomain';

const inputClass =
  'w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors';

const OrderStatusPage: React.FC = () => {
  const { ref: trackingToken } = useParams<{ ref: string }>();
  const navigate = useNavigate();

  const [inquiry, setInquiry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
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
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    const guard = createAsyncResultGuard();
    api.inquiries
      .getByTrackingToken(trackingToken)
      .then((data) => {
        if (!guard.isCurrent()) return;
        if (data) {
          setInquiry(data);
        } else {
          setInquiry(null);
          setNotFound(true);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!guard.isCurrent()) return;
        setNotFound(true);
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
    items = inquiry?.items_json ? JSON.parse(inquiry.items_json) : [];
  } catch {
    items = [];
  }
  // The stage the worker derived from the order itself, replacing the four
  // fixed words this page used to read off a column Adrian sets by hand in a
  // different place from where he works the order.
  const journey = normalizeJourney(inquiry?.journey);
  // Two gates, and both must open. The balance rules from round two decide
  // whether there is anything to settle; the stage decides whether settling it
  // is still a thing this order can do at all.
  const offersPayment =
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

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-3 pb-nav-gap space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors"
        aria-label="Back"
      >
        <ArrowLeft size={14} />
        <span className="text-ui-12">Back</span>
      </button>

      {/* Header */}
      <div>
        <h1 className="h2">Track your order</h1>
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors whitespace-nowrap"
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

      {/* Not found */}
      {notFound && (
        <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <h3 className="h3">Order not found</h3>
          <p className="text-ui-12 text-tea-text-sec mt-1 leading-relaxed">
            This private tracking code doesn't exist or hasn't been submitted yet. Double-check the code, or browse the shop and place a new inquiry.
          </p>
          <div className="mt-4">
            <Link
              to="/shop"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors"
            >
              Browse shop
            </Link>
          </div>
        </div>
      )}

      {/* Invoice block, §21 */}
      {inquiry && !notFound && (
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

          {/* Line items */}
          <div className="border-t border-tea-border">
            {items.map((item: any) => (
              <div
                key={item.id}
                className="flex justify-between items-baseline py-2 text-ui-14 text-tea-text border-b border-tea-border last:border-0"
              >
                <span className="flex-1 truncate">{item.name}</span>
                <span className="text-tea-text-sec text-ui-13 mx-4 font-mono tabular-nums">
                  {item.category === 'tea' ? `${item.quantityGrams}g` : `×${item.quantityGrams}`}
                </span>
                <span className="font-mono tabular-nums w-20 text-right">
                  {formatStoredUsd(Number(item.totalPrice))}
                </span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex justify-between items-baseline pt-3 mt-2 border-t border-tea-border">
            <span className="font-display text-ui-17 font-medium text-tea-text">Estimate</span>
            <span className="font-mono text-ui-17 text-tea-text tabular-nums">
              {formatStoredUsd(Number(inquiry?.total_estimate_usd || 0))}
            </span>
          </div>

          <p className="text-ui-11 text-tea-text-dim mt-2">
            Requested display currency: {inquiry.currency || 'USD'}
          </p>

          {/* The line that used to sit here promised a WhatsApp conversation
              about availability and pricing whatever had happened to the order,
              so it was still promising it after the tea had been posted. The
              stage below says what is actually true, and says it once. */}
          {(journey || offersPayment) && (
            <div className="mt-5 pt-5 border-t border-tea-border">
              <OrderJourneyStatus journey={journey}>
                {offersPayment && (
                  <div className="space-y-4">
                    <PayOrderAction payment={inquiry.payment} reference={inquiry.ref_number} />
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
