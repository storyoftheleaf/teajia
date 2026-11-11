import { beforeEach, describe, expect, it } from 'vitest';
import type { TastingData } from '../types';
import { createEmptyEntry, type TeaCompassEntry } from '../components/TeaCompass/types';
import { curateTastingUpdate, journalEntryCurateTeaId, journalEntryCurateTeaIdHere, saveCurateTasting } from './curateTastingSave';
import { useTeaCompassStore } from './teaCompassStore';

const now = new Date(2026, 10, 11, 15, 0, 0);
const earlierToday = new Date(2026, 10, 11, 9, 0, 0).toISOString();
const yesterday = new Date(2026, 10, 10, 9, 0, 0).toISOString();

const before: TastingData = { quality: 5 };
const saved: TastingData = { quality: 8, flavor: ['citrus-peel'] };

const tea = (history?: TeaCompassEntry['tastingHistory']) => ({ tastingHistory: history });

describe('a saved tasting from a Curate v2 card or capture form (same-day history)', () => {
  it('starts the history with the saved tasting on a tea never tasted', () => {
    const update = curateTastingUpdate(tea(), saved, undefined, { history: 'same-day', now });
    expect(update.tasting).toBe(saved);
    expect(update.tastingHistory).toEqual([{ data: saved, date: now.toISOString() }]);
  });

  it('replaces the last history record when it was written today', () => {
    const update = curateTastingUpdate(
      tea([{ data: before, date: yesterday }, { data: before, date: earlierToday }]),
      saved, undefined, { history: 'same-day', now },
    );
    expect(update.tastingHistory).toEqual([
      { data: before, date: yesterday },
      { data: saved, date: now.toISOString() },
    ]);
  });

  it('appends when the last history record is from an earlier day', () => {
    const update = curateTastingUpdate(tea([{ data: before, date: yesterday }]), saved, undefined, { history: 'same-day', now });
    expect(update.tastingHistory).toEqual([
      { data: before, date: yesterday },
      { data: saved, date: now.toISOString() },
    ]);
  });
});

describe('a saved tasting from the Curate v2 detail panel (append history)', () => {
  it('appends even when the last record is from today', () => {
    const update = curateTastingUpdate(tea([{ data: before, date: earlierToday }]), saved, undefined, { history: 'append', now });
    expect(update.tastingHistory).toEqual([
      { data: before, date: earlierToday },
      { data: saved, date: now.toISOString() },
    ]);
  });
});

describe('a saved tasting from old Curate (no history)', () => {
  it('writes the tasting and leaves the history out of the update', () => {
    const update = curateTastingUpdate(tea([{ data: before, date: yesterday }]), saved, 'like', { history: 'none', now });
    expect(update).toEqual({ tasting: saved, verdict: 'like' });
    expect('tastingHistory' in update).toBe(false);
  });
});

describe('the verdict a saved tasting writes', () => {
  it('is the chosen impression', () => {
    expect(curateTastingUpdate(tea(), saved, 'love', { history: 'none', now }).verdict).toBe('love');
  });

  it('is left alone when no impression was chosen', () => {
    expect('verdict' in curateTastingUpdate(tea(), saved, undefined, { history: 'none', now })).toBe(false);
  });

  it('is left alone for a tasting read back from storage, which has no impression key', () => {
    const stored = JSON.parse(JSON.stringify({ ...saved, impression: undefined })) as TastingData;
    expect('verdict' in curateTastingUpdate(tea(), stored, undefined, { history: 'none', now })).toBe(false);
  });

  it('is cleared when the chosen impression was tapped again to take it back', () => {
    const unchosen: TastingData = { ...saved, impression: undefined };
    const update = curateTastingUpdate(tea(), unchosen, undefined, { history: 'same-day', now });
    expect('verdict' in update).toBe(true);
    expect(update.verdict).toBeUndefined();
  });

  it('drops the empty impression key from the stored tasting once the verdict is cleared', () => {
    const unchosen: TastingData = { ...saved, impression: undefined };
    const update = curateTastingUpdate(tea(), unchosen, undefined, { history: 'same-day', now });
    expect('impression' in update.tasting!).toBe(false);
    expect('impression' in update.tastingHistory![0].data).toBe(false);
    expect(update.tasting).toEqual(saved);
  });

  it('follows the impression chosen again after taking one back', () => {
    const rechosen: TastingData = { ...saved, impression: 'neutral' };
    expect(curateTastingUpdate(tea(), rechosen, 'neutral', { history: 'none', now }).verdict).toBe('neutral');
  });
});

describe('an impression chosen in the tea form tasting (capture cards)', () => {
  beforeEach(() => {
    useTeaCompassStore.setState({ entries: [], pendingEntries: [] });
  });

  it('reaches the tea as its verdict, and taking it back clears the verdict', () => {
    const entry = { ...createEmptyEntry('tea'), id: 'tea-form', synced: true, unsyncedEdits: {} } as TeaCompassEntry;
    useTeaCompassStore.setState({ entries: [entry] });

    saveCurateTasting('tea-form', { ...saved, impression: 'love' }, 'love', { history: 'same-day' });
    expect(useTeaCompassStore.getState().getEntry('tea-form')!.verdict).toBe('love');

    saveCurateTasting('tea-form', { ...saved, impression: undefined }, undefined, { history: 'same-day' });
    const after = useTeaCompassStore.getState().getEntry('tea-form')!;
    expect(after.verdict).toBeUndefined();
    expect(Object.keys(after.unsyncedEdits ?? {})).toContain('verdict');
  });

  it('keeps a verdict given in triage when a later tasting never chose an impression', () => {
    const entry = { ...createEmptyEntry('tea'), id: 'triaged', verdict: 'pass', synced: true, unsyncedEdits: {} } as TeaCompassEntry;
    useTeaCompassStore.setState({ entries: [entry] });
    saveCurateTasting('triaged', saved, undefined, { history: 'none' });
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

    saveCurateTasting('tea-1', before, 'like', { history: 'append' });
    saveCurateTasting('tea-1', saved, undefined, { history: 'append' });

    const after = useTeaCompassStore.getState().getEntry('tea-1')!;
    expect(after.tasting).toBe(saved);
    expect(after.tastingHistory?.map(h => h.data)).toEqual([before, saved]);
    expect(after.verdict).toBe('like');
    expect(Object.keys(after.unsyncedEdits ?? {})).toEqual(expect.arrayContaining(['tasting', 'tastingHistory', 'verdict']));
  });

  it('does nothing for a tea this device does not hold', () => {
    saveCurateTasting('missing', saved, 'love', { history: 'append' });
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
    saveCurateTasting(teaId!, { ...saved, impression: 'like' }, 'like', { history: 'none' });

    const after = useTeaCompassStore.getState().getEntry('journal-tea')!;
    expect(after.tasting).toEqual({ ...saved, impression: 'like' });
    expect(after.verdict).toBe('like');
    expect(Object.keys(after.unsyncedEdits ?? {})).toEqual(expect.arrayContaining(['tasting', 'verdict']));
  });
});
