import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import { api, type PurchaseOrder, type PurchaseTrackingRow } from '../../../lib/api';
import { useAppStore } from '../../../lib/store';
import { refreshCommerceQueries } from '../../../lib/refreshCommerce';
import { TYPOGRAPHY_CLASSES as T } from '../../../designTokens';
import { IncomingReceiptsPanel } from './IncomingReceiptsPanel';
import { PurchaseInvoiceEvidence } from './PurchaseInvoiceEvidence';
import type { LogisticsOrder, LogisticsTracking } from '../../../lib/logisticsTypes';
import { LogisticsCreateShipment, LogisticsOrderFields, ManifestButtons, companyManifest, type LogisticsMutation } from './LogisticsControls';
import { LogisticsArrivalGroups } from './LogisticsArrivalGroups';
import { LogisticsServices } from './LogisticsServices';
import { LogisticsShipmentCard } from './LogisticsShipmentCard';
import { purchaseJourneyGroups } from './purchaseJourneyGroups';
import { logisticsPlaces } from './logisticsPlaces';
import { TrackingTask } from './TrackingTask';
import { dueLabel, remainingOf, TRANSPORT_LABELS } from './incomingGroups';

export type PurchaseTrackingFilter = 'all' | 'attention' | 'coming' | 'to_logistics' | 'at_logistics' | 'to_studio' | 'received' | 'cancelled';
export const purchaseAttention = (row: PurchaseTrackingRow) => row.attention.filter(item => item.code !== 'partial_delivery');
export function purchaseTrackingStage(row: PurchaseTrackingRow): PurchaseTrackingFilter {
  if (row.invoice_draft && !row.receipt && !row.purchase) return 'attention';
  if (!row.receipt && row.purchase?.status === 'pending' && row.purchase.create_request_key?.startsWith('intake:')) return 'attention';
  if (row.receipt?.state === 'received' || (!row.receipt && row.purchase?.status === 'received')) return 'received';
  if (row.receipt?.state === 'cancelled' || (!row.receipt && row.purchase?.status === 'cancelled')) return 'cancelled';
  return 'coming';
}
export function logisticsPurchaseStage(row: PurchaseTrackingRow, order?: LogisticsOrder, data?: LogisticsTracking): PurchaseTrackingFilter {
  const stage = purchaseTrackingStage(row);
  if (stage !== 'coming') return stage;
  if (data?.shipments.some(shipment => (shipment.state === 'in_transit' || shipment.state === 'partially_received') && shipment.lines.some(line => line.purchase_id === row.purchase?.id && line.received_quantity < line.quantity))) return 'to_studio';
  return order?.logistics_company_name ? order.logistics_arrived_at ? 'at_logistics' : 'to_logistics' : 'coming';
}
export function matchesPurchaseTracking(row: PurchaseTrackingRow, filter: PurchaseTrackingFilter, order?: LogisticsOrder, data?: LogisticsTracking) {
  if (filter === 'to_logistics' || filter === 'at_logistics' || filter === 'to_studio') {
    // A split purchase can have contents at logistics and other contents travelling.
    if (filter === 'at_logistics') return Boolean(order?.logistics_arrived_at && order.lines.some(line => line.available_quantity > 0)) || Boolean(data?.shipments.some(shipment => shipment.state === 'draft' && shipment.lines.some(line => line.purchase_id === row.purchase?.id)));
    return logisticsPurchaseStage(row, order, data) === filter;
  }
  return filter === 'all' || (filter === 'attention' ? purchaseAttention(row).length > 0 : purchaseTrackingStage(row) === filter);
}
const date = (value?: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
const number = (value: number) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
const unit = (value: string) => value === 'unit' ? 'pc' : 'g';
const supplier = (row: PurchaseTrackingRow) => row.purchase?.vendor_name || row.receipt?.vendor_name || row.arrival_proposal?.vendor_name || 'Supplier not recorded';
export function logisticsOrderSummary(order: LogisticsOrder, data: LogisticsTracking): { label: string; quantities: string; tracking: string; locations: Array<{ label: string; quantity: string }> } {
  const draft = data.shipments.filter(shipment => shipment.state === 'draft').flatMap(shipment => shipment.lines).filter(line => line.purchase_id === order.purchase_id);
  const travelling = data.shipments.filter(shipment => shipment.state === 'in_transit' || shipment.state === 'partially_received').flatMap(shipment => shipment.lines).filter(line => line.purchase_id === order.purchase_id);
  const describe = (lines: Array<{ quantity: number; unit: string }>) => {
    const grams = lines.filter(line => line.unit === 'g').reduce((sum, line) => sum + line.quantity, 0);
    const pieces = lines.filter(line => line.unit === 'unit').reduce((sum, line) => sum + line.quantity, 0);
    return [grams > 0 ? `${number(grams)} g` : '', pieces > 0 ? `${number(pieces)} pc` : ''].filter(Boolean).join(' + ');
  };
  const waiting = describe([...order.lines.map(line => ({ quantity: line.available_quantity, unit: line.unit })), ...draft.map(line => ({ quantity: Math.max(0, line.quantity - line.received_quantity), unit: line.unit }))]);
  const sent = describe(travelling.map(line => ({ quantity: Math.max(0, line.quantity - line.received_quantity), unit: line.unit })));
  const waitingLabel = order.logistics_arrived_at ? 'At logistics' : 'To logistics';
  return { locations: [...(waiting ? [{ label: waitingLabel, quantity: waiting }] : []), ...(sent ? [{ label: 'To studio', quantity: sent }] : [])], label: waiting && sent ? 'Part sent' : sent ? 'To studio' : waitingLabel, quantities: [waiting ? `${waitingLabel} ${waiting}` : '', sent ? `To studio ${sent}` : ''].filter(Boolean).join(' · '), tracking: [order.logistics_company_name, order.inbound_courier, order.inbound_tracking_number ? `Inbound ${order.inbound_tracking_number}` : 'Inbound tracking not recorded'].filter(Boolean).join(' · ') };
}

export function scopeLogisticsOrders(data: LogisticsTracking, rows: PurchaseTrackingRow[]) {
  const ids = new Set(rows.map(row => row.purchase?.id).filter(Boolean));
  return data.orders.filter(order => ids.has(order.purchase_id));
}

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
  const initialFilter: PurchaseTrackingFilter = view === 'to_logistics' || view === 'at_logistics' || view === 'to_studio' || view === 'coming' || view === 'attention' || view === 'received' || view === 'cancelled' ? view : 'all';
  const [filter, setFilter] = useState<PurchaseTrackingFilter>(initialFilter);
  const [vendor, setVendor] = useState('all');
  const [company, setCompany] = useState('all');
  const [open, setOpen] = useState<string | null>(initialOpen || params.get('purchaseId'));
  const [manualReceipt, setManualReceipt] = useState<string | null>(null);
  const [newForm, setNewForm] = useState(false);
  const [match, setMatch] = useState<PurchaseOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [purchaseError, setPurchaseError] = useState<{ id: string; message: string } | null>(null);
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ['purchase-tracking', accountId], queryFn: () => api.purchaseOrders.tracking(),
    staleTime: 15_000, refetchOnWindowFocus: true, refetchInterval: 60_000,
  });
  const logisticsQuery = useQuery({ queryKey: ['purchase-logistics', accountId], queryFn: () => api.logistics.tracking(), staleTime: 15_000, refetchOnWindowFocus: true, refetchInterval: 60_000 });
  const logistics = logisticsQuery.data;
  const orderFor = (row: PurchaseTrackingRow) => logistics?.orders.find(order => order.purchase_id === row.purchase?.id);
  const companies = [...new Set([...(logistics?.orders.map(order => order.logistics_company_name) || []), ...(logistics?.shipments.map(shipment => shipment.logistics_company_name) || [])].filter((value): value is string => Boolean(value)))].sort();
  useEffect(() => { setOpen(initialOpen || params.get('purchaseId')); setManualReceipt(null); setMatch(null); setPurchaseError(null); setVendor('all'); setCompany('all'); setFilter(initialFilter); setError(''); }, [accountId, initialOpen, params]);
  const rows = data?.rows || [];
  const vendors = [...new Set(rows.filter(row => !row.invoice_draft || row.purchase || row.receipt).map(supplier))].sort();
  const scoped = rows.filter(row => (vendor === 'all' || supplier(row) === vendor) && (company === 'all' || orderFor(row)?.logistics_company_name === company));
  const scopedOrders = logistics ? scopeLogisticsOrders(logistics, scoped) : [];
  const scopeKey = JSON.stringify([accountId, vendor, company]);
  const hasFilters = vendor !== 'all' || company !== 'all' || filter !== 'all';
  const clearFilters = () => { setVendor('all'); setCompany('all'); setFilter('all'); };
  const visible = scoped.filter(row => matchesPurchaseTracking(row, filter, orderFor(row), logistics));
  const visibleShipments = (logistics?.shipments || []).filter(shipment => shipment.state !== 'cancelled' && (company === 'all' || shipment.logistics_company_name === company) && (vendor === 'all' || shipment.lines.some(line => logistics?.orders.some(order => order.purchase_id === line.purchase_id && order.vendor_name === vendor))) && (filter === 'all' || filter === 'coming' && shipment.state !== 'received' || filter === 'at_logistics' && shipment.state === 'draft' || filter === 'to_studio' && (shipment.state === 'in_transit' || shipment.state === 'partially_received') || filter === 'received' && shipment.state === 'received' || filter === 'attention' && Boolean(shipment.freight_issue)));
  const refresh = async () => { await Promise.all([refreshCommerceQueries(queryClient, accountId), queryClient.invalidateQueries({ queryKey: ['purchase-logistics', accountId] })]); };
  const mutate: LogisticsMutation = async (action, onError) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); await refresh(); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The change could not be saved.';
      if (onError) onError(message); else setError(message);
      await refresh();
    }
    finally { setBusy(false); }
  };
  const mutatePurchase = (id: string, action: () => Promise<unknown>) => {
    setPurchaseError(null);
    return mutate(action, message => setPurchaseError({ id, message }));
  };
  const matchPurchase = async (purchase: PurchaseOrder) => {
    await mutatePurchase(purchase.id, async () => {
      const result = await api.purchaseOrders.prepareReceipt(purchase.id);
      if (result.receipt_id) { setOpen(purchase.id); }
      else setMatch(purchase);
    });
  };
  const attentionRows = visible.filter(row => purchaseAttention(row).length > 0);
  const journeys = purchaseJourneyGroups(visible.filter(row => !purchaseAttention(row).length), visibleShipments, scopedOrders);
  const otherSections = [
    { title: 'Other deliveries', rows: journeys.other.filter(row => !purchaseAttention(row).length && !['received', 'cancelled'].includes(purchaseTrackingStage(row))) },
    { title: 'Received', rows: journeys.other.filter(row => !purchaseAttention(row).length && purchaseTrackingStage(row) === 'received') },
    { title: 'Cancelled', rows: journeys.other.filter(row => !purchaseAttention(row).length && purchaseTrackingStage(row) === 'cancelled') },
  ];
  const openLinkedPurchase = (id: string) => { clearFilters(); setOpen(id); };
  const selectedPurchase = rows.find(row => row.id === open || row.purchase?.id === open || row.receipt?.id === open);
  const renderPurchase = (row: PurchaseTrackingRow, expanded = false) => {
      const attention = purchaseAttention(row);
      const receipt = row.receipt;
      const purchase = row.purchase;
      const logisticsOrder = orderFor(row);
      const routeStage = logisticsPurchaseStage(row, logisticsOrder, logistics);
      const routeSummary = logisticsOrder?.logistics_company_name && logistics ? logisticsOrderSummary(logisticsOrder, logistics) : null;
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
        <button type="button" className="purchase-tracking-open" disabled={expanded} aria-label={`Open purchase from ${title}`} onClick={() => setOpen(row.id)}>
          <div className="purchase-tracking-identity min-w-0"><h2 className={T.h3}>{title}</h2><div className="purchase-tracking-meta text-tea-text-sec"><span>{row.invoice_draft && !purchase && !receipt ? 'Invoice' : purchase?.po_number || date(purchase?.created_at) || 'Delivery'}</span><span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>{total && <span>{total}</span>}</div></div>
          <span className="purchase-tracking-status"><span className="logistics-state" data-state={attention.length ? 'attention' : stage === 'coming' ? routeStage : stage}>{stage === 'coming' && !attention.length ? routeSummary?.label || ({ to_logistics: 'To logistics', at_logistics: 'At logistics', to_studio: 'To studio' } as Record<string,string>)[routeStage] || stageLabel(row) : stageLabel(row)}</span></span>
        </button>
        {purchaseError && purchaseError.id === purchase?.id && <p role="alert" className="purchase-tracking-notice">{purchaseError.message} Your entries are kept. Use the same action to try again.</p>}
        {stage !== 'attention' && items.length > 0 && !expanded && <p className="purchase-tracking-contents text-tea-text-sec">{items.slice(0, 2).map(line => line.product_name).join(' · ')}{items.length > 2 ? ` + ${items.length - 2} more` : ''}</p>}
        {stage !== 'attention' && <>
          {routeSummary && stage === 'coming' ? <div className="purchase-location-totals">{routeSummary.locations.map(location => <div key={location.label}><span>{location.label === 'To studio' ? 'On way to studio' : location.label === 'To logistics' ? 'On way to logistics' : location.label}</span><strong>{location.quantity}</strong></div>)}</div> : <div className="purchase-tracking-summary"><span>{stage === 'received' ? `Received${row.history.length ? ` · ${date(row.history[0].recorded_at)}` : ''}` : stage === 'cancelled' ? 'Cancelled' : remaining ? `${remaining} coming` : 'No quantity recorded'}</span></div>}
          {(routeSummary || transport || due || purchase?.tracking_number) && <div className="purchase-parcel-tracking"><span className="text-tea-text-dim">{routeSummary ? 'Supplier tracking' : 'Delivery'}</span><span>{routeSummary ? [logisticsOrder?.inbound_courier, logisticsOrder?.inbound_tracking_number || 'Not recorded'].filter(Boolean).join(' · ') : [transport, due?.text, purchase?.tracking_number].filter(Boolean).join(' · ')}</span></div>}
        </>}
        {attention.length > 0 && <div className="purchase-tracking-attention"><span>{attention.map(item => item.message).join(' ')}</span>{row.invoice_draft && <Link className="tap-target purchase-tracking-button" to={`/admin/intake?importId=${encodeURIComponent(row.invoice_draft.id)}`}>Review invoice</Link>}{purchase && !receipt && <button type="button" disabled={busy} className="tap-target purchase-tracking-button" onClick={() => void matchPurchase(purchase)}>{legacy ? 'Check existing stock' : 'Identify items'}</button>}</div>}
        {expanded && <div className="purchase-tracking-expanded">
          {items.length > 0 ? <div className="purchase-tracking-items">{items.map(line => <div className="purchase-tracking-item" key={line.id}>
            <div className="purchase-tracking-item-title"><h3 className={T.h3}>{line.product_name}</h3><Link className="tap-target purchase-tracking-button" to={`/admin/stock?panel=${encodeURIComponent(line.product_id)}`}>Stock</Link></div>
            <div className="purchase-tracking-quantities" aria-label="Studio receipt quantities"><span>Ordered <strong>{number(line.expected_quantity)} {unit(line.unit)}</strong></span><span>Received <strong>{number(line.received_quantity)} {unit(line.unit)}</strong></span><span>Coming <strong>{number(Math.max(0, line.expected_quantity - line.received_quantity - line.cancelled_quantity))} {unit(line.unit)}</strong></span></div>
            {line.cancelled_quantity > 0 && <p className="purchase-tracking-item-note">{number(line.cancelled_quantity)} {unit(line.unit)} cancelled</p>}
          </div>)}</div> : <div className="purchase-tracking-unmatched">{(row.arrival_proposal ? [{name:row.arrival_proposal.product_name || 'Arrival item',quantity:row.arrival_proposal.quantity ?? null,unit:row.arrival_proposal.unit || 'g'}] : purchaseItems(purchase)).map((line, index) => <div key={index}><span>{line.name}</span><span>{line.quantity == null ? 'Quantity not recorded' : `${number(line.quantity)} ${unit(line.unit)}`}</span></div>)}</div>}
          <div className="purchase-tracking-detail-links">
            <section className="purchase-tracking-history" aria-label="Arrival history"><h3 className={T.label}>Arrival history <span className="text-tea-text-dim">{row.history.length}</span></h3><div className="purchase-tracking-history-content">{row.history.length ? row.history.map(event => <div key={event.id}><span>{date(event.recorded_at)} · {items.find(line => line.product_id === event.product_id)?.product_name || 'Stock arrival'}</span><strong>+{number(event.quantity)} {unit(event.unit)}</strong>{event.note && <p className="text-tea-text-sec">{event.note}</p>}</div>) : <p className="text-tea-text-sec">{items.some(line => line.received_quantity > 0) ? 'Detailed arrival history is unavailable for this older record.' : 'No arrivals recorded yet.'}</p>}</div></section>
            {row.source_document && <PurchaseInvoiceEvidence key={`${accountId}:${row.source_document.import_id}`} importId={row.source_document.import_id} title={row.source_document.title}/> }
            {purchase?.notes && <section className="purchase-tracking-note"><h3 className={T.label}>Supplier note</h3><p>{purchase.notes}</p></section>}
          {(purchase || receipt) && <section className="purchase-tracking-manual"><h3 className={T.label}>Edit purchase</h3><div className="purchase-tracking-manual-content">
            {receipt && !logisticsOrder?.logistics_company_name && <button type="button" className="tap-target purchase-tracking-button" onClick={() => setManualReceipt(receipt.id)}>Record arrival / manage delivery</button>}
            {purchase && !receipt && purchase.status !== 'cancelled' && <button type="button" disabled={busy} className="tap-target purchase-tracking-button" onClick={() => void matchPurchase(purchase)}>{legacy ? 'Link original stock entry' : 'Match purchase items'}</button>}
            {purchase && <label>Purchase status<select aria-label={`Purchase status for ${supplier(row)}`} value={purchase.status} disabled={busy || Boolean(receipt)} onChange={event => void mutatePurchase(purchase.id, () => api.purchaseOrders.updateStatus(purchase.id, event.target.value))}>{[...new Set(['pending', 'ordered', 'cancelled', purchase.status])].map(value => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}</select></label>}
            {purchase && logistics ? <LogisticsOrderFields key={JSON.stringify(logisticsOrder || purchase.id)} order={logisticsOrder} services={logistics.services || []} purchaseId={purchase.id} tracking={purchase.tracking_number} busy={busy} mutate={mutate}/> : purchase && <TrackingField purchase={purchase} busy={busy} save={value=>mutatePurchase(purchase.id, ()=>api.purchaseOrders.setTracking(purchase.id,value))}/>}
          </div></section>}
          </div>
        </div>}
      </article>;
  };
  if (manualReceipt) return <IncomingReceiptsPanel receiptId={manualReceipt} backLabel="Back to purchases" onClose={() => { setManualReceipt(null); void refresh(); }} />;

  return <section className="purchase-tracking font-sans text-ui-12 text-tea-text bg-tea-bg pb-nav-gap" aria-label="Purchases and deliveries">
    <header className="purchase-tracking-header">
      <div><h1 className={T.h2}>Purchases</h1></div>
      <div className="purchase-tracking-tools"><button type="button" className="tap-target purchase-tracking-button" disabled={isFetching} onClick={() => { void refetch(); void logisticsQuery.refetch(); }} aria-label="Refresh purchases"><RefreshCw size={14} className={isFetching ? 'animate-spin' : ''}/></button><button type="button" className="tap-target purchase-tracking-button purchase-tracking-add" aria-label="Add purchase" onClick={() => setNewForm(true)}><Plus size={14}/><span>Add purchase</span></button></div>
      {logistics && <LogisticsServices key={`services:${accountId}`} services={logistics.services || []} accountId={accountId} busy={busy} mutate={mutate}/>}
    </header>
    <div className="purchase-tracking-filters">
      <div role="group" aria-label="Filter purchases" className="purchase-tracking-tabs">{([['all', 'Tracking'], ['received', 'History']] as const).map(([key, label]) => <button key={key} type="button" className="tap-target" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span className="text-tea-text-dim">{scoped.filter(row => matchesPurchaseTracking(row, key, orderFor(row), logistics)).length}</span></button>)}</div>
      <label className="purchase-tracking-supplier"><span className="sr-only">Supplier</span><select aria-label="Filter supplier" value={vendor} onChange={event => setVendor(event.target.value)}><option value="all">All suppliers</option>{vendors.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      {companies.length > 0 && <label className="purchase-tracking-supplier"><select aria-label="Filter logistics company" value={company} onChange={event => setCompany(event.target.value)}><option value="all">All logistics companies</option>{companies.map(value => <option key={value}>{value}</option>)}</select></label>}
    </div>
    {logisticsQuery.isError && <p role="alert" className="purchase-tracking-notice">Logistics tracking could not be refreshed.<button type="button" className="tap-target purchase-tracking-button" onClick={() => void logisticsQuery.refetch()}>Refresh logistics</button></p>}
    {error && <p role="alert" className="purchase-tracking-notice">{error}<button type="button" className="tap-target purchase-tracking-button" onClick={() => setError('')}>Dismiss</button></p>}
    {isError && <p role="alert" className="purchase-tracking-notice">Purchases could not be refreshed.<button type="button" className="tap-target purchase-tracking-button" onClick={() => void refetch()}>Refresh purchases</button></p>}
    {isPending && <p role="status" className="purchase-tracking-notice"><Loader2 size={16} className="animate-spin"/>Loading purchases…</p>}
    {!isPending && !isError && !visible.length && !visibleShipments.length && <p className="purchase-tracking-notice">{hasFilters ? 'No purchases match these filters.' : 'No purchases recorded yet.'}{hasFilters && <button type="button" className="tap-target purchase-tracking-button" onClick={clearFilters}>Clear filters</button>}</p>}
    {attentionRows.length > 0 && <section className="purchase-review-queue"><header><h2 className={T.label}>Needs attention <span>{attentionRows.length}</span></h2></header><div>{attentionRows.map(row => renderPurchase(row))}</div></section>}
    <div className="purchase-tracking-journeys">{journeys.groups.map(group => {
      const places = logisticsPlaces(group.orders.filter(order => group.purchases.some(row => row.purchase?.id === order.purchase_id)), group.shipments);
      const completedPurchases = group.purchases.filter(row => ['received', 'cancelled'].includes(purchaseTrackingStage(row)));
      const shipmentCard = (shipment: typeof group.shipments[number]) => <LogisticsShipmentCard key={shipment.id} grouped shipment={shipment} orders={logistics?.orders || []} busy={busy} mutate={mutate} accountId={accountId} openPurchase={openLinkedPurchase}/>;
      return <section className="purchase-journey purchase-places" key={group.id} aria-label={`${group.name} purchases and shipments`}>
        <header className="purchase-journey-heading"><h2 className={T.h3}>{group.name}</h2><ManifestButtons manifest={companyManifest(group.name, group.orders, logistics?.shipments || [])}/></header>
        {filter !== 'received' && filter !== 'cancelled' && <div className="purchase-places-grid">
          <section className="purchase-place" aria-label={`Coming to ${group.name}`}>
            <header><h3 className={T.label}>Coming to {group.name}</h3><span>{places.incoming.length}</span></header>
            <div className="purchase-place-body">{places.incoming.map(order => <div className="purchase-parcel" key={order.purchase_id}>
              <div className="purchase-parcel-heading"><button type="button" className="tap-target purchase-place-link" onClick={() => setOpen(order.purchase_id)}>{order.vendor_name || 'Supplier'}</button><button type="button" className="tap-target purchase-tracking-button" disabled={busy} aria-label={`Arrived at ${group.name}: ${order.vendor_name}`} onClick={() => void mutatePurchase(order.purchase_id, () => api.logistics.markAtLogistics(order.purchase_id))}>Arrived</button></div>
              <p className="purchase-parcel-items">{order.lines.filter(line => line.available_quantity > 0).map(line => line.product_name).join(' · ')}</p>
              {(order.inbound_courier || order.inbound_tracking_number) && <p className="purchase-parcel-reference">{order.inbound_courier} <strong>{order.inbound_tracking_number}</strong></p>}
              {purchaseError?.id === order.purchase_id && <p role="alert">{purchaseError.message} Use Arrived again to retry.</p>}
            </div>)}{!places.incoming.length && <p className="purchase-place-empty">No parcels on the way.</p>}</div>
            {places.incoming.length > 1 && <div className="purchase-place-footer"><LogisticsArrivalGroups orders={places.incoming} busy={busy} mutate={mutate}/></div>}
          </section>
          <section className="purchase-place" aria-label={`At ${group.name}`}>
            <header><h3 className={T.label}>At {group.name}</h3><span>{places.collected.length + places.ready.reduce((sum, shipment) => sum + shipment.lines.length, 0)} items</span></header>
            <div className="purchase-place-body">{places.collected.map(({order,line}) => <button className="tap-target purchase-collected-item purchase-place-link" key={line.id} type="button" onClick={() => setOpen(order.purchase_id)}><span>{line.product_name}<small>{order.vendor_name}</small></span><strong>{number(line.available_quantity)} {unit(line.unit)}</strong></button>)}{places.ready.map(shipmentCard)}{!places.collected.length && !places.ready.length && <p className="purchase-place-empty">Nothing waiting here.</p>}</div>
            {logistics && places.collected.length > 0 && <div className="purchase-place-footer"><LogisticsCreateShipment key={`prepare:${scopeKey}:${group.id}`} label="Send together" data={{...logistics, orders:group.orders}} busy={busy} mutate={mutate}/></div>}
          </section>
          <section className="purchase-place" aria-label={`Coming to studio from ${group.name}`}>
            <header><h3 className={T.label}>Coming to studio</h3><span>{places.travelling.length}</span></header>
            <div className="purchase-place-body">{places.travelling.map(shipmentCard)}{!places.travelling.length && <p className="purchase-place-empty">No shipments on the way.</p>}</div>
          </section>
        </div>}
        {(filter === 'received' || filter === 'cancelled') && <section className="purchase-place-history">{places.history.map(shipmentCard)}{completedPurchases.map(row => renderPurchase(row))}</section>}
      </section>;
    })}
    {otherSections.filter(section => section.rows.length > 0 && (section.title === 'Other deliveries' || filter === 'received' || filter === 'cancelled')).map(section => <section key={section.title} className="purchase-tracking-other"><h2 className={T.label}>{section.title}</h2><div className="purchase-tracking-list">{section.rows.map(row => renderPurchase(row))}</div></section>)}
    </div>
    {scoped.some(row => purchaseTrackingStage(row) === 'cancelled') && <button type="button" className="tap-target purchase-tracking-archive" onClick={() => setFilter(filter === 'cancelled' ? 'all' : 'cancelled')}>{filter === 'cancelled' ? 'Show all purchases' : 'Show cancelled purchases'}</button>}
    <TrackingTask open={Boolean(selectedPurchase)} onClose={() => setOpen(null)} title={selectedPurchase ? `Purchase · ${supplier(selectedPurchase)}` : 'Purchase'}>{selectedPurchase && renderPurchase(selectedPurchase, true)}</TrackingTask>
    {newForm && <NewForm onClose={() => setNewForm(false)} submitting={busy} onSubmit={async input => { await mutate(async () => { await api.purchaseOrders.create(input); setNewForm(false); }); }}/ >}
    {match && <MatchForm po={match} onClose={() => setMatch(null)} onPrepared={() => { setOpen(match.id); setMatch(null); void refresh(); }}/ >}
  </section>;
}
