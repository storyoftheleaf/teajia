import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError, hasToken } from '../lib/api';
import { Icons } from '../components/Icons';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { useRates } from '../admin/hooks/useAdminData';
import { formatOrderAmount } from '../lib/orderMoney';

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OrderDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const authed = hasToken();
  const { data: rates = [] } = useRates();

  useEffect(() => {
    if (!authed) {
      navigate(`/signin?returnTo=${encodeURIComponent(`/account/orders/${id}`)}`, { replace: true });
    }
  }, [authed, id, navigate]);

  const query = useQuery({
    queryKey: ['me', 'orders', id],
    queryFn: () => api.me.order(id),
    enabled: authed && Boolean(id),
    retry: false,
  });

  if (!authed) return null;

  const order = query.data;
  const isMissing = query.error instanceof ApiError && query.error.status === 404;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-nav-gap-lg animate-[fadeIn_0.5s_ease-out]">
      <button
        type="button"
        onClick={() => navigate('/account/orders')}
        className="tap-target flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors mb-8"
        aria-label="Back"
      >
        <Icons.Back className="w-4 h-4" aria-hidden="true" />
        <span className="text-ui-12 uppercase tracking-[0.15em]">Back</span>
      </button>

      {query.isLoading && (
        <div className="space-y-4" aria-label="Loading order details">
          <div className="h-20 rounded border border-tea-border bg-tea-surface/40 animate-pulse" />
          <div className="h-40 rounded border border-tea-border bg-tea-surface/40 animate-pulse" />
          <div className="h-28 rounded border border-tea-border bg-tea-surface/40 animate-pulse" />
        </div>
      )}

      {query.isError && !query.isLoading && (
        <div role={isMissing ? undefined : 'alert'} className="rounded border border-tea-border bg-tea-surface p-6 text-center">
          <p className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text mb-2`}>
            {isMissing ? 'Order not found' : (query.error as Error).message || 'We could not load this order.'}
          </p>
          <p className="text-ui-13 text-tea-text-sec mb-4">
            {isMissing ? 'This order may no longer be available.' : 'Please try again in a moment.'}
          </p>
          {!isMissing && (
            <button
              type="button"
              onClick={() => query.refetch()}
              className="min-h-11 px-4 py-2 rounded-md cta-solid text-ui-13 font-semibold transition-colors"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {order && (
        <div className="space-y-8">
          <header>
            <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-gold mb-2`}>Order reference</p>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Order {order.invoice_number}</h1>
              <span className="text-ui-11 uppercase tracking-[0.1em] text-tea-text-sec">{order.status}</span>
            </div>
            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-ui-13">
              <div><dt className="text-tea-text-dim">Placed</dt><dd className="text-tea-text">{formatDate(order.created_at)}</dd></div>
              {order.payment_date && <div><dt className="text-tea-text-dim">Paid</dt><dd className="text-tea-text">{formatDate(order.payment_date)}</dd></div>}
              {order.fulfilled_at && <div><dt className="text-tea-text-dim">Fulfilled</dt><dd className="text-tea-text">{formatDate(order.fulfilled_at)}</dd></div>}
            </dl>
          </header>

          <section aria-labelledby="order-items-heading">
            <h2 id="order-items-heading" className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text mb-3`}>Items</h2>
            <ul className="divide-y divide-tea-border border-y border-tea-border">
              {order.items.map(item => (
                <li key={item.id} className="py-4 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <div className="min-w-0">
                    <p className="text-ui-14 text-tea-text break-words">{item.name}</p>
                    <p className="text-ui-12 text-tea-text-sec mt-1">
                      {item.quantity} × {formatOrderAmount(item.unit_price_usd, order.currency, rates)}
                    </p>
                  </div>
                  <p className="text-ui-14 text-tea-text font-medium whitespace-nowrap">{formatOrderAmount(item.line_total_usd, order.currency, rates)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Order totals" className="space-y-2 text-ui-14">
            <div className="flex justify-between gap-4 text-tea-text-sec"><span>Subtotal</span><span>{formatOrderAmount(order.subtotal_amount_usd, order.currency, rates)}</span></div>
            <div data-testid="shipping-total" className="flex justify-between gap-4 text-tea-text-sec"><span>Shipping</span><span>{formatOrderAmount(order.shipping_amount_usd, order.currency, rates)}</span></div>
            <div className="flex justify-between gap-4 border-t border-tea-border pt-3 text-tea-text font-semibold"><span>Total</span><span>{formatOrderAmount(order.total_amount_usd, order.currency, rates)}</span></div>
          </section>

          <section className="border-t border-tea-border pt-6">
            <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text mb-2`}>Questions about this order?</h2>
            <p className="text-ui-13 text-tea-text-sec mb-4">Contact the tea house for an update or inquiry.</p>
            {order.contact.whatsapp ? (
              <a
                data-testid="order-contact-action"
                href={`https://wa.me/${order.contact.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello, I have a question about order ${order.invoice_number}.`)}`}
                className="inline-flex min-h-11 items-center justify-center px-4 py-2 rounded-md cta-solid text-ui-13 font-semibold transition-colors"
                target="_blank"
                rel="noreferrer"
              >
                Ask about this order on WhatsApp
              </a>
            ) : order.contact.email ? (
              <a
                data-testid="order-contact-action"
                href={`mailto:${order.contact.email}?subject=${encodeURIComponent(`Question about order ${order.invoice_number}`)}`}
                className="inline-flex min-h-11 items-center justify-center px-4 py-2 rounded-md cta-solid text-ui-13 font-semibold transition-colors"
              >
                Ask about this order by email
              </a>
            ) : (
              <p className="text-ui-13 text-tea-text-sec">Contact details are unavailable for this order.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
