import type { TastingData, TastingRecord } from '../types';
import type { CompassVerdict, TeaCompassEntry } from '../components/TeaCompass/types';
import { useTeaCompassStore } from './teaCompassStore';

type HistoryRecord = NonNullable<TeaCompassEntry['tastingHistory']>[number];
type CurateTastingSaveOptions = {
  record: Pick<TastingRecord, 'id' | 'createdAt'>;
  /** Journal edits reuse the original record and may refer to older id-less history. */
  editing?: 'latest' | 'past';
};

/**
 * True when the impression was taken back in the tasting. The tasting writes the
 * impression key with no value only when the chosen impression is tapped again
 * (TastingSession's onVerdict); a tasting where none was chosen, or one read back
 * from storage, has no impression key at all.
 */
export function impressionWasUnchosen(data: TastingData): boolean {
  return Object.prototype.hasOwnProperty.call(data, 'impression') && data.impression == null;
}

function withoutImpressionKey(data: TastingData): TastingData {
  const { impression: _impression, ...rest } = data;
  return rest;
}

/** Each opening owns one stable record. Editing an older journal note leaves the current tasting alone. */
export function curateTastingUpdate(
  entry: Pick<TeaCompassEntry, 'tastingHistory'>,
  data: TastingData,
  verdict: CompassVerdict | undefined,
  { record, editing }: CurateTastingSaveOptions,
): Partial<TeaCompassEntry> {
  const existing = entry.tastingHistory ?? [];
  const index = existing.findIndex(item => item.id === record.id);
  const unchosen = !verdict && impressionWasUnchosen(data);
  const tasting = unchosen ? withoutImpressionKey(data) : data;
  const update: Partial<TeaCompassEntry> = {};

  if (index >= 0) {
    update.tastingHistory = existing.map((item, i) => i === index ? { ...item, data: tasting } : item);
    if (index < existing.length - 1) return update;
  } else if (!editing) {
    const historyRecord: HistoryRecord = { id: record.id, data: tasting, date: record.createdAt };
    update.tastingHistory = [...existing, historyRecord];
  } else if (editing === 'past' || existing.some(item => item.id && item.date > record.createdAt)) {
    return update;
  }

  update.tasting = tasting;
  if (verdict) update.verdict = verdict;
  else if (unchosen) update.verdict = undefined;
  return update;
}

/**
 * Applies a saved tasting to the Curate tea with this id, through the store's
 * `updateEntry` so the field-level sync records the change. Reads the tea at save
 * time, so a second save in the same opening builds on the first. Does nothing
 * when this device does not hold the tea.
 */
export function saveCurateTasting(
  entryId: string,
  data: TastingData,
  verdict: CompassVerdict | undefined,
  options: CurateTastingSaveOptions,
): void {
  const store = useTeaCompassStore.getState();
  const entry = store.getEntry(entryId);
  if (!entry) return;
  const update = curateTastingUpdate(entry, data, verdict, options);
  if (Object.keys(update).length) store.updateEntry(entryId, update);
}

/**
 * The Curate tea a journal entry belongs to, when this device holds it. A tasting
 * started from Curate files its journal entry under the Curate tea's id, so the
 * entry's own Curate link is tried first, then its product id.
 */
export function journalEntryCurateTeaId(
  entry: { compassEntryId?: string; productId: string },
  holdsTea: (id: string) => boolean,
): string | undefined {
  return [entry.compassEntryId, entry.productId].find((id): id is string => !!id && holdsTea(id));
}

/** `journalEntryCurateTeaId` against the Curate store on this device. */
export function journalEntryCurateTeaIdHere(entry: { compassEntryId?: string; productId: string }): string | undefined {
  const store = useTeaCompassStore.getState();
  return journalEntryCurateTeaId(entry, id => !!store.getEntry(id));
}
