import type { LedgerTransaction } from '../../lib/ledgerStore';
import { rateToUsd } from '../../lib/currency';
import { ledgerLineTotal } from './acquisitionPricing';

export function purchaseOrderPayload(tx: LedgerTransaction, rates: Array<{ currency: string; rateToUSD: number }>) {
  const rate = rateToUsd(rates, tx.currency);
  if (!rate || rate <= 0) throw new Error(`A current ${tx.currency} exchange rate is needed before confirming this purchase.`);
  if (tx.items.some(item => item.currency !== tx.currency)) throw new Error('Split purchases in different currencies before confirming.');
  return {
    request_id: `ledger:${tx.id}`, po_number: `PO-${tx.id.slice(0, 8).toUpperCase()}`,
    vendor_name: tx.counterpartyName || 'Unknown', vendor_id: tx.counterpartyId,
    items_json: JSON.stringify(tx.items.map(item => ({
      ...item, quantity: item.priceIsPerGram ? item.quantityGrams ?? 0 : item.quantityUnits ?? 1,
    }))),
    total_usd: tx.items.reduce((sum, item) => sum + ledgerLineTotal(item), 0) / rate,
    display_currency: tx.currency, status: 'confirmed',
  };
}

export async function persistPurchaseConfirmation(
  tx: LedgerTransaction,
  rates: Array<{ currency: string; rateToUSD: number }>,
  create: (payload: ReturnType<typeof purchaseOrderPayload>) => Promise<{ id: string }>,
  acknowledge: (id: string) => void,
): Promise<void> {
  const result = await create(purchaseOrderPayload(tx, rates));
  acknowledge(result.id);
}
