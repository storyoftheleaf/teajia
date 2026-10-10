import type { QueryClient } from '@tanstack/react-query';
import { useLedgerStore } from '../../lib/ledgerStore';
import { useTeaCompassStore } from '../../lib/teaCompassStore';

/** First element of every React Query key that holds a supplier's name somewhere in its data. */
const KEYS_WITH_SUPPLIER_NAMES = new Set([
  'customers', 'vendor', 'vendor-products', 'vendor-priced-products', 'supplier-sheet', 'supplier-freight',
  'purchase-orders', 'purchase_orders', 'compass-entries', 'compass-incoming', 'inventory-receipts-all',
  'inventory-source', 'products', 'admin-products',
]);

const sameName = (a: string | null | undefined, b: string) => (a ?? '').trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Make the new name show without a reload. The server has already changed every
 * record; this brings along what the browser kept a copy of: the cached reads
 * (refetched) and the two local stores that hold a supplier's name on teas and
 * on the open buying basket.
 *
 * The compass entries are written straight into the store rather than through
 * `updateEntry`, which would mark each one unsynced and deliberate: the server
 * already has the new name, so there is nothing to send.
 */
export function applySupplierRenameLocally(
  queryClient: QueryClient,
  change: { vendorId: string; oldName: string; newName: string },
): void {
  const { vendorId, oldName, newName } = change;

  useTeaCompassStore.setState((state) => {
    const rename = <T extends { vendorId?: string | null; vendorName?: string | null }>(entry: T): T =>
      entry.vendorId === vendorId || (!entry.vendorId && sameName(entry.vendorName, oldName))
        ? { ...entry, vendorName: newName }
        : entry;
    return {
      entries: state.entries.map(rename),
      pendingEntries: state.pendingEntries.map(rename),
      lastVendorName: state.lastVendorId === vendorId || (!state.lastVendorId && sameName(state.lastVendorName, oldName))
        ? newName
        : state.lastVendorName,
    };
  });

  const ledger = useLedgerStore.getState();
  for (const tx of ledger.transactions) {
    if (tx.counterpartyId === vendorId || (!tx.counterpartyId && sameName(tx.counterpartyName, oldName))) {
      ledger.updateTransaction(tx.id, { counterpartyName: newName });
    }
  }

  void queryClient.invalidateQueries({
    predicate: (query) => typeof query.queryKey[0] === 'string' && KEYS_WITH_SUPPLIER_NAMES.has(query.queryKey[0]),
  });
}
