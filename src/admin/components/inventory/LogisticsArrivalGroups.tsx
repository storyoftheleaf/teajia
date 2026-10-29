import React, { useState } from 'react';
import { api } from '../../../lib/api';
import type { LogisticsOrder } from '../../../lib/logisticsTypes';
import { useLogisticsAction, LogisticsActionError } from './useLogisticsAction';
import { logisticsNumber, type LogisticsMutation } from './LogisticsControls';
export function pendingLogisticsArrivals(orders: LogisticsOrder[]) {
  return orders.filter(order => order.logistics_company_name && !order.logistics_arrived_at && order.lines.some(line => line.available_quantity > 0));
}
export function logisticsArrivalGroups(orders: LogisticsOrder[]) {
  const groups = new Map<string, { id: string; name: string; orders: LogisticsOrder[] }>();
  for (const order of pendingLogisticsArrivals(orders)) {
    const id = order.logistics_company_id ? `contact:${order.logistics_company_id}` : `name:${order.logistics_company_name}`;
    const group = groups.get(id) || { id, name: order.logistics_company_name!, orders: [] };
    group.orders.push(order); groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export function arrivalQuantities(order: LogisticsOrder) {
  const grams = order.lines.filter(line => line.unit === 'g').reduce((sum, line) => sum + line.available_quantity, 0);
  const pieces = order.lines.filter(line => line.unit === 'unit').reduce((sum, line) => sum + line.available_quantity, 0);
  return [grams > 0 ? `${logisticsNumber(grams)} g` : '', pieces > 0 ? `${logisticsNumber(pieces)} pc` : ''].filter(Boolean).join(' + ');
}
/** Each arrival is idempotent. Retrying failed responses cannot add stock or duplicate an arrival. */
export async function markSelectedLogisticsArrivals(orders: LogisticsOrder[], mark: (id: string) => Promise<unknown> = api.logistics.markAtLogistics) {
  const succeeded: string[] = []; const failed: Array<{ id: string; message: string }> = [];
  for (const order of orders) {
    try { await mark(order.purchase_id); succeeded.push(order.purchase_id); }
    catch (cause) { failed.push({ id: order.purchase_id, message: cause instanceof Error ? cause.message : 'Arrival could not be confirmed.' }); }
  }
  return { succeeded, failed };
}
export function LogisticsArrivalGroups({ orders, busy, mutate: save }: { orders: LogisticsOrder[]; busy: boolean; mutate: LogisticsMutation }) {
  const { mutate, error } = useLogisticsAction(save);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState('');
  const groups = logisticsArrivalGroups(orders);
  const eligible = groups.flatMap(group => group.orders);
  const chosen = eligible.filter(order => selected.has(order.purchase_id));
  return <details className="logistics-create"><summary className="tap-target" aria-label="Check arrivals at logistics">Check arrivals <span className="text-tea-text-dim">{eligible.length}</span></summary><div className="logistics-form">
    {groups.length === 0 ? <p className="text-tea-text-sec">No assigned purchases are waiting for an arrival check.</p> : groups.map(group => <div className="logistics-selection" key={group.id}><div className="logistics-actions"><strong>{group.name}</strong><button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => setSelected(current => { const next = new Set(current); const all = group.orders.every(order => current.has(order.purchase_id)); for (const order of group.orders) { if (all) next.delete(order.purchase_id); else next.add(order.purchase_id); } return next; })}>{group.orders.every(order => selected.has(order.purchase_id)) ? 'Clear selection' : 'Select all'}</button></div>{group.orders.map(order => <label className="logistics-arrival-choice" key={order.purchase_id}><input type="checkbox" aria-label={`Arrived at logistics: ${order.vendor_name || 'Supplier'}, ${order.inbound_tracking_number || order.purchase_id}`} checked={selected.has(order.purchase_id)} disabled={busy} onChange={event => setSelected(current => { const next = new Set(current); if (event.target.checked) next.add(order.purchase_id); else next.delete(order.purchase_id); return next; })}/><span>{order.vendor_name || 'Supplier'}<small className="text-tea-text-dim">{[order.inbound_courier, order.inbound_tracking_number || 'No inbound tracking'].filter(Boolean).join(' · ')}</small></span><span>{arrivalQuantities(order)}</span></label>)}</div>)}
    <div className="logistics-actions"><button type="button" className="tap-target purchase-tracking-button" disabled={busy || !chosen.length} onClick={() => void mutate(async () => {
      const result = await markSelectedLogisticsArrivals(chosen);
      setSelected(current => { const next = new Set(current); for (const id of result.succeeded) next.delete(id); return next; });
      setNotice(`${result.succeeded.length} ${result.succeeded.length === 1 ? 'purchase' : 'purchases'} marked at logistics. Stock is unchanged.`);
      if (result.failed.length) throw new Error(`${result.succeeded.length} marked at logistics; ${result.failed.length} could not be confirmed. Retry the remaining selection safely. ${result.failed[0].message}`);
    })}>Mark selected at logistics{chosen.length ? ` (${chosen.length})` : ''}</button><span className="text-tea-text-dim">Check the parcels received by this company. This does not add studio stock.</span></div>{notice && <p role="status" className="text-tea-text-sec">{notice}</p>}
    <LogisticsActionError message={error} recovery="The unconfirmed purchases stay selected. Use Mark selected at logistics again to retry."/>
  </div></details>;
}
