import { beforeEach, describe, expect, it, vi } from 'vitest';

const { syncMock, listMock, samplesListMock, tokenAccount } = vi.hoisted(() => ({
  syncMock: vi.fn(),
  listMock: vi.fn(),
  samplesListMock: vi.fn(),
  tokenAccount: { current: 'acct-a' as string | null },
}));

vi.mock('./api', () => ({
  hasToken: () => true,
  isTokenScopedToAccount: (accountId: string) => tokenAccount.current === accountId,
  api: {
    compass: {
      sync: syncMock,
      remove: vi.fn(),
      promote: vi.fn(),
      list: listMock,
    },
    samples: { list: samplesListMock },
  },
}));

import { createEmptyEntry } from '../components/TeaCompass/types';
import { useTeaCompassStore } from './teaCompassStore';
import { hydrateCompassEntries, syncCompassEntries } from './teaCompassSync';

function entry(id: string) {
  return { ...createEmptyEntry(), id, name: id, synced: false };
}

describe('Compass sync acknowledgements', () => {
  beforeEach(() => {
    syncMock.mockReset();
    listMock.mockReset();
    samplesListMock.mockReset();
    samplesListMock.mockResolvedValue({ samples: [] });
    tokenAccount.current = 'acct-a';
    useTeaCompassStore.setState({
      entries: [],
      entriesByAccount: {},
      accountScopeId: 'acct-a',
      deletedIds: [],
      pendingPromotions: [],
      syncError: false,
    });
  });

  it('normalizes nullable server names before entries reach the Compass store', async () => {
    listMock.mockResolvedValue({
      entries: [{
        ...entry('nameless'),
        name: null,
        synced: undefined,
        photos: '[]',
        audio_clips: '[]',
      }],
    });

    await hydrateCompassEntries('acct-a');

    expect(useTeaCompassStore.getState().entries[0]?.name).toBe('');
  });

  it('recovers durable batch linkage and lifecycle from server-backed samples', async () => {
    listMock.mockResolvedValue({ entries: [{
      ...entry('linked-entry'), synced: undefined, photos: '[]', audio_clips: '[]',
      decision: 'selected', verdict: 'love', status: 'noted', sample_state: null, sample_set_id: null,
    }] });
    samplesListMock.mockResolvedValue({ samples: [{
      id: 'portion-1', account_id: 'acct-a', compass_entry_id: 'linked-entry', set_id: 'batch-1',
      status: 'received', tastings: [],
    }] });

    await hydrateCompassEntries('acct-a');

    expect(useTeaCompassStore.getState().entries[0]).toMatchObject({
      id: 'linked-entry', sampleSetId: 'batch-1', sampleState: 'received', isSample: true,
      decision: 'selected', verdict: 'love', status: 'noted', synced: false,
    });
  });

  it('never downgrades a durable Compass lifecycle from lagging sample logistics', async () => {
    listMock.mockResolvedValue({ entries: [{
      ...entry('already-tasted'), synced: undefined, photos: '[]', audio_clips: '[]',
      sample_state: 'tasted', sample_set_id: 'batch-1',
    }] });
    samplesListMock.mockResolvedValue({ samples: [{
      id: 'portion-1', account_id: 'acct-a', compass_entry_id: 'already-tasted', set_id: 'batch-1',
      status: 'requested', tastings: [],
    }] });
    await hydrateCompassEntries('acct-a');
    expect(useTeaCompassStore.getState().entries[0]).toMatchObject({ sampleState: 'tasted', sampleSetId: 'batch-1', synced: true });
  });

  it('marks only acknowledged ids synced and keeps collisions queued', async () => {
    syncMock.mockResolvedValue({
      synced: 1,
      syncedIds: ['accepted'],
      conflicts: ['collision'],
    });
    useTeaCompassStore.setState({ entries: [entry('accepted'), entry('collision')] });

    expect(await syncCompassEntries('acct-a')).toBe(1);
    expect(useTeaCompassStore.getState().entries.map(({ id, synced }) => ({ id, synced }))).toEqual([
      { id: 'accepted', synced: true },
      { id: 'collision', synced: false },
    ]);
    expect(useTeaCompassStore.getState().syncError).toBe(true);
  });

  it('marks automatic hydration and sync requests as background work', async () => {
    listMock.mockResolvedValue({ entries: [] });

    await hydrateCompassEntries('acct-a');

    expect(listMock).toHaveBeenCalledWith(undefined, { background: true });
    expect(samplesListMock).toHaveBeenCalledWith(undefined, { background: true });

    syncMock.mockResolvedValue({ synced: 1, syncedIds: ['pending'] });
    useTeaCompassStore.setState({ entries: [entry('pending')] });

    await syncCompassEntries('acct-a');

    expect(syncMock).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'pending' })],
      { background: true },
    );
  });

  it('sends durable sample unlink fields without the client-only isSample mirror', async () => {
    syncMock.mockResolvedValue({ synced: 1, syncedIds: ['unlinked'] });
    useTeaCompassStore.setState({
      entries: [{
        ...entry('unlinked'), sampleSetId: undefined, sampleState: null, isSample: false,
        decision: 'selected', verdict: 'love', status: 'noted',
      }],
    });

    expect(await syncCompassEntries('acct-a')).toBe(1);
    expect(syncMock).toHaveBeenCalledWith(
      [expect.objectContaining({
        id: 'unlinked', sample_set_id: null, sample_state: null,
        decision: 'selected', verdict: 'love', status: 'noted',
      })],
      { background: true },
    );
    expect(syncMock.mock.calls[0][0][0]).not.toHaveProperty('isSample');
  });

  it('does not trust a numeric count without explicit id acknowledgements', async () => {
    syncMock.mockResolvedValue({ synced: 2 });
    useTeaCompassStore.setState({ entries: [entry('one'), entry('two')] });

    expect(await syncCompassEntries('acct-a')).toBe(0);
    expect(useTeaCompassStore.getState().entries.every(item => !item.synced)).toBe(true);
    expect(useTeaCompassStore.getState().syncError).toBe(true);
  });

  it('never sends an unsynced entry from a different account', async () => {
    syncMock.mockResolvedValue({ synced: 1, syncedIds: ['b-only'] });
    useTeaCompassStore.setState({
      accountScopeId: 'acct-a',
      entries: [entry('a-unsynced')],
      entriesByAccount: { 'acct-b': [entry('b-only')] },
    });

    useTeaCompassStore.getState().switchAccount('acct-b');
    tokenAccount.current = 'acct-b';
    await syncCompassEntries('acct-b');

    const payload = syncMock.mock.calls[0]?.[0] as Array<{ id: string }>;
    expect(payload.map((item) => item.id)).toEqual(['b-only']);
    expect(payload.some((item) => item.id === 'a-unsynced')).toBe(false);
  });

  it('refuses sync and hydration requested for a non-active account', async () => {
    useTeaCompassStore.setState({ accountScopeId: 'acct-a', entries: [entry('a-only')] });

    expect(await syncCompassEntries('acct-b')).toBe(0);
    await hydrateCompassEntries('acct-b');

    expect(syncMock).not.toHaveBeenCalled();
    expect(listMock).not.toHaveBeenCalled();
    expect(useTeaCompassStore.getState().entries.map((item) => item.id)).toEqual(['a-only']);
  });

  it('waits for the refreshed JWT account before starting remote work', async () => {
    useTeaCompassStore.setState({ accountScopeId: 'acct-b', entries: [entry('b-unsynced')] });
    tokenAccount.current = 'acct-a';

    await hydrateCompassEntries('acct-b');
    expect(await syncCompassEntries('acct-b')).toBe(0);
    expect(listMock).not.toHaveBeenCalled();
    expect(syncMock).not.toHaveBeenCalled();

    tokenAccount.current = 'acct-b';
    listMock.mockResolvedValue({ entries: [] });
    syncMock.mockResolvedValue({ synced: 1, syncedIds: ['b-unsynced'] });
    await hydrateCompassEntries('acct-b');
    expect(await syncCompassEntries('acct-b')).toBe(1);
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(syncMock).toHaveBeenCalledTimes(1);
  });

  it('ignores stale sync acknowledgements after switching accounts', async () => {
    let resolveSync!: (value: { synced: number; syncedIds: string[] }) => void;
    syncMock.mockReturnValue(new Promise((resolve) => { resolveSync = resolve; }));
    useTeaCompassStore.setState({ accountScopeId: 'acct-a', entries: [entry('a-pending')] });

    const pending = syncCompassEntries('acct-a');
    useTeaCompassStore.getState().switchAccount('acct-b');
    useTeaCompassStore.getState().switchAccount('acct-a');
    resolveSync({ synced: 1, syncedIds: ['a-pending'] });
    expect(await pending).toBe(0);

    expect(useTeaCompassStore.getState().entries[0]).toMatchObject({ id: 'a-pending', synced: false });
  });

  it('ignores a stale hydrate response after the active account changes', async () => {
    let resolveList!: (value: { entries: unknown[] }) => void;
    listMock.mockReturnValue(new Promise((resolve) => { resolveList = resolve; }));
    useTeaCompassStore.setState({ accountScopeId: 'acct-a', entries: [] });

    const pending = hydrateCompassEntries('acct-a');
    useTeaCompassStore.getState().switchAccount('acct-b');
    const b = entry('b-local');
    useTeaCompassStore.getState().addEntry(b);
    resolveList({ entries: [{ ...entry('a-server'), photos: '[]', audio_clips: '[]' }] });
    await pending;

    expect(useTeaCompassStore.getState().accountScopeId).toBe('acct-b');
    expect(useTeaCompassStore.getState().entries.map((item) => item.id)).toEqual(['b-local']);
  });
});
