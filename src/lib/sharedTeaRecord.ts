import type { TeaCompassEntry } from '../components/TeaCompass/types';

/** Only durable links identify a shared record. A matching name or source does
 * not mean two teas are the same, and opening Inventory never makes a copy. */
export function sharedTeaRecordId(product: { id: string; sourceCompassEntryId?: string }, entries: Pick<TeaCompassEntry, 'id' | 'draftProductId'>[]): string | undefined {
  return product.sourceCompassEntryId || entries.find(entry => entry.draftProductId === product.id)?.id;
}

export function sharedTeaRecordHref(entryId: string): string {
  return `/admin/compass?tab=library&entry=${encodeURIComponent(entryId)}`;
}

/** Resolve only a verified product in this account, never a name match or stale ID. */
export function sharedStockRecordId(entry: Pick<TeaCompassEntry, 'id' | 'draftProductId'>, products: readonly { id: string; source_compass_entry_id?: string | null; sourceCompassEntryId?: string | null }[]): string | undefined {
  const backlink = products.find(product => (product.source_compass_entry_id ?? product.sourceCompassEntryId) === entry.id);
  if (backlink) return backlink.id;
  return products.find(product => product.id === entry.draftProductId && !(product.source_compass_entry_id ?? product.sourceCompassEntryId))?.id;
}
export function sharedStockRecordHref(productId: string): string {
  return `/admin/stock?panel=${encodeURIComponent(productId)}`;
}
