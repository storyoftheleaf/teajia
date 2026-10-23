import type { TeaCompassEntry } from './types';

/** Keep the caller's ordering within each supplier; absent suppliers go last. */
export function librarySupplierGroups(entries: TeaCompassEntry[]) {
  const groups = new Map<string, { key: string; label: string; entries: TeaCompassEntry[] }>();
  for (const entry of entries) {
    const label = entry.vendorName?.trim().replace(/\s+/g, ' ') || '';
    const key = label.toLocaleLowerCase();
    const group = groups.get(key);
    if (group) group.entries.push(entry);
    else groups.set(key, { key, label: label || 'Supplier not recorded', entries: [entry] });
  }
  return [...groups.values()].sort((a, b) => !a.key ? 1 : !b.key ? -1 : a.key.localeCompare(b.key));
}
