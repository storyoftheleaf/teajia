import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, hasToken } from '../lib/api';
import { Icons } from '../components/Icons';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { useRates } from '../admin/hooks/useAdminData';
import { formatOrderAmount } from '../lib/orderMoney';
import { PayOrderAction } from '../components/shared/PayOrderAction';
import { ReportPaymentAction } from '../components/shared/ReportPaymentAction';
import { OrderJourneyStatus } from '../components/shared/OrderJourneyStatus';
import { normalizeJourney, showsPaymentActions } from '../components/shared/orderJourneyDomain';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OrderHistoryPage() {
  const navigate = useNavigate();
  const authed = hasToken();
  const { data: rates = [] } = useRates();
  const queryClient = useQueryClient();

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
          Every order starts a conversation, check WhatsApp for live updates.
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
          {orders.map(order => {
            // Same derived stage the detail page reads, so a customer moving
            // between the two never sees the order described two ways.
            const journey = normalizeJourney(order.journey);
            const offersPayment = showsPaymentActions(journey, order.payment);
            return (
            <li key={order.id}>
              <button
                type="button"
                onClick={() => navigate(`/account/orders/${encodeURIComponent(order.id)}`)}
                className="w-full min-h-11 rounded border border-tea-border bg-tea-surface px-4 py-3 flex items-center justify-between gap-4 text-left hover:border-tea-gold/30 transition-colors"
                aria-label={`${order.invoice_number}, ${journey?.label ?? order.status}, ${formatOrderAmount(order.total_amount_usd, order.currency, rates)}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-ui-13 text-tea-text">{order.invoice_number}</span>
                    {/* The invoice word (Draft, Pending, Filled) is Adrian's own
                        filing. The row shows the customer's stage instead, and
                        shows nothing at all when there is no stage to show. */}
                    <OrderJourneyStatus journey={journey} variant="inline" />
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
                    {formatOrderAmount(order.total_amount_usd, order.currency, rates)}
                  </p>
                  <Icons.ChevronRight className="w-4 h-4 text-tea-text-sec" aria-hidden="true" />
                </div>
              </button>
              {/* Outside the row button, never inside it: a link nested in a
                  button is not a thing a browser can resolve. Gated on the
                  stage as well as the balance, so a closed order never carries
                  an invitation to send money against it. */}
              {offersPayment && (
                <>
                  <PayOrderAction payment={order.payment} reference={order.invoice_number} className="mt-2 px-4" />
                  {/* Collapsed to a single line until it is used, so a list of
                      orders stays a list rather than a column of forms. */}
                  <ReportPaymentAction
                    payment={order.payment}
                    source={{ kind: 'account', invoiceId: order.id }}
                    onReported={() => {
                      void queryClient.invalidateQueries({ queryKey: ['me', 'orders'] });
                    }}
                    className="mt-2 px-4"
                  />
                </>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
