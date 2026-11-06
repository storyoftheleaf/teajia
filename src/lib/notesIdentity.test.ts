import { beforeEach, describe, expect, it, vi } from 'vitest';

const { syncMock, getAllMock, sessionSyncMock, token } = vi.hoisted(() => ({
  syncMock: vi.fn(),
  getAllMock: vi.fn(),
  sessionSyncMock: vi.fn(),
  token: { account: 'acct-a', user: 'user-a' },
}));

vi.mock('./api', () => ({
  hasToken: () => true,
  isTokenScopedToAccount: (account: string, user: string) => token.account === account && token.user === user,
  api: { notes: { sync: syncMock, getAll: getAllMock, syncSessions: sessionSyncMock } },
}));

import { useAppStore } from './store';
import { mergeNotesPersistedState, notesPersonKey, useNotesStore } from './notesStore';
import { hydrateNotes, syncNotes } from './notesSync';

function addDraftNote(id: string, authorId: string) {
  return useNotesStore.getState().addNote({
    accountId: 'acct-a', compassEntryId: id, text: `${authorId} draft note`,
    sourceType: 'manual', authorId, authorName: authorId, visibility: 'private',
  });
}

describe('Compass attached note identity', () => {
  beforeEach(() => {
    syncMock.mockReset();
    getAllMock.mockReset();
    sessionSyncMock.mockReset();
    token.account = 'acct-a'; token.user = 'user-a';
    useNotesStore.setState({
      notes: [], sessions: [], notesByPerson: {}, sessionsByPerson: {},
      personScopeKey: null, scopeRevision: 0,
    });
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-a' });
    useNotesStore.getState().switchPerson('acct-a', 'user-a');
  });

  it('hides A offline note from B in the same account and never uploads it as B', async () => {
    const a = addDraftNote('a-draft', 'user-a');
    useAppStore.setState({ activeAccountId: null, activeUserId: null });
    token.user = 'user-b';
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-b' });
    expect(useNotesStore.getState().notes).toEqual([]);
    await syncNotes();
    expect(syncMock).not.toHaveBeenCalled();
    expect(useNotesStore.getState().notesByPerson[notesPersonKey('acct-a', 'user-a')!]).toContainEqual(a);
    token.user = 'user-a';
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-a' });
    expect(useNotesStore.getState().notes.map(n => n.id)).toEqual([a.id]);
  });

  it('shows shared server notes to B and sends B authored notes', async () => {
    token.user = 'user-b';
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-b' });
    getAllMock.mockResolvedValue({ notes: [{
      id: 'shared', account_id: 'acct-a', compass_entry_id: 'saved-tea', text: 'Team note',
      source_type: 'manual', author_id: 'user-a', author_name: 'A', visibility: 'private', created_at: '2026-11-01',
    }] });
    await hydrateNotes();
    expect(useNotesStore.getState().getNotesForCompassEntry('saved-tea').map(n => n.id)).toEqual(['shared']);
    const b = addDraftNote('saved-tea', 'user-b');
    syncMock.mockResolvedValue({});
    await syncNotes();
    expect(syncMock.mock.calls[0][0].map((n: { id: string }) => n.id)).toEqual([b.id]);
    expect(syncMock.mock.calls[0][0][0]).toMatchObject({ author_id: 'user-b' });
  });

  it('keeps old unowned notes for restricted recovery without assigning B', async () => {
    useAppStore.setState({ activeAccountId: null, activeUserId: null });
    const old = addDraftNote('legacy', 'acct-a');
    token.user = 'user-b';
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-b' });
    expect(useNotesStore.getState().notes).toEqual([]);
    expect(useNotesStore.getState().notesByPerson.__legacy_unscoped__).toContainEqual(old);
    await syncNotes();
    expect(syncMock).not.toHaveBeenCalled();
  });

  it('retains legacy note facade and bucket through rehydration without exposing either to B', () => {
    token.user = 'user-b';
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-b' });
    const old = { ...addDraftNote('legacy', 'acct-a'), id: 'legacy-facade' };
    const older = { ...old, id: 'legacy-bucket' };
    const persisted = { notes: [old], notesByPerson: { __legacy_unscoped__: [older] } };
    const merged = mergeNotesPersistedState(persisted, useNotesStore.getState());
    expect(merged.notes).toEqual([]);
    expect(merged.notesByPerson.__legacy_unscoped__).toEqual([older]);
    expect(merged.notesByPerson['__facade_copy__:__legacy_unscoped__']).toEqual([old]);
    const reloaded = mergeNotesPersistedState(JSON.parse(JSON.stringify(merged)), useNotesStore.getState());
    expect(reloaded.notes).toEqual([]);
    expect(reloaded.notesByPerson.__legacy_unscoped__).toEqual([older]);
    expect(reloaded.notesByPerson['__facade_copy__:__legacy_unscoped__']).toEqual([old]);
  });

  it('ignores A late acknowledgement and late hydration after B takes the same account', async () => {
    const a = addDraftNote('a-draft', 'user-a');
    let resolveSync!: () => void;
    syncMock.mockReturnValue(new Promise<void>(resolve => { resolveSync = resolve; }));
    const pending = syncNotes();
    await vi.waitFor(() => expect(syncMock).toHaveBeenCalledTimes(1));
    token.user = 'user-b';
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-b' });
    resolveSync();
    await pending;
    token.user = 'user-a';
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-a' });
    expect(useNotesStore.getState().notes.find(n => n.id === a.id)?.synced).toBe(false);

    let resolveHydrate!: (value: { notes: unknown[] }) => void;
    getAllMock.mockReturnValue(new Promise(resolve => { resolveHydrate = resolve; }));
    const reading = hydrateNotes();
    token.user = 'user-b';
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-b' });
    resolveHydrate({ notes: [{ id: 'a-only-server' }] });
    await reading;
    expect(useNotesStore.getState().notes).toEqual([]);
  });
});
