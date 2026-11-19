import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_URL, fetchWithTimeout } from '../../lib/api';
import { Button } from './Button';

interface PayPalSandboxCheckoutProps {
  trackingToken: string;
  invoiceId?: string;
  onConfirmed: () => void;
}

type SandboxConfig = { enabled: boolean; outstanding_usd?: number };
type CheckoutState = 'idle' | 'creating' | 'verifying' | 'pending' | 'completed' | 'error';

async function sandboxRequest<T>(url: string, body?: Record<string, string>): Promise<T> {
  const response = await fetchWithTimeout(url, {
    method: body ? 'POST' : 'GET',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    // Private tracking identifiers must not be copied to the incident ledger.
    reportIncident: false,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(typeof data?.error === 'string' ? data.error : 'The test payment could not be checked. Please try again.') as Error & { code?: string };
    error.code = data?.code; throw error;
  }
  return data as T;
}

/** This control exists only when the local API explicitly enables sandbox checkout. */
export const PayPalSandboxCheckout: React.FC<PayPalSandboxCheckoutProps> = ({ trackingToken, invoiceId, onConfirmed }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [config, setConfig] = useState<SandboxConfig | null>(null);
  const [state, setState] = useState<CheckoutState>('idle');
  const [error, setError] = useState<string | null>(null);
  const confirmedCallback = useRef(onConfirmed);
  confirmedCallback.current = onConfirmed;
  const attemptedOrder = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const endpoint = `${API_URL}/api/orders/${encodeURIComponent(trackingToken)}/paypal-sandbox`;
  const cancelled = searchParams.get('paypal_sandbox_cancel') === '1';
  const returnedOrder = cancelled ? null : searchParams.get('paypal_sandbox_order')
    || (searchParams.get('paypal_sandbox_return') === '1' ? searchParams.get('token') : null);

  useEffect(() => {
    let current = true;
    setConfig(null);
    const selection = new URLSearchParams();
    if (invoiceId) selection.set('invoice', invoiceId);
    if (returnedOrder) selection.set('order_id', returnedOrder);
    sandboxRequest<SandboxConfig>(endpoint + (selection.size ? `?${selection}` : ''))
      .then(data => { if (current) setConfig(data?.enabled === true ? data : { enabled: false }); })
      .catch(() => { if (current) setConfig({ enabled: false }); });
    return () => { current = false; };
  }, [endpoint, invoiceId, returnedOrder]);

  const verify = useCallback(async () => {
    if (!returnedOrder) return;
    setState('verifying'); setError(null);
    try {
      const result = await sandboxRequest<{ state: 'completed' | 'pending' }>(`${endpoint}/capture`, {
        ...(invoiceId ? { invoice_id: invoiceId } : {}), order_id: returnedOrder,
      });
      if (!mounted.current) return;
      if (result.state !== 'completed') { setState('pending'); return; }
      setState('completed');
      // Returning from PayPal is not proof of payment. Only the verified server
      // result reaches here, and the parent reloads the invoice ledger itself.
      const clean = new URLSearchParams(window.location.search);
      ['paypal_sandbox_order', 'paypal_sandbox_return', 'paypal_sandbox_cancel', 'token', 'PayerID'].forEach(key => clean.delete(key));
      setSearchParams(clean, { replace: true });
      confirmedCallback.current();
    } catch (cause) {
      if (mounted.current && (cause as { code?: string })?.code === 'sandbox_payment_failed') {
        const clean = new URLSearchParams(window.location.search);
        ['paypal_sandbox_order', 'paypal_sandbox_return', 'paypal_sandbox_cancel', 'token', 'PayerID'].forEach(key => clean.delete(key));
        setSearchParams(clean, { replace: true });
      }
      if (mounted.current) { setError(cause instanceof Error ? cause.message : 'The test payment could not be verified.'); setState('error'); }
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
      const result = await sandboxRequest<{ order_id: string; approval_url: string }>(endpoint, invoiceId ? { invoice_id: invoiceId } : {});
      const approval = new URL(result.approval_url);
      if (approval.protocol !== 'https:' || !['sandbox.paypal.com', 'www.sandbox.paypal.com'].includes(approval.hostname)) {
        throw new Error('The test checkout did not return a PayPal sandbox link.');
      }
      window.location.assign(approval.href);
    } catch (cause) {
      if (mounted.current) { setError(cause instanceof Error ? cause.message : 'The test checkout could not be opened.'); setState('error'); }
    }
  };

  if (!config?.enabled) return null;
  const hasBalance = typeof config.outstanding_usd === 'number' && Number.isFinite(config.outstanding_usd) && config.outstanding_usd > 0;
  if (!hasBalance && !returnedOrder && state !== 'completed') return null;
  const busy = state === 'creating' || state === 'verifying';
  const checking = Boolean(returnedOrder) && state !== 'completed';

  return (
    <section aria-label="PayPal sandbox checkout" className="mt-5 border-t border-tea-border pt-5 space-y-3">
      <p className="text-ui-14 text-tea-text">PayPal test checkout</p>
      <p className="text-ui-12 text-tea-text-sec">Sandbox only. No real money is taken.</p>
      {cancelled && <p role="status" className="text-ui-13 text-tea-text-sec">Test checkout cancelled. No payment was confirmed.</p>}
      {state === 'pending' && <p role="status" className="text-ui-13 text-tea-text-sec">PayPal is still processing this test payment. Your order is not marked paid yet.</p>}
      {state === 'completed' && <p role="status" className="text-ui-13 text-tea-text-sec">PayPal confirmed this test payment.</p>}
      {error && <p role="alert" className="text-ui-13 text-tea-text">{error}</p>}
      {state !== 'completed' && <Button type="button" variant="primary" disabled={busy} onClick={() => { void (checking ? verify() : start()); }}>
        {state === 'creating' ? 'Opening PayPal sandbox…' : state === 'verifying' ? 'Verifying test payment…' : checking ? 'Check test payment' : 'Pay with PayPal · test'}
      </Button>}
    </section>
  );
};
