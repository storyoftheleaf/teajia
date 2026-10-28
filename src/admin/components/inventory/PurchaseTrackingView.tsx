import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Loader2, Plus, RefreshCw } from 'lucide-react';
import { api, type PurchaseOrder, type PurchaseTrackingRow } from '../../../lib/api';
import { useAppStore } from '../../../lib/store';
import { refreshCommerceQueries } from '../../../lib/refreshCommerce';
import { TYPOGRAPHY_CLASSES as T } from '../../../designTokens';
import { IncomingReceiptsPanel } from './IncomingReceiptsPanel';
import { PurchaseInvoiceEvidence } from './PurchaseInvoiceEvidence';
import { dueLabel, remainingOf, TRANSPORT_LABELS } from './incomingGroups';

export type PurchaseTrackingFilter = 'all' | 'attention' | 'coming' | 'received' | 'cancelled';
export const purchaseAttention = (row: PurchaseTrackingRow) => row.attention.filter(item => item.code !== 'partial_delivery');
export function purchaseTrackingStage(row: PurchaseTrackingRow): PurchaseTrackingFilter {
  if (row.invoice_draft && !row.receipt && !row.purchase) return 'attention';
  if (!row.receipt && row.purchase?.status === 'pending' && row.purchase.create_request_key?.startsWith('intake:')) return 'attention';
  if (row.receipt?.state === 'received' || (!row.receipt && row.purchase?.status === 'received')) return 'received';
  if (row.receipt?.state === 'cancelled' || (!row.receipt && row.purchase?.status === 'cancelled')) return 'cancelled';
  return 'coming';
}
export function matchesPurchaseTracking(row: PurchaseTrackingRow, filter: PurchaseTrackingFilter) {
  return filter === 'all' || (filter === 'attention' ? purchaseAttention(row).length > 0 : purchaseTrackingStage(row) === filter);
}
const date = (value?: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
const number = (value: number) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
const unit = (value: string) => value === 'unit' ? 'pc' : 'g';
const supplier = (row: PurchaseTrackingRow) => row.purchase?.vendor_name || row.receipt?.vendor_name || row.arrival_proposal?.vendor_name || 'Supplier not recorded';
function purchaseItems(purchase: PurchaseOrder | null): Array<{ name: string; quantity: number | null; unit: string }> {
  try {
    const parsed = JSON.parse(purchase?.items_json || '[]');
    return Array.isArray(parsed) ? parsed.map(item => ({ name: String(item.product_name || item.name || 'Unnamed item'), quantity: item.quantity ?? item.quantity_grams ?? null, unit: item.unit || 'g' })) : [];
  } catch { return []; }
}
function comingText(row: PurchaseTrackingRow) {
  if (row.arrival_proposal) return row.arrival_proposal.quantity == null ? 'Quantity to confirm' : `${number(row.arrival_proposal.quantity)} ${unit(row.arrival_proposal.unit || 'g')}`;
  if (!row.receipt) { const count = purchaseItems(row.purchase).length; return `${count} ${count === 1 ? 'item' : 'items'}`; }
  const { grams, units } = remainingOf(row.receipt);
  return [grams > 0 ? `${number(grams)} g` : '', units > 0 ? `${number(units)} pc` : ''].filter(Boolean).join(' + ');
}
function stageLabel(row: PurchaseTrackingRow) {
  if (purchaseAttention(row).length) return 'Needs attention';
  const stage = purchaseTrackingStage(row);
  if (stage === 'received') return 'Received';
  if (stage === 'cancelled') return 'Cancelled';
  return row.receipt?.state === 'partially_received' ? 'Part arrived' : row.receipt?.state === 'in_transit' ? 'On the way' : 'Coming';
}

function TrackingField({purchase, busy, save}: {purchase:PurchaseOrder; busy:boolean; save:(value:string)=>Promise<void>}) {
  const [value,setValue] = useState(purchase.tracking_number || '');
  useEffect(() => setValue(purchase.tracking_number || ''), [purchase.id,purchase.tracking_number]);
  const dirty = value.trim() !== (purchase.tracking_number || '');
  return <label>Tracking<input aria-label={`Tracking for ${purchase.vendor_name}`} value={value} onChange={event=>setValue(event.target.value)} disabled={busy}/>{dirty && <button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={()=>void save(value.trim())}>Save</button>}</label>;
}

type NewFormProps = { onClose: () => void; onSubmit: (data: Parameters<typeof api.purchaseOrders.create>[0]) => Promise<void>; submitting: boolean };
type MatchFormProps = { po: PurchaseOrder; onClose: () => void; onPrepared: (id: string) => void };
export function PurchaseTrackingView({ NewForm, MatchForm, initialOpen }: { NewForm: React.ComponentType<NewFormProps>; MatchForm: React.ComponentType<MatchFormProps>; initialOpen?: string | null }) {
  const accountId = useAppStore(state => state.activeAccountId);
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const view = params.get('view');
  const initialFilter: PurchaseTrackingFilter = view === 'coming' || view === 'attention' || view === 'received' || view === 'cancelled' ? view : 'all';
  const [filter, setFilter] = useState<PurchaseTrackingFilter>(initialFilter);
  const [vendor, setVendor] = useState('all');
  const [open, setOpen] = useState<string | null>(initialOpen || params.get('purchaseId'));
  const [manualReceipt, setManualReceipt] = useState<string | null>(null);
  const [newForm, setNewForm] = useState(false);
  const [match, setMatch] = useState<PurchaseOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ['purchase-tracking', accountId], queryFn: () => api.purchaseOrders.tracking(),
    staleTime: 15_000, refetchOnWindowFocus: true, refetchInterval: 60_000,
  });
  useEffect(() => { setOpen(initialOpen || params.get('purchaseId')); setManualReceipt(null); setMatch(null); setVendor('all'); setFilter(initialFilter); setError(''); }, [accountId, initialOpen, params]);
  const rows = data?.rows || [];
  const vendors = [...new Set(rows.filter(row => !row.invoice_draft || row.purchase || row.receipt).map(supplier))].sort();
  const scoped = rows.filter(row => vendor === 'all' || supplier(row) === vendor);
  const visible = scoped.filter(row => matchesPurchaseTracking(row, filter));
  const refresh = () => refreshCommerceQueries(queryClient, accountId);
  const mutate = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The change could not be saved.'); }
    finally { setBusy(false); }
  };
  const matchPurchase = async (purchase: PurchaseOrder) => {
    await mutate(async () => {
      const result = await api.purchaseOrders.prepareReceipt(purchase.id);
      if (result.receipt_id) { setOpen(purchase.id); }
      else setMatch(purchase);
    });
  };
  if (manualReceipt) return <IncomingReceiptsPanel receiptId={manualReceipt} backLabel="Back to purchases" onClose={() => { setManualReceipt(null); void refresh(); }} />;

  return <section className="purchase-tracking font-sans text-ui-12 text-tea-text bg-tea-bg pb-nav-gap" aria-label="Purchases and deliveries">
    <header className="purchase-tracking-header">
      <div><h1 className={T.h2}>Purchases</h1><p className="text-tea-text-sec">Coming, arrived and anything to resolve.</p></div>
      <div className="purchase-tracking-tools"><button type="button" className="tap-target purchase-tracking-button" disabled={isFetching} onClick={() => void refetch()} aria-label="Refresh purchases"><RefreshCw size={14} className={isFetching ? 'animate-spin' : ''}/></button><button type="button" className="tap-target purchase-tracking-button" onClick={() => setNewForm(true)}><Plus size={14}/>Add purchase</button></div>
    </header>
    <div className="purchase-tracking-filters">
      <div role="group" aria-label="Filter purchases" className="purchase-tracking-tabs">{([['all', 'All'], ['attention', 'Needs attention'], ['coming', 'Coming'], ['received', 'Received']] as const).map(([key, label]) => <button key={key} type="button" className="tap-target" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span className="text-tea-text-dim">{scoped.filter(row => matchesPurchaseTracking(row, key)).length}</span></button>)}</div>
      <label className="purchase-tracking-supplier"><span className="sr-only">Supplier</span><select aria-label="Filter supplier" value={vendor} onChange={event => setVendor(event.target.value)}><option value="all">All suppliers</option>{vendors.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    </div>
    {(error || isError) && <p role="alert" className="purchase-tracking-notice">{error || 'Purchases could not be refreshed.'}<button type="button" className="tap-target underline" onClick={() => void refetch()}>Try again</button></p>}
    {isPending && <p role="status" className="purchase-tracking-notice"><Loader2 size={16} className="animate-spin"/>Loading purchases…</p>}
    {!isPending && !isError && !visible.length && <p className="purchase-tracking-notice">{filter === 'attention' ? 'Nothing needs your attention.' : filter === 'received' ? 'No received purchases in this view.' : filter === 'coming' ? 'Nothing coming in this view.' : 'No purchases recorded yet.'}</p>}
    <div className="purchase-tracking-list">{visible.map(row => {
      const expanded = open === row.id || open === row.purchase?.id || open === row.receipt?.id;
      const attention = purchaseAttention(row);
      const receipt = row.receipt;
      const purchase = row.purchase;
      const items = receipt?.lines || [];
      const itemCount = row.invoice_draft && !purchase && !receipt ? row.invoice_draft.item_count : row.arrival_proposal ? 1 : items.length || purchaseItems(purchase).length;
      const title = row.invoice_draft && !purchase && !receipt ? row.invoice_draft.title || 'Invoice to review' : supplier(row);
      const legacy = Boolean(purchase?.create_request_key?.startsWith('intake:'));
      const remaining = comingText(row);
      const stage = purchaseTrackingStage(row);
      const due = stage === 'coming' ? dueLabel(receipt?.eta) : null;
      const transport = receipt?.transport_mode ? TRANSPORT_LABELS[receipt.transport_mode] : null;
      const total = purchase?.total_usd == null ? null : `$${number(purchase.total_usd)} USD`;
      return <article className="purchase-tracking-record" key={row.id} data-purchase-id={purchase?.id} data-receipt-id={receipt?.id}>
        <button type="button" className="purchase-tracking-open" aria-expanded={expanded} aria-label={`${expanded ? 'Close' : 'Open'} purchase from ${title}`} onClick={() => setOpen(expanded ? null : row.id)}>
          <div className="purchase-tracking-identity min-w-0"><h2 className={T.h3}>{title}</h2><div className="purchase-tracking-meta text-tea-text-sec"><span>{row.invoice_draft && !purchase && !receipt ? 'Invoice' : purchase?.po_number || date(purchase?.created_at) || 'Delivery'}</span><span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>{total && <span>{total}</span>}</div></div>
          <span className="purchase-tracking-status">{stageLabel(row)}{expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</span>
        </button>
        {stage !== 'attention' && <div className="purchase-tracking-summary"><span>{stage === 'received' ? `Received${row.history.length ? ` · ${date(row.history[0].recorded_at)}` : ''}` : stage === 'cancelled' ? 'Cancelled' : remaining ? `${remaining} coming` : 'No quantity recorded'}</span><span className="text-tea-text-sec">{[transport, due?.text, purchase?.tracking_number ? `Tracking ${purchase.tracking_number}` : null].filter(Boolean).join(' · ')}</span></div>}
        {attention.length > 0 && <div className="purchase-tracking-attention"><span>{attention.map(item => item.message).join(' ')}</span>{row.invoice_draft && <Link className="tap-target purchase-tracking-button" to={`/admin/intake?importId=${encodeURIComponent(row.invoice_draft.id)}`}>Review invoice</Link>}{purchase && !receipt && <button type="button" disabled={busy} className="tap-target purchase-tracking-button" onClick={() => void matchPurchase(purchase)}>{legacy ? 'Link stock entry' : 'Match items'}</button>}</div>}
        {expanded && <div className="purchase-tracking-expanded">
          {items.length > 0 ? <div className="purchase-tracking-items">{items.map(line => <div className="purchase-tracking-item" key={line.id}>
            <div className="purchase-tracking-item-title"><h3 className={T.h3}>{line.product_name}</h3><Link className="tap-target purchase-tracking-button" to={`/admin/stock?panel=${encodeURIComponent(line.product_id)}`}>Stock</Link></div>
            <div className="purchase-tracking-quantities"><span>Ordered <strong>{number(line.expected_quantity)} {unit(line.unit)}</strong></span><span>Arrived <strong>{number(line.received_quantity)} {unit(line.unit)}</strong></span><span>Coming <strong>{number(Math.max(0, line.expected_quantity - line.received_quantity - line.cancelled_quantity))} {unit(line.unit)}</strong></span></div>
            {line.cancelled_quantity > 0 && <p className="purchase-tracking-item-note">{number(line.cancelled_quantity)} {unit(line.unit)} cancelled</p>}
          </div>)}</div> : <div className="purchase-tracking-unmatched">{(row.arrival_proposal ? [{name:row.arrival_proposal.product_name || 'Arrival item',quantity:row.arrival_proposal.quantity ?? null,unit:row.arrival_proposal.unit || 'g'}] : purchaseItems(purchase)).map((line, index) => <div key={index}><span>{line.name}</span><span>{line.quantity == null ? 'Quantity not recorded' : `${number(line.quantity)} ${unit(line.unit)}`}</span></div>)}</div>}
          <div className="purchase-tracking-detail-links">
            <details className="purchase-tracking-history"><summary className="tap-target" aria-label="Arrival history">History <span className="text-tea-text-dim">{row.history.length}</span></summary><div className="purchase-tracking-history-content">{row.history.length ? row.history.map(event => <div key={event.id}><span>{date(event.recorded_at)} · {items.find(line => line.product_id === event.product_id)?.product_name || 'Stock arrival'}</span><strong>+{number(event.quantity)} {unit(event.unit)}</strong>{event.note && <p className="text-tea-text-sec">{event.note}</p>}</div>) : <p className="text-tea-text-sec">{items.some(line => line.received_quantity > 0) ? 'Detailed arrival history is unavailable for this older record.' : 'No arrivals recorded yet.'}</p>}</div></details>
            {row.source_document && <PurchaseInvoiceEvidence key={`${accountId}:${row.source_document.import_id}`} importId={row.source_document.import_id} title={row.source_document.title}/> }
            {purchase?.notes && <details className="purchase-tracking-note"><summary className="tap-target" aria-label="Supplier note" title="Supplier note">Note</summary><p>{purchase.notes}</p></details>}
          {(purchase || receipt) && <details className="purchase-tracking-manual"><summary className="tap-target" aria-label="Make a change">Changes</summary><div className="purchase-tracking-manual-content">
            {receipt && <button type="button" className="tap-target purchase-tracking-button" onClick={() => setManualReceipt(receipt.id)}>Record arrival / manage delivery</button>}
            {purchase && !receipt && purchase.status !== 'cancelled' && <button type="button" disabled={busy} className="tap-target purchase-tracking-button" onClick={() => void matchPurchase(purchase)}>{legacy ? 'Link original stock entry' : 'Match purchase items'}</button>}
            {purchase && <label>Purchase status<select aria-label={`Purchase status for ${supplier(row)}`} value={purchase.status} disabled={busy || Boolean(receipt)} onChange={event => void mutate(() => api.purchaseOrders.updateStatus(purchase.id, event.target.value))}>{[...new Set(['pending', 'ordered', 'cancelled', purchase.status])].map(value => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}</select></label>}
            {purchase && <TrackingField purchase={purchase} busy={busy} save={value=>mutate(()=>api.purchaseOrders.setTracking(purchase.id,value))}/>}
          </div></details>}
          </div>
        </div>}
      </article>;
    })}</div>
    {scoped.some(row => purchaseTrackingStage(row) === 'cancelled') && <button type="button" className="tap-target purchase-tracking-archive" onClick={() => setFilter(filter === 'cancelled' ? 'all' : 'cancelled')}>{filter === 'cancelled' ? 'Show all purchases' : 'Show cancelled purchases'}</button>}
    {newForm && <NewForm onClose={() => setNewForm(false)} submitting={busy} onSubmit={async input => { await mutate(async () => { await api.purchaseOrders.create(input); setNewForm(false); }); }}/ >}
    {match && <MatchForm po={match} onClose={() => setMatch(null)} onPrepared={() => { setOpen(match.id); setMatch(null); void refresh(); }}/ >}
  </section>;
}
