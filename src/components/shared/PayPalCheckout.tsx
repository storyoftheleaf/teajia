import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_URL, fetchWithTimeout } from '../../lib/api';
import { Button } from './Button';

interface PayPalCheckoutProps {
  trackingToken: string;
  invoiceId?: string;
  onConfirmed: () => void;
}

type PayPalConfig = { enabled: boolean; outstanding_usd?: number; shipping_later?: boolean };
type CheckoutState = 'idle' | 'creating' | 'verifying' | 'pending' | 'completed' | 'error';

async function paypalRequest<T>(url: string, body?: Record<string, string>): Promise<T> {
  const response = await fetchWithTimeout(url, {
    method: body ? 'POST' : 'GET',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    // Private tracking identifiers must not be copied to the incident ledger.
    reportIncident: false,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(typeof data?.error === 'string' ? data.error : 'The payment could not be checked. Please try again.') as Error & { code?: string };
    error.code = data?.code; throw error;
  }
  return data as T;
}

/** Shown only when the production API explicitly enables this merchant checkout. */
export const PayPalCheckout: React.FC<PayPalCheckoutProps> = ({ trackingToken, invoiceId, onConfirmed }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [config, setConfig] = useState<PayPalConfig | null>(null);
  const [state, setState] = useState<CheckoutState>('idle');
  const [error, setError] = useState<string | null>(null);
  const confirmedCallback = useRef(onConfirmed);
  confirmedCallback.current = onConfirmed;
  const attemptedOrder = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const endpoint = `${API_URL}/api/orders/${encodeURIComponent(trackingToken)}/paypal`;
  const cancelled = searchParams.get('paypal_live_cancel') === '1';
  const returnedOrder = cancelled ? null : searchParams.get('paypal_live_order')
    || (searchParams.get('paypal_live_return') === '1' ? searchParams.get('token') : null);

  useEffect(() => {
    let current = true;
    setConfig(null);
    const selection = new URLSearchParams();
    if (invoiceId) selection.set('invoice', invoiceId);
    if (returnedOrder) selection.set('order_id', returnedOrder);
    paypalRequest<PayPalConfig>(endpoint + (selection.size ? `?${selection}` : ''))
      .then(data => { if (current) setConfig(data?.enabled === true ? data : { enabled: false }); })
      .catch(() => { if (current) setConfig({ enabled: false }); });
    return () => { current = false; };
  }, [endpoint, invoiceId, returnedOrder]);

  const verify = useCallback(async () => {
    if (!returnedOrder) return;
    setState('verifying'); setError(null);
    try {
      const result = await paypalRequest<{ state: 'completed' | 'pending' }>(`${endpoint}/capture`, {
        ...(invoiceId ? { invoice_id: invoiceId } : {}), order_id: returnedOrder,
      });
      if (!mounted.current) return;
      if (result.state !== 'completed') { setState('pending'); return; }
      setState('completed');
      // Returning from PayPal is not proof of payment. Only the verified server
      // result reaches here, and the parent reloads the invoice ledger itself.
      const clean = new URLSearchParams(window.location.search);
      ['paypal_live_order', 'paypal_live_return', 'paypal_live_cancel', 'token', 'PayerID'].forEach(key => clean.delete(key));
      setSearchParams(clean, { replace: true });
      confirmedCallback.current();
    } catch (cause) {
      if (mounted.current && (cause as { code?: string })?.code === 'paypal_payment_failed') {
        const clean = new URLSearchParams(window.location.search);
        ['paypal_live_order', 'paypal_live_return', 'paypal_live_cancel', 'token', 'PayerID'].forEach(key => clean.delete(key));
        setSearchParams(clean, { replace: true });
      }
      if (mounted.current) { setError(cause instanceof Error ? cause.message : 'The payment could not be verified.'); setState('error'); }
    }
  }, [endpoint, invoiceId, returnedOrder, setSearchParams]);

  useEffect(() => {
    if (!config?.enabled || !returnedOrder || attemptedOrder.current === returnedOrder) return;
    attemptedOrder.current = returnedOrder;
    void verify();
  }, [config?.enabled, returnedOrder, verify]);

  const start = async () => {
    if (state === 'creating' || state === 'verifying') return;
    setState('creating'); setError(null);
    try {
      const result = await paypalRequest<{ order_id: string; approval_url: string }>(endpoint, invoiceId ? { invoice_id: invoiceId } : {});
      const approval = new URL(result.approval_url);
      if (approval.protocol !== 'https:' || !['paypal.com', 'www.paypal.com'].includes(approval.hostname)) {
        throw new Error('The checkout did not return a PayPal link.');
      }
      window.location.assign(approval.href);
    } catch (cause) {
      if (mounted.current) { setError(cause instanceof Error ? cause.message : 'The checkout could not be opened.'); setState('error'); }
    }
  };

  if (!config?.enabled) return null;
  const hasBalance = typeof config.outstanding_usd === 'number' && Number.isFinite(config.outstanding_usd) && config.outstanding_usd > 0;
  if (!hasBalance && !returnedOrder && state !== 'completed') return null;
  const busy = state === 'creating' || state === 'verifying';
  const checking = Boolean(returnedOrder) && state !== 'completed';

  return (
    <section aria-label="PayPal checkout" className="mt-5 border-t border-tea-border pt-5 space-y-3">
      <p className="text-ui-14 text-tea-text">PayPal checkout</p>
      <p className="text-ui-12 text-tea-text-sec">{config.shipping_later ? 'Pay securely with PayPal. Shipping is quoted and charged separately later.' : 'Pay securely with PayPal.'}</p>
      {cancelled && <p role="status" className="text-ui-13 text-tea-text-sec">Checkout cancelled. No payment was confirmed.</p>}
      {state === 'pending' && <p role="status" className="text-ui-13 text-tea-text-sec">PayPal is still processing this payment. Your order is not marked paid yet.</p>}
      {state === 'completed' && <p role="status" className="text-ui-13 text-tea-text-sec">PayPal confirmed this payment.</p>}
      {error && <p role="alert" className="text-ui-13 text-tea-text">{error}</p>}
      {state !== 'completed' && <Button type="button" variant="primary" disabled={busy} onClick={() => { void (checking ? verify() : start()); }}>
        {state === 'creating' ? 'Opening PayPal…' : state === 'verifying' ? 'Verifying payment…' : checking ? 'Check payment' : 'Pay with PayPal'}
      </Button>}
    </section>
  );
};
