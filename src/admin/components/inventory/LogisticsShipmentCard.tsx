import React, { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { LogisticsFreight, LogisticsOrder, LogisticsReceiveInput, LogisticsShipment } from '../../../lib/logisticsTypes';
import { estimatePackedVolume, type PackedItemKind } from '../../../lib/logisticsFreight';
import { TYPOGRAPHY_CLASSES as T } from '../../../designTokens';
import { LogisticsMutation, ManifestButtons, logisticsNumber as n, logisticsUnit as u, shipmentManifest } from './LogisticsControls';
import { confirmStudioReceipt, readReceiveIntent, remainingReceiptQuantities, selectedReceiptLines } from './logisticsReceipt';
import { useLogisticsAction, LogisticsActionError } from './useLogisticsAction';
import { referenceUrl } from './logisticsManifest';
const nullableNumber = (value: FormDataEntryValue | null) => String(value ?? '').trim() === '' ? null : Number(value);
const status = { draft: 'Ready to send', in_transit: 'To studio', partially_received: 'Part received', received: 'Received', cancelled: 'Cancelled' };

function ShipmentEditor({ shipment, busy, mutate: save }: { shipment: LogisticsShipment; busy: boolean; mutate: LogisticsMutation }) {
  const { mutate, error } = useLogisticsAction(save);
  const freight = shipment.freight;
  return <form className="logistics-form" onSubmit={event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const basis = form.get('basis') as LogisticsFreight['basis'];
    const rate = nullableNumber(form.get('rate')); const total = nullableNumber(form.get('total'));
    void mutate(() => api.logistics.updateShipment(shipment.id, { outbound_courier: String(form.get('courier') || '').trim() || null, tracking_number: String(form.get('tracking') || '').trim() || null, eta: String(form.get('eta') || '') || null, freight: rate == null && total == null ? null : { basis, rate, total_amount: total, billed_quantity: nullableNumber(form.get('billed')), currency: String(form.get('currency') || '').trim() || null, confirmed: form.get('confirmed') === 'on', allocation_basis: form.get('allocation') as 'kg' | 'm3' } }));
  }}><div className="logistics-fields logistics-routing-fields"><label>Outbound courier<input name="courier" defaultValue={shipment.outbound_courier || ''} disabled={busy}/></label><label>Outbound tracking<input name="tracking" defaultValue={shipment.tracking_number || ''} disabled={busy}/></label><label>Expected at studio<input name="eta" type="date" defaultValue={shipment.eta?.slice(0, 10) || ''} disabled={busy}/></label></div><fieldset className="logistics-fields"><legend>Shipment freight</legend><label>Charged by<select name="basis" defaultValue={freight?.basis || (shipment.mode === 'sea' ? 'm3' : 'kg')}><option value="kg">kg</option><option value="m3">m³</option><option value="fixed">Fixed bill</option></select></label><label>Rate<input name="rate" type="number" min="0" step="any" defaultValue={freight?.rate ?? ''}/></label><label>Billable kg / m³<input name="billed" type="number" min="0" step="any" defaultValue={freight?.billed_quantity ?? ''} placeholder="Enter billable size"/></label><label>Total bill<input name="total" type="number" min="0" step="any" defaultValue={freight?.total_amount ?? ''} placeholder="From rate"/></label><label>Currency<input name="currency" defaultValue={freight?.currency || ''} placeholder="CNY"/></label><label>Split by<select name="allocation" defaultValue={freight?.allocation_basis || (shipment.mode === 'sea' ? 'm3' : 'kg')}><option value="kg">Weight</option><option value="m3">Volume</option></select></label><label><input type="checkbox" name="confirmed" defaultChecked={freight?.confirmed}/>Bill confirmed</label></fieldset><div className="logistics-actions"><button className="tap-target purchase-tracking-button" disabled={busy} type="submit">Save shipment</button><span className="text-tea-text-dim">Freight is recorded for landed cost; shelf pricing is unchanged.</span></div><LogisticsActionError message={error} recovery="Your entries are kept. Use Save shipment again to retry."/></form>;
}
function ShipmentLineEditor({ line, shipment, busy, mutate: save }: { line: LogisticsShipment['lines'][number]; shipment: LogisticsShipment; busy: boolean; mutate: LogisticsMutation }) {
  const { mutate, error } = useLogisticsAction(save);
  const [volume, setVolume] = useState(line.volume_m3 == null ? '' : String(line.volume_m3));
  const [estimated, setEstimated] = useState(line.volume_estimated);
  const [kind, setKind] = useState<PackedItemKind>(line.unit === 'g' ? 'loose_tea' : 'other');
  const [note, setNote] = useState('');
  return <details className="logistics-line-details"><summary className="tap-target" aria-label={`Packing and references for ${line.product_name}`}>Details</summary><form className="logistics-fields" onSubmit={event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void mutate(() => api.logistics.updateShipment(shipment.id, { lines: [{ id: line.id, weight_kg: nullableNumber(form.get('weight')), weight_estimated: form.get('weightEstimated') === 'on', volume_m3: volume.trim() === '' ? null : Number(volume), volume_estimated: estimated, image_url: String(form.get('image') || '').trim() || null, source_url: String(form.get('source') || '').trim() || null }] }));
  }}><label>Packed kg<input name="weight" type="number" min="0" step="any" defaultValue={line.weight_kg ?? ''} disabled={busy}/></label><label><input name="weightEstimated" type="checkbox" defaultChecked={line.weight_estimated}/>Estimated weight</label><label>Packed m³<input name="volume" type="number" min="0" step="any" value={volume} onChange={event => setVolume(event.target.value)} disabled={busy}/></label><label><input type="checkbox" checked={estimated} onChange={event => setEstimated(event.target.checked)}/>Estimated volume</label><label>Estimate for<select value={kind} onChange={event => setKind(event.target.value as PackedItemKind)}><option value="loose_tea">Loose tea</option><option value="pressed_tea">Pressed tea</option><option value="gaiwan">Gaiwan</option><option value="cup">Cup</option><option value="teapot">Teapot</option><option value="other">Other</option></select></label><button type="button" className="tap-target purchase-tracking-button" disabled={busy || kind === 'other'} onClick={() => { const estimate = estimatePackedVolume({ kind, quantity: line.quantity, unit: line.unit }); if (estimate.volume_m3 != null) { setVolume(String(estimate.volume_m3)); setEstimated(true); } setNote(estimate.note); }}>Estimate volume</button>{note && <p className="logistics-field-note text-tea-text-dim">{note}</p>}<label>Reference image URL<input name="image" type="url" defaultValue={line.image_url || ''} placeholder="https://"/></label><label>Source URL<input name="source" type="url" defaultValue={line.source_url || ''} placeholder="https://"/></label><button type="submit" className="tap-target purchase-tracking-button" disabled={busy}>Save packing</button><LogisticsActionError message={error} recovery="Your entries are kept. Use Save packing again to retry."/></form></details>;
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
  return <div className={`logistics-receive${expanded ? ' logistics-receive-open' : ''}`}><div className="logistics-actions">
    <button type="button" className="tap-target purchase-tracking-button" disabled={busy || Boolean(pending)} onClick={() => { setQuantities(remainingReceiptQuantities(shipment.lines)); setExpanded(true); }}>Receive all at studio</button>
    <button type="button" className="tap-target purchase-tracking-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{pending ? 'Retry arrival' : expanded ? 'Close check' : 'Check items'}</button>
  </div>{expanded && <div className="logistics-form">
    <p className="text-tea-text-sec">{shipment.tracking_number ? `Shipment ${shipment.tracking_number}. ` : ''}Confirm what is physically at the studio. Saving adds it to stock immediately.</p>
    {pending ? <p role="status">The last save was interrupted. Retry the same quantities to finish recording it.</p> : <>
      <div className="logistics-actions"><button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => setQuantities(remainingReceiptQuantities(shipment.lines))}>Select all</button><button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => setQuantities({})}>Clear</button></div>
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
  </div>}</div>;
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
export function LogisticsShipmentCard({ shipment, orders, busy, mutate, accountId, openPurchase, grouped = false }: { grouped?: boolean; shipment: LogisticsShipment; orders: LogisticsOrder[]; busy: boolean; mutate: LogisticsMutation; accountId: string | null; openPurchase: (id: string) => void }) {
  const { mutate: cancel, error: cancelError } = useLogisticsAction(mutate);
  const purchases = [...new Set(shipment.lines.map(line => line.purchase_id))];
  return <article className="logistics-shipment" aria-label={`${shipment.logistics_company_name} shipment`}><div className="logistics-shipment-heading"><div className="logistics-actions"><h2 className={T.h3}>{grouped ? `${shipment.mode === 'sea' ? 'Boat' : 'Air'} shipment` : shipment.logistics_company_name}</h2><span>{!grouped && (shipment.mode === 'sea' ? 'Boat' : 'Air')}{shipment.service_quote?.name ? `${grouped ? '' : ' · '}${shipment.service_quote.name}` : ''}</span><span className="text-tea-text-sec">{status[shipment.state]}</span></div><div className="logistics-actions"><span>{shipment.freight_total == null ? 'Freight not set' : `${n(shipment.freight_total)} ${shipment.freight?.currency || ''}`} <small className="text-tea-text-dim">{shipment.freight?.confirmed ? 'Confirmed bill' : 'Estimate'}{shipment.freight?.confirmed && shipment.freight_estimated ? ' · estimated split' : ''}</small></span><ManifestButtons manifest={shipmentManifest(shipment, orders)}/></div></div><div className="logistics-shipment-meta text-tea-text-sec"><span>{shipment.tracking_number ? `${shipment.outbound_courier || 'Tracking'} ${shipment.tracking_number}` : 'Outbound tracking not recorded'}</span><span>{purchases.length} {purchases.length === 1 ? 'purchase' : 'purchases'} · {shipment.lines.length} lines{shipment.eta ? ` · Expected ${shipment.eta.slice(0, 10)}` : ''}</span></div>{shipment.freight_issue && <p className="logistics-shipment-issue">{shipment.freight_issue}</p>}<div className="logistics-shipment-contents" aria-label="Shipment contents">{purchases.map(id => <div key={id}><button type="button" className="tap-target logistics-purchase-link" onClick={() => openPurchase(id)}>{orders.find(order => order.purchase_id === id)?.vendor_name || 'Purchase'} · purchase</button>{shipment.lines.filter(line => line.purchase_id === id).map(line => <div className="logistics-shipment-content" key={line.id}><span>{line.product_name}</span><strong>{n(shipment.state === 'received' ? line.received_quantity : Math.max(0, line.quantity - line.received_quantity))} {u(line.unit)}{shipment.state === 'received' ? ' received' : shipment.state === 'draft' ? ' ready' : ' coming'}</strong></div>)}</div>)}</div><details className="logistics-contents"><summary className="tap-target">Costs & packing</summary><div className="logistics-form">{purchases.map(id => <div className="logistics-purchase-group" key={id}><button className="tap-target purchase-tracking-button" type="button" onClick={() => openPurchase(id)}>{orders.find(order => order.purchase_id === id)?.vendor_name || 'Purchase'} · order details</button>{shipment.lines.filter(line => line.purchase_id === id).map(line => <div className="logistics-line" key={line.id}><div className="logistics-line-summary">{referenceUrl(line.image_url) && <img src={referenceUrl(line.image_url)!} alt={`Reference for ${line.product_name}`} loading="lazy" referrerPolicy="no-referrer"/>}<span>{line.product_name}<small className="text-tea-text-dim">{line.original_cost_amount == null ? 'Paid cost not recorded' : `${n(line.original_cost_amount)} ${line.original_cost_currency || ''}`}{line.allocated_freight != null ? ` · Freight ${n(line.allocated_freight)} ${shipment.freight?.currency || ''}${shipment.freight_estimated ? ' estimate' : ''}` : ''}{line.original_cost_amount != null && line.allocated_freight != null && line.original_cost_currency === shipment.freight?.currency ? ` · Landed ${n(line.original_cost_amount + line.allocated_freight)} ${line.original_cost_currency}` : ''}</small></span><span>{n(line.quantity)} {u(line.unit)}{line.received_quantity > 0 && <small className="text-tea-text-dim">{n(line.received_quantity)} received</small>}</span><span className="text-tea-text-sec">{line.volume_m3 == null ? 'Volume not set' : `${n(line.volume_m3)} m³${line.volume_estimated ? ' est.' : ''}`}</span></div>{shipment.state !== 'cancelled' && <ShipmentLineEditor key={`${line.id}:${line.volume_m3}:${line.weight_kg}:${line.image_url}:${line.source_url}`} line={line} shipment={shipment} busy={busy} mutate={mutate}/>}</div>)}</div>)}</div></details><div className="logistics-card-actions">{shipment.state === 'draft' && <ShipmentDispatch key={shipment.id} shipment={shipment} busy={busy} mutate={mutate}/>}{shipment.state !== 'cancelled' && <details className="logistics-edit"><summary className="tap-target">Shipment changes</summary><ShipmentEditor key={JSON.stringify([shipment.freight, shipment.tracking_number, shipment.outbound_courier, shipment.eta])} shipment={shipment} busy={busy} mutate={mutate}/>{shipment.state === 'draft' && <button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => void cancel(() => api.logistics.cancelShipment(shipment.id))}>Cancel shipment</button>}<LogisticsActionError message={cancelError} recovery="Use Cancel shipment again to retry."/></details>}{(shipment.state === 'in_transit' || shipment.state === 'partially_received') && <ShipmentReceive key={`${accountId}:${shipment.id}`} shipment={shipment} orders={orders} busy={busy} mutate={mutate} accountId={accountId}/>}</div></article>;
}
