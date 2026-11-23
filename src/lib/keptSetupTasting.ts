import type { CustomerTasting } from '../types';
import { eventTastingRecordId } from './tastingAccessors';

export type KeptSetupTea = { id: string; name: string; productId?: string };

export function keptSetupTastingHref(
  journal: CustomerTasting[],
  eventId: string,
  menu: KeptSetupTea[],
  tea: KeptSetupTea,
): string | null {
  const exactId = eventTastingRecordId(eventId, tea.id);
  const eligible = journal.filter(entry => !entry.archived);
  for (const entry of eligible) {
    if (entry.tastings.some(record => record.id === exactId && record.eventId === eventId)) {
      return tastingHref(entry, exactId);
    }
  }

  const productId = tea.productId ?? tea.id;
  if (menu.filter(other => (other.productId ?? other.id) === productId).length !== 1) return null;
  // Older notes used random IDs. Only link when one record can belong to this exact menu row.
  const legacy = eligible.filter(entry => entry.productId === productId).flatMap(entry =>
    entry.tastings
      .filter(record => record.sourceType === 'event' && record.eventId === eventId && !record.id.startsWith('event-tasting:'))
      .map(record => ({ entry, record })),
  );
  return legacy.length === 1 ? tastingHref(legacy[0].entry, legacy[0].record.id) : null;
}

function tastingHref(entry: CustomerTasting, recordId: string) {
  const params = new URLSearchParams({ tea: entry.productId, entry: entry.id, tasting: recordId });
  return `/account/journal?${params}`;
}
