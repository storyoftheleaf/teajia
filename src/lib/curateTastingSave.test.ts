import { beforeEach, describe, expect, it } from 'vitest';
import type { TastingData } from '../types';
import { createEmptyEntry, type TeaCompassEntry } from '../components/TeaCompass/types';
import { curateTastingUpdate, journalEntryCurateTeaId, journalEntryCurateTeaIdHere, saveCurateTasting } from './curateTastingSave';
import { useTeaCompassStore } from './teaCompassStore';

const now = new Date(2026, 10, 11, 15, 0, 0);
const earlierToday = new Date(2026, 10, 11, 9, 0, 0).toISOString();
const opening = { id: 'opening-1', createdAt: now.toISOString() };
const secondOpening = { id: 'opening-2', createdAt: earlierToday };

const before: TastingData = { quality: 5 };
const saved: TastingData = { quality: 8, flavor: ['citrus-peel'] };

const tea = (history?: TeaCompassEntry['tastingHistory']) => ({ tastingHistory: history });

describe('one history record for each saved Curate tasting opening', () => {
  it('keeps different openings on the same day alongside their id-less history', () => {
    const legacy = { data: before, date: earlierToday };
    const first = curateTastingUpdate(tea([legacy]), before, undefined, { record: opening });
    const second = curateTastingUpdate(tea(first.tastingHistory), saved, undefined, { record: secondOpening });

    expect(second.tasting).toBe(saved);
    expect(second.tastingHistory).toEqual([
      legacy,
      { id: opening.id, data: before, date: opening.createdAt },
      { id: secondOpening.id, data: saved, date: secondOpening.createdAt },
    ]);
  });

  it('updates the same opening without adding a record or changing its date', () => {
    const first = curateTastingUpdate(tea(), before, undefined, { record: opening });
    const second = curateTastingUpdate(tea(first.tastingHistory), saved, undefined, { record: opening });
    expect(second.tasting).toBe(saved);
    expect(second.tastingHistory).toEqual([{ id: opening.id, data: saved, date: opening.createdAt }]);
  });

  it('keeps the current tasting and verdict when editing an earlier journal record', () => {
    const first = { id: opening.id, data: before, date: opening.createdAt };
    const latest = { id: secondOpening.id, data: saved, date: secondOpening.createdAt };
    const update = curateTastingUpdate(tea([first, latest]), { quality: 6 }, 'pass', { record: opening, editing: 'past' });
    expect(update).toEqual({ tastingHistory: [{ ...first, data: { quality: 6 } }, latest] });
  });
});

describe('the verdict a saved tasting writes', () => {
  it('is the chosen impression', () => {
    expect(curateTastingUpdate(tea(), saved, 'love', { record: opening }).verdict).toBe('love');
  });

  it('is left alone when no impression was chosen', () => {
    expect('verdict' in curateTastingUpdate(tea(), saved, undefined, { record: opening })).toBe(false);
  });

  it('is left alone for a tasting read back from storage, which has no impression key', () => {
    const stored = JSON.parse(JSON.stringify({ ...saved, impression: undefined })) as TastingData;
    expect('verdict' in curateTastingUpdate(tea(), stored, undefined, { record: opening })).toBe(false);
  });

  it('is cleared when the chosen impression was tapped again to take it back', () => {
    const unchosen: TastingData = { ...saved, impression: undefined };
    const update = curateTastingUpdate(tea(), unchosen, undefined, { record: opening });
    expect('verdict' in update).toBe(true);
    expect(update.verdict).toBeUndefined();
  });

  it('drops the empty impression key from the stored tasting once the verdict is cleared', () => {
    const unchosen: TastingData = { ...saved, impression: undefined };
    const update = curateTastingUpdate(tea(), unchosen, undefined, { record: opening });
    expect('impression' in update.tasting!).toBe(false);
    expect('impression' in update.tastingHistory![0].data).toBe(false);
    expect(update.tasting).toEqual(saved);
  });

  it('follows the impression chosen again after taking one back', () => {
    const rechosen: TastingData = { ...saved, impression: 'neutral' };
    expect(curateTastingUpdate(tea(), rechosen, 'neutral', { record: opening }).verdict).toBe('neutral');
  });
});

describe('an impression chosen in the tea form tasting (capture cards)', () => {
  beforeEach(() => {
    useTeaCompassStore.setState({ entries: [], pendingEntries: [] });
  });

  it('reaches the tea as its verdict, and taking it back clears the verdict', () => {
    const entry = { ...createEmptyEntry('tea'), id: 'tea-form', synced: true, unsyncedEdits: {} } as TeaCompassEntry;
    useTeaCompassStore.setState({ entries: [entry] });

    saveCurateTasting('tea-form', { ...saved, impression: 'love' }, 'love', { record: opening });
    expect(useTeaCompassStore.getState().getEntry('tea-form')!.verdict).toBe('love');

    saveCurateTasting('tea-form', { ...saved, impression: undefined }, undefined, { record: opening });
    const after = useTeaCompassStore.getState().getEntry('tea-form')!;
    expect(after.verdict).toBeUndefined();
    expect(Object.keys(after.unsyncedEdits ?? {})).toContain('verdict');
  });

  it('keeps a verdict given in triage when a later tasting never chose an impression', () => {
    const entry = { ...createEmptyEntry('tea'), id: 'triaged', verdict: 'pass', synced: true, unsyncedEdits: {} } as TeaCompassEntry;
    useTeaCompassStore.setState({ entries: [entry] });
    saveCurateTasting('triaged', saved, undefined, { record: opening });
    expect(useTeaCompassStore.getState().getEntry('triaged')!.verdict).toBe('pass');
  });
});

describe('saving a tasting to a Curate tea in the store', () => {
  beforeEach(() => {
    useTeaCompassStore.setState({ entries: [], pendingEntries: [] });
  });

  it('updates the tea through updateEntry and builds on a save made earlier in the same opening', () => {
    const entry = { ...createEmptyEntry('tea'), id: 'tea-1', synced: true, unsyncedEdits: {} } as TeaCompassEntry;
    useTeaCompassStore.setState({ entries: [entry] });

    saveCurateTasting('tea-1', before, 'like', { record: opening });
    saveCurateTasting('tea-1', saved, undefined, { record: opening });

    const after = useTeaCompassStore.getState().getEntry('tea-1')!;
    expect(after.tasting).toBe(saved);
    expect(after.tastingHistory?.map(h => h.data)).toEqual([saved]);
    expect(after.verdict).toBe('like');
    expect(Object.keys(after.unsyncedEdits ?? {})).toEqual(expect.arrayContaining(['tasting', 'tastingHistory', 'verdict']));
  });

  it('does nothing for a tea this device does not hold', () => {
    saveCurateTasting('missing', saved, 'love', { record: opening });
    expect(useTeaCompassStore.getState().entries).toEqual([]);
  });
});

describe('a journal entry reopened from the account panel', () => {
  const holds = (ids: string[]) => (id: string) => ids.includes(id);

  it('finds its Curate tea by the entry\'s Curate link first', () => {
    expect(journalEntryCurateTeaId({ compassEntryId: 'tea-a', productId: 'tea-b' }, holds(['tea-a', 'tea-b']))).toBe('tea-a');
  });

  it('finds its Curate tea by the product id a Curate tasting files it under', () => {
    expect(journalEntryCurateTeaId({ productId: 'tea-b' }, holds(['tea-b']))).toBe('tea-b');
  });

  it('has no Curate tea when this device holds none of its ids, such as a shop product', () => {
    expect(journalEntryCurateTeaId({ productId: 'product-9' }, holds(['tea-b']))).toBeUndefined();
  });

  it('updates its Curate tea after saving, with the tasting and the chosen verdict', () => {
    const entry = { ...createEmptyEntry('tea'), id: 'journal-tea', tasting: before, synced: true, unsyncedEdits: {} } as TeaCompassEntry;
    useTeaCompassStore.setState({ entries: [entry], pendingEntries: [] });

    const teaId = journalEntryCurateTeaIdHere({ productId: 'journal-tea' });
    expect(teaId).toBe('journal-tea');
    saveCurateTasting(teaId!, { ...saved, impression: 'like' }, 'like', { record: opening, editing: 'latest' });

    const after = useTeaCompassStore.getState().getEntry('journal-tea')!;
    expect(after.tasting).toEqual({ ...saved, impression: 'like' });
    expect(after.verdict).toBe('like');
    expect(Object.keys(after.unsyncedEdits ?? {})).toEqual(expect.arrayContaining(['tasting', 'verdict']));
  });
});
