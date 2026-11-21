import type { InventoryReceipt } from '../admin/types';
import type { ShopOrder } from '../components/CurateV2/shopOrders';
import type { TeaCompassEntry } from '../components/TeaCompass/types';

export type SourcingIdentity = Pick<TeaCompassEntry, 'id' | 'draftProductId'>;
/** A supplier name is not an order association. Only recorded tea/product links count. */
export function teaSourcingConnections(entry: SourcingIdentity, orders: readonly ShopOrder[], receipts: readonly InventoryReceipt[]) {
  const linkedOrders = orders.filter(order => order.items.some(line => line.compassEntryId === entry.id
    || (!!entry.draftProductId && line.productId === entry.draftProductId)));
  const orderIds = new Set(linkedOrders.map(order => order.id));
  const linkedReceipts = receipts.filter(receipt => !receipt.legacy && (
    (receipt.source_kind === 'purchase_order' && !!receipt.source_ref && orderIds.has(receipt.source_ref))
    || (!!entry.draftProductId && receipt.lines.some(line => line.product_id === entry.draftProductId))));
  return { orders: linkedOrders, receipts: linkedReceipts };
}
