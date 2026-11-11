import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listMock, syncMock } = vi.hoisted(() => ({ listMock: vi.fn(), syncMock: vi.fn() }));

vi.mock('./api', () => ({
  hasToken: () => true,
  api: { tastingJournal: { list: listMock, sync: syncMock } },
}));

import { useAppStore } from './store';
import { hydrateTastingJournal, retryPendingJournalSync, syncTastingJournal } from './tastingJournalSync';
import type { CustomerTasting } from '../types';

const sitting = (id: string, createdAt: string, words: string) => ({ id, createdAt, tasting: { notes: [words] } as any });

describe('pulling the journal joins it with what this device holds', () => {
  beforeEach(() => listMock.mockReset());

  it('an unsynced local edit of a sitting the shop also holds survives the pull', async () => {
    const local: CustomerTasting = {
      id: 'entry', productId: 'tea', productName: 'Tea', productType: 'Oolong',
      note: { tasting: { notes: ['edited here'] } as any, updatedAt: '2026-11-09T08:00:00.000Z' },
      tastings: [sitting('first', '2026-11-01T08:00:00.000Z', 'edited here')],
      createdAt: '2026-11-01T08:00:00.000Z', synced: false,
    };
    useAppStore.setState({ tastingJournal: [local] });
    listMock.mockResolvedValue([{
      id: 'entry', product_id: 'tea', product_name: 'Tea', product_type: 'Oolong', created_at: '2026-11-01T08:00:00.000Z',
      note: JSON.stringify({ tasting: { notes: ['older'] }, updatedAt: '2026-11-02T08:00:00.000Z' }),
      tastings: JSON.stringify([
        sitting('first', '2026-11-01T08:00:00.000Z', 'older'),
        sitting('other-device', '2026-11-03T08:00:00.000Z', 'from the laptop'),
      ]),
    }]);

    await hydrateTastingJournal();

    const [entry] = useAppStore.getState().tastingJournal;
    expect(entry.tastings.map(t => [t.id, t.tasting.notes?.[0]])).toEqual([
      ['first', 'edited here'],
      ['other-device', 'from the laptop'],
    ]);
    expect(entry.note.tasting.notes).toEqual(['edited here']);
    expect(entry.synced).toBe(false);
  });
});

describe('the retry wired to the real journal', () => {
  beforeEach(() => syncMock.mockReset());

  it('a journal with nothing waiting sends nothing on retry', async () => {
    useAppStore.setState({ tastingJournal: [] });

    await retryPendingJournalSync();

    expect(syncMock).not.toHaveBeenCalled();
  });

  it('an unsynced entry is pushed on retry and marked synced when the push succeeds', async () => {
    syncMock.mockResolvedValue({});
    useAppStore.setState({ tastingJournal: [{
      id: 'entry', productId: 'tea', productName: 'Tea', productType: 'Oolong',
      note: { tasting: {} as any, updatedAt: '2026-11-09T08:00:00.000Z' },
      tastings: [], createdAt: '2026-11-01T08:00:00.000Z', synced: false,
    }] });

    await retryPendingJournalSync();
    await retryPendingJournalSync();

    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().tastingJournal[0].synced).toBe(true);
  });
});

describe('an edit made while a push is on its way', () => {
  beforeEach(() => syncMock.mockReset());

  it('stays waiting, so the next push sends it', async () => {
    const entry: CustomerTasting = {
      id: 'entry', productId: 'tea', productName: 'Tea', productType: 'Oolong',
      note: { tasting: { notes: ['first words'] } as any, updatedAt: '2026-11-09T08:00:00.000Z' },
      tastings: [sitting('first', '2026-11-01T08:00:00.000Z', 'first words')],
      createdAt: '2026-11-01T08:00:00.000Z', synced: false,
    };
    const untouched: CustomerTasting = { ...entry, id: 'other', productId: 'other-tea' };
    useAppStore.setState({ tastingJournal: [entry, untouched] });
    let finish: (value: unknown) => void = () => {};
    syncMock.mockReturnValue(new Promise(resolve => { finish = resolve; }));

    const push = syncTastingJournal();
    useAppStore.setState(state => ({
      tastingJournal: state.tastingJournal.map(e => e.id === 'entry'
        ? { ...e, note: { ...e.note, tasting: { notes: ['changed mid-flight'] } as any, updatedAt: '2026-11-09T09:00:00.000Z' } }
        : e),
    }));
    finish({});
    await push;

    const journal = useAppStore.getState().tastingJournal;
    expect(journal.find(e => e.id === 'entry')?.synced).toBe(false);
    expect(journal.find(e => e.id === 'other')?.synced).toBe(true);
  });
});
