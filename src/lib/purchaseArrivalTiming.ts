import type { LogisticsOrder, LogisticsShipment } from './logisticsTypes';

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

/** Follow the same receipt routing as the worker. A managed purchase cannot
 * be counted directly, even while it has no outbound shipment. */
export function purchaseArrivalAction(logistics: {
  orders: readonly Pick<LogisticsOrder, 'purchase_id' | 'managed' | 'logistics_company_name'>[];
  shipments: ReadonlyArray<Pick<LogisticsShipment, 'id' | 'state'> & { lines: Array<ArrivalShipment['lines'][number] & { id: string }> }>;
}, orderId: string, receiptLineId?: string) {
  const order = logistics.orders.find(row => row.purchase_id === orderId);
  const shipments = logistics.shipments.flatMap(shipment => {
    if (shipment.state === 'received' || shipment.state === 'cancelled') return [];
    const line = shipment.lines.find(row => row.purchase_id === orderId
      && (!receiptLineId || row.receipt_line_id === receiptLineId)
      && row.received_quantity < row.quantity);
    return line ? [{ shipment, line }] : [];
  });
  if (shipments.length > 1) {
    const view = shipments.some(({ shipment }) => shipment.state === 'draft') ? 'all' : 'to_studio';
    return {
      label: 'View shipments',
      href: `/admin/purchase-orders?view=${view}&shipmentsForPurchaseId=${encodeURIComponent(orderId)}`,
    };
  }
  if (shipments.length === 1) {
    const [{ shipment, line }] = shipments;
    const href = `/admin/purchase-orders?shipmentId=${encodeURIComponent(shipment.id)}`;
    if (shipment.state === 'draft' || !receiptLineId) return { label: 'View shipment', href };
    return { label: 'Open studio receipt', href: `${href}&receiptLineId=${encodeURIComponent(line.id)}` };
  }
  return (order?.managed ?? Boolean(order?.logistics_company_name)) ? {
    label: 'Track supplier order',
    href: `/admin/purchase-orders?purchaseId=${encodeURIComponent(orderId)}`,
  } : undefined;
}
