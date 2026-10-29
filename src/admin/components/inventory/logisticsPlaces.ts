import type { LogisticsOrder, LogisticsShipment } from '../../../lib/logisticsTypes';

/** Quantities belong to a physical place, even when one purchase spans several. */
export function logisticsPlaces(orders: LogisticsOrder[], shipments: LogisticsShipment[]) {
  return {
    incoming: orders.filter(order => !order.logistics_arrived_at && order.lines.some(line => line.available_quantity > 0)),
    collected: orders.filter(order => order.logistics_arrived_at).flatMap(order => order.lines.filter(line => line.available_quantity > 0).map(line => ({ order, line }))),
    ready: shipments.filter(shipment => shipment.state === 'draft'),
    travelling: shipments.filter(shipment => shipment.state === 'in_transit' || shipment.state === 'partially_received'),
    history: shipments.filter(shipment => shipment.state === 'received' || shipment.state === 'cancelled'),
  };
}
