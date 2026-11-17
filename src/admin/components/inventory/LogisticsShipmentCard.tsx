import React, { useId, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { TeaCard, TeaCardControlRow, TeaCardMeta, TeaCardMetric, TeaCardTitle } from '../../../components/tea/TeaCard';
import { TeaPanelSummary } from '../../../components/tea/TeaPanelSummary';
import { Button } from '../../../components/shared/Button';
import { api, ApiError } from '../../../lib/api';
import { isUnrecordedCurrency } from '../../../lib/currency';
import type { LogisticsAddress, LogisticsFreight, LogisticsOrder, LogisticsReceiveInput, LogisticsShipment } from '../../../lib/logisticsTypes';
import { estimatePackedVolume, type PackedItemKind } from '../../../lib/logisticsFreight';
import { TYPOGRAPHY_CLASSES as T } from '../../../designTokens';
import { LogisticsMutation, ManifestButtons, logisticsNumber as n, logisticsUnit as u, shipmentManifest } from './LogisticsControls';
import { confirmStudioReceipt, readReceiveIntent, remainingReceiptQuantities, selectedReceiptLines } from './logisticsReceipt';
import { StudioReferralForm } from './StudioReceiptReferral';
import { useLogisticsAction, LogisticsActionError } from './useLogisticsAction';
import { referenceUrl } from './logisticsManifest';
import { landedCost } from './landedCost';
import { TrackingTask } from './TrackingTask';
import { AddressPicker, logisticsAddressText } from './LogisticsAddresses';
import { LogisticsTrackingUpdate } from './LogisticsTrackingUpdate';
import { shipmentPlanningSummary, formatCostTotals, formatPlanningMeasure, formatPlanningNumber, planningItemKind } from './logisticsPlanning';
const nullableNumber = (value: FormDataEntryValue | null) => String(value ?? '').trim() === '' ? null : Number(value);
const quoteBasis = { fixed: 'fixed', kg: 'per kg', m3: 'per m³' };
const status = { draft: 'Ready to send', in_transit: 'On the way', partially_received: 'Part received', received: 'In stock', cancelled: 'Cancelled' };
export function shipmentArrivalDate(value: string | null) {
  if (!value) return '';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function ShipmentEditor({ shipment, addresses, busy, mutate: save, onUpdated }: {
  addresses: LogisticsAddress[];
  shipment: LogisticsShipment;
  busy: boolean;
  mutate: LogisticsMutation;
  onUpdated?: (shipment: LogisticsShipment) => void;
}) {
  const { mutate, error } = useLogisticsAction(save);
  const freight = shipment.freight;
  const [basis, setBasis] = useState<LogisticsFreight['basis']>(freight?.basis || (shipment.mode === 'sea' ? 'm3' : 'kg'));
  const [deliveryAddress, setDeliveryAddress] = useState(shipment.delivery_address ? 'keep' : '');
  const allocation = freight?.allocation_basis || (shipment.mode === 'sea' ? 'm3' : 'kg');
  return <form className="logistics-form" onSubmit={event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rate = nullableNumber(form.get('rate'));
    const total = nullableNumber(form.get('total'));
    void mutate(async () => {
      const result = await api.logistics.updateShipment(shipment.id, {
          ...(deliveryAddress !== 'keep' ? { delivery_address_id: deliveryAddress || null } : {}),
        outbound_courier: String(form.get('courier') || '').trim() || null,
        tracking_number: String(form.get('tracking') || '').trim() || null,
        eta: String(form.get('eta') || '') || null,
        freight: rate == null && total == null ? null : {
          basis, rate, total_amount: total,
          billed_quantity: nullableNumber(form.get('billed')),
          currency: String(form.get('currency') || '').trim() || null,
          confirmed: form.get('confirmed') === 'on',
          allocation_basis: form.get('allocation') === 'kg' ? 'kg' : form.get('allocation') === 'm3' ? 'm3' : allocation,
        },
      });
      onUpdated?.(result.shipment);
    });
  }}>
    <div className="logistics-fields logistics-routing-fields [&_input]:!w-full [&_label]:!grid [&_select]:!w-full">
      <label>Outbound courier<input name="courier" defaultValue={shipment.outbound_courier || ''} disabled={busy}/></label>
      <label>Outbound tracking<input name="tracking" defaultValue={shipment.tracking_number || ''} disabled={busy}/></label>
      <AddressPicker addresses={addresses} role="destination" current={shipment.delivery_address} value={deliveryAddress}
        onChange={setDeliveryAddress} busy={busy} label="Deliver to"/>
      <label>Expected at studio<input name="eta" type="date" defaultValue={shipment.eta?.slice(0, 10) || ''} disabled={busy}/></label>
    </div>
    <fieldset className="logistics-fields" disabled={busy}>
      <legend>Shipment freight</legend>
      <label>Charged by<select name="basis" value={basis} onChange={event => setBasis(event.target.value as LogisticsFreight['basis'])}>
        <option value="kg">By weight (kg)</option><option value="m3">By volume (m³)</option><option value="fixed">Fixed bill</option>
      </select></label>
      {basis !== 'fixed' && <>
        <label>Rate per {basis === 'kg' ? 'kg' : 'm³'}<input name="rate" type="number" min="0" step="any" defaultValue={freight?.rate ?? ''}/></label>
        <label>Billable {basis === 'kg' ? 'kg' : 'm³'}<input name="billed" type="number" min="0" step="any" defaultValue={freight?.billed_quantity ?? ''}/></label>
      </>}
      <label>Total bill<input name="total" type="number" min="0" step="any" defaultValue={freight?.total_amount ?? ''}
        placeholder={basis === 'fixed' ? undefined : 'Calculated from rate'}/></label>
      <label>Currency<input name="currency" defaultValue={freight?.currency || ''} placeholder="CNY"/></label>
      {shipment.lines.length > 1 && <label>Split bill by<select name="allocation" defaultValue={allocation}>
        <option value="kg">Weight</option><option value="m3">Volume</option>
      </select></label>}
      <label><input type="checkbox" name="confirmed" defaultChecked={freight?.confirmed}/>Bill confirmed</label>
    </fieldset>
    <div className="flex justify-end"><Button type="submit" size="sm" disabled={busy}>Save shipment</Button></div>
    <LogisticsActionError message={error} recovery="Your entries are kept. Use Save shipment again to retry."/>
  </form>;
}
function ShipmentLineEditor({ line, shipment, busy, mutate: save }: { line: LogisticsShipment['lines'][number]; shipment: LogisticsShipment; busy: boolean; mutate: LogisticsMutation }) {
  const { mutate, error } = useLogisticsAction(save);
  const [volume, setVolume] = useState(line.volume_m3 == null ? '' : String(line.volume_m3));
  const [estimated, setEstimated] = useState(line.volume_estimated);
  const [kind, setKind] = useState<PackedItemKind>(planningItemKind(line));
  const [note, setNote] = useState('');
  return <form aria-label={`Packing and references for ${line.product_name}`} className="logistics-fields" onSubmit={event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void mutate(() => api.logistics.updateShipment(shipment.id, { lines: [{ id: line.id, weight_kg: nullableNumber(form.get('weight')), weight_estimated: form.get('weightEstimated') === 'on', volume_m3: volume.trim() === '' ? null : Number(volume), volume_estimated: estimated, image_url: String(form.get('image') || '').trim() || null, source_url: String(form.get('source') || '').trim() || null }] }));
  }}><label>Packed kg<input name="weight" type="number" min="0" step="any" defaultValue={line.weight_kg ?? ''} disabled={busy}/></label><label><input name="weightEstimated" type="checkbox" defaultChecked={line.weight_estimated}/>Estimated weight</label><label>Packed m³<input name="volume" type="number" min="0" step="any" value={volume} onChange={event => setVolume(event.target.value)} disabled={busy}/></label><label><input type="checkbox" checked={estimated} onChange={event => setEstimated(event.target.checked)}/>Estimated volume</label><label>Estimate for<select value={kind} onChange={event => setKind(event.target.value as PackedItemKind)}><option value="loose_tea">Loose tea</option><option value="pressed_tea">Pressed tea</option><option value="gaiwan">Gaiwan</option><option value="cup">Cup</option><option value="teapot">Teapot</option><option value="other">Other</option></select></label><button type="button" className="tap-target purchase-tracking-button" disabled={busy || kind === 'other'} onClick={() => { const estimate = estimatePackedVolume({ kind, quantity: line.quantity, unit: line.unit }); if (estimate.volume_m3 != null) { setVolume(String(estimate.volume_m3)); setEstimated(true); } setNote(estimate.note); }}>Estimate volume</button>{note && <p className="logistics-field-note text-tea-text-dim">{note}</p>}<label>Reference image URL<input name="image" type="url" defaultValue={line.image_url || ''} placeholder="https://"/></label><label>Source URL<input name="source" type="url" defaultValue={line.source_url || ''} placeholder="https://"/></label><button type="submit" className="tap-target purchase-tracking-button" disabled={busy}>Save packing</button><LogisticsActionError message={error} recovery="Your entries are kept. Use Save packing again to retry."/></form>;
}
function ShipmentReceive({ shipment, orders, busy, mutate: save, accountId, receiptLineId, onCloseReceipt, autoOpenRetry, onReceived }: {
  shipment: LogisticsShipment;
  orders: LogisticsOrder[];
  busy: boolean;
  mutate: LogisticsMutation;
  accountId: string | null;
  receiptLineId?: string;
  onCloseReceipt?: () => void;
  autoOpenRetry: boolean;
  onReceived: (shipment: LogisticsShipment, lines: LogisticsReceiveInput['lines']) => void;
}) {
  const { mutate, error } = useLogisticsAction(save);
  const errorId = useId();
  const storageKey = `teajia:studio-receive:${accountId}:${shipment.id}`;
  const [pending, setPending] = useState<LogisticsReceiveInput | null>(() => readReceiveIntent(storageKey));
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [openedManually, setOpenedManually] = useState(Boolean(pending) && autoOpenRetry);
  const expanded = openedManually || Boolean(receiptLineId);
  const close = () => {
    setOpenedManually(false);
    setReferringId(null);
    if (receiptLineId) onCloseReceipt?.();
  };
  const [referringId, setReferringId] = useState<string | null>(null);
  const referringLine = shipment.lines.find(line => line.id === referringId);
  const heldIds = new Set(shipment.studio_referrals?.filter(referral => !referral.resolved_at).map(referral => referral.line_id));
  const receivable = shipment.lines.filter(line => !heldIds.has(line.id));
  const remaining = shipment.lines.filter(line => line.quantity > line.received_quantity);
  const purchaseIds = [...new Set(remaining.map(line => line.purchase_id))];
  const dueToReceive = remaining.filter(line => !heldIds.has(line.id));
  const lineErrors = new Map<string, string>();
  for (const line of dueToReceive) {
    const raw = quantities[line.id]?.trim();
    if (!raw) continue;
    const count = Number(raw);
    const due = line.quantity - line.received_quantity;
    if (count > due) lineErrors.set(line.id, `${n(count)} ${u(line.unit)} exceeds ${n(due)} ${u(line.unit)} due.`);
    else if (count < 0) lineErrors.set(line.id, 'Enter a count of zero or more.');
    else if (line.unit === 'unit' && !Number.isInteger(count)) lineErrors.set(line.id, 'Enter a whole piece count.');
  }
  const focusCount = !busy && !pending && !referringLine && (dueToReceive.length === 1 || dueToReceive.some(line => line.id === receiptLineId));
  let picked: LogisticsReceiveInput['lines'] = [];
  let invalid = false;
  const receiptQuantities = Object.fromEntries(Object.entries(quantities).filter(([id]) => !heldIds.has(id)));
  try { picked = selectedReceiptLines(receivable, receiptQuantities); } catch { invalid = true; }
  const totals = (pending?.lines || picked).reduce((sum, item) => {
    const line = shipment.lines.find(line => line.id === item.line_id);
    if (line?.unit === 'g') sum.grams += item.quantity; else sum.pieces += item.quantity;
    return sum;
  }, { grams: 0, pieces: 0 });
  const summary = [totals.grams ? `${n(totals.grams)} g` : '', totals.pieces ? `${n(totals.pieces)} pc` : ''].filter(Boolean).join(' + ');
  return <div className="logistics-receive"><div className="logistics-actions">
    <button type="button" className="tap-target purchase-tracking-button logistics-record-arrival"
      aria-label="Record studio arrival" aria-haspopup="dialog" onClick={() => setOpenedManually(true)}>
      {pending ? 'Retry arrival' : 'Receive at studio'}
    </button>
  </div><TrackingTask open={expanded} onClose={close} compact
    initialFocus={focusCount ? '[data-focus-count="true"]:not(:disabled)' : 'container'}
    title={referringLine ? 'Refer to Adrian' : 'Receive at studio'}>
  {referringLine ? <StudioReferralForm key={referringLine.id} shipment={shipment} line={referringLine} busy={busy} save={save}
    cancel={() => setReferringId(null)} saved={() => {
      setQuantities(current => ({ ...current, [referringLine.id]: '' }));
      setReferringId(null);
    }} /> : <div className="logistics-form">
    {shipment.tracking_number && <p className="text-tea-text-sec break-words">Shipment {shipment.tracking_number}</p>}
    {pending ? <>
      <p role="status">The last save was interrupted. Retrying these same counts will not add stock twice.</p>
      <ul aria-label="Counts awaiting confirmation" className="grid gap-1">
        {pending.lines.map(item => {
          const line = shipment.lines.find(candidate => candidate.id === item.line_id);
          return <li key={item.line_id} className="flex flex-wrap justify-between gap-2 border-b border-tea-border py-2">
            <strong className="min-w-0 break-words">{line?.product_name || 'Shipment item'}</strong>
            <span>{n(item.quantity)} {line ? u(line.unit) : ''}</span>
          </li>;
        })}
      </ul>
    </> : <>
      <p className="text-tea-text-sec">Enter what you counted at the studio. Stock changes when you confirm.</p>
      {purchaseIds.map(id => {
        const order = orders.find(candidate => candidate.purchase_id === id);
        const lines = remaining.filter(line => line.purchase_id === id);
        return <section aria-label={order?.vendor_name || 'Supplier'} key={id} className="logistics-selection">
          {lines.map(line => {
            const held = heldIds.has(line.id);
            const due = line.quantity - line.received_quantity;
            const orderedLine = order?.lines.find(item => item.id === line.receipt_line_id);
            const allocation = orderedLine && orderedLine.expected_quantity !== line.quantity ? 'in shipment' : 'ordered';
            const inputError = lineErrors.get(line.id);
            const errorLabel = `${errorId}-${line.id}`;
            return <TeaCard key={line.id} className={receiptLineId === line.id ? 'ring-1 ring-tea-gold' : undefined}
              title={<TeaCardTitle>{line.product_name}</TeaCardTitle>}
              meta={<TeaCardMeta primary={order?.vendor_name || 'Supplier'} trailing={held ? 'With Adrian for review' : undefined}/>}
              metricsLabel="Studio receipt quantities"
              metrics={<>
                <TeaCardMetric label={allocation === 'ordered' ? 'Ordered' : 'In shipment'}>{`${n(line.quantity)} ${u(line.unit)}`}</TeaCardMetric>
                <TeaCardMetric label="Received">{`${n(line.received_quantity)} ${u(line.unit)}`}</TeaCardMetric>
                <TeaCardMetric label="Due"><strong className="text-ui-16 text-tea-text">{n(due)} {u(line.unit)}<span className="sr-only"> due</span></strong></TeaCardMetric>
              </>}
              actions={!held && <div className="flex w-full flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <label>
                    <span className="text-tea-text-sec">Counted now ({u(line.unit)})</span>
                    <input aria-label={`Received ${line.product_name}`} type="number" min="0" max={due} step={line.unit === 'unit' ? '1' : 'any'}
                      placeholder="0" value={quantities[line.id] || ''} disabled={busy} aria-invalid={Boolean(inputError)}
                      aria-describedby={inputError ? errorLabel : undefined}
                      data-focus-count={dueToReceive.length === 1 || receiptLineId === line.id}
                      onChange={event => setQuantities(current => ({ ...current, [line.id]: event.target.value }))}/>
                  </label>
                  {inputError && <p id={errorLabel} role="alert" className="mt-1 text-tea-text-sec">{inputError}</p>}
                </div>
                <Button variant="plain" type="button" className="tap-target purchase-tracking-button" disabled={busy}
                  aria-label={`Refer to Adrian for ${line.product_name}`} onClick={() => setReferringId(line.id)}>Refer to Adrian</Button>
              </div>}
            />;
          })}
        </section>;
      })}
    </>}
    {invalid && lineErrors.size === 0 && <p role="alert">Check the quantities. They cannot exceed what is due.</p>}
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!pending && dueToReceive.length > 1 && <button type="button" className="tap-target purchase-tracking-button mr-auto"
        disabled={busy} onClick={() => setQuantities(remainingReceiptQuantities(receivable))}>Fill all due amounts</button>}
      <Button type="button" size="sm" disabled={busy || (!pending && (invalid || !picked.length))} onClick={() => void mutate(async () => {
      const input = pending || { idempotency_key: crypto.randomUUID(), lines: picked };
      setPending(input);
      try {
        const result = await confirmStudioReceipt(shipment.id, input, storageKey);
        onReceived(result.shipment, input.lines);
      }
      catch (cause) {
        if (cause instanceof ApiError && cause.data?.code === 'studio_referral_open') setQuantities({});
        if (cause instanceof ApiError && ([400, 401, 403, 404, 422].includes(cause.status) || cause.data?.code === 'studio_referral_open')) {
          setPending(null); try { sessionStorage.removeItem(storageKey); } catch { /* Keep correction available. */ }
        }
        throw cause;
      }
      setPending(null); setQuantities({}); close();
    })}>{pending ? 'Retry save' : 'Confirm received'}{summary ? ` · ${summary}` : ''}</Button></div>
    <LogisticsActionError message={error} recovery={pending ? 'Use Retry save to finish these same quantities without recording them twice.' : 'Check the current quantities before confirming again.'}/>
  </div>}</TrackingTask></div>;
}
function ShipmentDispatch({ shipment, busy, mutate: save, onDispatched, onEdit }: {
  shipment: LogisticsShipment;
  busy: boolean;
  mutate: LogisticsMutation;
  onDispatched: (shipment: LogisticsShipment) => void;
  onEdit: () => void;
}) {
  const { mutate, error } = useLogisticsAction(save);
  const [sending, setSending] = useState(false);
  const address = shipment.delivery_address ? null : 'Delivery address missing';
  const arrival = shipment.eta ? null : 'ETA unknown';
  const missing = [address, arrival].filter(Boolean).join(' · ');
  return <div className="min-w-0">
    {missing && <p className="text-tea-text-sec">{missing}</p>}
    <TeaCardControlRow>
      <Button type="button" size="sm" disabled={busy || sending || !shipment.tracking_number} onClick={() => void mutate(async () => {
        setSending(true);
        try {
          const result = await api.logistics.dispatchShipment(shipment.id);
          onDispatched(result.shipment);
        } finally {
          setSending(false);
        }
      })}>{sending ? 'Sending…' : 'Mark sent to studio'}</Button>
      <Button variant="plain" type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={onEdit}>
        {shipment.tracking_number ? 'Edit costs & shipment' : 'Add tracking & shipment details'}
      </Button>
    </TeaCardControlRow>
    <LogisticsActionError message={error} recovery="Check the shipment before trying to mark it sent again."/>
  </div>;
}
export function LogisticsShipmentCard({ shipment, orders, addresses = [], busy, mutate, accountId, openPurchase, grouped = false, receiptLineId, onCloseReceipt, onShipmentChanged, onReviewReferral, canResolveReferral, autoOpenReceiptRetry = true }: {
  grouped?: boolean;
  addresses?: LogisticsAddress[];
  shipment: LogisticsShipment;
  orders: LogisticsOrder[];
  busy: boolean;
  mutate: LogisticsMutation;
  accountId: string | null;
  openPurchase: (id: string) => void;
  receiptLineId?: string;
  onCloseReceipt?: () => void;
  onShipmentChanged?: (shipment: LogisticsShipment) => void;
  onReviewReferral?: (id: string) => void;
  canResolveReferral?: boolean;
  autoOpenReceiptRetry?: boolean;
}) {
  const { mutate: cancel, error: cancelError } = useLogisticsAction(mutate);
  const [editor, setEditor] = useState<'shipment' | 'packing' | null>(null);
  const [receiptNotice, setReceiptNotice] = useState<string[]>([]);
  const [dispatched, setDispatched] = useState<LogisticsShipment | null>(null);
  const displayed = shipment.state === 'draft' && dispatched?.id === shipment.id ? dispatched : shipment;
  const state = displayed.state;
  const onReceived = (updated: LogisticsShipment, counts: LogisticsReceiveInput['lines']) => {
    setReceiptNotice(counts.flatMap(count => {
      const line = updated.lines.find(item => item.id === count.line_id);
      if (!line) return [];
      const due = line.quantity - line.received_quantity;
      const summary = `${n(count.quantity)} ${u(line.unit)} added · ${n(due)} ${u(line.unit)} still due`;
      return [counts.length > 1 ? `${line.product_name} · ${summary}` : summary];
    }));
    onShipmentChanged?.(updated);
  };
  const { mutate: saveEstimate, error: estimateError } = useLogisticsAction(mutate);
  const planning = shipmentPlanningSummary(shipment);
  const freight = planning.freight;
  const freightUnit = freight.basis === 'm3' ? 'm³' : 'kg';
  const originalQuote = shipment.service_quote;
  const purchases = [...new Set(shipment.lines.map(line => line.purchase_id))];
  const arrivalDate = shipmentArrivalDate(shipment.eta);
  const name = `${shipment.mode === 'sea' ? 'Boat' : 'Air'} shipment`;
  return <article id={`shipment-card-${shipment.id}`} tabIndex={-1}
    className="logistics-shipment logistics-shipment-compact"
    aria-label={`${shipment.logistics_company_name} shipment`}>
    <div className="logistics-shipment-heading">
      <div className="logistics-actions"><h2 className={T.h3}>{name}</h2>{shipment.service_quote?.name && <span className="text-tea-text-sec">{shipment.service_quote.name}</span>}<span className="logistics-state" data-state={state}>{status[state]}</span></div>
      {!grouped && <span className="text-tea-text-sec">{shipment.logistics_company_name}</span>}
    </div>
    <div className="px-2 pb-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Shipment contents">
        {displayed.lines.map(line => {
          const order = orders.find(item => item.purchase_id === line.purchase_id);
          const expected = order?.lines.find(item => item.id === line.receipt_line_id)?.expected_quantity;
          const referral = displayed.studio_referrals?.find(item => item.line_id === line.id && !item.resolved_at);
          return <TeaCard key={line.id}
            title={<TeaCardTitle>{line.product_name}</TeaCardTitle>}
            trailing={<button type="button" className="tap-target purchase-place-link" aria-label={`Open purchase for ${line.product_name}`}
              title="Open purchase" onClick={() => openPurchase(line.purchase_id)}><ArrowUpRight size={14} aria-hidden="true"/></button>}
            meta={<TeaCardMeta primary={order?.vendor_name || 'Supplier'} trailing={referral ? 'With Adrian for review' : undefined}/>}
            metricsLabel="Shipment quantities"
            metrics={<>
              <TeaCardMetric label={expected != null && expected !== line.quantity ? 'In shipment' : 'Ordered'}>{`${n(line.quantity)} ${u(line.unit)}`}</TeaCardMetric>
              <TeaCardMetric label="Received">{`${n(line.received_quantity)} ${u(line.unit)}`}</TeaCardMetric>
              <TeaCardMetric label="Due">{`${n(line.quantity - line.received_quantity)} ${u(line.unit)}`}</TeaCardMetric>
            </>}
            actions={referral && onReviewReferral && <TeaCardControlRow>
              <Button variant="plain" type="button" className="tap-target purchase-tracking-button"
                aria-label={`${line.product_name} · Studio referral`} onClick={() => onReviewReferral(referral.id)}>
                {canResolveReferral ? 'Review discrepancy' : 'View discrepancy'}
              </Button>
            </TeaCardControlRow>}>
            {referral && <div className="min-w-0 space-y-1 px-2.5 py-2 text-tea-text-sec">
              <p className="break-words"><strong>Reason</strong> · {referral.reason}</p>
              <p className="break-words"><strong>Evidence</strong> · {referral.source_reference}</p>
              <p><strong>Count reported</strong> · {referral.observed_quantity == null ? 'Unknown' : `${n(referral.observed_quantity)} ${u(line.unit)}`}</p>
            </div>}
          </TeaCard>;
        })}
      </div>
      {receiptNotice.length > 0 && <ul role="status" className="grid gap-1 px-2 py-2 text-tea-text-sec">
        {receiptNotice.map((notice, index) => <li key={index}>{notice}</li>)}
      </ul>}
    </div>
    <div className="logistics-card-actions">
      {state === 'draft' && <ShipmentDispatch key={shipment.id} shipment={displayed} busy={busy} mutate={mutate}
        onDispatched={snapshot => { setDispatched(snapshot); onShipmentChanged?.(snapshot); }} onEdit={() => setEditor('shipment')}/>}
      {(state === 'in_transit' || state === 'partially_received') &&
        <ShipmentReceive key={`${accountId}:${shipment.id}`} shipment={displayed} orders={orders} busy={busy}
          mutate={mutate} accountId={accountId} receiptLineId={receiptLineId} onCloseReceipt={onCloseReceipt} autoOpenRetry={autoOpenReceiptRetry} onReceived={onReceived}/>}
      {state !== 'draft' && <button type="button" className="tap-target purchase-tracking-button" aria-haspopup="dialog"
        onClick={() => setEditor('shipment')}>{state === 'cancelled' ? 'View record' : 'Edit costs & shipment'}</button>}
      {!grouped && <ManifestButtons manifest={shipmentManifest(shipment, orders)}/>}
    </div>
    <div className="logistics-shipment-route">
      <span><strong>{shipment.logistics_company_name} → {shipment.delivery_address?.label || 'Art studio · address not set'}</strong></span>
      <span>{shipment.tracking_number || 'Outbound tracking not recorded'}{shipment.outbound_courier ? ` · ${shipment.outbound_courier}` : ''}</span>
      <span><span className="text-tea-text-dim">Arrival </span><strong>{arrivalDate || 'Date not recorded'}</strong></span>
    </div>
    {shipment.delivery_address && <p className="break-words px-3 text-tea-text-sec">{logisticsAddressText(shipment.delivery_address)}</p>}
    <LogisticsTrackingUpdate update={shipment.tracking_update} showCarrierSource
      emptyLabel={shipment.mode === 'sea' ? 'No carrier report for this Boat shipment' : 'No shipment update reported'}/>
    <div className="shipment-overview">
      <div className="shipment-costs" aria-label="Shipment costs"><dl><div><dt>Goods paid</dt><dd>{formatCostTotals(planning.goods)}</dd></div><div className="shipment-freight-total"><dt>Shipping {freight.status === 'confirmed' ? 'bill' : 'estimate'}</dt><dd>{freight.amount == null ? 'Not enough information' : `${n(freight.amount)} ${freight.currency}`}</dd></div></dl>
      <p className="shipment-calculation">{freight.basis === 'fixed' ? 'Fixed freight charge' : freight.rate != null && freight.currency ? `${freight.quantity == null ? 'Quantity needed' : formatPlanningNumber(freight.quantity)} ${freightUnit} × ${n(freight.rate)} ${freight.currency}/${freightUnit}` : 'Set the company’s rate to estimate shipping.'}{freight.source === 'planning' ? ' · estimate only' : freight.quantity != null ? ' · billed quantity' : ''}</p>
      {originalQuote && shipment.freight && <p className="shipment-calculation">
        Original quote · {originalQuote.rate == null ? 'Rate not recorded' : isUnrecordedCurrency(originalQuote.currency) ? 'Currency not recorded' : `${n(originalQuote.rate)} ${originalQuote.currency}`}
        {' · '}{quoteBasis[originalQuote.basis]}
      </p>}
      {freight.issue && <p className="shipment-calculation text-tea-text-dim">{freight.issue}</p>}</div>
    </div>
    <div className="shipment-measures"><span><span>Packed volume </span>{formatPlanningMeasure(planning.volume, 'm³')}</span><span><span>Packed weight </span>{formatPlanningMeasure(planning.weight, 'kg')}</span></div>
    <TrackingTask open={editor !== null} onClose={() => setEditor(null)} compact
      title={editor === 'packing' ? 'Packing & item costs' : `${name}${shipment.tracking_number ? ` · ${shipment.tracking_number}` : ''}`}>
      <div hidden={editor === 'packing'}><div className="logistics-form">
        <TeaPanelSummary title={shipment.lines.map(line => line.product_name).join(', ')}
          subtitle={shipment.logistics_company_name} metadata={status[state]}/>
        <div className="logistics-freight-summary">
          {originalQuote && <span className="mr-2">
            Original quote <strong>{originalQuote.rate == null ? 'Rate not recorded' : isUnrecordedCurrency(originalQuote.currency) ? 'Currency not recorded' : `${n(originalQuote.rate)} ${originalQuote.currency}`}</strong>
            <small className="text-tea-text-dim"> · {quoteBasis[originalQuote.basis]}</small>
          </span>}
          <span>Freight <strong>{shipment.freight_total == null ? 'not set' : `${n(shipment.freight_total)} ${shipment.freight?.currency || ''}`}</strong>{shipment.freight_total != null && <small className="text-tea-text-dim"> · {shipment.freight?.confirmed ? 'bill confirmed' : 'estimate'}{shipment.freight?.confirmed && shipment.freight_estimated ? ' · estimated split' : ''}</small>}</span>
        </div>
        {shipment.freight_issue && <p className="logistics-shipment-issue">{shipment.freight_issue}</p>}
        {shipment.state !== 'cancelled' && <ShipmentEditor key={JSON.stringify([shipment.freight, shipment.tracking_number, shipment.outbound_courier, shipment.eta, shipment.delivery_address])} shipment={shipment} addresses={addresses} busy={busy} mutate={mutate} onUpdated={onShipmentChanged}/>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-tea-border pt-2">
          {state === 'draft' && <Button variant="plain" type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => void cancel(() => api.logistics.cancelShipment(shipment.id))}>Cancel shipment</Button>}
          <Button variant="plain" type="button" className="tap-target purchase-tracking-button" onClick={() => setEditor('packing')}>Packing & item costs</Button>
        </div>
        <LogisticsActionError message={cancelError} recovery="Use Cancel shipment again to retry."/>
      </div></div>
      <div hidden={editor !== 'packing'}><div className="logistics-form">
        <Button variant="plain" type="button" className="tap-target purchase-tracking-button" onClick={() => setEditor('shipment')}>Back to shipment</Button>
        {planning.lines.some(line => line.suggestedVolume) && <button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => void saveEstimate(() => api.logistics.updateShipment(shipment.id, { lines: planning.lines.filter(line => line.suggestedVolume).map(suggestion => { const line = shipment.lines.find(line => line.id === suggestion.id)!; return { id: line.id, weight_kg: line.weight_kg, weight_estimated: line.weight_estimated, volume_m3: suggestion.volumeM3, volume_estimated: true }; }) }))}>Use estimated packing volumes</button>}
        <LogisticsActionError message={estimateError} recovery="Use estimated packing volumes again to retry."/>
        <ManifestButtons manifest={shipmentManifest(shipment, orders)}/>
        {purchases.map(id => <section className="logistics-purchase-group" key={id}>
          <button className="tap-target purchase-tracking-button" type="button" onClick={() => { setEditor(null); openPurchase(id); }}>{orders.find(order => order.purchase_id === id)?.vendor_name || 'Purchase'} · order details</button>
          {shipment.lines.filter(line => line.purchase_id === id).map(line => <div className="logistics-line" key={line.id}>
            <div className="logistics-line-summary">
              {referenceUrl(line.image_url) && <img src={referenceUrl(line.image_url)!} alt={`Reference for ${line.product_name}`} loading="lazy" referrerPolicy="no-referrer"/>}
              <span>{line.product_name}<small className="text-tea-text-dim">{line.original_cost_amount == null ? 'Paid cost not recorded' : `${n(line.original_cost_amount)} ${line.original_cost_currency || ''}`}{line.allocated_freight != null ? ` · Freight ${n(line.allocated_freight)} ${shipment.freight?.currency || ''}${shipment.freight_estimated ? ' estimate' : ''}` : ''}{landedCost(line.original_cost_amount, line.original_cost_currency, line.allocated_freight, shipment.freight?.currency) != null ? ` · Landed ${n(landedCost(line.original_cost_amount, line.original_cost_currency, line.allocated_freight, shipment.freight?.currency)!)} ${line.original_cost_currency}` : ''}</small></span>
              <span>{n(line.quantity)} {u(line.unit)}{line.received_quantity > 0 && <small className="text-tea-text-dim">{n(line.received_quantity)} received</small>}</span>
              <span className="text-tea-text-sec">{line.volume_m3 == null ? 'Volume not set' : `${n(line.volume_m3)} m³${line.volume_estimated ? ' est.' : ''}`}</span>
            </div>
            {shipment.state !== 'cancelled' && <ShipmentLineEditor key={`${line.id}:${line.volume_m3}:${line.weight_kg}:${line.image_url}:${line.source_url}`} line={line} shipment={shipment} busy={busy} mutate={mutate}/>}
          </div>)}
        </section>)}
      </div></div>
    </TrackingTask>
  </article>;
}
