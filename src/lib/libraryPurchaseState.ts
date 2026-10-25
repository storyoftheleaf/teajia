import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { InventoryReceipt } from '../admin/types';
import { usePrivateQueryScope } from '../admin/hooks/usePrivateQueryScope';
import { api, type CuratePurchaseReceipt } from './api';
import { useLedgerStore, type LedgerLineItem, type LedgerTransaction } from './ledgerStore';
import { useShopOrders, type ShopOrder } from '../components/CurateV2/shopOrders';

export interface LibraryPurchaseIdentity { entryId?: string; productId?: string; chosen?: boolean }
export interface LibraryPurchaseQuantity {
  unit: 'g' | 'unit'; draft: number; ordered: number;
  /** Unknown until a durable receipt records the arrival. Stock on hand is not a receipt. */
  received: number | null; due: number | null;
}
export interface LibraryPurchaseState {
  status: 'none' | 'chosen' | 'draft' | 'ordered' | 'partially_received' | 'received';
  quantities: LibraryPurchaseQuantity[];
  draftTransactionId?: string;
  receiptId?: string;
}
const matches = (identity: LibraryPurchaseIdentity, line: LedgerLineItem) =>
  (!!identity.entryId && line.compassEntryId === identity.entryId)
  || (!!identity.productId && line.productId === identity.productId);
const positive = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
const amount = (line: LedgerLineItem): { unit: 'g' | 'unit'; value: number } | null => {
  if (line.priceIsPerGram) {
    const value = positive(line.quantityGrams);
    return value === null ? null : { unit: 'g', value };
  }
  const count = positive(line.quantityUnits);
  if (count === null) return null;
  const weight = positive(line.unitWeightGrams);
  return weight !== null && weight > 0 && line.type !== 'Teaware'
    ? { unit: 'g', value: count * weight } : { unit: 'unit', value: count };
};

/** Orders say what was bought. Receipts alone say what arrived and remains due. */
export function libraryPurchaseStateOf(
  identity: LibraryPurchaseIdentity,
  transactions: readonly LedgerTransaction[] = [],
  orders: readonly ShopOrder[] = [],
  receipts: readonly InventoryReceipt[] = [],
  proposals: readonly CuratePurchaseReceipt[] = [],
): LibraryPurchaseState {
  const quantities = new Map<'g' | 'unit', LibraryPurchaseQuantity>();
  const unknownDueUnits = new Set<'g' | 'unit'>();
  const bucket = (unit: 'g' | 'unit') => {
    if (!quantities.has(unit)) quantities.set(unit, { unit, draft: 0, ordered: 0, received: null, due: null });
    return quantities.get(unit)!;
  };
  let draftTransactionId: string | undefined;
  let receiptId: string | undefined;
  let ordered = false;
  const recordedIds = new Set(orders.map(order => order.id));
  const receiptOrderIds = new Set<string>();
  const seenLines = new Set<string>();
  for (const receipt of receipts) {
    if (receipt.legacy || receipt.state === 'planned') continue;
    for (const line of receipt.lines) {
      if (!identity.productId || line.product_id !== identity.productId || seenLines.has(line.id)) continue;
      const expected = positive(line.expected_quantity);
      const received = positive(line.received_quantity);
      const cancelled = positive(line.cancelled_quantity);
      if (expected === null || received === null || cancelled === null) continue;
      seenLines.add(line.id);
      const q = bucket(line.unit);
      q.ordered += expected;
      q.received = (q.received ?? 0) + received;
      q.due = (q.due ?? 0) + Math.max(0, expected - received - cancelled);
      ordered = true;
      if (!receiptId || expected > received + cancelled) receiptId = receipt.id;
      // Only a recorded reference proves that these are the same order.
      for (const ref of [line.source_ref, receipt.source_ref]) {
        if (!ref) continue;
        receiptOrderIds.add(ref);
        const parsed = /^order:([^:]+):/.exec(ref);
        if (parsed) receiptOrderIds.add(parsed[1]);
      }
    }
  }
  const acceptedByOrder = new Map<string, Map<'g' | 'unit', number>>();
  const seenProposals = new Set<string>();
  for (const proposal of proposals) {
    if (proposal.acquisition_kind !== 'purchase' || proposal.status === 'rejected' || seenProposals.has(proposal.id)) continue;
    if (!((identity.entryId && proposal.compass_entry_id === identity.entryId)
      || (identity.productId && proposal.product_id === identity.productId))) continue;
    const parsed = /^(?:order|ledger):([^:]+):/.exec(proposal.idempotency_key);
    const orderId = proposal.idempotency_key.startsWith('ledger:')
      ? transactions.find(tx => tx.id === parsed?.[1])?.purchaseOrderId ?? parsed?.[1] : parsed?.[1];
    const quantity = positive(proposal.quantity);
    if (!orderId || quantity === null) continue;
    seenProposals.add(proposal.id);
    const byUnit = acceptedByOrder.get(orderId) ?? new Map<'g' | 'unit', number>();
    const accepted = proposal.status === 'accepted' && proposal.ledger_id ? quantity : 0;
    byUnit.set(proposal.unit, (byUnit.get(proposal.unit) ?? 0) + accepted);
    acceptedByOrder.set(orderId, byUnit);
  }
  const addOrdered = (items: readonly LedgerLineItem[], orderId?: string) => {
    for (const line of items.filter(line => matches(identity, line))) {
      ordered = true;
      const q = amount(line);
      if (q) {
        const target = bucket(q.unit);
        target.ordered += q.value;
        const accepted = orderId ? acceptedByOrder.get(orderId)?.get(q.unit) : undefined;
        if (accepted !== undefined) {
          target.received = (target.received ?? 0) + accepted;
          target.due = (target.due ?? 0) + Math.max(0, q.value - accepted);
        } else {
          // The order alone cannot prove whether anything arrived.
          target.due = null;
          unknownDueUnits.add(q.unit);
        }
      }
    }
  };
  for (const tx of transactions) {
    if (tx.direction !== 'purchase') continue;
    if (tx.status === 'draft') {
      for (const line of tx.items.filter(line => matches(identity, line))) {
        draftTransactionId ??= tx.id;
        const q = amount(line);
        if (q) bucket(q.unit).draft += q.value;
      }
    } else if (!tx.purchaseOrderId || (!recordedIds.has(tx.purchaseOrderId) && !receiptOrderIds.has(tx.purchaseOrderId))) addOrdered(tx.items, tx.purchaseOrderId);
  }
  for (const order of orders) {
    if (['cancelled', 'draft', 'pending'].includes(order.status) || receiptOrderIds.has(order.id)) continue;
    addOrdered(order.items, order.id);
  }
  const facts = [...quantities.values()].map(q => unknownDueUnits.has(q.unit) ? { ...q, due: null } : q);
  const received = facts.some(q => (q.received ?? 0) > 0);
  const due = facts.some(q => (q.due ?? 0) > 0);
  const allArrived = facts.length > 0 && facts.every(q => q.due === 0 && q.received !== null);
  const status = draftTransactionId ? 'draft' : received && due ? 'partially_received'
    : received && allArrived ? 'received' : ordered ? 'ordered' : identity.chosen ? 'chosen' : 'none';
  return { status, quantities: facts, draftTransactionId, receiptId };
}

export function purchaseStateLabel(state: LibraryPurchaseState): string {
  const names = { none: '', chosen: 'Chosen', draft: 'Draft order', ordered: 'Ordered', partially_received: 'Part received', received: 'Received' };
  const facts = state.quantities.flatMap(q => {
    const suffix = q.unit === 'g' ? 'g' : ' pcs';
    const parts: string[] = [];
    if (q.draft > 0) parts.push(`${q.draft.toLocaleString()}${suffix} draft`);
    if (q.due !== null && q.due > 0) parts.push(`${q.due.toLocaleString()}${suffix} due`);
    else if (q.received !== null && q.received > 0) parts.push(`${q.received.toLocaleString()}${suffix} received`);
    else if (q.ordered > 0) parts.push(`${q.ordered.toLocaleString()}${suffix} ordered`);
    return parts;
  });
  return [names[state.status], ...facts].filter(Boolean).join(' · ');
}

export const LIBRARY_RECEIPTS_KEY = ['library-purchase-receipts'] as const;
export function useLibraryPurchases() {
  const scope = usePrivateQueryScope();
  const transactions = useLedgerStore(s => s.transactions);
  const ledgerAccount = useLedgerStore(s => s.accountScopeId);
  const shop = useShopOrders();
  const receipts = useQuery<InventoryReceipt[]>({
    queryKey: [...LIBRARY_RECEIPTS_KEY, ...scope.key], enabled: scope.ready,
    queryFn: () => api.inventoryReceipts.list(true), staleTime: 30_000,
  });
  const proposals = useQuery({
    queryKey: ['library-purchase-history', ...scope.key], enabled: scope.ready,
    queryFn: async () => (await api.compass.receiptHistory()).pending, staleTime: 30_000,
  });
  const stateFor = useCallback((identity: LibraryPurchaseIdentity) => libraryPurchaseStateOf(
    identity,
    scope.ready && ledgerAccount === scope.key[0] ? transactions : [],
    scope.ready ? shop.orders : [],
    scope.ready ? receipts.data ?? [] : [],
    scope.ready ? proposals.data ?? [] : [],
  ), [scope.ready, scope.key[0], ledgerAccount, transactions, shop.orders, receipts.data, proposals.data]);
  return { stateFor, receipts: scope.ready ? receipts.data ?? [] : [], receiptProposals: scope.ready ? proposals.data ?? [] : [], isLoading: scope.ready && (receipts.isLoading || proposals.isLoading || shop.loading), isError: receipts.isError || proposals.isError || shop.failed };
}
