import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import type { LedgerLineItem } from '../../lib/ledgerStore';
import { orderMoney } from '../CurateV2/curatePricing';
import { SHOP_ORDERS_KEY, shopOrderAsTransaction, useShopOrders, type ShopOrder } from '../CurateV2/shopOrders';
import { OrderMessageSheet } from '../CurateV2/OrderMessageSheet';
import { AGENT_KEYS } from '../CurateV2/AgentInbox';
import { money } from './BuyingBasket';
import { Icons } from '../Icons';

// In process (canvas Flow 4, plan samples-to-orders.md build 4): every placed
// purchase order, by supplier and route, through Placed, Sent to supplier,
// Shipped and Received. These are the shop's own purchase orders, the same
// records Curate's Orders reads; nothing here keeps a copy.
//
// A tracking number, typed here or set by an agent (set_order_tracking), marks
// the parcel Shipped. Receive accepts each tea's waiting receipt, which puts it
// on the shelf with what it cost, exactly as Curate's Arrived does.

export const IN_PROCESS_STATUSES = ['confirmed', 'sent', 'shipped'];
const STEPS = ['Placed', 'Sent to supplier', 'Shipped', 'Received'];
const stepOf = (status: string) => Math.max(0, ['confirmed', 'sent', 'shipped', 'received'].indexOf(status));

function amountWords(item: LedgerLineItem): string {
  if (!item.priceIsPerGram && item.quantityUnits) {
    const word = String(item.form || (item.type === 'Teaware' ? 'piece' : 'piece')).toLowerCase();
    return `${item.quantityUnits} ${item.quantityUnits === 1 ? word : `${word}s`}`;
  }
  const g = item.quantityGrams ?? 0;
  return g >= 1000 ? `${Math.round(g / 100) / 10} kg` : `${g} g`;
}

const TrackingField: React.FC<{ order: ShopOrder; onSave: (text: string) => Promise<void> }> = ({ order, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  if (editing) {
    return <input ref={ref} aria-label={`Tracking number for ${order.vendorName}`} value={draft} onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); if (draft.trim() !== (order.trackingNumber ?? '')) void onSave(draft); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
      className="h-8 flex-1 min-w-0 px-2.5 bg-transparent border border-tea-border focus:border-tea-gold rounded-md outline-none font-mono text-ui-13 text-tea-text" />;
  }
  if (order.trackingNumber) {
    return <button type="button" onClick={() => { setDraft(order.trackingNumber ?? ''); setEditing(true); }} aria-label={`Tracking number for ${order.vendorName}`}
      className="min-w-0 truncate text-left text-ui-12 text-tea-text-sec">Tracking <span className="font-mono text-tea-text">{order.trackingNumber}</span></button>;
  }
  return <button type="button" onClick={() => { setDraft(''); setEditing(true); }}
    className="h-8 flex-1 min-w-0 px-2.5 border border-dashed border-tea-border rounded-md text-left text-ui-12 text-tea-text-sec hover:text-tea-text">Paste a tracking number</button>;
};

const OrderRow: React.FC<{ order: ShopOrder; onReceived: (text: string) => void }> = ({ order, onReceived }) => {
  const queryClient = useQueryClient();
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const [messaging, setMessaging] = useState(false);
  const [messaged, setMessaged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const step = stepOf(order.status);
  const tx = shopOrderAsTransaction(order);
  const totals = orderMoney(tx);
  const refresh = () => queryClient.invalidateQueries({ queryKey: SHOP_ORDERS_KEY });
  const run = async (work: () => Promise<void>) => {
    setBusy(true); setNote(null);
    try { await work(); } catch (e) { setNote({ text: e instanceof Error ? e.message : 'Could not save. Try again.', error: true }); }
    finally { setBusy(false); void refresh(); }
  };
  const setStatus = (status: string) => run(async () => { await api.purchaseOrders.updateStatus(order.id, status); });
  const saveTracking = (text: string) => run(async () => {
    await api.purchaseOrders.setTracking(order.id, text);
    // A parcel with a tracking number has left; the agent tool does the same.
    if (text.trim() && order.status !== 'shipped') await api.purchaseOrders.updateStatus(order.id, 'shipped');
  });
  const receive = () => run(async () => {
    const teaIds = new Set(order.items.map((i) => i.compassEntryId).filter(Boolean) as string[]);
    const { pending } = await api.compass.pendingReceipts();
    const mine = pending.filter((r) => r.compass_entry_id && teaIds.has(r.compass_entry_id));
    for (const r of mine) {
      await api.compass.acceptReceiptProposal(r.id);
      if (r.compass_entry_id) updateEntry(r.compass_entry_id, { status: 'in_stock' });
    }
    await api.purchaseOrders.updateStatus(order.id, 'received');
    void queryClient.invalidateQueries({ queryKey: AGENT_KEYS.arriving });
    // The order leaves this list once received, so the screen says what happened.
    onReceived(mine.length === 1 ? `${order.vendorName}: one tea is in Stock with what it cost.` : mine.length ? `${order.vendorName}: ${mine.length} teas are in Stock with what they cost.` : `${order.vendorName}: received. No tea on it was waiting to be shelved.`);
  });

  const action = step === 0
    ? (messaged
      ? <button type="button" disabled={busy} onClick={() => void setStatus('sent')} className="text-ui-13 text-tea-gold-lt">Mark sent</button>
      : <button type="button" onClick={() => { setMessaging(true); setMessaged(true); }} className="text-ui-13 text-tea-gold-lt">Send message ›</button>)
    : step === 1
      ? <button type="button" disabled={busy} onClick={() => void setStatus('shipped')} className="text-ui-13 text-tea-text-sec hover:text-tea-text">Mark shipped</button>
      : <button type="button" disabled={busy} onClick={() => void receive()} className="text-ui-13 text-tea-gold-lt">Receive ›</button>;

  return (
    <div data-testid="in-process-order" className="py-3 border-b border-tea-border">
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="truncate font-display text-[19px] font-semibold leading-tight text-tea-text">{order.vendorName}</span>
        {order.shipMode && <span className={`shrink-0 text-ui-12 ${order.shipMode === 'air' ? 'text-tea-gold-lt' : 'text-tea-text-sec'}`}>{order.shipMode === 'air' ? 'air' : 'boat'}</span>}
        <span className="ml-auto shrink-0 num text-ui-14 text-tea-text">{totals.parts.map((p) => money(p.amount, p.currency)).join(' + ')}</span>
      </div>
      <p className="mt-0.5 truncate text-ui-12 text-tea-text-sec">{order.items.map((i) => `${i.name} · ${amountWords(i)}`).join(', ')}</p>
      <ol aria-label={`${order.vendorName}, ${STEPS[step]}`} className="grid grid-cols-4 gap-[3px] mt-2.5">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? 'step' : undefined}
            className={`pt-1 border-t-2 text-ui-10 leading-tight ${i <= step ? 'border-tea-gold text-tea-text' : 'border-tea-border text-tea-text-dim'}`}>{label}</li>
        ))}
      </ol>
      <div className="flex items-center gap-3 mt-2.5 min-w-0">
        <TrackingField order={order} onSave={saveTracking} />
        <span className="ml-auto shrink-0">{action}</span>
      </div>
      {note && <p role={note.error ? 'alert' : 'status'} className={`mt-1.5 text-ui-12 ${note.error ? 'text-tea-error' : 'text-tea-text-sec'}`}>{note.text}</p>}
      <OrderMessageSheet tx={messaging ? tx : null} onOpenChange={(open) => { if (!open) setMessaging(false); }} />
    </div>
  );
};

export const InProcess: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const shop = useShopOrders();
  const orders = shop.orders.filter((o) => IN_PROCESS_STATUSES.includes(o.status));
  const [received, setReceived] = useState<string[]>([]);
  return <>
    <div className="flex items-center gap-2 pl-2 pr-4 min-h-[52px] shrink-0 border-b border-tea-border">
      <button type="button" onClick={onClose} aria-label="Close in process" className="min-w-[44px] min-h-[44px] flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors">
        <Icons.Close className="w-5 h-5" />
      </button>
      <h2 className="font-display text-[22px] leading-none text-tea-text">In process</h2>
      <span className="num text-ui-12 text-tea-text-sec">{orders.length}</span>
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto tea-card-scroll px-4 pb-nav-gap">
      {received.map((text) => <p key={text} role="status" className="pt-3 text-ui-13 text-tea-text">{text}</p>)}
      {shop.loading ? <p className="py-8 text-ui-13 text-tea-text-sec">Loading the orders…</p>
        : shop.failed ? <p role="alert" className="py-8 text-ui-13 text-tea-error">Could not read the orders. Try again in a moment.</p>
        : orders.length === 0 ? <p className="py-8 text-ui-15 text-tea-text">{received.length ? 'Nothing else on its way.' : 'Nothing on its way.'} Orders placed from Buying show here.</p>
        : orders.map((o) => <OrderRow key={o.id} order={o} onReceived={(text) => setReceived((r) => [...r, text])} />)}
      <p className="py-3 text-ui-12 leading-relaxed text-tea-text-dim">An agent can add tracking too, from a forwarder's email or a WeChat message. Received orders move into Stock.</p>
    </div>
  </>;
};
