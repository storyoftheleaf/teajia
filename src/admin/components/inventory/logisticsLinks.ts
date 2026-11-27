/**
 * Everything in freight is connected, and every connection is a link
 * (Adrian, 2026-11-27): a supplier order goes to a logistics company, a
 * shipment travels by one of its services and carries teas, and each tea's
 * freight comes from that service. These are the addresses each one opens at,
 * and what each service is connected to, so every surface can link both ways.
 */
import type { LogisticsOrder, LogisticsService, LogisticsShipment, LogisticsTracking } from '../../../lib/logisticsTypes';

const q = (value: string) => encodeURIComponent(value);
export const teaHref = (productId: string) => `/admin/stock?panel=${q(productId)}`;
export const purchaseHref = (purchaseId: string) => `/admin/purchase-orders?purchaseId=${q(purchaseId)}`;
export const shipmentHref = (shipmentId: string) => `/admin/purchase-orders?shipmentId=${q(shipmentId)}`;
export const serviceHref = (serviceId: string) => `/admin/purchase-orders?serviceId=${q(serviceId)}`;

export const SHIPMENT_STATE_WORD: Record<LogisticsShipment['state'], string> = {
  draft: 'Being packed', in_transit: 'On the way', partially_received: 'Part received', received: 'Received', cancelled: 'Cancelled',
};

/** Still coming: not yet received, not cancelled. */
export const shipmentIsComing = (shipment: Pick<LogisticsShipment, 'state'>) => shipment.state === 'draft' || shipment.state === 'in_transit' || shipment.state === 'partially_received';

/** An order still has goods waiting at, or heading to, its logistics company. */
export const orderIsWaiting = (order: LogisticsOrder) => order.lines.some(line => line.available_quantity > 0);

export interface ConnectedTea { id: string; name: string }
export interface ServiceConnections {
  orders: LogisticsOrder[];
  shipments: LogisticsShipment[];
  teas: ConnectedTea[];
}

/** What this service is connected to: its company's waiting orders, its shipments, and the teas it prices. */
export function serviceConnections(
  service: Pick<LogisticsService, 'id' | 'logistics_company_id'>,
  tracking: Pick<LogisticsTracking, 'orders' | 'shipments'> | null | undefined,
  products: ReadonlyArray<{ id: string; freightServiceId?: string | null; givenName?: string | null; productName?: string | null }>,
): ServiceConnections {
  const shipments = (tracking?.shipments ?? []).filter(shipment => shipment.service_id === service.id && shipment.state !== 'cancelled')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const orders = (tracking?.orders ?? []).filter(order => order.logistics_company_id === service.logistics_company_id && orderIsWaiting(order));
  const teas = products.filter(product => product.freightServiceId === service.id)
    .map(product => ({ id: product.id, name: product.givenName || product.productName || 'Unnamed tea' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { orders, shipments, teas };
}

/** The shipments a tea is on, newest first, with the service each travels by. */
export function teaShipments(productId: string, tracking: Pick<LogisticsTracking, 'shipments' | 'services'> | null | undefined) {
  return (tracking?.shipments ?? [])
    .filter(shipment => shipment.state !== 'cancelled' && shipment.lines.some(line => line.product_id === productId))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(shipment => ({ shipment, service: (tracking?.services ?? []).find(service => service.id === shipment.service_id) ?? shipment.service_quote ?? null }));
}
