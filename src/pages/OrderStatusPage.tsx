import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useShopPrice } from '../components/shop/shopPrice';

const inputClass =
  'w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Inquiry received',
  confirmed: 'Order confirmed',
  shipped: 'Shipped',
  completed: 'Completed',
};

const OrderStatusPage: React.FC = () => {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();

  const [inquiry, setInquiry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lookupRef, setLookupRef] = useState('');

  // Above the loading early return, as every hook in this app must be. The
  // basket that produced this order was quoted in the reader's currency, so the
  // receipt for it has to be too: calling the raw dollar formatter here meant a
  // reader who checked out in Rupiah came back to a dollar total.
  const shopPrice = useShopPrice();

  useEffect(() => {
    if (!ref) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    api.inquiries
      .getByRef(ref)
      .then((data) => {
        if (data) {
          setInquiry(data);
        } else {
          setInquiry(null);
          setNotFound(true);
        }
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [ref]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const next = lookupRef.trim();
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

  const items = inquiry?.items_json ? JSON.parse(inquiry.items_json) : [];
  const status = inquiry?.status || 'pending';

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
          Order reference
        </label>
        <div className="flex gap-2">
          <input
            id="order-ref"
            type="text"
            value={lookupRef}
            onChange={(e) => setLookupRef(e.target.value)}
            placeholder={ref || 'e.g. ORD-12345'}
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
        {ref && (
          <p className="text-ui-12 text-tea-text-dim">
            Showing order <span className="font-mono text-tea-text">{ref}</span>
          </p>
        )}
      </form>

      {/* Not found */}
      {notFound && (
        <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <h3 className="h3">Order not found</h3>
          <p className="text-ui-12 text-tea-text-sec mt-1 leading-relaxed">
            This order reference doesn't exist or hasn't been submitted yet. Double-check the reference, or browse the shop and place a new inquiry.
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
            <h3 className="h3">Order {ref}</h3>
            <span className="label-caps text-tea-text-dim">
              {STATUS_LABEL[status] || status} ·{' '}
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
                  {shopPrice.total(item.totalPrice)}
                </span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex justify-between items-baseline pt-3 mt-2 border-t border-tea-border">
            <span className="font-display text-ui-17 font-medium text-tea-text">Estimate</span>
            <span className="font-mono text-ui-17 text-tea-text tabular-nums">
              {shopPrice.total(inquiry?.total_estimate_usd || 0)}
            </span>
          </div>

          <p className="text-ui-12 text-tea-text-sec mt-4 leading-relaxed">
            We'll confirm availability, pricing, and shipping personally over WhatsApp.
          </p>
        </div>
      )}
    </div>
  );
};

export default OrderStatusPage;
