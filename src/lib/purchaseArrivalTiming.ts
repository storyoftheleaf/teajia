import type { LogisticsShipment } from './logisticsTypes';

const dayLength = 86_400_000;

type ArrivalShipment = Pick<LogisticsShipment, 'state' | 'dispatched_at' | 'eta'> & {
  lines: Array<Pick<LogisticsShipment['lines'][number], 'purchase_id' | 'receipt_line_id' | 'quantity' | 'received_quantity'>>;
};

function calendarDay(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day ? date : undefined;
}

function shortDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function purchaseArrivalTiming(
  shipments: readonly ArrivalShipment[],
  line: { orderId?: string; receiptLineId?: string; remaining: number; receiptEta?: string | null },
) {
  const active = line.receiptLineId && line.orderId ? shipments.flatMap(shipment => {
    if (shipment.state !== 'in_transit' && shipment.state !== 'partially_received') return [];
    const quantity = shipment.lines.reduce((sum, item) => {
      if (item.purchase_id !== line.orderId || item.receipt_line_id !== line.receiptLineId) return sum;
      return sum + Math.max(0, item.quantity - item.received_quantity);
    }, 0);
    return quantity > 0 ? [{ shipment, quantity }] : [];
  }) : [];

  if (active.length > 1) return `${active.length} shipments · See Purchase Tracking`;

  const delivery = active[0];
  const dispatched = calendarDay(delivery?.shipment.dispatched_at);
  const eta = calendarDay(delivery ? delivery.shipment.eta : line.receiptEta);
  const days = dispatched && eta ? (eta.getTime() - dispatched.getTime()) / dayLength : null;
  if (!dispatched && !eta) return undefined;

  const transit = days != null && days >= 0 ? (days === 0 ? ' (same day)' : ` (~${days} ${days === 1 ? 'day' : 'days'})`) : '';

  return [
    delivery && delivery.quantity < line.remaining ? 'Partial shipment' : null,
    dispatched ? `Shipped ${shortDate(dispatched)}` : null,
    eta ? `Est. ${shortDate(eta)}${transit}` : null,
  ].filter(Boolean).join(' · ');
}
