import type { TeaCompassEntry } from '../components/TeaCompass/types';

/** Only durable links identify a shared record. A matching name or source does
 * not mean two teas are the same, and opening Inventory never makes a copy. */
export function sharedTeaRecordId(product: { id: string; sourceCompassEntryId?: string }, entries: Pick<TeaCompassEntry, 'id' | 'draftProductId'>[]): string | undefined {
  return product.sourceCompassEntryId || entries.find(entry => entry.draftProductId === product.id)?.id;
}

export function sharedTeaRecordHref(entryId: string): string {
  return `/admin/compass?tab=library&entry=${encodeURIComponent(entryId)}`;
}
