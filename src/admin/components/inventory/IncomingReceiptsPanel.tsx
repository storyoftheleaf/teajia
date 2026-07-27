import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, PackageCheck } from 'lucide-react';
import { api } from '../../../lib/api';
import type { InventoryReceipt } from '../../types';

export function IncomingReceiptsPanel({ onClose, receiptId }: { onClose: () => void; receiptId?: string | null }) {
  const [receipts, setReceipts] = useState<InventoryReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await api.inventoryReceipts.list(Boolean(receiptId));
      setReceipts(receiptId ? loaded.filter(receipt => receipt.id === receiptId) : loaded);
      setError(null);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load incoming stock.'); }
    finally { setLoading(false); }
  }, [receiptId]);
  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, action: () => Promise<unknown>) => {
    setWorking(key); setError(null);
    try { await action(); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'That change could not be saved. Try again.'); }
    finally { setWorking(null); }
  };

  const title = receiptId ? 'Receipt details' : 'Incoming stock';

  return <section className="flex-1 min-h-0 overflow-auto pb-nav-gap bg-tea-bg" aria-label={title}>
    <div className="sticky top-0 z-10 bg-tea-bg border-b border-tea-border px-4 py-3 flex items-center gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <button className="tap-target text-tea-text-sec hover:text-tea-text" onClick={onClose} aria-label="Back to inventory"><ArrowLeft size={20}/></button>
        <div><h2 className="font-display text-ui-20 text-tea-text">{title}</h2><p className="text-ui-12 text-tea-text-sec">{receiptId ? 'The finalized vendor receipt and its inventory movements.' : 'Expected stock stays separate from current on-hand stock until it arrives.'}</p></div>
      </div>
    </div>
    <div className="max-w-3xl mx-auto p-4 space-y-3">
      {error && <div role="alert" className="border border-tea-border bg-tea-elevated rounded-md px-3 py-2 text-ui-12 text-tea-text">{error} <button onClick={() => void load()} className="ml-2 underline text-tea-text-sec hover:text-tea-text">Try again</button></div>}
      {loading && <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-tea-gold"/></div>}
      {!loading && receipts.length === 0 && <div className="py-16 text-center"><PackageCheck className="mx-auto text-tea-text-sec mb-3"/><p className="font-display text-ui-17 text-tea-text">{receiptId ? 'Receipt not found' : 'Nothing on the way'}</p></div>}
      {receipts.map(receipt => <article key={receipt.id} className="border border-tea-border bg-tea-surface rounded-xl overflow-hidden">
        <header className="px-4 py-3 border-b border-tea-border flex flex-wrap items-start justify-between gap-2">
          <div><div className="font-display text-ui-15 text-tea-text">{receipt.vendor_name || (receipt.legacy ? 'Earlier incoming stock' : 'Incoming receipt')}</div><div className="text-ui-11 text-tea-text-sec">{[receipt.source_kind, receipt.source_ref].filter(Boolean).join(' · ')}</div></div>
          <div className="flex flex-wrap items-center gap-2"><span className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-sec">{receipt.state.replace('_',' ')}</span>{!receipt.legacy && receipt.state === 'planned' && <button disabled={working === receipt.id} onClick={() => void act(receipt.id, () => api.inventoryReceipts.updateState(receipt.id, 'ordered'))} className="min-h-11 px-3 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Mark ordered</button>}{!receipt.legacy && receipt.state === 'ordered' && <button disabled={working === receipt.id} onClick={() => void act(receipt.id, () => api.inventoryReceipts.updateState(receipt.id, 'in_transit'))} className="min-h-11 px-3 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Mark in transit</button>}</div>
        </header>
        <div className="divide-y divide-tea-border">{receipt.lines.map(line => {
          const expected = Number(line.expected_quantity); const received = Number(line.received_quantity); const cancelled = Number(line.cancelled_quantity); const remaining = Math.max(0, expected - received - cancelled);
          const value = quantities[line.id] ?? String(remaining);
          return <div key={line.id} className="p-4 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0"><div className="text-ui-14 text-tea-text truncate">{line.product_name}</div><div className="text-ui-12 text-tea-text-sec">Expected: {expected} {line.unit} · Current on hand: {Number(line.current_on_hand ?? received)} {line.unit} · Received here: {received} {line.unit} · Remaining: {remaining} {line.unit}</div><div className="text-ui-11 text-tea-text-sec">Purpose: {line.intended_purpose}{line.source_ref ? ` · Source: ${line.source_ref}` : ''}</div></div>
            {!receipt.legacy && remaining > 0 && <div className="flex flex-wrap items-end gap-2"><label className="text-ui-11 text-tea-text-sec">Quantity received<input aria-label={`Quantity received for ${line.product_name}`} type="number" min="0" max={remaining} step={line.unit === 'unit' ? 1 : 'any'} value={value} disabled={working === line.id} onChange={event => setQuantities(current => ({ ...current, [line.id]: event.target.value }))} className="block mt-1 w-24 min-h-11 rounded-md border border-tea-border bg-tea-bg px-2 text-ui-13 text-tea-text"/></label><button disabled={working===line.id} onClick={() => void act(line.id, () => api.inventoryReceipts.cancelRemaining(line.id))} className="min-h-11 px-3 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Cancel remaining</button><button disabled={working===line.id || !Number(value) || Number(value) > remaining} onClick={() => void act(line.id, () => api.inventoryReceipts.receive(line.id, Number(value)))} className="min-h-11 px-4 rounded-md cta-solid text-ui-12 font-medium disabled:opacity-50">{working===line.id ? 'Saving…' : 'Receive'}</button></div>}
          </div>;
        })}</div>
      </article>)}
    </div>
  </section>;
}
