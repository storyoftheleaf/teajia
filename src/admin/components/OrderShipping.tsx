import React, { useEffect, useRef, useState } from 'react';
import { api, isTokenScopedToAccount } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { shippingNotificationMessage, type ShippingPaymentNotification } from '../../lib/shippingNotification';

interface ShippingOrder {
  id: string;
  status: string;
  source_inquiry_id?: string | null;
  shipping_cost_usd?: number;
  shipping_destination?: string | null;
  delivery_address?: string | null;
  shipping_quote_status?: 'requested' | 'confirmed' | null;
  tracking_number?: string | null;
}

/** Save delivery separately from line-item edits and the payment ledger. */
export const OrderShipping: React.FC<{
  order: ShippingOrder;
  onChanged: () => Promise<void>;
}> = ({ order, onChanged }) => {
  const [quote, setQuote] = useState(order.shipping_quote_status === 'requested' ? '' : String(order.shipping_cost_usd ?? 0));
  const [destination, setDestination] = useState(order.shipping_destination ?? '');
  const [tracking, setTracking] = useState(order.tracking_number ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [notification, setNotification] = useState<ShippingPaymentNotification | null>(null);
  const [notificationUnavailable, setNotificationUnavailable] = useState(false);
  const pending = useRef(false);
  const accountId = useAppStore(state => state.activeAccountId);
  const closed = order.status === 'Void';
  const quoteLocked = closed || order.status === 'Filled';
  useEffect(() => {
    let current = true;
    setNotification(null);
    setNotificationUnavailable(false);
    if (order.source_inquiry_id && !closed && accountId && isTokenScopedToAccount(accountId)) {
      api.invoices.getShippingNotification(order.id).then(result => {
        if (current && useAppStore.getState().activeAccountId === accountId && isTokenScopedToAccount(accountId)) setNotification(result);
      }).catch(() => { if (current) setNotificationUnavailable(true); });
    }
    return () => { current = false; };
  }, [order.id, order.source_inquiry_id, closed, accountId]);
  const notificationMessage = shippingNotificationMessage(notification);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending.current || closed || !accountId || !isTokenScopedToAccount(accountId)) return;
    setNotice('');
    const amount = Number(quote);
    if (!quoteLocked && !quote.trim()) {
      setError('Enter a shipping quote. Use 0 only for pickup or free delivery.');
      return;
    }
    if (!quoteLocked && (!Number.isFinite(amount) || amount < 0)) {
      setError('Shipping must be a valid amount of 0 or more.');
      return;
    }
    pending.current = true;
    setSaving(true);
    setError(null);
    const stillCurrent = () => useAppStore.getState().activeAccountId === accountId && isTokenScopedToAccount(accountId);
    try {
      const saved = await api.invoices.update(order.id, {
        ...(!quoteLocked ? { shipping_cost_usd: Math.round(amount * 100) / 100 } : {}),
        shipping_destination: destination.trim() || null,
        tracking_number: tracking.trim() || null,
      });
      if (!stillCurrent()) return;
      if (order.source_inquiry_id) {
        if (saved?.shipping_notification) setNotification(saved.shipping_notification);
        try {
          const latest = await api.invoices.getShippingNotification(order.id);
          if (stillCurrent()) { setNotification(latest); setNotificationUnavailable(false); }
        } catch { if (stillCurrent()) setNotificationUnavailable(true); }
      }
      if (!stillCurrent()) return;
      try {
        await onChanged();
        if (stillCurrent()) setNotice(order.source_inquiry_id ? '' : 'Shipping saved.');
      } catch {
        if (stillCurrent()) setNotice('Shipping saved, but the balance could not refresh. Reload orders before recording payment.');
      }
    } catch (failure) {
      if (stillCurrent()) setError(failure instanceof Error ? failure.message : 'Could not save shipping. Please retry.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  if (closed) return <section aria-label="Shipping" className="min-w-0 text-ui-13 text-tea-text-sec">
    <h4 className={`${T.h3} text-tea-text mb-2`}>Shipping cancelled</h4>
    {order.delivery_address && <p className="break-words whitespace-pre-line">{order.delivery_address}</p>}
    {order.shipping_destination && <p className="break-words">{order.shipping_destination}</p>}
    {order.tracking_number && <p className="break-words">Tracking: {order.tracking_number}</p>}
  </section>;

  return (
    <section aria-label="Shipping" className="min-w-0">
      <h4 className={`${T.h3} text-tea-text mb-3`}>Shipping</h4>
      {order.shipping_quote_status === 'requested' && !order.source_inquiry_id && <p className="mb-3 text-ui-13 text-tea-text-sec">Tea is paid separately. Enter the agreed shipping quote; the buyer pays the remaining balance on their existing order page before dispatch.</p>}
      {order.source_inquiry_id && !quoteLocked && <p className="mb-3 text-ui-13 text-tea-text-sec">Tea is paid separately. New shipping quotes send a payment link by agreed WhatsApp, otherwise email. Unchanged quotes are not resent.</p>}
      {order.delivery_address && <p className="mb-3 break-words whitespace-pre-line text-ui-13 text-tea-text-sec">{order.delivery_address}</p>}
      <form onSubmit={save} noValidate className="space-y-3">
        <div>
          <label htmlFor="shipping-quote" className={`${T.label} block text-tea-text-sec mb-1`}>Shipping quote (USD)</label>
          <input id="shipping-quote" type="number" min="0" step="0.01" inputMode="decimal" value={quote} onChange={event => { setQuote(event.target.value); setNotice(''); }} disabled={quoteLocked || saving} className="checkout-input" aria-describedby="shipping-help" />
          <p id="shipping-help" className="text-ui-12 text-tea-text-dim mt-1">
            {quoteLocked ? 'Shipping cost is fixed after shipment.' : 'Use 0 for pickup or free delivery.'}
          </p>
        </div>
        <div>
          <label htmlFor="shipping-destination" className={`${T.label} block text-tea-text-sec mb-1`}>Delivery destination</label>
          <textarea id="shipping-destination" rows={2} maxLength={500} value={destination} onChange={event => { setDestination(event.target.value); setNotice(''); }} disabled={closed || saving} placeholder="Address or pickup arrangement" className="checkout-input resize-y" />
        </div>
        <div>
          <label htmlFor="shipping-tracking" className={`${T.label} block text-tea-text-sec mb-1`}>Tracking number (optional)</label>
          <input id="shipping-tracking" type="text" maxLength={500} value={tracking} onChange={event => { setTracking(event.target.value); setNotice(''); }} disabled={closed || saving} className="checkout-input" />
        </div>
        {error && <p role="alert" className="text-ui-13 text-tea-text">{error}</p>}
        {notificationMessage && <p role="status" className="text-ui-13 text-tea-text-sec">{notificationMessage}</p>}
        {notificationUnavailable && <p role="status" className="text-ui-13 text-tea-text-sec">The payment request status could not be checked. Reload this order before sending another message.</p>}
        {notice && <p role="status" className="text-ui-13 text-tea-text-sec">{notice}</p>}
        {!closed && <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save shipping'}</button>}
      </form>
    </section>
  );
};
