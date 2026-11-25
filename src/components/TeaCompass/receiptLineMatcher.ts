import type { InventoryReceipt } from '../../admin/types';
import type { LedgerLineItem } from '../../lib/ledgerStore';

/** An explicit saved line identity is authoritative and must never fall across to another line. */
export function matchOrderReceiptLine(item: LedgerLineItem, receipt?: InventoryReceipt) {
  if (item.purchaseReceiptLineId) return receipt?.lines.find(line => line.id === item.purchaseReceiptLineId);
  if (item.productId) return receipt?.lines.find(line => line.product_id === item.productId);
  return undefined;
}
