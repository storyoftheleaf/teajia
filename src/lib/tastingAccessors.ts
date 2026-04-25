import type { CustomerTasting, TastingRecord, TastingData } from '../types';

/** The most recent tasting on an entry. Falls back to a synthetic record built from the note. */
export function latestTasting(entry: CustomerTasting): TastingRecord {
  if (entry.tastings.length > 0) return entry.tastings[entry.tastings.length - 1];
  return { id: entry.id, createdAt: entry.createdAt, tasting: entry.note.tasting };
}

/** Event metadata from the most recent tasting that has an eventId, if any. */
export function entryEvent(entry: CustomerTasting): { eventId?: string; eventSlug?: string; eventTitle?: string } {
  for (let i = entry.tastings.length - 1; i >= 0; i--) {
    const t = entry.tastings[i];
    if (t.eventId) return { eventId: t.eventId, eventSlug: t.eventSlug, eventTitle: t.eventTitle };
  }
  return {};
}

/** Source type from the most recent tasting that has one. */
export function entrySourceType(entry: CustomerTasting): TastingRecord['sourceType'] | undefined {
  for (let i = entry.tastings.length - 1; i >= 0; i--) {
    if (entry.tastings[i].sourceType) return entry.tastings[i].sourceType;
  }
  return undefined;
}

/** The TastingData shown on the journal card: the note's synthesized view. */
export function displayTastingData(entry: CustomerTasting): TastingData {
  return entry.note.tasting;
}
