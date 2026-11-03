import React, { useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { money, validateRecordAmount } from './OrderPayments';

type RefundInput = { amount_usd: number; request_id: string; reference?: string };

export function readRefundRetry(key: string): RefundInput | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value.request_id === 'string' && Number.isFinite(value.amount_usd) && value.amount_usd > 0 ? value : null;
  } catch { return null; }
}

/** A record of money already returned. A retry reuses the exact saved request. */
export function OrderRefund({ invoiceId, due, refunded, onChanged }: {
  invoiceId: string; due: number; refunded: number; onChanged: () => void;
}) {
  const accountId = useAppStore(state => state.activeAccountId);
  const key = `teajia_refund_retry:${accountId}:${invoiceId}`;
  const [pending, setPending] = useState(() => readRefundRetry(key));
  const [amount, setAmount] = useState(() => String(pending?.amount_usd ?? due.toFixed(2)));
  const [reference, setReference] = useState(pending?.reference || '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const invalid = pending ? null : validateRecordAmount(amount, due);
    if (invalid) { setError(invalid); return; }
    const input = pending || { amount_usd: Number(amount), request_id: crypto.randomUUID(), reference: reference.trim() || undefined };
    // Persist before sending. If storage is unavailable, do not risk a duplicate after reload.
    try { localStorage.setItem(key, JSON.stringify(input)); }
    catch { setError('This browser cannot save a safe refund retry. Enable local storage and try again.'); return; }
    setPending(input); setBusy(true); setError(null);
    try {
      await api.invoices.recordRefund(invoiceId, input);
      localStorage.removeItem(key);
      setPending(null); setSaved(true); onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not confirm the refund record. Retry the same record.'); }
    finally { setBusy(false); }
  };
  return <section aria-label="Refund" className="mt-3 border border-tea-border rounded-xl bg-tea-surface p-4">
    <h4 className={`${TYPOGRAPHY_CLASSES.label} text-tea-text`}>Refund</h4>
    <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text-sec mt-2`}>{money(refunded)} returned · {money(due)} still to return</p>
    {saved ? <p role="status" className="text-ui-13 text-tea-text mt-3">Refund recorded. Refreshing the order…</p> : (due > 0 || pending) && <form onSubmit={submit} className="mt-3 space-y-3">
      <p className="text-ui-13 text-tea-text-sec">Record money you have already returned to the customer.</p>
      <div className="flex flex-wrap gap-3">
        <label className="flex-1 min-w-0 text-ui-13 text-tea-text-sec">Returned USD<input aria-label="Refund amount USD" type="number" min="0.01" step="0.01" value={amount} disabled={busy || !!pending} onChange={event => setAmount(event.target.value)} className="w-full min-h-11 bg-tea-bg border border-tea-border rounded-md px-3 mt-1" /></label>
        <label className="flex-1 min-w-0 text-ui-13 text-tea-text-sec">Reference<input value={reference} disabled={busy || !!pending} onChange={event => setReference(event.target.value)} className="w-full min-h-11 bg-tea-bg border border-tea-border rounded-md px-3 mt-1" /></label>
      </div>
      {error && <p role="alert" className="text-ui-13 text-tea-text">{error}</p>}
      <button disabled={busy} className="min-h-11 px-4 rounded-md cta-solid text-ui-13 disabled:opacity-50">{busy ? 'Recording…' : pending ? 'Retry refund record' : 'Record refund sent'}</button>
    </form>}
  </section>;
}
