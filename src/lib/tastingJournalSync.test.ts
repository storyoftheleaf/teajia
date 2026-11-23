import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listMock, syncMock, scopedToken } = vi.hoisted(() => ({
  listMock: vi.fn(),
  syncMock: vi.fn(),
  scopedToken: { accountId: 'a' as string | null, userId: 'member' },
}));

vi.mock('./api', () => ({
  hasToken: () => true,
  getTokenClaims: () => ({ sub: scopedToken.userId, active_account_id: scopedToken.accountId, memberships: [] }),
  isTokenScopedToAccount: (accountId: string, userId: string) =>
    accountId === scopedToken.accountId && userId === scopedToken.userId,
  api: { tastingJournal: { list: listMock, sync: syncMock } },
}));

import { useAppStore } from './store';
import { hydrateTastingJournal, retryPendingJournalSync, syncTastingJournal } from './tastingJournalSync';
import type { CustomerTasting } from '../types';

const sitting = (id: string, createdAt: string, words: string) => ({ id, createdAt, tasting: { notes: [words] } as any });

describe('pulling the journal joins it with what this device holds', () => {
  beforeEach(() => {
    listMock.mockReset();
    scopedToken.accountId = 'a';
    useAppStore.setState({ activeAccountId: 'a', activeUserId: 'member', tastingJournal: [] });
  });

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

  it('shares the in-flight account read and replaces the offline row ID without losing its link or archive', async () => {
    const local = {
      id: 'offline-entry', productId: 'tea', productName: 'Tea', productType: 'Oolong',
      note: { tasting: {}, updatedAt: '2026-11-09T08:00:00.000Z' },
      tastings: [], createdAt: '2026-11-01T08:00:00.000Z', archived: true, synced: false,
    };
    useAppStore.setState({ tastingJournal: [local] });
    listMock.mockResolvedValue({ entries: [{
      id: 'server-entry', product_id: 'tea', product_name: 'Tea', account_id: 'a',
      created_at: '2026-11-02T08:00:00.000Z',
      tasting: { rating: 7 }, source_type: 'event', event_id: 'event', event_slug: 'tea-sit',
    }] });

    await Promise.all([hydrateTastingJournal(), hydrateTastingJournal()]);

    expect(listMock).toHaveBeenCalledExactlyOnceWith({
      background: true, expectedAuth: { accountId: 'a', userId: 'member' },
    });
    expect(useAppStore.getState().tastingJournal).toMatchObject([{
      id: 'server-entry',
      previousIds: ['offline-entry'],
      archived: true,
      synced: false,
      tastings: [{ sourceType: 'event', eventId: 'event', eventSlug: 'tea-sit', tasting: { rating: 7 } }],
    }]);
  });

  it('keeps an archive pushed while an older server read is in flight', async () => {
    useAppStore.setState({ tastingJournal: [{
      id: 'entry', productId: 'tea', productName: 'Tea', productType: 'Oolong',
      note: { tasting: {}, updatedAt: '2026-11-09T08:00:00.000Z' },
      tastings: [], createdAt: '2026-11-01T08:00:00.000Z', archived: true, synced: false,
    }] });
    let finish: (value: unknown) => void = () => {};
    listMock.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const pull = hydrateTastingJournal();

    syncMock.mockResolvedValueOnce({});
    await syncTastingJournal();
    finish([{ id: 'entry', product_id: 'tea', account_id: 'a', archived: 0 }]);
    await pull;

    expect(useAppStore.getState().tastingJournal[0]).toMatchObject({ archived: true, synced: true });
  });

  it('hydrates the journal for a signed-in guest who has no active location', async () => {
    scopedToken.accountId = null;
    useAppStore.getState().setActiveAccountId(null);
    listMock.mockResolvedValueOnce([
      { id: 'guest-entry', product_id: 'tea' },
      { id: 'other-scope', product_id: 'other-tea', account_id: 'a' },
    ]);

    await hydrateTastingJournal();

    expect(listMock).toHaveBeenCalledExactlyOnceWith({ background: true });
    expect(useAppStore.getState().tastingJournal.map(entry => entry.id)).toEqual(['guest-entry']);
  });

  it('ignores a stale pull after switching account, even after returning to its original account', async () => {
    let finish: (value: unknown) => void = () => {};
    listMock.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const old = hydrateTastingJournal();
    useAppStore.getState().setActiveAccountId('b');
    await hydrateTastingJournal();
    expect(listMock).toHaveBeenCalledTimes(1);

    scopedToken.accountId = 'b';
    listMock.mockResolvedValueOnce([{ id: 'b-entry', product_id: 'b-tea', account_id: 'b' }]);
    await hydrateTastingJournal();
    expect(useAppStore.getState().tastingJournal.map(entry => entry.id)).toEqual(['b-entry']);

    useAppStore.getState().setActiveAccountId('a');
    scopedToken.accountId = 'a';
    listMock.mockResolvedValueOnce([{ id: 'a-new', product_id: 'a-tea', account_id: 'a' }]);
    await hydrateTastingJournal();
    finish([{ id: 'a-old', product_id: 'old', account_id: 'a' }]);
    await old;
    expect(useAppStore.getState().tastingJournal.map(entry => entry.id)).toEqual(['a-new']);
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
