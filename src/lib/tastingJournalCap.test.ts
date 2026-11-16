import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './store';
import type { CustomerTasting } from '../types';

const entry = (n: number, synced: boolean): CustomerTasting => ({
  id: `entry-${n}`, productId: `tea-${n}`, productName: `Tea ${n}`, productType: 'Oolong',
  note: { tasting: {} as any, updatedAt: '2026-11-01T08:00:00.000Z' },
  tastings: [{ id: `sitting-${n}`, createdAt: '2026-11-01T08:00:00.000Z', tasting: {} as any }],
  createdAt: '2026-11-01T08:00:00.000Z', synced,
});

const record = { id: 'new-sitting', createdAt: '2026-11-11T08:00:00.000Z', tasting: {} as any };

describe('the local journal never drops an entry the shop does not hold', () => {
  beforeEach(() => useAppStore.setState({ tastingJournal: [] }));

  it('a guest\'s 101st tea keeps the first one', () => {
    useAppStore.setState({ tastingJournal: Array.from({ length: 100 }, (_, i) => entry(100 - i, false)) });
    useAppStore.getState().upsertTastingByProductId('tea-101', 'Tea 101', 'Oolong', undefined, record);
    const journal = useAppStore.getState().tastingJournal;
    expect(journal).toHaveLength(101);
    expect(journal.some(e => e.id === 'entry-1')).toBe(true);

    useAppStore.getState().addTasting(entry(102, false));
    expect(useAppStore.getState().tastingJournal).toHaveLength(102);
  });

  it('a session tasting uses the active shop entry or adopts local guest history', () => {
    const otherShop = { ...entry(1, true), accountId: 'other', note: { tasting: { quality: 4 }, updatedAt: '2026-11-01' } };
    const guest = { ...entry(1, false), id: 'guest-entry' };
    useAppStore.setState({ tastingJournal: [otherShop, guest] });
    useAppStore.getState().upsertTastingByProductId('tea-1', 'Tea 1', 'Oolong', undefined, {
      ...record, sourceType: 'event', eventId: 'event-1', tasting: { quality: 8 },
    }, { rating: 8 }, 'local');
    const journal = useAppStore.getState().tastingJournal;
    expect(journal[0]).toEqual(otherShop);
    expect(journal[1]).toMatchObject({ id: 'guest-entry', accountId: 'local', note: { rating: 8 } });
  });

  it('an unsynced entry outlives synced ones, and synced ones still stop at the cap', () => {
    // Oldest at the end: one unsynced entry behind 99 synced ones.
    useAppStore.setState({ tastingJournal: [...Array.from({ length: 99 }, (_, i) => entry(100 - i, true)), entry(1, false)] });
    useAppStore.getState().upsertTastingByProductId('tea-101', 'Tea 101', 'Oolong', undefined, record);
    const journal = useAppStore.getState().tastingJournal;
    expect(journal).toHaveLength(100);
    expect(journal.some(e => e.id === 'entry-1')).toBe(true);
    expect(journal.some(e => e.id === 'entry-2')).toBe(false);
    expect(journal[0].productId).toBe('tea-101');
  });
});
