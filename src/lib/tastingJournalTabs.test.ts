import { afterEach, describe, expect, it, vi } from 'vitest';
import { joinOtherTabJournal, journalInStoredValue, listenForOtherTabJournal, storedValueWithJournal } from './tastingJournalTabs';
import type { CustomerTasting } from '../types';

const sitting = (id: string, createdAt: string, words: string) => ({ id, createdAt, tasting: { notes: [words] } as any });

function entry(id: string, productId: string, updatedAt: string, sittings: ReturnType<typeof sitting>[], extra: Partial<CustomerTasting> = {}): CustomerTasting {
  return {
    id, productId, productName: productId, productType: 'Oolong',
    note: { tasting: { notes: [sittings.at(-1)?.tasting.notes[0] ?? ''] } as any, updatedAt },
    tastings: sittings,
    createdAt: '2026-11-01T08:00:00.000Z',
    synced: false,
    ...extra,
  };
}

const stored = (journal: CustomerTasting[]) => JSON.stringify({ state: { tastingJournal: journal, cart: [] }, version: 6 });

describe('another tab writing the journal is joined into this tab', () => {
  it('a tea the other tab added appears here first and this tab keeps its own teas', () => {
    const mine = entry('a', 'tea-a', '2026-11-02T08:00:00.000Z', [sitting('a1', '2026-11-02T08:00:00.000Z', 'mine')]);
    const theirs = entry('b', 'tea-b', '2026-11-03T08:00:00.000Z', [sitting('b1', '2026-11-03T08:00:00.000Z', 'theirs')]);

    const joined = joinOtherTabJournal([mine], [theirs, mine], [mine]);

    expect(joined.map(e => e.id)).toEqual(['b', 'a']);
  });

  it('when both tabs edited the same tea every sitting survives and the later note wins', () => {
    const first = sitting('s1', '2026-11-01T08:00:00.000Z', 'first');
    const base = entry('a', 'tea-a', '2026-11-01T08:00:00.000Z', [first]);
    const mine = entry('a', 'tea-a', '2026-11-04T08:00:00.000Z', [first, sitting('here', '2026-11-04T08:00:00.000Z', 'this tab')]);
    const theirs = entry('a', 'tea-a', '2026-11-03T08:00:00.000Z', [first, sitting('there', '2026-11-03T08:00:00.000Z', 'other tab')]);

    const [joined] = joinOtherTabJournal([mine], [theirs], [base]);

    expect(joined.tastings.map(t => t.id)).toEqual(['s1', 'there', 'here']);
    expect(joined.note.tasting.notes).toEqual(['this tab']);
    expect(joined.synced).toBe(false);
  });

  it('an unsynced entry only this tab has is kept when the other tab writes without it', () => {
    const mine = entry('a', 'tea-a', '2026-11-02T08:00:00.000Z', [sitting('a1', '2026-11-02T08:00:00.000Z', 'not yet on the shop')]);
    const theirs = entry('b', 'tea-b', '2026-11-03T08:00:00.000Z', [sitting('b1', '2026-11-03T08:00:00.000Z', 'theirs')], { synced: true });

    const joined = joinOtherTabJournal([mine], [theirs], []);

    expect(joined.map(e => e.id)).toEqual(['b', 'a']);
    expect(joined.find(e => e.id === 'a')?.synced).toBe(false);
  });

  it('a tea this tab has not touched takes the other tab copy whole so an archive arrives', () => {
    const mine = entry('a', 'tea-a', '2026-11-02T08:00:00.000Z', [sitting('a1', '2026-11-02T08:00:00.000Z', 'x')]);
    const theirs = { ...mine, archived: true };

    const [joined] = joinOtherTabJournal([mine], [theirs], [mine]);

    expect(joined.archived).toBe(true);
  });

  it('the same tea started in two tabs under different ids becomes one entry with both sittings', () => {
    const mine = entry('a', 'tea-a', '2026-11-02T08:00:00.000Z', [sitting('a1', '2026-11-02T08:00:00.000Z', 'here')]);
    const theirs = entry('b', 'tea-a', '2026-11-03T08:00:00.000Z', [sitting('b1', '2026-11-03T08:00:00.000Z', 'there')]);

    const joined = joinOtherTabJournal([mine], [theirs], []);

    expect(joined).toHaveLength(1);
    expect(joined[0].tastings.map(t => t.id)).toEqual(['a1', 'b1']);
  });

  it('nothing new from the other tab returns this tab journal unchanged so the tabs stop answering each other', () => {
    const mine = entry('a', 'tea-a', '2026-11-02T08:00:00.000Z', [sitting('a1', '2026-11-02T08:00:00.000Z', 'x')]);
    const local = [mine];

    expect(joinOtherTabJournal(local, [JSON.parse(JSON.stringify(mine))], null)).toBe(local);
  });

  it('only the journal is read from a stored value and anything unreadable is ignored', () => {
    const mine = entry('a', 'tea-a', '2026-11-02T08:00:00.000Z', []);
    expect(journalInStoredValue(stored([mine]))).toEqual([mine]);
    expect(journalInStoredValue('not json')).toBeNull();
    expect(journalInStoredValue(null)).toBeNull();
    expect(journalInStoredValue(JSON.stringify({ state: { cart: [] } }))).toBeNull();
  });
});

describe('the storage listener', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('sets only the journal when another tab writes the store key and ignores other keys', () => {
    let handler: ((event: any) => void) | undefined;
    vi.stubGlobal('window', { addEventListener: (_: string, fn: any) => { handler = fn; }, removeEventListener: () => {} });
    const mine = entry('a', 'tea-a', '2026-11-02T08:00:00.000Z', []);
    const theirs = entry('b', 'tea-b', '2026-11-03T08:00:00.000Z', []);
    const setState = vi.fn();
    listenForOtherTabJournal({ getState: () => ({ tastingJournal: [mine] }), setState }, 'teajia-storage');

    handler!({ key: 'something-else', newValue: stored([theirs]), oldValue: stored([mine]) });
    expect(setState).not.toHaveBeenCalled();

    handler!({ key: 'teajia-storage', newValue: stored([theirs]), oldValue: stored([mine]) });
    expect(setState).toHaveBeenCalledTimes(1);
    expect(Object.keys(setState.mock.calls[0][0])).toEqual(['tastingJournal']);
    expect(setState.mock.calls[0][0].tastingJournal.map((e: CustomerTasting) => e.id)).toEqual(['b', 'a']);
  });
});

describe('what is left in storage after joining another tab', () => {
  it('keeps the other tab cart and settings and replaces only the journal', () => {
    const theirs = JSON.stringify({ state: { cart: [{ id: 'new-in-their-cart' }], currency: 'USD', tastingJournal: [] }, version: 3 });
    const joined = [{ id: 'mine' }] as any;

    const kept = JSON.parse(storedValueWithJournal(theirs, joined)!);

    expect(kept.state.cart).toEqual([{ id: 'new-in-their-cart' }]);
    expect(kept.state.currency).toBe('USD');
    expect(kept.state.tastingJournal).toEqual([{ id: 'mine' }]);
    expect(kept.version).toBe(3);
  });

  it('an unreadable stored value is left alone', () => {
    expect(storedValueWithJournal('not json', [])).toBeNull();
    expect(storedValueWithJournal(null, [])).toBeNull();
    expect(storedValueWithJournal(JSON.stringify({ nothing: true }), [])).toBeNull();
  });
});
