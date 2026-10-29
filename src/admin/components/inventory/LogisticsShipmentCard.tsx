import React, { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { LogisticsAddress, LogisticsFreight, LogisticsOrder, LogisticsReceiveInput, LogisticsShipment } from '../../../lib/logisticsTypes';
import { estimatePackedVolume, type PackedItemKind } from '../../../lib/logisticsFreight';
import { TYPOGRAPHY_CLASSES as T } from '../../../designTokens';
import { LogisticsMutation, ManifestButtons, logisticsNumber as n, logisticsUnit as u, shipmentManifest } from './LogisticsControls';
import { confirmStudioReceipt, readReceiveIntent, remainingReceiptQuantities, selectedReceiptLines } from './logisticsReceipt';
import { useLogisticsAction, LogisticsActionError } from './useLogisticsAction';
import { referenceUrl } from './logisticsManifest';
import { TrackingTask } from './TrackingTask';
import { AddressPicker, logisticsAddressText } from './LogisticsAddresses';
import { LogisticsTrackingUpdate } from './LogisticsTrackingUpdate';
import { shipmentPlanningSummary, formatCostTotals, formatPlanningMeasure, formatPlanningNumber, planningItemKind } from './logisticsPlanning';
const nullableNumber = (value: FormDataEntryValue | null) => String(value ?? '').trim() === '' ? null : Number(value);
const status = { draft: 'Ready to send', in_transit: 'On the way', partially_received: 'Part received', received: 'In stock', cancelled: 'Cancelled' };
export function shipmentArrivalDate(value: string | null) {
  if (!value) return '';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function ShipmentEditor({ shipment, addresses, busy, mutate: save }: { addresses: LogisticsAddress[]; shipment: LogisticsShipment; busy: boolean; mutate: LogisticsMutation }) {
  const { mutate, error } = useLogisticsAction(save);
  const freight = shipment.freight;
  const [deliveryAddress, setDeliveryAddress] = useState(shipment.delivery_address ? 'keep' : '');
  return <form className="logistics-form" onSubmit={event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const basis = form.get('basis') as LogisticsFreight['basis'];
    const rate = nullableNumber(form.get('rate')); const total = nullableNumber(form.get('total'));
    void mutate(() => api.logistics.updateShipment(shipment.id, { ...(deliveryAddress !== 'keep' ? { delivery_address_id: deliveryAddress || null } : {}), outbound_courier: String(form.get('courier') || '').trim() || null, tracking_number: String(form.get('tracking') || '').trim() || null, eta: String(form.get('eta') || '') || null, freight: rate == null && total == null ? null : { basis, rate, total_amount: total, billed_quantity: nullableNumber(form.get('billed')), currency: String(form.get('currency') || '').trim() || null, confirmed: form.get('confirmed') === 'on', allocation_basis: form.get('allocation') as 'kg' | 'm3' } }));
  }}><div className="logistics-fields logistics-routing-fields"><AddressPicker addresses={addresses} role="destination" current={shipment.delivery_address} value={deliveryAddress} onChange={setDeliveryAddress} busy={busy} label="Deliver to"/><label>Outbound courier<input name="courier" defaultValue={shipment.outbound_courier || ''} disabled={busy}/></label><label>Outbound tracking<input name="tracking" defaultValue={shipment.tracking_number || ''} disabled={busy}/></label><label>Expected at studio<input name="eta" type="date" defaultValue={shipment.eta?.slice(0, 10) || ''} disabled={busy}/></label></div><fieldset className="logistics-fields"><legend>Shipment freight</legend><label>Charged by<select name="basis" defaultValue={freight?.basis || (shipment.mode === 'sea' ? 'm3' : 'kg')}><option value="kg">kg</option><option value="m3">m³</option><option value="fixed">Fixed bill</option></select></label><label>Rate<input name="rate" type="number" min="0" step="any" defaultValue={freight?.rate ?? ''}/></label><label>Billable kg / m³<input name="billed" type="number" min="0" step="any" defaultValue={freight?.billed_quantity ?? ''} placeholder="Enter billable size"/></label><label>Total bill<input name="total" type="number" min="0" step="any" defaultValue={freight?.total_amount ?? ''} placeholder="From rate"/></label><label>Currency<input name="currency" defaultValue={freight?.currency || ''} placeholder="CNY"/></label><label>Split by<select name="allocation" defaultValue={freight?.allocation_basis || (shipment.mode === 'sea' ? 'm3' : 'kg')}><option value="kg">Weight</option><option value="m3">Volume</option></select></label><label><input type="checkbox" name="confirmed" defaultChecked={freight?.confirmed}/>Bill confirmed</label></fieldset><div className="logistics-actions"><button className="tap-target purchase-tracking-button" disabled={busy} type="submit">Save shipment</button><span className="text-tea-text-dim">Freight is recorded for landed cost; shelf pricing is unchanged.</span></div><LogisticsActionError message={error} recovery="Your entries are kept. Use Save shipment again to retry."/></form>;
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
function ShipmentReceive({ shipment, orders, busy, mutate: save, accountId }: { shipment: LogisticsShipment; orders: LogisticsOrder[]; busy: boolean; mutate: LogisticsMutation; accountId: string | null }) {
  const { mutate, error } = useLogisticsAction(save);
  const storageKey = `teajia:studio-receive:${accountId}:${shipment.id}`;
  const [pending, setPending] = useState<LogisticsReceiveInput | null>(() => readReceiveIntent(storageKey));
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(Boolean(pending));
  const remaining = shipment.lines.filter(line => line.quantity > line.received_quantity);
  const purchaseIds = [...new Set(remaining.map(line => line.purchase_id))];
  let picked: LogisticsReceiveInput['lines'] = [];
  let invalid = false;
  try { picked = selectedReceiptLines(shipment.lines, quantities); } catch { invalid = true; }
  const totals = (pending?.lines || picked).reduce((sum, item) => {
    const line = shipment.lines.find(line => line.id === item.line_id);
    if (line?.unit === 'g') sum.grams += item.quantity; else sum.pieces += item.quantity;
    return sum;
  }, { grams: 0, pieces: 0 });
  const summary = [totals.grams ? `${n(totals.grams)} g` : '', totals.pieces ? `${n(totals.pieces)} pc` : ''].filter(Boolean).join(' + ');
  const chooseGroup = (purchaseId: string, checked: boolean) => setQuantities(current => {
    const next = { ...current };
    for (const line of remaining.filter(line => line.purchase_id === purchaseId)) next[line.id] = checked ? String(line.quantity - line.received_quantity) : '';
    return next;
  });
  return <div className="logistics-receive"><div className="logistics-actions">
    <button type="button" className="tap-target purchase-tracking-button logistics-record-arrival" aria-label="Record studio arrival" aria-haspopup="dialog" onClick={() => setExpanded(true)}>{pending ? 'Retry arrival' : 'Receive'}</button>
  </div><TrackingTask open={expanded} onClose={() => setExpanded(false)} title="Receive at studio"><div className="logistics-form">
    <p className="text-tea-text-sec">{shipment.tracking_number ? `Shipment ${shipment.tracking_number}. ` : ''}Select only what has physically arrived at the studio. Stock changes when you confirm received.</p>
    {pending ? <p role="status">The last save was interrupted. Retry the same quantities to finish recording it.</p> : <>
      <div className="logistics-actions"><button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => setQuantities(remainingReceiptQuantities(shipment.lines))}>Receive all</button><button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => setQuantities({})}>Clear</button></div>
      {purchaseIds.map(id => {
        const order = orders.find(order => order.purchase_id === id);
        const lines = remaining.filter(line => line.purchase_id === id);
        return <div className="logistics-selection" key={id}><label className="logistics-actions"><input type="checkbox" className="tap-target" aria-label={`Select purchase from ${order?.vendor_name || 'supplier'}`} checked={lines.every(line => Number(quantities[line.id]) > 0)} aria-checked={lines.some(line => Number(quantities[line.id]) > 0) && !lines.every(line => Number(quantities[line.id]) > 0) ? 'mixed' : lines.every(line => Number(quantities[line.id]) > 0)} ref={element => { if (element) element.indeterminate = lines.some(line => Number(quantities[line.id]) > 0) && !lines.every(line => Number(quantities[line.id]) > 0); }} disabled={busy} onChange={event => chooseGroup(id, event.target.checked)}/><span>{order?.vendor_name || 'Supplier'} · {order?.inbound_tracking_number || 'Inbound tracking not recorded'}</span></label>
          {lines.map(line => <div className="logistics-receive-line" key={line.id}><label className="flex items-center gap-2 min-w-0"><input type="checkbox" className="tap-target" aria-label={`Select ${line.product_name}`} checked={Number(quantities[line.id]) > 0} disabled={busy} onChange={event => setQuantities(current => ({ ...current, [line.id]: event.target.checked ? String(line.quantity - line.received_quantity) : '' }))}/><span>{line.product_name}<small className="text-tea-text-dim">{n(line.quantity - line.received_quantity)} {u(line.unit)} coming</small></span></label><input aria-label={`Received ${line.product_name}`} type="number" min="0" max={line.quantity - line.received_quantity} step={line.unit === 'unit' ? '1' : 'any'} placeholder="0" value={quantities[line.id] || ''} disabled={busy} onChange={event => setQuantities(current => ({ ...current, [line.id]: event.target.value }))}/><span>{u(line.unit)}</span></div>)}
        </div>;
      })}
    </>}
    {invalid && <p role="alert">Check the quantities. They cannot exceed what is coming.</p>}
    <div className="logistics-actions"><button type="button" className="tap-target purchase-tracking-button" disabled={busy || (!pending && (invalid || !picked.length))} onClick={() => void mutate(async () => {
      const input = pending || { idempotency_key: crypto.randomUUID(), lines: selectedReceiptLines(shipment.lines, quantities) };
      setPending(input);
      try { await confirmStudioReceipt(shipment.id, input, storageKey); }
      catch (cause) {
        if (cause instanceof ApiError && [400, 401, 403, 404, 422].includes(cause.status)) {
          setPending(null); try { sessionStorage.removeItem(storageKey); } catch { /* Keep correction available. */ }
        }
        throw cause;
      }
      setPending(null); setQuantities({}); setExpanded(false);
    })}>{pending ? 'Retry save' : 'Confirm received'}{summary ? ` · ${summary}` : ''}</button></div>
    <LogisticsActionError message={error} recovery={pending ? 'Use Retry save to finish these same quantities without recording them twice.' : 'Your quantities are kept. Check them and use Confirm received again.'}/>
  </div></TrackingTask></div>;
}
function ShipmentDispatch({ shipment, busy, mutate: save }: { shipment: LogisticsShipment; busy: boolean; mutate: LogisticsMutation }) {
  const { mutate, error } = useLogisticsAction(save);
  const [tracking, setTracking] = useState(shipment.tracking_number || '');
  const savedTracking = useRef(shipment.tracking_number || '');
  useEffect(() => {
    const previous = savedTracking.current;
    const next = shipment.tracking_number || '';
    setTracking(current => current === previous ? next : current);
    savedTracking.current = next;
  }, [shipment.tracking_number]);
  return <form className="logistics-actions logistics-dispatch" onSubmit={event => {
    event.preventDefault();
    void mutate(async () => {
      if (tracking.trim() !== shipment.tracking_number) await api.logistics.updateShipment(shipment.id, { tracking_number: tracking.trim() });
      await api.logistics.dispatchShipment(shipment.id);
    });
  }}><label>Outbound tracking <input aria-label="Dispatch tracking number" value={tracking} onChange={event => setTracking(event.target.value)} disabled={busy} required/></label><button type="submit" className="tap-target purchase-tracking-button" disabled={busy || !tracking.trim()}>Mark sent to studio</button><LogisticsActionError message={error} recovery="Your tracking number is kept. Use Mark sent to studio again to retry."/></form>;
}
export function LogisticsShipmentCard({ shipment, orders, addresses = [], busy, mutate, accountId, openPurchase, grouped = false }: { grouped?: boolean; addresses?: LogisticsAddress[]; shipment: LogisticsShipment; orders: LogisticsOrder[]; busy: boolean; mutate: LogisticsMutation; accountId: string | null; openPurchase: (id: string) => void }) {
  const { mutate: cancel, error: cancelError } = useLogisticsAction(mutate);
  const [editing, setEditing] = useState(false);
  const { mutate: saveEstimate, error: estimateError } = useLogisticsAction(mutate);
  const planning = shipmentPlanningSummary(shipment);
  const freight = planning.freight;
  const freightUnit = freight.basis === 'm3' ? 'm³' : 'kg';
  const purchases = [...new Set(shipment.lines.map(line => line.purchase_id))];
  const arrivalDate = shipmentArrivalDate(shipment.eta);
  const name = `${shipment.mode === 'sea' ? 'Boat' : 'Air'} shipment`;
  return <article className="logistics-shipment logistics-shipment-compact" aria-label={`${shipment.logistics_company_name} shipment`}>
    <div className="logistics-shipment-heading">
      <div className="logistics-actions"><h2 className={T.h3}>{name}</h2>{shipment.service_quote?.name && <span className="text-tea-text-sec">{shipment.service_quote.name}</span>}<span className="logistics-state" data-state={shipment.state}>{status[shipment.state]}</span></div>
      {!grouped && <span className="text-tea-text-sec">{shipment.logistics_company_name}</span>}
    </div>
    <div className="logistics-shipment-route"><span><strong>{shipment.logistics_company_name} → {shipment.delivery_address?.label || 'Art studio · address not set'}</strong></span><span>{shipment.tracking_number || 'Outbound tracking not recorded'}{shipment.outbound_courier ? ` · ${shipment.outbound_courier}` : ''}</span><span><span className="text-tea-text-dim">Arrival </span><strong>{arrivalDate || 'Date not recorded'}</strong></span></div>
    {shipment.delivery_address && <div className="logistics-shipment-route"><span className="text-tea-text-sec break-words">{logisticsAddressText(shipment.delivery_address)}</span></div>}
    <LogisticsTrackingUpdate update={shipment.tracking_update} emptyLabel="No shipment update reported"/>
    <div className="shipment-overview">
      <div className="logistics-shipment-contents" aria-label="Shipment contents"><div className="parcel-column-labels"><span>Contents</span><span>Quantity</span><span>Paid</span></div>{shipment.lines.map(line => <div className="parcel-content-row" key={line.id}><button type="button" className="tap-target purchase-place-link" aria-label={`Open purchase for ${line.product_name}`} onClick={() => openPurchase(line.purchase_id)}>{line.product_name}</button><span>{n(line.quantity)} {u(line.unit)}{shipment.state === 'partially_received' && <small className="block text-tea-text-dim">{n(line.received_quantity)} received</small>}</span><span>{line.original_cost_amount == null ? 'Not recorded' : `${n(line.original_cost_amount)} ${line.original_cost_currency || '(currency needed)'}`}</span></div>)}</div>
      <div className="shipment-costs" aria-label="Shipment costs"><dl><div><dt>Goods paid</dt><dd>{formatCostTotals(planning.goods)}</dd></div><div className="shipment-freight-total"><dt>Shipping {freight.status === 'confirmed' ? 'bill' : 'estimate'}</dt><dd>{freight.amount == null ? 'Not enough information' : `${n(freight.amount)} ${freight.currency}`}</dd></div></dl>
      <p className="shipment-calculation">{freight.basis === 'fixed' ? 'Fixed freight charge' : freight.rate != null && freight.currency ? `${freight.quantity == null ? 'Quantity needed' : formatPlanningNumber(freight.quantity)} ${freightUnit} × ${n(freight.rate)} ${freight.currency}/${freightUnit}` : 'Set the company’s rate to estimate shipping.'}{freight.source === 'planning' ? ' · estimate only' : freight.quantity != null ? ' · billed quantity' : ''}</p>
      {freight.issue && <p className="shipment-calculation text-tea-text-dim">{freight.issue}</p>}</div>
    </div>
    <div className="shipment-measures"><span><span>Packed volume </span>{formatPlanningMeasure(planning.volume, 'm³')}</span><span><span>Packed weight </span>{formatPlanningMeasure(planning.weight, 'kg')}</span><span className="text-tea-text-dim">{shipment.mode === 'sea' ? 'Volume and weight are separate measurements.' : 'Packed weight includes packaging.'}</span></div>
    <div className="logistics-card-actions">
      {shipment.state === 'draft' && <ShipmentDispatch key={shipment.id} shipment={shipment} busy={busy} mutate={mutate}/>}
      {(shipment.state === 'in_transit' || shipment.state === 'partially_received') && <ShipmentReceive key={`${accountId}:${shipment.id}`} shipment={shipment} orders={orders} busy={busy} mutate={mutate} accountId={accountId}/>}
      <button type="button" className="tap-target purchase-tracking-button" aria-haspopup="dialog" onClick={() => setEditing(true)}>{shipment.state === 'cancelled' ? 'View record' : 'Edit costs & shipment'}</button>
      <ManifestButtons manifest={shipmentManifest(shipment, orders)}/>
    </div>
    <TrackingTask open={editing} onClose={() => setEditing(false)} title={`${name}${shipment.tracking_number ? ` · ${shipment.tracking_number}` : ''}`}>
      <div className="logistics-form">
        <div className="shipment-planning-note"><p>{shipment.delivery_address ? `Deliver to ${shipment.delivery_address.label}: ${logisticsAddressText(shipment.delivery_address)}` : 'Choose a saved delivery address below so the shipment and message show where it is going.'}</p><p>{shipment.mode === 'sea' ? 'For a volume-based quote: packed m³ × rate per m³. Weight cannot be converted to volume without knowing the packed size.' : 'For a weight-based quote: packed kg × rate per kg. Include packaging in the weight.'} The company’s final bill can differ from this estimate.</p>
        {planning.lines.some(line => line.suggestedVolume) && <button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => void saveEstimate(() => api.logistics.updateShipment(shipment.id, { lines: planning.lines.filter(line => line.suggestedVolume).map(suggestion => { const line = shipment.lines.find(line => line.id === suggestion.id)!; return { id: line.id, weight_kg: line.weight_kg, weight_estimated: line.weight_estimated, volume_m3: suggestion.volumeM3, volume_estimated: true }; }) }))}>Use estimated packing volumes</button>}
        <LogisticsActionError message={estimateError} recovery="Use estimated packing volumes again to retry."/></div>
        <ManifestButtons manifest={shipmentManifest(shipment, orders)}/>
        <div className="logistics-freight-summary"><span>Freight <strong>{shipment.freight_total == null ? 'not set' : `${n(shipment.freight_total)} ${shipment.freight?.currency || ''}`}</strong>{shipment.freight_total != null && <small className="text-tea-text-dim"> · {shipment.freight?.confirmed ? 'bill confirmed' : 'estimate'}{shipment.freight?.confirmed && shipment.freight_estimated ? ' · estimated split' : ''}</small>}</span></div>
        {shipment.freight_issue && <p className="logistics-shipment-issue">{shipment.freight_issue}</p>}
        {shipment.state !== 'cancelled' && <ShipmentEditor key={JSON.stringify([shipment.freight, shipment.tracking_number, shipment.outbound_courier, shipment.eta, shipment.delivery_address])} shipment={shipment} addresses={addresses} busy={busy} mutate={mutate}/>}
        <h3 className={T.h3}>Packing & item costs</h3>
        {purchases.map(id => <section className="logistics-purchase-group" key={id}>
          <button className="tap-target purchase-tracking-button" type="button" onClick={() => { setEditing(false); openPurchase(id); }}>{orders.find(order => order.purchase_id === id)?.vendor_name || 'Purchase'} · order details</button>
          {shipment.lines.filter(line => line.purchase_id === id).map(line => <div className="logistics-line" key={line.id}>
            <div className="logistics-line-summary">
              {referenceUrl(line.image_url) && <img src={referenceUrl(line.image_url)!} alt={`Reference for ${line.product_name}`} loading="lazy" referrerPolicy="no-referrer"/>}
              <span>{line.product_name}<small className="text-tea-text-dim">{line.original_cost_amount == null ? 'Paid cost not recorded' : `${n(line.original_cost_amount)} ${line.original_cost_currency || ''}`}{line.allocated_freight != null ? ` · Freight ${n(line.allocated_freight)} ${shipment.freight?.currency || ''}${shipment.freight_estimated ? ' estimate' : ''}` : ''}{line.original_cost_amount != null && line.allocated_freight != null && line.original_cost_currency === shipment.freight?.currency ? ` · Landed ${n(line.original_cost_amount + line.allocated_freight)} ${line.original_cost_currency}` : ''}</small></span>
              <span>{n(line.quantity)} {u(line.unit)}{line.received_quantity > 0 && <small className="text-tea-text-dim">{n(line.received_quantity)} received</small>}</span>
              <span className="text-tea-text-sec">{line.volume_m3 == null ? 'Volume not set' : `${n(line.volume_m3)} m³${line.volume_estimated ? ' est.' : ''}`}</span>
            </div>
            {shipment.state !== 'cancelled' && <ShipmentLineEditor key={`${line.id}:${line.volume_m3}:${line.weight_kg}:${line.image_url}:${line.source_url}`} line={line} shipment={shipment} busy={busy} mutate={mutate}/>}
          </div>)}
        </section>)}
        {shipment.state === 'draft' && <button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => void cancel(() => api.logistics.cancelShipment(shipment.id))}>Cancel shipment</button>}
        <LogisticsActionError message={cancelError} recovery="Use Cancel shipment again to retry."/>
      </div>
    </TrackingTask>
  </article>;
}
