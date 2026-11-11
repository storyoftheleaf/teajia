import type { TastingData } from '../types';
import type { CompassVerdict, TeaCompassEntry } from '../components/TeaCompass/types';
import { useTeaCompassStore } from './teaCompassStore';

/**
 * What a saved tasting does to its Curate tea, whichever door opened it.
 *
 * Every Curate door (the cards, the detail panels, the capture forms, the
 * account panel's journal) hands the saved tasting here, so a tasting always
 * changes the tea the same way: its current `tasting`, its history, and its
 * verdict.
 *
 * History rule. The doors disagreed when this was written: two Curate v2 doors
 * replace the last history record when it was written today, the Curate v2
 * detail panel always appends, and old Curate wrote no history at all. Neither
 * of the first two keeps everything the other keeps, so the rule is still named
 * by each door until one is chosen.
 *   - 'same-day': replace the last record when it is from today, else append.
 *   - 'append': always append.
 *   - 'none': leave the history as it is.
 */
export type CurateHistoryRule = 'same-day' | 'append' | 'none';

type HistoryRecord = NonNullable<TeaCompassEntry['tastingHistory']>[number];

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

function historyAfterSave(
  existing: ReadonlyArray<HistoryRecord>,
  data: TastingData,
  rule: CurateHistoryRule,
  now: Date,
): HistoryRecord[] {
  const record: HistoryRecord = { data, date: now.toISOString() };
  if (rule === 'append') return [...existing, record];
  const last = existing[existing.length - 1];
  const lastWasToday = !!last && new Date(last.date).toDateString() === now.toDateString();
  return lastWasToday ? [...existing.slice(0, -1), record] : [...existing, record];
}

/**
 * The update a saved tasting makes to its Curate tea.
 * - `tasting` is always the saved tasting.
 * - `tastingHistory` follows the door's history rule.
 * - `verdict` is the chosen impression when there is one. It is cleared only when
 *   the impression was explicitly taken back in this tasting; otherwise it is
 *   left alone, so a verdict given in triage is not wiped by a tasting that
 *   never chose one.
 */
export function curateTastingUpdate(
  entry: Pick<TeaCompassEntry, 'tastingHistory'>,
  data: TastingData,
  verdict: CompassVerdict | undefined,
  options: { history: CurateHistoryRule; now?: Date },
): Partial<TeaCompassEntry> {
  const now = options.now ?? new Date();
  const unchosen = !verdict && impressionWasUnchosen(data);
  // The empty impression key has done its job once the verdict is cleared. Kept on
  // the tea, a later reopening in this page would read it as a second take-back
  // and clear a verdict given since. Stored JSON is the same either way.
  const tasting = unchosen ? withoutImpressionKey(data) : data;
  const update: Partial<TeaCompassEntry> = { tasting };
  if (options.history !== 'none') {
    update.tastingHistory = historyAfterSave(entry.tastingHistory ?? [], tasting, options.history, now);
  }
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
  options: { history: CurateHistoryRule },
): void {
  const store = useTeaCompassStore.getState();
  const entry = store.getEntry(entryId);
  if (!entry) return;
  store.updateEntry(entryId, curateTastingUpdate(entry, data, verdict, options));
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
