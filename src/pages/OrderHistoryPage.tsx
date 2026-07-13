import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, hasToken } from '../lib/api';
import { Icons } from '../components/Icons';
import { TYPOGRAPHY_CLASSES } from '../designTokens';

// Currency formatter — falls back to a plain prefix when Intl rejects the code
// (D1 stores legacy values like "NT" or "Yuan" that aren't ISO 4217).
function formatTotal(amountUsd: number, currency: string): string {
  const safe = Number.isFinite(amountUsd) ? amountUsd : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${currency || 'USD'} ${safe.toFixed(2)}`;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s === 'fulfilled' || s === 'paid' || s === 'complete' || s === 'completed') return 'text-tea-gold';
  if (s === 'void' || s === 'cancelled' || s === 'canceled') return 'text-tea-text-dim';
  return 'text-tea-text-sec';
}

export default function OrderHistoryPage() {
  const navigate = useNavigate();
  const authed = hasToken();

  useEffect(() => {
    if (!authed) {
      navigate(`/signin?returnTo=${encodeURIComponent('/account/orders')}`, { replace: true });
    }
  }, [authed, navigate]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['me', 'orders'],
    queryFn: () => api.me.orders(),
    enabled: authed,
  });

  if (!authed) return null;

  const orders = data?.orders ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-nav-gap-lg animate-[fadeIn_0.5s_ease-out]">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors mb-8"
      >
        <Icons.Back className="w-4 h-4" />
        <span className="text-ui-12 uppercase tracking-[0.15em]">Back</span>
      </button>

      <header className="mb-8">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-2`}>Order History</h1>
        <p className="text-ui-14 text-tea-text-sec">
          Every order starts a conversation — check WhatsApp for live updates.
        </p>
      </header>

      {isLoading && (
        <div className="space-y-3" aria-label="Loading orders">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-20 rounded border border-tea-border bg-tea-surface/40 animate-pulse" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded border border-tea-border bg-tea-surface p-6 text-center">
          <p className="text-ui-14 text-tea-text-sec">We couldn't load your orders right now. Please try again in a moment.</p>
        </div>
      )}

      {!isLoading && !isError && orders.length === 0 && (
        <div className="rounded border border-tea-border bg-tea-surface p-8 text-center">
          <Icons.Clock className="w-8 h-8 text-tea-gold/40 mx-auto mb-3" />
          <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text mb-1`}>No orders yet</p>
          <p className="text-ui-13 text-tea-text-sec max-w-xs mx-auto">
            When you place an order, it will appear here. Every order is confirmed over WhatsApp.
          </p>
        </div>
      )}

      {!isLoading && !isError && orders.length > 0 && (
        <ul className="space-y-2">
          {orders.map(order => (
            <li key={order.id}>
              <button
                type="button"
                onClick={() => navigate(`/account/orders/${encodeURIComponent(order.id)}`)}
                className="w-full min-h-11 rounded border border-tea-border bg-tea-surface px-4 py-3 flex items-center justify-between gap-4 text-left hover:border-tea-gold/30 transition-colors"
                aria-label={`${order.invoice_number}, ${order.status}, ${formatTotal(order.total_amount_usd, order.currency)}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-ui-13 text-tea-text">{order.invoice_number}</span>
                    <span className={`text-ui-11 uppercase tracking-[0.1em] ${statusTone(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-ui-12 text-tea-text-sec mt-1">
                    {formatDate(order.created_at)}
                    {order.line_items_count > 0 && (
                      <span> · {order.line_items_count} {order.line_items_count === 1 ? 'item' : 'items'}</span>
                    )}
                  </p>
                </div>
                <div className="text-right flex items-center gap-2 shrink-0">
                  <p className="text-ui-14 text-tea-text font-medium">
                    {formatTotal(order.total_amount_usd, order.currency)}
                  </p>
                  <Icons.ChevronRight className="w-4 h-4 text-tea-text-sec" aria-hidden="true" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
