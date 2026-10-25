import type { TeaCompassEntry } from './types';

export const libraryEntryRejected = (entry: TeaCompassEntry) => entry.decision === 'passed_on' || entry.status === 'pass';

/** A chat-imported order is chosen even when no formal purchase order exists. */
export function libraryEntryChosen(entry: TeaCompassEntry, purchaseStatus?: string) {
  return !libraryEntryRejected(entry) && (entry.decision === 'selected'
    || ['incoming', 'in_stock', 'depleted'].includes(entry.status)
    || ['ordered', 'partially_received', 'received'].includes(purchaseStatus ?? ''));
}

/** Stable supplier identities survive renaming; legacy unlinked names still group together. */
export function librarySupplierGroups(entries: TeaCompassEntry[]) {
  const groups = new Map<string, { key: string; label: string; entries: TeaCompassEntry[] }>();
  for (const entry of entries) {
    const label = entry.vendorName?.trim().replace(/\s+/g, ' ') || '';
    const supplierId = entry.linkedCustomerId || entry.vendorId;
    const key = supplierId ? `supplier:${supplierId}` : label ? `name:${label.toLocaleLowerCase()}` : '';
    const group = groups.get(key);
    if (group) group.entries.push(entry);
    else groups.set(key, { key, label: label || 'Supplier not recorded', entries: [entry] });
  }
  return [...groups.values()].sort((a, b) => !a.key ? 1 : !b.key ? -1 : a.label.localeCompare(b.label));
}
