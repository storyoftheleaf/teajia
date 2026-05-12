import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { fmtShopPrice } from '../utils/formatNumber';

const OrderStatusPage: React.FC = () => {
  const { ref } = useParams<{ ref: string }>();
  const [inquiry, setInquiry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!ref) return;
    api.inquiries.getByRef(ref).then(data => {
      if (data) setInquiry(data);
      else setNotFound(true);
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [ref]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-tea-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
        <h1 className="h2 mb-3">Order not found</h1>
        <p className="text-ui-12 text-tea-text-dim leading-relaxed mb-6">This order reference doesn't exist or hasn't been submitted yet.</p>
        <Link to="/shop" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors">Browse shop</Link>
      </div>
    );
  }

  const items = inquiry?.items_json ? JSON.parse(inquiry.items_json) : [];
  const status = inquiry?.status || 'pending';
  const statusLabels: Record<string, string> = {
    pending: 'Inquiry Received',
    confirmed: 'Order Confirmed',
    shipped: 'Shipped',
    completed: 'Completed',
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 pt-12 pb-24 animate-[fadeIn_0.5s_ease-out]">
      <div className="text-center mb-8">
        <p className="label-caps text-tea-text-dim mb-2">Order Status</p>
        <h1 className="h2 mb-1">{ref}</h1>
        <p className="text-ui-12 text-tea-text-dim">{new Date(inquiry?.created_at || Date.now()).toLocaleDateString()}</p>
      </div>

      <div className="bg-tea-surface border border-tea-border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="label-caps text-tea-text-dim">Status</span>
          <span className="inline-flex px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[1.2px] bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40">{statusLabels[status] || status}</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-ui-14">
            <span className="text-tea-text-sec">Name</span>
            <span className="text-tea-text">{inquiry?.customer_name}</span>
          </div>
          <div className="flex justify-between text-ui-14">
            <span className="text-tea-text-sec">Contact</span>
            <span className="text-tea-text">{inquiry?.customer_contact}</span>
          </div>
          <div className="flex justify-between text-ui-14">
            <span className="text-tea-text-sec">Location</span>
            <span className="text-tea-text">{inquiry?.customer_location}</span>
          </div>
        </div>
      </div>

      <div className="bg-tea-surface border border-tea-border rounded-xl p-6 mb-6">
        <p className="label-caps text-tea-text-dim mb-3">Items</p>
        {items.map((item: any) => (
          <div key={item.id} className="flex justify-between items-center text-ui-14 border-b border-tea-border py-2 last:border-0">
            <div>
              <span className="text-tea-text">{item.name}</span>
              <span className="text-tea-text-sec text-ui-12 ml-2">
                {item.category === 'tea' ? `${item.quantityGrams}g` : `\u00d7${item.quantityGrams}`}
              </span>
            </div>
            <span className="mono-text text-ui-14 text-tea-text">{fmtShopPrice(item.totalPrice)}</span>
          </div>
        ))}
        <div className="flex justify-between items-center pt-3 border-t border-tea-border mt-2">
          <span className="text-ui-14 text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>Estimate</span>
          <span className="text-ui-17 text-tea-readgold" style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>{fmtShopPrice(inquiry?.total_estimate_usd || 0)}</span>
        </div>
      </div>

      <p className="text-center subtitle text-ui-13">
        We'll confirm availability, pricing, and shipping personally.
      </p>
    </div>
  );
};

export default OrderStatusPage;
