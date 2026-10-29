import React, { useState } from 'react';
import { TrackingTask } from './TrackingTask';
import { LogisticsMessage } from './LogisticsMessage';
import { api } from '../../../lib/api';
import type { LogisticsOrder, LogisticsPurchaseLine, LogisticsService, LogisticsShipment, LogisticsTracking } from '../../../lib/logisticsTypes';
import { TYPOGRAPHY_CLASSES as T } from '../../../designTokens';
import { useLogisticsAction, LogisticsActionError } from './useLogisticsAction';
import { downloadManifest, type LogisticsManifest } from './logisticsManifest';
import { shipmentPlanningSummary } from './logisticsPlanning';

export type LogisticsMutation = (action: () => Promise<unknown>, onError?: (message: string) => void) => Promise<void>;
export const logisticsUnit = (unit: string) => unit === 'unit' ? 'pc' : 'g';
export const logisticsNumber = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 4 });
export function companyManifest(company: string, orders: LogisticsOrder[], shipments: LogisticsShipment[] = []): LogisticsManifest {
  const reserved = (id: string) => shipments.filter(shipment => shipment.state === 'draft').flatMap(shipment => shipment.lines).filter(line => line.receipt_line_id === id).reduce((sum, line) => sum + line.quantity - line.received_quantity, 0);
  return { title: `${company} contents`, company, items: orders.filter(order => order.logistics_company_name === company).flatMap(order => order.lines.filter(line => line.available_quantity + reserved(line.id) > 0).map(line => { const quantity = line.available_quantity + reserved(line.id); return { supplier: order.vendor_name || '', purchase: order.purchase_id, product: line.product_name, quantity, unit: logisticsUnit(line.unit), paidCost: line.original_cost_amount == null || !line.expected_quantity ? null : line.original_cost_amount * quantity / line.expected_quantity, currency: line.original_cost_currency, imageUrl: line.image_url, sourceUrl: line.source_url, inboundTracking: order.inbound_tracking_number, inboundCourier: order.inbound_courier, stage: order.logistics_arrived_at ? 'At logistics' : 'To logistics' }; })) };
}
export function shipmentManifest(shipment: LogisticsShipment, orders: LogisticsOrder[]): LogisticsManifest {
  const planning = shipmentPlanningSummary(shipment);
  const freightPlanning = planning.freight.source === 'planning';
  const freight = freightPlanning && planning.freight.basis ? {
    basis: planning.freight.basis, rate: planning.freight.rate, billed_quantity: planning.freight.quantity,
    total_amount: planning.freight.amount, currency: planning.freight.currency, confirmed: false,
  } : shipment.freight || (shipment.service_quote ? {
    basis: shipment.service_quote.basis, rate: shipment.service_quote.rate, billed_quantity: null,
    total_amount: null, currency: shipment.service_quote.currency, confirmed: false,
  } : null);
  return { title: `${shipment.logistics_company_name} ${shipment.mode === 'sea' ? 'boat' : 'air'} shipment`, company: shipment.logistics_company_name, mode: shipment.mode === 'sea' ? 'Boat' : 'Air', outboundTracking: shipment.tracking_number, eta: shipment.eta, status: shipment.state, freight, freightPlanning, freightTotal: freightPlanning ? planning.freight.amount : shipment.freight_total, items: shipment.lines.map(line => {
    const order = orders.find(item => item.purchase_id === line.purchase_id);
    const plannedLine = planning.lines.find(item => item.id === line.id);
    return { supplier: order?.vendor_name || '', purchase: line.purchase_id, product: line.product_name, quantity: line.quantity, unit: logisticsUnit(line.unit), paidCost: line.original_cost_amount, currency: line.original_cost_currency, imageUrl: line.image_url, sourceUrl: line.source_url, inboundTracking: order?.inbound_tracking_number, inboundCourier: order?.inbound_courier, weightKg: line.weight_kg, weightEstimated: line.weight_estimated, volumeM3: plannedLine?.volumeM3 ?? line.volume_m3, volumeEstimated: Boolean(plannedLine?.suggestedVolume || line.volume_estimated), freight: line.allocated_freight, freightCurrency: shipment.freight?.currency, freightEstimated: shipment.freight_estimated, stage: shipment.state };
  }) };
}
export function ManifestButtons({ manifest }: { manifest: LogisticsManifest }) {
  return <span className="logistics-actions"><LogisticsMessage manifest={manifest}/><button type="button" className="tap-target purchase-tracking-button" onClick={() => downloadManifest(manifest, 'csv')}>CSV</button><button type="button" className="tap-target purchase-tracking-button" onClick={() => downloadManifest(manifest, 'html')}>Photo list</button></span>;
}
export function LogisticsOrderFields({ order, purchaseId, tracking, services = [], busy, mutate: save }: { services?: LogisticsService[]; order?: LogisticsOrder; purchaseId: string; tracking?: string | null; busy: boolean; mutate: LogisticsMutation }) {
  const { mutate, error } = useLogisticsAction(save);
  const [company, setCompany] = useState(order?.logistics_company_name || '');
  const [contactId, setContactId] = useState(order?.logistics_company_id || '');
  const contacts = [...new Map([...services.filter(service => service.active).map(service => ({id: service.logistics_company_id, name: service.logistics_company_name})), ...(order?.logistics_company_id ? [{id:order.logistics_company_id, name:order.logistics_company_name || ''}] : [])].map(contact => [contact.id,contact])).values()];
  const [courier, setCourier] = useState(order?.inbound_courier || '');
  const [inbound, setInbound] = useState(order?.inbound_tracking_number || tracking || '');
  const dirty = contactId !== (order?.logistics_company_id || '') || company.trim() !== (order?.logistics_company_name || '') || courier.trim() !== (order?.inbound_courier || '') || inbound.trim() !== (order?.inbound_tracking_number || '');
  return <div className="logistics-order-fields"><label>Logistics company{contacts.length > 0 && <select aria-label="Saved logistics company" value={contactId} disabled={busy} onChange={event => { setContactId(event.target.value); const contact = contacts.find(item => item.id === event.target.value); if (contact) setCompany(contact.name); }}><option value="">Enter company name</option>{contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select>}{!contactId && <input aria-label="Logistics company" value={company} onChange={event => setCompany(event.target.value)} disabled={busy}/>}</label><label>Inbound courier<input aria-label="Inbound courier" value={courier} onChange={event => setCourier(event.target.value)} disabled={busy}/></label><label>Inbound tracking<input aria-label="Inbound tracking" value={inbound} onChange={event => setInbound(event.target.value)} disabled={busy}/></label><button type="button" className="tap-target purchase-tracking-button" disabled={busy || !company.trim() || !dirty} onClick={() => void mutate(() => api.logistics.saveOrder(purchaseId, { logistics_company_id: contactId || null, logistics_company_name: company.trim(), inbound_courier: courier.trim() || null, inbound_tracking_number: inbound.trim() || null }))}>Save route</button>{order?.logistics_company_name && !order.logistics_arrived_at && <button type="button" className="tap-target purchase-tracking-button" disabled={busy || dirty} onClick={() => void mutate(() => api.logistics.markAtLogistics(purchaseId))}>Mark at logistics</button>}{order?.logistics_arrived_at && <span className="text-tea-text-sec">At logistics · stock unchanged</span>}<LogisticsActionError message={error} recovery="Your entries are kept. Use Save route or Mark at logistics again to retry."/></div>;
}
export function selectReadyQuantities(current: Record<string, string>, lines: Pick<LogisticsPurchaseLine, 'id' | 'available_quantity'>[], selected: boolean): Record<string, string> {
  const next = { ...current };
  for (const line of lines) {
    if (line.available_quantity <= 0) continue;
    if (!selected) delete next[line.id];
    else if (!(Number(next[line.id]) > 0)) next[line.id] = String(line.available_quantity);
  }
  return next;
}
export function LogisticsCreateShipment({ data, busy, mutate: save, label = 'Prepare shipment' }: { data: LogisticsTracking; busy: boolean; mutate: LogisticsMutation; label?: string }) {
  const { mutate, error } = useLogisticsAction(save);
  const [open, setOpen] = useState(false);
  const eligible = data.orders.filter(order => order.logistics_arrived_at && order.lines.some(line => line.available_quantity > 0));
  const companyKey = (order: LogisticsOrder) => order.logistics_company_id ? `contact:${order.logistics_company_id}` : `name:${order.logistics_company_name}`;
  const companies = [...new Map(eligible.filter(order => order.logistics_company_name).map(order => [companyKey(order), { key: companyKey(order), name: order.logistics_company_name! }])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const [company, setCompany] = useState('');
  const [mode, setMode] = useState<'air' | 'sea'>('air');
  const [serviceId, setServiceId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [key, setKey] = useState(() => crypto.randomUUID());
  const selectedCompanyKey = company || companies[0]?.key || '';
  const selectedCompany = companies.find(item => item.key === selectedCompanyKey)?.name || '';
  const orders = eligible.filter(order => companyKey(order) === selectedCompanyKey);
  const services = (data.services || []).filter(service => service.active && service.logistics_company_id === orders[0]?.logistics_company_id);
  const service = services.find(item => item.id === serviceId);
  const lines = orders.flatMap(order => order.lines).filter(line => line.available_quantity > 0);
  const selected = lines.filter(line => Number(quantities[line.id]) > 0);
  const allSelected = lines.length > 0 && lines.every(line => Number(quantities[line.id]) > 0);
  const selectLines = (chosen: typeof lines, checked: boolean) => { setQuantities(current => selectReadyQuantities(current, chosen, checked)); setKey(crypto.randomUUID()); };
  const valid = selected.length > 0 && selected.every(line => Number(quantities[line.id]) <= line.available_quantity && (line.unit !== 'unit' || Number.isInteger(Number(quantities[line.id]))));
  return <><button type="button" className="tap-target purchase-tracking-button" aria-label="Prepare shipment from logistics" onClick={() => setOpen(true)}>{label}</button><TrackingTask open={open} onClose={() => setOpen(false)} title="Send together"><div className="logistics-form"><div className="logistics-actions"><h2 className={T.h3}>Ready to send</h2><label>Company<select aria-label="Shipment logistics company" value={selectedCompanyKey} disabled={busy} onChange={event => { setCompany(event.target.value); setServiceId(''); setQuantities({}); setKey(crypto.randomUUID()); }}><option value="">Choose company</option>{companies.map(value => <option key={value.key} value={value.key}>{value.name}</option>)}</select></label><label>By<select aria-label="Shipment mode" value={mode} disabled={busy} onChange={event => { setMode(event.target.value as 'air' | 'sea'); setServiceId(''); setKey(crypto.randomUUID()); }}><option value="air">Air</option><option value="sea">Boat</option></select></label>{services.length > 0 && <label>Service<select aria-label="Shipment service" value={serviceId} disabled={busy} onChange={event => { setServiceId(event.target.value); const selected = services.find(item => item.id === event.target.value); if (selected) setMode(selected.mode); setKey(crypto.randomUUID()); }}><option value="">Enter freight later</option>{services.map(item => <option key={item.id} value={item.id}>{item.name} · {logisticsNumber(item.rate)} {item.currency}{item.basis === 'fixed' ? ' fixed' : item.basis === 'm3' ? '/m³' : '/kg'}</option>)}</select></label>}{service && <span className="text-tea-text-dim">Quoted estimate · final bill can be entered later</span>}{!services.length && (data.services || []).some(item => item.active && item.logistics_company_name === selectedCompany) && <span className="text-tea-text-dim">Choose this saved company in each purchase's Changes to use its services.</span>}</div>{lines.length > 0 && <div className="logistics-actions"><button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => selectLines(lines, !allSelected)}>{allSelected ? 'Clear selection' : 'Select all'}</button><span className="text-tea-text-dim">Select whole purchases, or adjust individual quantities.</span></div>}{orders.length === 0 ? <p className="text-tea-text-sec">Record a purchase at its logistics company first.</p> : orders.map(order => <div className="logistics-selection" key={order.purchase_id}><label className="logistics-ready-choice"><input type="checkbox" aria-label={`Ready purchase from ${order.vendor_name || 'Supplier'}, ${order.inbound_tracking_number || order.purchase_id}`} checked={order.lines.filter(line => line.available_quantity > 0).every(line => Number(quantities[line.id]) > 0)} ref={element => { if (element) element.indeterminate = order.lines.some(line => line.available_quantity > 0 && Number(quantities[line.id]) > 0) && !order.lines.filter(line => line.available_quantity > 0).every(line => Number(quantities[line.id]) > 0); }} disabled={busy} onChange={event => selectLines(order.lines.filter(line => line.available_quantity > 0), event.target.checked)}/><span>{order.vendor_name || 'Supplier'}<small className="text-tea-text-dim">{[order.inbound_courier, order.inbound_tracking_number || 'No inbound tracking'].filter(Boolean).join(' · ')}</small></span></label>{order.lines.filter(line => line.available_quantity > 0).map(line => <label key={line.id}><span>{line.product_name}<small className="text-tea-text-dim">{logisticsNumber(line.available_quantity)} {logisticsUnit(line.unit)} available</small></span><input type="number" aria-label={`Ship ${line.product_name}`} min="0" max={line.available_quantity} step={line.unit === 'unit' ? '1' : 'any'} value={quantities[line.id] || ''} placeholder="0" disabled={busy} onChange={event => { setQuantities(current => ({ ...current, [line.id]: event.target.value })); setKey(crypto.randomUUID()); }}/><span>{logisticsUnit(line.unit)}</span></label>)}</div>)}<div className="logistics-actions"><button type="button" disabled={busy || !valid} className="tap-target purchase-tracking-button" onClick={() => void mutate(async () => { await api.logistics.createShipment({ idempotency_key: key, service_id: service?.id || null, logistics_company_id: orders[0]?.logistics_company_id || null, logistics_company_name: selectedCompany, mode, lines: selected.map(line => ({ receipt_line_id: line.id, quantity: Number(quantities[line.id]) })) }); setQuantities({}); setKey(crypto.randomUUID()); setOpen(false); })}>Mark selected ready</button><span className="text-tea-text-dim">Groups these goods as ready to send. Dispatch and verified studio arrival are recorded separately.</span></div><LogisticsActionError message={error} recovery="Your selection is kept. Use Mark selected ready again to retry."/></div></TrackingTask></>;
}
