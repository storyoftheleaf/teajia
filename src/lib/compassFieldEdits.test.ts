import { beforeEach, describe, expect, it, vi } from 'vitest';

const saved = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => saved.get(key) ?? null,
  setItem: (key: string, value: string) => saved.set(key, value),
  removeItem: (key: string) => saved.delete(key),
  key: (index: number) => [...saved.keys()][index] ?? null,
  get length() { return saved.size; },
});
vi.stubGlobal('window', { localStorage: globalThis.localStorage });

const { syncMock, listMock } = vi.hoisted(() => ({ syncMock: vi.fn(), listMock: vi.fn() }));
vi.mock('./api', () => ({
  hasToken: () => true,
  isTokenScopedToAccount: () => true,
  isTransientApiError: () => true,
  api: { compass: { sync: syncMock, remove: vi.fn(), promote: vi.fn(), list: listMock } },
}));

const { createEmptyEntry } = await import('../components/TeaCompass/types');
const { useTeaCompassStore } = await import('./teaCompassStore');
const { useAppStore } = await import('./store');
const { syncCompassEntries } = await import('./teaCompassSync');

/** A tea this device loaded from the server and has not touched since. */
function inStep(id: string) {
  return {
    ...createEmptyEntry(), id, name: 'Server name', notes: 'server note', priceAmount: 100, priceCurrency: 'Yuan' as const,
    synced: true, syncedGivenName: null, touchedFields: undefined,
  };
}
const lastChanges = () => syncMock.mock.calls.at(-1)?.[2];

describe('a device records which fields it changed until the server has them', () => {
  beforeEach(() => {
    saved.clear();
    useAppStore.setState({ activeUserId: 'user-a', activeAccountId: 'acct-a' });
    syncMock.mockReset();
    listMock.mockReset();
    // The read-back after a save is not what is under test here.
    listMock.mockRejectedValue(new Error('read-back not under test'));
    useTeaCompassStore.setState({
      entries: [inStep('tea')], entriesByAccount: {}, accountScopeId: 'acct-a', userScopeId: 'user-a',
      deletedIds: [], pendingPromotions: [], syncError: false,
    });
  });

  it('several edits before a sync send each changed field once, with what it held before the first edit', async () => {
    const store = useTeaCompassStore.getState();
    store.updateEntry('tea', { notes: 'first try' });
    store.updateEntry('tea', { notes: 'second try', priceAmount: 0 });
    store.updateEntry('tea', { season: 'Spring' });
    // A value set to what it already was is not an edit.
    store.updateEntry('tea', { name: 'Server name' });
    syncMock.mockResolvedValue({ syncedIds: ['tea'] });
    await syncCompassEntries('acct-a');

    const sent = syncMock.mock.calls[0][0][0];
    expect(sent).toMatchObject({ id: 'tea', notes: 'second try', price_amount: 0, name: 'Server name' });
    const hint = lastChanges().tea;
    expect(hint.fields.sort()).toEqual(['notes', 'price_amount', 'season']);
    expect(hint.base).toEqual({ notes: 'server note', price_amount: 100, season: null });
    expect(Object.keys(hint.edited_at).sort()).toEqual(['notes', 'price_amount', 'season']);
    expect(useTeaCompassStore.getState().entries[0]).toMatchObject({ synced: true, unsyncedEdits: undefined });
  });

  it('a product link set on this device is sent as an edit, so the server can rule on it', async () => {
    useTeaCompassStore.getState().updateEntry('tea', { draftProductId: 'product', synced: false });
    syncMock.mockResolvedValue({ syncedIds: ['tea'] });
    await syncCompassEntries('acct-a');
    expect(lastChanges().tea.fields).toEqual(['draft_product_id']);
    expect(lastChanges().tea.base).toEqual({ draft_product_id: null });
  });

  it('a failed sync keeps every edit, and the retry sends the same base', async () => {
    const store = useTeaCompassStore.getState();
    store.updateEntry('tea', { notes: 'offline note' });
    syncMock.mockRejectedValueOnce(new Error('offline'));
    await syncCompassEntries('acct-a');
    expect(useTeaCompassStore.getState().syncError).toBe(true);
    expect(useTeaCompassStore.getState().entries[0].synced).toBe(false);

    store.updateEntry('tea', { notes: 'offline note, longer' });
    syncMock.mockResolvedValueOnce({ syncedIds: ['tea'] });
    await syncCompassEntries('acct-a');
    expect(lastChanges().tea.base).toEqual({ notes: 'server note' });
    expect(syncMock.mock.calls.at(-1)![0][0].notes).toBe('offline note, longer');
    expect(useTeaCompassStore.getState().entries[0].synced).toBe(true);
  });

  it('an edit typed while the save is in the air goes out next time against what the server now has', async () => {
    const store = useTeaCompassStore.getState();
    store.updateEntry('tea', { notes: 'sent note' });
    let finish!: (value: unknown) => void;
    syncMock.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const pending = syncCompassEntries('acct-a');
    await vi.waitFor(() => expect(syncMock).toHaveBeenCalledTimes(1));
    store.updateEntry('tea', { season: 'Fall' });
    finish({ syncedIds: ['tea'] });
    await pending;

    const entry = useTeaCompassStore.getState().entries[0];
    expect(entry.synced).toBe(false);
    expect(Object.keys(entry.unsyncedEdits ?? {})).toEqual(['season']);
    syncMock.mockResolvedValueOnce({ syncedIds: ['tea'] });
    await syncCompassEntries('acct-a');
    expect(lastChanges().tea).toMatchObject({ fields: ['season'], base: { season: null } });
  });

  it('unsynced edits survive a reload and are sent after it', async () => {
    useTeaCompassStore.getState().updateEntry('tea', { notes: 'typed before the reload' });
    const beforeReload = saved.get('teajia-compass')!;
    expect(beforeReload).toContain('unsyncedEdits');

    // A reload: the page's memory is gone, the browser's storage is not.
    useTeaCompassStore.setState({ entries: [], entriesByAccount: {} });
    saved.set('teajia-compass', beforeReload);
    await useTeaCompassStore.persist.rehydrate();
    const restored = useTeaCompassStore.getState().entries.find(entry => entry.id === 'tea');
    expect(restored?.unsyncedEdits?.notes?.base).toBe('server note');

    syncMock.mockResolvedValueOnce({ syncedIds: ['tea'] });
    await syncCompassEntries('acct-a');
    expect(lastChanges().tea).toMatchObject({ fields: ['notes'], base: { notes: 'server note' } });
  });

  it('a tea with unsent changes nobody recorded is still sent whole with no hint', async () => {
    useTeaCompassStore.setState({ entries: [{ ...inStep('legacy'), synced: false }] });
    useTeaCompassStore.getState().updateEntry('legacy', { notes: 'edited by the new bundle' });
    syncMock.mockResolvedValueOnce({ syncedIds: ['legacy'] });
    await syncCompassEntries('acct-a');
    expect(syncMock.mock.calls[0]).toHaveLength(2);
    expect(syncMock.mock.calls[0][0][0]).toMatchObject({ id: 'legacy', notes: 'edited by the new bundle', name: 'Server name' });
  });
});
