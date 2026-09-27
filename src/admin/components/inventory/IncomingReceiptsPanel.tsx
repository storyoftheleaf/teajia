import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, PackageCheck } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { useAppStore } from '../../../lib/store';
import type { InventoryReceipt } from '../../types';

interface PendingReceive {
  lineId: string;
  quantity: number;
  key: string;
  confirmed: boolean;
}

function readPendingReceive(key: string): PendingReceive | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null');
    return value && typeof value.lineId === 'string' && typeof value.key === 'string'
      && Number.isFinite(value.quantity) && value.quantity > 0 && typeof value.confirmed === 'boolean'
      ? value as PendingReceive : null;
  } catch { return null; }
}

function validReceiveQuantity(quantity: number, remaining: number, unit: string): boolean {
  return Number.isFinite(quantity) && quantity > 0 && quantity <= remaining
    && (unit !== 'unit' || Number.isInteger(quantity));
}

export function IncomingReceiptsPanel({ onClose, receiptId }: { onClose: () => void; receiptId?: string | null }) {
  const accountId = useAppStore(state => state.activeAccountId);
  const pendingKey = `teajia:pending-receive:${accountId || 'no-account'}`;
  const [receipts, setReceipts] = useState<InventoryReceipt[]>([]);
  const [receiptsScope, setReceiptsScope] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [pendingReceive, setPendingReceive] = useState<PendingReceive | null>(() => readPendingReceive(pendingKey));
  const pendingReceiveRef = useRef<PendingReceive | null>(pendingReceive);
  const workingRef = useRef(false);
  const scopeRef = useRef(pendingKey);
  const scopeEpochRef = useRef(0);
  const loadIdRef = useRef(0);
  if (scopeRef.current !== pendingKey) {
    scopeRef.current = pendingKey;
    scopeEpochRef.current += 1;
  }
  useEffect(() => {
    setReceipts([]);
    setReceiptsScope(null);
    setQuantities({});
    setError(null);
    setStale(false);
    setLoading(true);
    workingRef.current = false;
    setWorking(null);
    const restored = readPendingReceive(pendingKey);
    pendingReceiveRef.current = restored;
    setPendingReceive(restored);
  }, [pendingKey]);
  const rememberReceive = (intent: PendingReceive | null, scopeKey: string, scopeEpoch: number) => {
    if (scopeRef.current !== scopeKey || scopeEpochRef.current !== scopeEpoch) return;
    pendingReceiveRef.current = intent;
    setPendingReceive(intent);
    try {
      if (intent) sessionStorage.setItem(scopeKey, JSON.stringify(intent));
      else sessionStorage.removeItem(scopeKey);
    } catch { /* The mounted panel still retains the key if storage is unavailable. */ }
  };
  const load = useCallback(async () => {
    const scopeKey = pendingKey;
    const scopeEpoch = scopeEpochRef.current;
    const loadId = ++loadIdRef.current;
    const isCurrent = () => scopeRef.current === scopeKey && scopeEpochRef.current === scopeEpoch && loadIdRef.current === loadId;
    setLoading(true);
    try {
      const loaded = await api.inventoryReceipts.list(Boolean(receiptId));
      if (!isCurrent()) return false;
      setReceipts(receiptId ? loaded.filter(receipt => receipt.id === receiptId) : loaded);
      setReceiptsScope(scopeKey);
      setError(pendingReceiveRef.current && !pendingReceiveRef.current.confirmed
        ? 'This receive has not been confirmed. Retry Receive with the original request before changing stock again.'
        : null);
      setStale(Boolean(pendingReceiveRef.current && !pendingReceiveRef.current.confirmed));
      if (pendingReceiveRef.current?.confirmed) {
        const completedLineId = pendingReceiveRef.current.lineId;
        setQuantities(current => {
          const next = { ...current };
          delete next[completedLineId];
          return next;
        });
        pendingReceiveRef.current = null;
        setPendingReceive(null);
        try { sessionStorage.removeItem(scopeKey); } catch { /* Storage may be blocked. */ }
      }
      return true;
    }
    catch (cause) {
      if (!isCurrent()) return false;
      setStale(true);
      setError(cause instanceof Error ? cause.message : 'Could not load incoming stock.');
      return false;
    }
    finally { if (isCurrent()) setLoading(false); }
  }, [receiptId, pendingKey]);
  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, action: () => Promise<unknown>) => {
    if (workingRef.current || stale || pendingReceiveRef.current) return;
    const scopeKey = pendingKey;
    const scopeEpoch = scopeEpochRef.current;
    const isCurrent = () => scopeRef.current === scopeKey && scopeEpochRef.current === scopeEpoch;
    workingRef.current = true;
    setWorking(key); setError(null);
    try {
      await action();
      if (!isCurrent()) return;
      setStale(true);
      if (!await load() && isCurrent()) setError('The change was saved, but the current receipt could not be refreshed. Retry the refresh before changing stock again.');
    }
    catch (cause) { if (isCurrent()) setError(cause instanceof Error ? cause.message : 'That change could not be saved. Try again.'); }
    finally { if (isCurrent()) { workingRef.current = false; setWorking(null); } }
  };

  const receive = async (lineId: string, quantity: number) => {
    if (workingRef.current) return;
    const scopeKey = pendingKey;
    const scopeEpoch = scopeEpochRef.current;
    const isCurrent = () => scopeRef.current === scopeKey && scopeEpochRef.current === scopeEpoch;
    let intent = pendingReceiveRef.current;
    if (intent && (intent.lineId !== lineId || intent.confirmed)) return;
    if (!intent) {
      if (stale) return;
      const line = receiptsScope === scopeKey ? receipts.flatMap(receipt => receipt.lines).find(item => item.id === lineId) : null;
      const remaining = line ? Math.max(0, Number(line.expected_quantity) - Number(line.received_quantity) - Number(line.cancelled_quantity)) : 0;
      if (!line || !validReceiveQuantity(quantity, remaining, line.unit)) {
        setError(line?.unit === 'unit' ? 'Enter a whole number of units within the remaining quantity.' : 'Enter a positive quantity within the remaining amount.');
        return;
      }
      intent = { lineId, quantity, key: crypto.randomUUID(), confirmed: false };
      rememberReceive(intent, scopeKey, scopeEpoch);
    }
    workingRef.current = true;
    setWorking(lineId);
    setError(null);
    try {
      await api.inventoryReceipts.receive(intent.lineId, intent.quantity, intent.key);
      if (!isCurrent()) return;
      rememberReceive({ ...intent, confirmed: true }, scopeKey, scopeEpoch);
      setStale(true);
      if (!await load() && isCurrent()) setError('Stock was received, but the current quantities could not be refreshed. Retry the refresh before receiving more.');
    } catch (cause) {
      if (!isCurrent()) return;
      if (cause instanceof ApiError && (cause.status === 400 || cause.status === 409)) {
        rememberReceive(null, scopeKey, scopeEpoch);
        setStale(false);
        setError(cause.message);
        return;
      }
      setStale(true);
      setError(`Could not confirm whether stock was received: ${cause instanceof Error ? cause.message : 'request failed'}. Retry Receive to reuse the same request; other stock changes are paused.`);
    } finally {
      if (isCurrent()) {
        workingRef.current = false;
        setWorking(null);
      }
    }
  };

  const title = receiptId ? 'Receipt details' : 'Incoming stock';
  const visibleReceipts = receiptsScope === pendingKey ? receipts : [];

  return <section className="flex-1 min-h-0 overflow-auto pb-nav-gap bg-tea-bg" aria-label={title}>
    <div className="sticky top-0 z-10 bg-tea-bg border-b border-tea-border px-4 py-3 flex items-center gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <button className="tap-target text-tea-text-sec hover:text-tea-text" onClick={onClose} aria-label="Back to inventory"><ArrowLeft size={20}/></button>
        <div><h2 className="font-display text-ui-20 text-tea-text">{title}</h2><p className="text-ui-12 text-tea-text-sec">{receiptId ? 'The finalized vendor receipt and its inventory movements.' : 'Expected stock stays separate from current on-hand stock until it arrives.'}</p></div>
      </div>
    </div>
    <div className="max-w-3xl mx-auto p-4 space-y-3">
      {error && <div role="alert" className="border border-tea-border bg-tea-elevated rounded-md px-3 py-2 text-ui-12 text-tea-text">{error} {pendingReceive && !pendingReceive.confirmed
        ? <button disabled={Boolean(working)} onClick={() => void receive(pendingReceive.lineId, pendingReceive.quantity)} className="ml-2 min-h-11 underline text-tea-text-sec hover:text-tea-text disabled:opacity-50">Retry Receive</button>
        : <button onClick={() => void load()} className="ml-2 min-h-11 underline text-tea-text-sec hover:text-tea-text">Try again</button>}</div>}
      {loading && <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-tea-gold"/></div>}
      {!loading && visibleReceipts.length === 0 && <div className="py-16 text-center"><PackageCheck className="mx-auto text-tea-text-sec mb-3"/><p className="font-display text-ui-17 text-tea-text">{receiptId ? 'Receipt not found' : 'Nothing on the way'}</p></div>}
      {visibleReceipts.map(receipt => <article key={receipt.id} className="border border-tea-border bg-tea-surface rounded-xl overflow-hidden">
        <header className="px-4 py-3 border-b border-tea-border flex flex-wrap items-start justify-between gap-2">
          <div><div className="font-display text-ui-15 text-tea-text">{receipt.vendor_name || (receipt.legacy ? 'Earlier incoming stock' : 'Incoming receipt')}</div><div className="text-ui-11 text-tea-text-sec">{[receipt.source_kind, receipt.source_ref].filter(Boolean).join(' · ')}</div></div>
          <div className="flex flex-wrap items-center gap-2"><span className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-sec">{receipt.state.replace('_',' ')}</span>{!receipt.legacy && receipt.state === 'planned' && <button disabled={Boolean(working || stale || pendingReceive)} onClick={() => void act(receipt.id, () => api.inventoryReceipts.updateState(receipt.id, 'ordered'))} className="min-h-11 px-3 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Mark ordered</button>}{!receipt.legacy && receipt.state === 'ordered' && <button disabled={Boolean(working || stale || pendingReceive)} onClick={() => void act(receipt.id, () => api.inventoryReceipts.updateState(receipt.id, 'in_transit'))} className="min-h-11 px-3 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Mark in transit</button>}</div>
        </header>
        <div className="divide-y divide-tea-border">{receipt.lines.map(line => {
          const expected = Number(line.expected_quantity); const received = Number(line.received_quantity); const cancelled = Number(line.cancelled_quantity); const remaining = Math.max(0, expected - received - cancelled);
          const value = quantities[line.id] ?? String(remaining);
          return <div key={line.id} className="p-4 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0"><div className="text-ui-14 text-tea-text truncate">{line.product_name}</div><div className="text-ui-12 text-tea-text-sec">Expected: {expected} {line.unit} · Current on hand: {Number(line.current_on_hand ?? received)} {line.unit} · Received here: {received} {line.unit} · Remaining: {remaining} {line.unit}</div><div className="text-ui-11 text-tea-text-sec">Purpose: {line.intended_purpose}{line.source_ref ? ` · Source: ${line.source_ref}` : ''}</div></div>
            {!receipt.legacy && remaining > 0 && <div className="flex flex-wrap items-end gap-2"><label className="text-ui-11 text-tea-text-sec">Quantity received<input aria-label={`Quantity received for ${line.product_name}`} type="number" min="0" max={remaining} step={line.unit === 'unit' ? 1 : 'any'} value={pendingReceive?.lineId === line.id ? String(pendingReceive.quantity) : value} disabled={Boolean(working || stale || pendingReceive)} onChange={event => setQuantities(current => ({ ...current, [line.id]: event.target.value }))} className="block mt-1 w-24 min-h-11 rounded-md border border-tea-border bg-tea-bg px-2 text-ui-13 text-tea-text disabled:opacity-50"/></label><button disabled={Boolean(working || stale || pendingReceive)} onClick={() => void act(line.id, () => api.inventoryReceipts.cancelRemaining(line.id))} className="min-h-11 px-3 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Cancel remaining</button><button disabled={Boolean(working || pendingReceive || stale || !validReceiveQuantity(Number(value), remaining, line.unit))} onClick={() => void receive(line.id, Number(value))} className="min-h-11 px-4 rounded-md cta-solid text-ui-12 font-medium disabled:opacity-50">{working===line.id ? 'Saving…' : 'Receive'}</button></div>}
          </div>;
        })}</div>
      </article>)}
    </div>
  </section>;
}
