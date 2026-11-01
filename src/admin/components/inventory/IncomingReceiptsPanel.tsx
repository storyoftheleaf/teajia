import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { refreshCommerceQueries } from '../../../lib/refreshCommerce';
import { Link } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES as T } from '../../../designTokens';
import { ArrowLeft, Loader2, PackageCheck } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { useAppStore } from '../../../lib/store';
import type { InventoryReceipt, ReceiptTransportMode } from '../../types';
import { TRANSPORT_LABELS, dueLabel, groupIncoming } from './incomingGroups';

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

export function IncomingReceiptsPanel({ onClose, receiptId, backLabel = 'Back to inventory' }: { onClose: () => void; receiptId?: string | null; backLabel?: string }) {
  const queryClient = useQueryClient();
  const accountId = useAppStore(state => state.activeAccountId);
  const pendingKey = `teajia:pending-receive:${accountId || 'no-account'}`;
  const [receipts, setReceipts] = useState<InventoryReceipt[]>([]);
  const [receiptsScope, setReceiptsScope] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [modeFilter, setModeFilter] = useState<'all' | ReceiptTransportMode>('all');
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
      await refreshCommerceQueries(queryClient, accountId);
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
      await refreshCommerceQueries(queryClient, accountId);
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

  return <section className="purchase-tracking font-sans text-ui-12 flex-1 min-h-0 overflow-auto pb-nav-gap bg-tea-bg" aria-label={title}>
    <div className="sticky top-0 z-10 bg-tea-bg border-b border-tea-border px-4 py-3 flex items-center gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <button className="tap-target text-tea-text-sec hover:text-tea-text" onClick={onClose} aria-label={backLabel}><ArrowLeft size={20}/></button>
        <div><h2 className={`${T.h3} text-tea-text`}>{title}</h2><p className="text-ui-12 text-tea-text-sec">{receiptId ? 'The finalized vendor receipt and its inventory movements.' : 'Expected stock stays separate from current on-hand stock until it arrives.'}</p></div>
      </div>
    </div>
    <div className="max-w-3xl mx-auto p-4 space-y-3">
      {error && <div role="alert" className="border border-tea-border bg-tea-elevated rounded-md px-3 py-2 text-ui-12 text-tea-text">{error} {pendingReceive && !pendingReceive.confirmed
        ? <button disabled={Boolean(working)} onClick={() => void receive(pendingReceive.lineId, pendingReceive.quantity)} className="ml-2 min-h-11 underline text-tea-text-sec hover:text-tea-text disabled:opacity-50">Retry Receive</button>
        : <button onClick={() => void load()} className="ml-2 min-h-11 underline text-tea-text-sec hover:text-tea-text">Try again</button>}</div>}
      {loading && <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-tea-gold"/></div>}
      {!loading && visibleReceipts.length === 0 && <div className="py-16 text-center"><PackageCheck className="mx-auto text-tea-text-sec mb-3"/><p className="font-display text-ui-17 text-tea-text">{receiptId ? 'Receipt not found' : 'Nothing on the way'}</p></div>}
      {visibleReceipts.length > 0 && <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-ui-12 text-tea-text-sec">
        <span><span className="font-mono text-tea-text">{visibleReceipts.length}</span> {visibleReceipts.length === 1 ? 'delivery' : 'deliveries'}</span>
        <span className="flex-1" />
        {(['all', ...Object.keys(TRANSPORT_LABELS)] as Array<'all' | ReceiptTransportMode>).filter(mode => mode === 'all' || visibleReceipts.some(r => r.transport_mode === mode)).map(mode => <button key={mode} type="button" aria-pressed={modeFilter === mode} onClick={() => setModeFilter(mode)} className={`min-h-9 px-3 rounded-full border text-ui-12 ${modeFilter === mode ? 'border-tea-gold text-tea-gold' : 'border-tea-border text-tea-text-sec'}`}>{mode === 'all' ? 'All' : TRANSPORT_LABELS[mode]}</button>)}
      </div>}
      {groupIncoming(visibleReceipts.filter(r => modeFilter === 'all' || r.transport_mode === modeFilter)).map(group => <section key={group.key} aria-label={`Coming from ${group.label}`} className="space-y-2">
        <div className="flex items-baseline justify-between gap-3 pt-2">
          <h3 className="font-display text-ui-17 text-tea-text">{group.label}</h3>
          <span className="font-mono text-ui-11 text-tea-text-sec">{[group.remainingGrams > 0 ? `${group.remainingGrams.toLocaleString('en-US')} g` : null, group.remainingUnits > 0 ? `${group.remainingUnits} pc` : null].filter(Boolean).join(' · ') || 'nothing left to arrive'}</span>
        </div>
        {group.receipts.map(receipt => <article key={receipt.id} className="border border-tea-border bg-tea-surface rounded-xl overflow-hidden">
        <header className="purchase-receiving-heading">
          <span className="text-tea-text-sec">{receipt.state.replace(/_/g,' ')}{!['received','cancelled'].includes(receipt.state) && dueLabel(receipt.eta) ? ` · ${dueLabel(receipt.eta)!.text}` : ''}</span>
          <div className="flex flex-wrap items-center gap-2">{!receipt.legacy && <select aria-label={`How the delivery from ${receipt.vendor_name || 'this supplier'} travels`} value={receipt.transport_mode ?? ''} disabled={Boolean(working || stale || pendingReceive)} onChange={event => { const mode = (event.target.value || null) as ReceiptTransportMode | null; void act(`transport:${receipt.id}`, () => api.inventoryReceipts.updateTransport(receipt.id, mode)); }} className="purchase-tracking-button min-h-11"><option value="">How it travels</option>{(Object.keys(TRANSPORT_LABELS) as ReceiptTransportMode[]).map(mode => <option key={mode} value={mode}>{TRANSPORT_LABELS[mode]}</option>)}</select>}{!receipt.legacy && receipt.state === 'planned' && <button disabled={Boolean(working || stale || pendingReceive)} onClick={() => void act(receipt.id, () => api.inventoryReceipts.updateState(receipt.id, 'ordered'))} className="tap-target purchase-tracking-button">Mark ordered</button>}{!receipt.legacy && receipt.state === 'ordered' && <button disabled={Boolean(working || stale || pendingReceive)} onClick={() => void act(receipt.id, () => api.inventoryReceipts.updateState(receipt.id, 'in_transit'))} className="tap-target purchase-tracking-button">Mark in transit</button>}</div>
        </header>
        <div className="purchase-receiving-items">{receipt.lines.map(line => {
          const expected = Number(line.expected_quantity); const received = Number(line.received_quantity); const cancelled = Number(line.cancelled_quantity); const remaining = Math.max(0, expected - received - cancelled);
          const value = quantities[line.id] ?? String(remaining);
          const unit = line.unit === 'unit' ? 'pc' : 'g';
          return <div key={line.id} className="purchase-tracking-item">
            <div className="purchase-tracking-item-title"><h3 className={T.h3}>{line.product_name}</h3><Link to={`/admin/stock?panel=${encodeURIComponent(line.product_id)}`} className="tap-target purchase-tracking-button">Stock</Link></div>
            <div className="purchase-tracking-quantities"><span>Ordered <strong>{expected} {unit}</strong></span><span>Arrived <strong>{received} {unit}</strong></span><span>Coming <strong>{remaining} {unit}</strong></span></div>
            {!receipt.legacy && remaining > 0 && <div className="purchase-receiving-arrival"><span>Arriving now</span><div className="purchase-receiving-entry"><label><span className="sr-only">Quantity received</span><input aria-label={`Quantity received for ${line.product_name}`} type="number" min="0" max={remaining} step={line.unit === 'unit' ? 1 : 'any'} value={pendingReceive?.lineId === line.id ? String(pendingReceive.quantity) : value} disabled={Boolean(working || stale || pendingReceive)} onChange={event => setQuantities(current => ({ ...current, [line.id]: event.target.value }))}/><span>{unit}</span></label><button className="tap-target" disabled={Boolean(working || pendingReceive || stale || !validReceiveQuantity(Number(value), remaining, line.unit))} onClick={() => void receive(line.id, Number(value))}>{working===line.id ? 'Saving…' : 'Receive'}</button></div></div>}
            <details className="purchase-receiving-item-details"><summary className="tap-target">Stock and corrections</summary><div><p>Shelf stock: {Number(line.current_on_hand ?? received)} {unit} · Purpose: {line.intended_purpose}{cancelled > 0 ? ` · ${cancelled} ${unit} cancelled` : ''}</p><p>For a stock correction, open Stock. Use Arriving now to record a new delivery.</p>{!receipt.legacy && remaining > 0 && <button disabled={Boolean(working || stale || pendingReceive)} onClick={() => void act(line.id, () => api.inventoryReceipts.cancelRemaining(line.id))} className="tap-target purchase-tracking-button">Cancel remaining</button>}</div></details>
          </div>;
        })}</div>
        <details className="purchase-receiving-item-details"><summary className="tap-target">Receipt source</summary><p>{[receipt.source_kind, receipt.source_ref].filter(Boolean).join(' · ')}</p></details>
      </article>)}
      </section>)}
    </div>
  </section>;
}
