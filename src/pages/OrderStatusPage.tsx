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
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <h1 className="text-2xl font-serif text-tea-text mb-4">Order Not Found</h1>
        <p className="text-sm text-tea-text-sec mb-8">This order reference doesn't exist or hasn't been submitted yet.</p>
        <Link to="/shop" className="px-8 py-3 bg-tea-gold text-tea-bg text-xs uppercase tracking-display">Browse Shop</Link>
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
    <div className="max-w-lg mx-auto py-12 px-6 animate-[fadeIn_0.5s_ease-out]">
      <div className="text-center mb-8">
        <p className="text-ui-10 uppercase tracking-display text-tea-text-sec mb-2">Order Status</p>
        <h1 className="text-2xl font-serif text-tea-text mb-1">{ref}</h1>
        <p className="text-xs text-tea-text-sec">{new Date(inquiry?.created_at || Date.now()).toLocaleDateString()}</p>
      </div>

      <div className="bg-tea-surface border border-tea-border rounded-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-ui-10 uppercase tracking-caps text-tea-text-sec">Status</span>
          <span className="badge-status badge-status-gold">{statusLabels[status] || status}</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-tea-text-sec">Name</span>
            <span className="text-tea-text">{inquiry?.customer_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-tea-text-sec">Contact</span>
            <span className="text-tea-text">{inquiry?.customer_contact}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-tea-text-sec">Location</span>
            <span className="text-tea-text">{inquiry?.customer_location}</span>
          </div>
        </div>
      </div>

      <div className="bg-tea-surface border border-tea-border rounded-md p-6 mb-6">
        <p className="text-ui-10 uppercase tracking-caps text-tea-text-sec mb-3">Items</p>
        {items.map((item: any) => (
          <div key={item.id} className="flex justify-between items-center text-sm border-b border-tea-border py-2 last:border-0">
            <div>
              <span className="text-tea-text">{item.name}</span>
              <span className="text-tea-text-sec text-xs ml-2">
                {item.category === 'tea' ? `${item.quantityGrams}g` : `\u00d7${item.quantityGrams}`}
              </span>
            </div>
            <span className="num text-tea-text">{fmtShopPrice(item.totalPrice)}</span>
          </div>
        ))}
        <div className="flex justify-between items-center pt-3 border-t border-tea-border mt-2">
          <span className="text-sm font-medium text-tea-text">Estimate</span>
          <span className="num text-lg font-serif text-tea-gold">{fmtShopPrice(inquiry?.total_estimate_usd || 0)}</span>
        </div>
      </div>

      <p className="text-center text-xs text-tea-text-sec italic">
        We'll confirm availability, pricing, and shipping personally.
      </p>
    </div>
  );
};

export default OrderStatusPage;
