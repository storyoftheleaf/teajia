import { describe, expect, it } from 'vitest';
import type { LogisticsOrder, LogisticsShipment } from '../../../lib/logisticsTypes';
import { logisticsPlaces } from './logisticsPlaces';
describe('physical logistics places', () => {
 it('keeps supplier parcels separate, collected balances available, and allocations in their own shipment', () => {
  const orders = [
   {purchase_id:'a',logistics_arrived_at:null,lines:[{id:'one',available_quantity:100}]},
   {purchase_id:'b',logistics_arrived_at:null,lines:[{id:'two',available_quantity:200}]},
   {purchase_id:'c',logistics_arrived_at:'today',lines:[{id:'three',available_quantity:50},{id:'allocated',available_quantity:0}]},
  ] as LogisticsOrder[];
  const shipments = [{id:'draft',state:'draft'},{id:'boat',state:'partially_received'},{id:'done',state:'received'}] as LogisticsShipment[];
  const places = logisticsPlaces(orders,shipments);
  expect(places.incoming.map(order=>order.purchase_id)).toEqual(['a','b']);
  expect(places.collected.map(({line})=>[line.id,line.available_quantity])).toEqual([['three',50]]);
  expect(places.ready.map(s=>s.id)).toEqual(['draft']);
  expect(places.travelling.map(s=>s.id)).toEqual(['boat']);
  expect(places.history.map(s=>s.id)).toEqual(['done']);
 });
});
