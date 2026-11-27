/**
 * The journey track (Adrian chose it, 2026-11-27): each logistics service is a
 * line tea moves along, ordered, at the forwarder, on the way, arrived. Each
 * stage counts what is in it and every item is a link to it.
 */
import type { LogisticsService, LogisticsTracking } from '../../../lib/logisticsTypes';
import { orderIsWaiting, purchaseHref, serviceConnections, shipmentHref, teaHref } from './logisticsLinks';

export type JourneyStageKey = 'ordered' | 'at_forwarder' | 'on_the_way' | 'arrived';
export interface JourneyItem { key: string; label: string; detail?: string; href: string }
export interface JourneyStage { key: JourneyStageKey; label: string; items: JourneyItem[] }
export interface ServiceJourney {
  stages: JourneyStage[];
  /** The stage to open first: the furthest along that still has something coming. */
  focus: JourneyStageKey | null;
  teas: JourneyItem[];
  /** The last confirmed bill, as its rate and unit, e.g. "79 Yuan/kg". */
  lastBill: string | null;
}

const shortDate = (iso: string | null | undefined) => {
  if (!iso) return null;
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : null;
};

const unit = (basis: string) => (basis === 'fixed' ? ' fixed' : basis === 'm3' ? '/m³' : '/kg');

export function serviceJourney(
  service: Pick<LogisticsService, 'id' | 'logistics_company_id' | 'logistics_company_name'>,
  tracking: Pick<LogisticsTracking, 'orders' | 'shipments'> | null | undefined,
  products: Parameters<typeof serviceConnections>[2],
): ServiceJourney {
  const { orders, shipments, teas } = serviceConnections(service, tracking, products);
  const order = (o: (typeof orders)[number]) => ({ key: o.purchase_id, label: o.vendor_name || 'Supplier order', href: purchaseHref(o.purchase_id) });
  const ship = (s: (typeof shipments)[number]) => {
    const due = shortDate(s.eta);
    const arrived = s.state === 'received';
    return { key: s.id, label: arrived ? `Arrived${shortDate(s.dispatched_at) ? `, sent ${shortDate(s.dispatched_at)}` : ''}` : due ? `Due ${due}` : s.state === 'draft' ? 'Being packed' : 'On the way', detail: `${s.lines.length} ${s.lines.length === 1 ? 'tea' : 'teas'}`, href: shipmentHref(s.id) };
  };
  const stages: JourneyStage[] = [
    { key: 'ordered', label: 'Ordered', items: orders.filter(o => orderIsWaiting(o) && !o.logistics_arrived_at).map(order) },
    { key: 'at_forwarder', label: `At ${service.logistics_company_name}`, items: orders.filter(o => orderIsWaiting(o) && o.logistics_arrived_at).map(order) },
    { key: 'on_the_way', label: 'On the way', items: shipments.filter(s => s.state === 'draft' || s.state === 'in_transit' || s.state === 'partially_received').map(ship) },
    { key: 'arrived', label: 'Arrived', items: shipments.filter(s => s.state === 'received').map(ship) },
  ];
  const focus = (['on_the_way', 'at_forwarder', 'ordered', 'arrived'] as const).find(key => stages.find(stage => stage.key === key)!.items.length) ?? null;
  const billed = shipments.find(s => s.freight?.confirmed && s.freight.rate != null && s.freight.currency);
  return {
    stages, focus,
    teas: teas.map(tea => ({ key: tea.id, label: tea.name, href: teaHref(tea.id) })),
    lastBill: billed?.freight ? `${Number(billed.freight.rate)} ${billed.freight.currency}${unit(billed.freight.basis)}` : null,
  };
}
