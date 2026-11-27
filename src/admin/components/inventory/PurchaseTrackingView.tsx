import { Button } from '../../../components/shared/Button';
import { serviceHref, shipmentHref, SHIPMENT_STATE_WORD } from './logisticsLinks';
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, History, Loader2, MoreHorizontal, Plus, RefreshCw } from 'lucide-react';
import { api, type PurchaseOrder, type PurchaseTrackingRow } from '../../../lib/api';
import { selectIsOwnerTier, useAppStore } from '../../../lib/store';
import { usePurchaseLogistics } from '../../hooks/usePurchaseLogistics';
import { refreshCommerceQueries } from '../../../lib/refreshCommerce';
import { TYPOGRAPHY_CLASSES as T } from '../../../designTokens';
import { TeaPanelSummary } from '../../../components/tea/TeaPanelSummary';
import { TeaCard, TeaCardMeta, TeaCardMetric, TeaCardTitle } from '../../../components/tea/TeaCard';
import { IncomingReceiptsPanel } from './IncomingReceiptsPanel';
import { PurchaseInvoiceEvidence } from './PurchaseInvoiceEvidence';
import type { LogisticsOrder, LogisticsShipment, LogisticsTracking } from '../../../lib/logisticsTypes';
import { LogisticsCreateShipment, LogisticsOrderFields, ManifestButtons, companyManifest, type LogisticsMutation } from './LogisticsControls';
import { LogisticsArrivalGroups } from './LogisticsArrivalGroups';
import { LogisticsAddresses } from './LogisticsAddresses';
import { LogisticsServices } from './LogisticsServices';
import { LogisticsShipmentCard } from './LogisticsShipmentCard';
import { StudioReferralReview } from './StudioReceiptReferral';
import { purchaseJourneyGroups } from './purchaseJourneyGroups';
import { logisticsPlaces } from './logisticsPlaces';
import { TrackingTask } from './TrackingTask';
import { LogisticsTrackingUpdate } from './LogisticsTrackingUpdate';
import { ParcelContents } from './LogisticsParcel';
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
const stockPurpose = { working: 'Working stock', sample: 'Sample stock', personal: 'Personal stock' };
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
  return row.receipt?.state === 'partially_received' ? 'Part arrived' : row.receipt?.state === 'in_transit' ? 'On the way' : row.purchase?.status === 'sent' ? 'Sent' : 'Coming';
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
  const canResolveReferral = useAppStore(selectIsOwnerTier);
  const [reviewingReferral, setReviewingReferral] = useState<{ accountId: string | null; id: string } | null>(null);
  const [routeTarget, setRouteTarget] = useState<{ accountId: string | null; purchaseId: string } | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<{ accountId: string | null; shipmentId: string; lineId: string } | null>(null);
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const reviewId = params.get('purchaseId');
  const requestedShipmentId = params.get('shipmentId');
  const requestedLineId = params.get('receiptLineId');
  const shipmentsForPurchaseId = params.get('shipmentsForPurchaseId');
  const clearPurchaseShipmentFilter = () => setParams(current => {
    const next = new URLSearchParams(current);
    next.delete('shipmentsForPurchaseId');
    next.delete('view');
    return next;
  }, { replace: true });
  const closeRequestedReceipt = () => setParams(current => {
    const next = new URLSearchParams(current);
    next.delete('receiptLineId');
    return next;
  }, { replace: true });
  const view = params.get('view');
  const initialFilter: PurchaseTrackingFilter = view === 'to_logistics' || view === 'at_logistics' || view === 'to_studio' || view === 'coming' || view === 'attention' || view === 'received' || view === 'cancelled' ? view : 'all';
  const [filter, setFilter] = useState<PurchaseTrackingFilter>(initialFilter);
  const [vendor, setVendor] = useState('all');
  const [company, setCompany] = useState('all');
  const [open, setOpenState] = useState<string | null>(reviewId || initialOpen || null);
  const setOpen = (id: string | null) => {
    setOpenState(id);
    if (reviewId === id) return;
    setParams(current => {
      const next = new URLSearchParams(current);
      if (id) next.set('purchaseId', id);
      else next.delete('purchaseId');
      return next;
    }, { replace: id === null });
  };
  const [manualReceipt, setManualReceipt] = useState<string | null>(null);
  const [detailTask, setDetailTask] = useState<'edit' | 'history' | null>(null);
  const [newForm, setNewForm] = useState(false);
  const [match, setMatch] = useState<PurchaseOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [purchaseError, setPurchaseError] = useState<{ id: string; message: string } | null>(null);
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ['purchase-tracking', accountId], queryFn: () => api.purchaseOrders.tracking(),
    staleTime: 15_000, refetchOnWindowFocus: true, refetchInterval: 60_000,
  });
  const logisticsQuery = usePurchaseLogistics(true, 60_000);
  const logistics = logisticsQuery.data;
  const requestedShipment = logistics?.shipments.find(shipment => shipment.id === requestedShipmentId);
  const requestedLine = requestedShipment?.lines.find(line => line.id === requestedLineId);
  const requestedReceipt = requestedShipment && requestedLine
    && (requestedShipment.state === 'in_transit' || requestedShipment.state === 'partially_received')
    && requestedLine.quantity > requestedLine.received_quantity
    ? requestedLine.id : undefined;
  useEffect(() => {
    if (!requestedShipment?.id || requestedReceipt) return;
    const frame = requestAnimationFrame(() => {
      const card = document.getElementById(`shipment-card-${requestedShipment.id}`);
      card?.scrollIntoView({ block: 'nearest' });
      card?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [requestedShipment?.id, requestedReceipt]);
  const orderFor = (row: PurchaseTrackingRow) => logistics?.orders.find(order => order.purchase_id === row.purchase?.id);
  const companies = [...new Set([...(logistics?.orders.map(order => order.logistics_company_name) || []), ...(logistics?.shipments.map(shipment => shipment.logistics_company_name) || [])].filter((value): value is string => Boolean(value)))].sort();
  useEffect(() => {
    setOpenState(reviewId || initialOpen || null);
    setManualReceipt(null);
    setDetailTask(null);
    setMatch(null);
    setPurchaseError(null);
  }, [accountId, initialOpen, reviewId]);
  useEffect(() => {
    setRouteTarget(null);
    setReceiptTarget(null);
  }, [accountId]);
  useEffect(() => {
    setVendor('all');
    setCompany('all');
    setFilter(initialFilter);
    setError('');
  }, [accountId, initialFilter]);
  const rows = data?.rows || [];
  const vendors = [...new Set(rows.filter(row => !row.invoice_draft || row.purchase || row.receipt).map(supplier))].sort();
  const scoped = rows.filter(row => (vendor === 'all' || supplier(row) === vendor) && (company === 'all' || orderFor(row)?.logistics_company_name === company));
  const scopedOrders = logistics ? scopeLogisticsOrders(logistics, scoped) : [];
  const scopeKey = JSON.stringify([accountId, vendor, company]);
  const hasFilters = vendor !== 'all' || company !== 'all' || filter !== 'all';
  const clearFilters = () => { setVendor('all'); setCompany('all'); setFilter('all'); };
  const visible = scoped.filter(row => matchesPurchaseTracking(row, filter, orderFor(row), logistics));
  const visibleShipments = (logistics?.shipments || []).filter(shipment => (!shipmentsForPurchaseId || shipment.lines.some(line => line.purchase_id === shipmentsForPurchaseId)) && shipment.state !== 'cancelled' && (company === 'all' || shipment.logistics_company_name === company) && (vendor === 'all' || shipment.lines.some(line => logistics?.orders.some(order => order.purchase_id === line.purchase_id && order.vendor_name === vendor))) && (filter === 'all' || filter === 'coming' && shipment.state !== 'received' || filter === 'at_logistics' && shipment.state === 'draft' || filter === 'to_studio' && (shipment.state === 'in_transit' || shipment.state === 'partially_received') || filter === 'received' && shipment.state === 'received' || filter === 'attention' && Boolean(shipment.freight_issue)));
  const refresh = async () => {
    await Promise.all([
      refetch({ cancelRefetch: false }),
      queryClient.invalidateQueries({ queryKey: logisticsQuery.queryKey }, { cancelRefetch: false }),
    ]);
  };
  const refreshStock = () => refreshCommerceQueries(queryClient, accountId);
  const replaceShipment = (updated: LogisticsShipment) => {
    queryClient.setQueryData<LogisticsTracking>(logisticsQuery.queryKey, current => current && ({
      ...current,
      shipments: current.shipments.map(shipment => shipment.id === updated.id ? {
        ...shipment,
        ...updated,
        tracking_update: updated.tracking_update ?? (shipment.tracking_number === updated.tracking_number ? shipment.tracking_update : null),
      } : shipment),
    }));
  };
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
  const attentionRows = shipmentsForPurchaseId ? [] : visible.filter(row => purchaseAttention(row).length > 0);
  const studioReferrals = (logistics?.shipments ?? []).flatMap(shipment =>
    (shipment.studio_referrals ?? []).flatMap(referral => {
      const line = shipment.lines.find(line => line.id === referral.line_id);
      return line ? [{ shipment, line, referral }] : [];
    }));
  const openReferrals = studioReferrals.filter(({ referral }) => !referral.resolved_at);
  const queuedReferrals = openReferrals.filter(({ shipment }) =>
    (!shipmentsForPurchaseId || shipment.lines.some(line => line.purchase_id === shipmentsForPurchaseId)) && (
    !visibleShipments.some(visible => visible.id === shipment.id)
    || filter === 'received' || filter === 'cancelled'));
  const referralReview = reviewingReferral?.accountId === accountId
    ? studioReferrals.find(({ referral }) => referral.id === reviewingReferral?.id)
    : undefined;
  const displayedPurchases = shipmentsForPurchaseId ? [] : visible.filter(row => !purchaseAttention(row).length);
  const journeyShipments = requestedShipment && !visibleShipments.some(shipment => shipment.id === requestedShipment.id)
    ? [...visibleShipments, requestedShipment] : visibleShipments;
  const journeys = purchaseJourneyGroups(displayedPurchases, journeyShipments, shipmentsForPurchaseId ? [] : scopedOrders);
  const hasActiveShipment = (group: typeof journeys.groups[number]) =>
    group.shipments.some(shipment => shipment.state !== 'received' && shipment.state !== 'cancelled');
  const journeyGroups = [...journeys.groups].sort((a, b) => Number(hasActiveShipment(b)) - Number(hasActiveShipment(a)));
  const otherSections = [
    { title: 'Other deliveries', rows: journeys.other.filter(row => !purchaseAttention(row).length && !['received', 'cancelled'].includes(purchaseTrackingStage(row))) },
    { title: 'Received', rows: journeys.other.filter(row => !purchaseAttention(row).length && purchaseTrackingStage(row) === 'received') },
    { title: 'Cancelled', rows: journeys.other.filter(row => !purchaseAttention(row).length && purchaseTrackingStage(row) === 'cancelled') },
  ];
  const openLinkedPurchase = (id: string) => { clearFilters(); setOpen(id); };
  const selectedPurchase = rows.find(row => row.id === open || row.purchase?.id === open || row.receipt?.id === open);
  const selectedOrder = selectedPurchase?.purchase;
  const selectedLogisticsOrder = selectedPurchase && orderFor(selectedPurchase);
  const routePurchase = routeTarget?.accountId === accountId
    ? rows.find(row => row.purchase?.id === routeTarget?.purchaseId)
    : undefined;
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
      const total = purchase?.total_usd == null ? null : `$${purchase.total_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
      const reference = row.invoice_draft && !purchase && !receipt ? 'Invoice' : purchase?.po_number || date(purchase?.created_at);
      const status = stage === 'coming' && !attention.length
        ? routeSummary?.label || ({ to_logistics: 'To logistics', at_logistics: 'At logistics', to_studio: 'To studio' } as Record<string, string>)[routeStage] || stageLabel(row)
        : stageLabel(row);
      const tracking = routeSummary
        ? [logisticsOrder?.inbound_courier, logisticsOrder?.inbound_tracking_number || 'Not recorded'].filter(Boolean).join(' · ')
        : [transport, due?.text, purchase?.tracking_number].filter(Boolean).join(' · ');
      const unmatched = row.arrival_proposal
        ? [{ name: row.arrival_proposal.product_name || 'Arrival item', quantity: row.arrival_proposal.quantity ?? null, unit: row.arrival_proposal.unit || 'g' }]
        : purchaseItems(purchase);
      const managedLogistics = logisticsOrder?.managed === true || !!logisticsOrder?.logistics_company_name;
      const canReceive = receipt && logistics && !managedLogistics;
      const canAssignRoute = logistics && receipt && stage === 'coming' && purchase
        && !managedLogistics;
      const canMatch = purchase && !receipt && purchase.status !== 'cancelled';
      const canPlace = canMatch && purchase.status === 'pending' && !legacy;
      return <div className="min-w-0 space-y-2" key={row.id} data-purchase-id={purchase?.id} data-receipt-id={receipt?.id}>
        <TeaCard
          title={<TeaCardTitle as="h2">{title}</TeaCardTitle>}
          trailing={expanded ? purchase && (
            <Button variant="plain" type="button" className="tap-target library-more-action" aria-label="Edit purchase" onClick={() => setDetailTask('edit')}>
              <MoreHorizontal size={18} aria-hidden="true" />
            </Button>
          ) : (
            <Button variant="plain" type="button" className="tap-target library-more-action" aria-label={`Open purchase from ${title}`} onClick={() => setOpen(purchase?.id || receipt?.id || row.id)}>
              <MoreHorizontal size={18} aria-hidden="true" />
            </Button>
          )}
          meta={<TeaCardMeta primary={status} trailing={reference} />}
          metricsLeading={expanded && (
            <div className="library-quick-actions">
              <Button variant="plain" type="button" className="tap-target" aria-label="Arrival history" onClick={() => setDetailTask('history')}><History size={17} aria-hidden="true" /></Button>
              {row.source_document && <PurchaseInvoiceEvidence key={`${accountId}:${row.source_document.import_id}`} importId={row.source_document.import_id} title={row.source_document.title} />}
            </div>
          )}
          metricsLabel="Purchase summary"
          metrics={<>
            <TeaCardMetric label={itemCount === 1 ? 'Item' : 'Items'}>{itemCount}</TeaCardMetric>
            {total && <TeaCardMetric label="Total">{total}</TeaCardMetric>}
            {stage === 'coming' && !routeSummary && receipt && remaining && <TeaCardMetric label="Coming">{remaining}</TeaCardMetric>}
            {stage === 'received' && row.history.length > 0 && <TeaCardMetric label="Received">{date(row.history[0].recorded_at)}</TeaCardMetric>}
            {routeSummary?.locations.map(location => <TeaCardMetric key={location.label} label={location.label}>{location.quantity}</TeaCardMetric>)}
          </>}
          actions={(canAssignRoute || attention.length > 0 || (expanded && (canReceive || canMatch))) && <>
            {canAssignRoute && <Button variant="plain" type="button" className="tap-target library-tea-primary"
              disabled={busy} onClick={() => setRouteTarget({ accountId, purchaseId: purchase.id })}>Assign inbound route</Button>}
            {row.invoice_draft && attention.length > 0 && <Link className="tap-target inline-flex min-h-tap items-center px-2 text-tea-text-sec" to={`/admin/intake?importId=${encodeURIComponent(row.invoice_draft.id)}`}>Review invoice</Link>}
            {expanded && canReceive && (
              <Button variant="plain" type="button" className="tap-target library-tea-primary" aria-label="Record arrival / manage delivery" onClick={() => setManualReceipt(receipt.id)}>{stage === 'coming' ? 'Record arrival' : 'Manage delivery'}</Button>
            )}
            {canMatch && (expanded || attention.length > 0) && (
              <Button variant="plain" type="button" disabled={busy} className="tap-target px-2 text-tea-text-sec" onClick={() => void matchPurchase(purchase)}>
                {expanded ? legacy ? 'Link original stock entry' : 'Match purchase items' : legacy ? 'Check existing stock' : 'Identify items'}
              </Button>
            )}
            {expanded && canPlace && (
              <Button variant="plain" type="button" disabled={busy} className="tap-target library-tea-primary" onClick={() => void mutatePurchase(purchase.id, () => api.purchaseOrders.updateStatus(purchase.id, 'ordered'))}>Place order</Button>
            )}
          </>}
        >
          {purchaseError && purchaseError.id === purchase?.id && <p role="alert" className="py-2 text-tea-text-sec">{purchaseError.message} Your entries are kept. Use the same action to try again.</p>}
          {stage !== 'attention' && items.length > 0 && !expanded && <p className="py-1 text-tea-text-sec">{items.slice(0, 2).map(line => line.product_name).join(' · ')}{items.length > 2 ? ` + ${items.length - 2} more` : ''}</p>}
          {stage !== 'attention' && tracking && <p className="py-1 text-tea-text-sec">{routeSummary ? 'Supplier tracking' : 'Delivery'} · {tracking}</p>}
          {stage !== 'attention' && logisticsOrder?.tracking_update && <LogisticsTrackingUpdate update={logisticsOrder.tracking_update} />}
          {stage !== 'attention' && logisticsOrder?.logistics_company_name && purchase && (() => {
            // Every connection is a link (Adrian, 2026-11-27): its company's service, and each shipment it is on.
            const companyService = (logistics?.services || []).find(service => service.active && service.logistics_company_id === logisticsOrder.logistics_company_id);
            const onShipments = (logistics?.shipments || []).filter(shipment => shipment.state !== 'cancelled' && shipment.lines.some(line => line.purchase_id === purchase.id));
            return <p data-testid="purchase-connections" className="flex flex-wrap gap-x-2 py-1 text-tea-text-sec">
              <span>Goes to</span>
              <Link className="tap-target underline text-tea-gold" to={serviceHref(companyService?.id || 'new')}>{logisticsOrder.logistics_company_name}{companyService ? ` · ${companyService.name}` : ', add its rate'}</Link>
              {onShipments.map(shipment => <Link key={shipment.id} className="tap-target underline text-tea-gold" to={shipmentHref(shipment.id)}>{SHIPMENT_STATE_WORD[shipment.state]}{shipment.eta ? `, due ${shipment.eta}` : ''}</Link>)}
            </p>;
          })()}
          {attention.length > 0 && <p className="px-3 py-1 text-tea-text-sec">{attention.map(item => item.message).join(' ')}</p>}
        </TeaCard>
        {expanded && <>
          <div className="grid gap-2">
            {items.length > 0 ? items.map(line => (
              <TeaCard
                key={line.id}
                title={<TeaCardTitle>{line.product_name}</TeaCardTitle>}
                meta={stockPurpose[line.intended_purpose] && <TeaCardMeta primary={stockPurpose[line.intended_purpose]} />}
                metricsLeading={
                  <div className="library-quick-actions">
                    <Link className="tap-target inline-flex min-h-tap w-11 items-center justify-center text-tea-text-sec" aria-label={`Open Stock for ${line.product_name}`} to={`/admin/stock?panel=${encodeURIComponent(line.product_id)}`}><Archive size={17} aria-hidden="true" /></Link>
                  </div>
                }
                metricsLabel="Studio receipt quantities"
                metrics={<>
                  <TeaCardMetric label="Ordered">{`${number(line.expected_quantity)} ${unit(line.unit)}`}</TeaCardMetric>
                  <TeaCardMetric label="Received">{`${number(line.received_quantity)} ${unit(line.unit)}`}</TeaCardMetric>
                  <TeaCardMetric label="Coming">{`${number(Math.max(0, line.expected_quantity - line.received_quantity - line.cancelled_quantity))} ${unit(line.unit)}`}</TeaCardMetric>
                </>}
              >
                {line.cancelled_quantity > 0 && <p className="pb-2 text-tea-text-sec">{number(line.cancelled_quantity)} {unit(line.unit)} cancelled</p>}
              </TeaCard>
            )) : unmatched.map((line, index) => (
              <TeaCard
                key={index}
                title={<TeaCardTitle>{line.name}</TeaCardTitle>}
                meta={line.quantity == null && <TeaCardMeta primary="Quantity not recorded" />}
                metrics={line.quantity != null && <TeaCardMetric label="Ordered">{`${number(line.quantity)} ${unit(line.unit)}`}</TeaCardMetric>}
              />
            ))}
          </div>
          {purchase?.notes && <section className="border-t border-tea-border px-2.5 py-3">
            <h3 className={T.label}>Supplier note</h3>
            <p className="whitespace-pre-wrap break-words pt-1 text-tea-text-sec">{purchase.notes}</p>
          </section>}
        </>}
      </div>;
  };
  if (manualReceipt) return <IncomingReceiptsPanel receiptId={manualReceipt} backLabel="Back to purchases" onClose={() => { setManualReceipt(null); void refreshStock(); }} />;

  return <section className="purchase-tracking font-sans text-ui-12 text-tea-text bg-tea-bg pb-nav-gap" aria-label="Purchases and deliveries">
    <header className="purchase-tracking-header">
      <div><h1 className={T.h2}>Purchases</h1></div>
      <div className="purchase-tracking-tools"><button type="button" className="tap-target purchase-tracking-button" disabled={isFetching} onClick={() => { void refetch(); void logisticsQuery.refetch(); }} aria-label="Refresh purchases"><RefreshCw size={14} className={isFetching ? 'animate-spin' : ''}/></button><button type="button" className="tap-target purchase-tracking-button purchase-tracking-add" aria-label="Add purchase" onClick={() => setNewForm(true)}><Plus size={14}/><span>Add purchase</span></button></div>
      {logistics && <LogisticsServices key={`services:${accountId}`} services={logistics.services || []} tracking={logistics} accountId={accountId} busy={busy} mutate={mutate}/>}
      {logistics && <LogisticsAddresses key={`addresses:${accountId}`} addresses={logistics.addresses || []} services={logistics.services || []} accountId={accountId} busy={busy} mutate={mutate}/>}
    </header>
    <div className="purchase-tracking-filters">
      <div role="group" aria-label="Filter purchases" className="purchase-tracking-tabs">{([['all', 'Tracking'], ['received', 'History']] as const).map(([key, label]) => <button key={key} type="button" className="tap-target" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span className="text-tea-text-dim">{scoped.filter(row => matchesPurchaseTracking(row, key, orderFor(row), logistics)).length}</span></button>)}</div>
      <label className="purchase-tracking-supplier"><span className="sr-only">Supplier</span><select aria-label="Filter supplier" value={vendor} onChange={event => setVendor(event.target.value)}><option value="all">All suppliers</option>{vendors.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      {companies.length > 0 && <label className="purchase-tracking-supplier"><select aria-label="Filter logistics company" value={company} onChange={event => setCompany(event.target.value)}><option value="all">All logistics companies</option>{companies.map(value => <option key={value}>{value}</option>)}</select></label>}
    </div>
    {shipmentsForPurchaseId && <div className="purchase-tracking-notice flex flex-wrap items-center justify-between gap-2">
      <p>{logisticsQuery.isPending ? 'Opening shipments…' : visibleShipments.length ? 'Shipments for this supplier order' : 'No active shipment for this supplier order'}</p>
      <Button variant="plain" type="button" className="tap-target purchase-tracking-button" onClick={clearPurchaseShipmentFilter}>Show all purchases</Button>
    </div>}
    {logisticsQuery.isError && <p role="alert" className="purchase-tracking-notice">Logistics tracking could not be refreshed.<button type="button" className="tap-target purchase-tracking-button" onClick={() => void logisticsQuery.refetch()}>Refresh logistics</button></p>}
    {error && <p role="alert" className="purchase-tracking-notice">{error}<button type="button" className="tap-target purchase-tracking-button" onClick={() => setError('')}>Dismiss</button></p>}
    {isError && <p role="alert" className="purchase-tracking-notice">Purchases could not be refreshed.<button type="button" className="tap-target purchase-tracking-button" onClick={() => void refetch()}>Refresh purchases</button></p>}
    {isPending && <p role="status" className="purchase-tracking-notice"><Loader2 size={16} className="animate-spin"/>{reviewId ? 'Opening supplier order…' : 'Loading purchases…'}</p>}
    {!isPending && !isError && reviewId && !selectedPurchase && <p role="status" className="purchase-tracking-notice">Purchase unavailable in this shop.<button type="button" className="tap-target purchase-tracking-button" onClick={() => setOpen(null)}>Back to purchases</button></p>}
    {!isPending && !isError && !visible.length && !visibleShipments.length && <p className="purchase-tracking-notice">{hasFilters ? 'No purchases match these filters.' : 'No purchases recorded yet.'}{hasFilters && <button type="button" className="tap-target purchase-tracking-button" onClick={clearFilters}>Clear filters</button>}</p>}
    {(attentionRows.length > 0 || queuedReferrals.length > 0) && <section className="purchase-review-queue">
      <header><h2 className={T.label}>Needs attention <span>{attentionRows.length + queuedReferrals.length}</span></h2></header>
      <div>{queuedReferrals.map(({ referral, shipment, line }) => <Button variant="plain" key={referral.id} type="button"
        className="tap-target purchase-tracking-button flex flex-wrap justify-between w-full gap-x-3 text-left"
        aria-haspopup="dialog" onClick={() => setReviewingReferral({ id: referral.id, accountId })}>
        <strong>{line.product_name}</strong><span>Studio referral · {shipment.tracking_number || shipment.logistics_company_name}</span>
      </Button>)}{attentionRows.map(row => renderPurchase(row))}</div>
    </section>}
    {referralReview && <TrackingTask open onClose={() => setReviewingReferral(null)} title="Studio receipt referral">
      <StudioReferralReview key={referralReview.referral.id} {...referralReview} canResolve={canResolveReferral} busy={busy} save={mutate}
        onReturnToReceipt={() => {
          clearFilters();
          setReviewingReferral(null);
          setReceiptTarget({ accountId, shipmentId: referralReview.shipment.id, lineId: referralReview.line.id });
        }}/>
    </TrackingTask>}
    <div className="purchase-tracking-journeys">{journeyGroups.map(group => {
      const places = logisticsPlaces(group.orders.filter(order => group.purchases.some(row => row.purchase?.id === order.purchase_id)), group.shipments);
      const completedPurchases = group.purchases.filter(row => ['received', 'cancelled'].includes(purchaseTrackingStage(row)));
      const shipmentCard = (shipment: typeof group.shipments[number]) => <LogisticsShipmentCard key={shipment.id} grouped
        shipment={shipment} addresses={logistics?.addresses || []} orders={logistics?.orders || []} busy={busy}
        mutate={mutate} accountId={accountId} openPurchase={openLinkedPurchase}
        receiptLineId={receiptTarget?.accountId === accountId && receiptTarget?.shipmentId === shipment.id
          ? receiptTarget.lineId : requestedShipmentId === shipment.id ? requestedReceipt : undefined}
        onShipmentChanged={replaceShipment}
        autoOpenReceiptRetry={!requestedShipmentId || requestedShipmentId === shipment.id}
        onReviewReferral={id => setReviewingReferral({ id, accountId })}
        canResolveReferral={canResolveReferral}
        onCloseReceipt={() => {
          setReceiptTarget(null);
          if (requestedShipmentId === shipment.id && requestedLineId) closeRequestedReceipt();
        }}/>;
      return <section className="purchase-journey purchase-places" key={group.id} aria-label={`${group.name} purchases and shipments`}>
        <header className="purchase-journey-heading"><div className="company-route-heading"><h2 className={T.h3}>{group.name}</h2><span className="text-tea-text-dim">Collection warehouse</span></div><ManifestButtons manifest={companyManifest(group.name, group.orders, logistics?.shipments || [])}/></header>
        <div className="company-rates" aria-label={`Rates for ${group.name}`}>{(logistics?.services || []).filter(service => service.active && (group.orders.some(order => order.logistics_company_id === service.logistics_company_id) || group.shipments.some(shipment => shipment.logistics_company_id === service.logistics_company_id))).map(service => <span key={service.id}><strong>{service.mode === 'sea' ? 'Boat' : 'Air'}</strong> {number(service.rate)} {service.currency}{service.basis === 'm3' ? '/m³' : service.basis === 'kg' ? '/kg' : ' fixed'} <small>{service.name}</small></span>)}</div>
        {filter !== 'received' && filter !== 'cancelled' && <div className="space-y-3">
          {(places.travelling.length > 0 || places.ready.length > 0) &&
            <section className="purchase-place purchase-outbound" aria-label={`Shipments to studio from ${group.name}`}>
              <header><h3 className={T.label}>Shipments to studio</h3></header>
              <div className="purchase-place-body">{[...places.travelling, ...places.ready].map(shipmentCard)}</div>
            </section>}
          <div className="flex flex-wrap gap-3">
          {places.incoming.length > 0 && <section className="purchase-place min-w-0 flex-1" aria-label={`Coming to ${group.name}`}>
            <header><h3 className={T.label}>Supplier → {group.name}</h3><span>{places.incoming.length} {places.incoming.length === 1 ? 'parcel' : 'parcels'}</span></header>
            <div className="purchase-place-body">{places.incoming.map(order => <div className="purchase-parcel" key={order.purchase_id}>
              <div className="purchase-parcel-heading"><button type="button" className="tap-target purchase-place-link" onClick={() => setOpen(order.purchase_id)}>{order.vendor_name || 'Supplier'}</button><button type="button" className="tap-target purchase-tracking-button" disabled={busy} aria-label={`Arrived at ${group.name}: ${order.vendor_name}`} onClick={() => void mutatePurchase(order.purchase_id, () => api.logistics.markAtLogistics(order.purchase_id))}>Arrived</button></div>
              <LogisticsTrackingUpdate update={order.tracking_update} emptyLabel={order.inbound_tracking_number ? 'No parcel update reported' : 'Awaiting tracking number'}/>
              <ParcelContents order={order} openPurchase={setOpen}/>
              {order.warehouse_address && <p className="purchase-parcel-reference"><span>To {order.warehouse_address.label}</span><span>{[order.warehouse_address.address_lines, order.warehouse_address.city].filter(Boolean).join(', ')}</span></p>}
              <p className="purchase-parcel-reference"><span>{order.inbound_courier || 'Courier not recorded'}</span><strong>{order.inbound_tracking_number || 'Tracking not recorded'}</strong></p>
              {purchaseError?.id === order.purchase_id && <p role="alert">{purchaseError.message} Use Arrived again to retry.</p>}
            </div>)}</div>
            {places.incoming.length > 1 && <div className="purchase-place-footer"><LogisticsArrivalGroups orders={places.incoming} busy={busy} mutate={mutate}/></div>}
          </section>}
          {places.collected.length > 0 && <section className="purchase-place min-w-0 flex-1" aria-label={`At ${group.name}`}>
            <header><h3 className={T.label}>At {group.name}</h3><span>{places.collected.length} items</span></header>
            <div className="purchase-place-body">{[...new Map(places.collected.map(({order}) => [order.purchase_id, order])).values()].map(order => <div className="purchase-parcel" key={order.purchase_id}><div className="purchase-parcel-heading"><button className="tap-target purchase-place-link" type="button" onClick={() => setOpen(order.purchase_id)}>{order.vendor_name || 'Supplier'}</button><span className="text-tea-text-dim">Arrived {date(order.logistics_arrived_at)}</span></div><LogisticsTrackingUpdate update={order.tracking_update} emptyLabel={`Arrival recorded ${date(order.logistics_arrived_at)}`}/><ParcelContents order={order} openPurchase={setOpen}/><p className="purchase-parcel-reference">{order.inbound_courier}<strong>{order.inbound_tracking_number || 'Tracking not recorded'}</strong></p></div>)}</div>
            {logistics && places.collected.length > 0 && <div className="purchase-place-footer"><LogisticsCreateShipment key={`prepare:${scopeKey}:${group.id}`} data={{...logistics, orders:group.orders}} busy={busy} mutate={mutate}/></div>}
          </section>}
          </div>
        </div>}
        {(filter === 'received' || filter === 'cancelled') && <section className="purchase-place-history">{places.history.map(shipmentCard)}{completedPurchases.map(row => renderPurchase(row))}</section>}
        {filter !== 'received' && filter !== 'cancelled' && places.history.filter(shipment => shipment.id === requestedShipmentId).map(shipmentCard)}
      </section>;
    })}
    {otherSections.filter(section => section.rows.length > 0 && (section.title === 'Other deliveries' || filter === 'received' || filter === 'cancelled')).map(section => <section key={section.title} className="purchase-tracking-other"><h2 className={T.label}>{section.title}</h2><div className="purchase-tracking-list">{section.rows.map(row => renderPurchase(row))}</div></section>)}
    </div>
    {scoped.some(row => purchaseTrackingStage(row) === 'cancelled') && <button type="button" className="tap-target purchase-tracking-archive" onClick={() => setFilter(filter === 'cancelled' ? 'all' : 'cancelled')}>{filter === 'cancelled' ? 'Show all purchases' : 'Show cancelled purchases'}</button>}
    <TrackingTask
      open={Boolean(selectedPurchase) && !routePurchase}
      onClose={() => detailTask ? setDetailTask(null) : setOpen(null)}
      title={detailTask === 'edit' ? 'Edit purchase' : detailTask === 'history' ? 'Arrival history' : 'Purchase'}
    >
      {selectedPurchase && detailTask === 'history' && (
        <div className="purchase-tracking-history-content">
          {selectedPurchase.history.length ? selectedPurchase.history.map(event => (
            <div key={event.id}>
              <span>{date(event.recorded_at)} · {selectedPurchase.receipt?.lines.find(line => line.product_id === event.product_id)?.product_name || 'Stock arrival'}</span>
              <strong>+{number(event.quantity)} {unit(event.unit)}</strong>
              {event.note && <p className="text-tea-text-sec">{event.note}</p>}
            </div>
          )) : (
            <p className="text-tea-text-sec">{selectedPurchase.receipt?.lines.some(line => line.received_quantity > 0) ? 'Detailed arrival history is unavailable for this older record.' : 'No arrivals recorded yet.'}</p>
          )}
        </div>
      )}
      {selectedPurchase && selectedOrder && detailTask === 'edit' && (
        <div className="purchase-tracking-manual-content">
          {purchaseError?.id === selectedOrder.id && <p role="alert" className="w-full text-tea-text-sec">{purchaseError.message} Your entries are kept. Use the same action to try again.</p>}
          <label className="w-full">
            Purchase status
            <select aria-label={`Purchase status for ${supplier(selectedPurchase)}`} value={selectedOrder.status} disabled={busy || Boolean(selectedPurchase.receipt)} onChange={event => void mutatePurchase(selectedOrder.id, () => api.purchaseOrders.updateStatus(selectedOrder.id, event.target.value))}>
              {[...new Set(['pending', 'ordered', 'cancelled', selectedOrder.status])].map(value => <option key={value} value={value}>{value === 'sent' ? 'Sent' : value.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
          <div className="w-full border-t border-tea-border pt-2">
            {logistics ? (
              <LogisticsOrderFields key={JSON.stringify(selectedLogisticsOrder || selectedOrder.id)} order={selectedLogisticsOrder} services={logistics.services || []} addresses={logistics.addresses || []} purchaseId={selectedOrder.id} tracking={selectedOrder.tracking_number} busy={busy} mutate={mutate} />
            ) : <TrackingField purchase={selectedOrder} busy={busy} save={value => mutatePurchase(selectedOrder.id, () => api.purchaseOrders.setTracking(selectedOrder.id, value))} />}
          </div>
        </div>
      )}
      {selectedPurchase && !detailTask && renderPurchase(selectedPurchase, true)}
    </TrackingTask>
    {routePurchase?.purchase && logistics && <TrackingTask open onClose={() => setRouteTarget(null)} title="Assign inbound route" compact>
      <div className="sticky top-0 z-10 bg-tea-surface pb-2">
        <TeaPanelSummary title={routePurchase.receipt?.lines.map(line => line.product_name).join(', ') || supplier(routePurchase)}
          subtitle={supplier(routePurchase)} metadata={<><span>{stageLabel(routePurchase)}</span>{comingText(routePurchase) && <span>· {comingText(routePurchase)} due</span>}</>}/>
      </div>
      <div className="logistics-form">
        <LogisticsOrderFields key={routePurchase.purchase.id} order={orderFor(routePurchase)}
          services={logistics.services || []} addresses={logistics.addresses || []}
          purchaseId={routePurchase.purchase.id} tracking={routePurchase.purchase.tracking_number}
          busy={busy} mutate={mutate} onSaved={() => setRouteTarget(null)}/>
      </div>
    </TrackingTask>}
    {newForm && <NewForm onClose={() => setNewForm(false)} submitting={busy} onSubmit={async input => { await mutate(async () => { await api.purchaseOrders.create(input); setNewForm(false); }); }}/ >}
    {match && <MatchForm po={match} onClose={() => setMatch(null)} onPrepared={() => { setOpen(match.id); setMatch(null); void refreshStock(); }}/ >}
  </section>;
}
