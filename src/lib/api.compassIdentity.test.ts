import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, clearToken, setToken } from './api';
import { useAppStore } from './store';
import { compassPersonKey, useTeaCompassStore } from './teaCompassStore';
import { createEmptyEntry } from '../components/TeaCompass/types';

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; }, clear: () => values.clear(),
    getItem: key => values.get(key) ?? null, key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); },
  };
}

function tokenFor(userId: string, suffix = 'one') {
  return `header.${btoa(JSON.stringify({ sub: userId, active_account_id: 'acct-a' }))}.${suffix}`;
}

const scope = { expectedAuth: { accountId: 'acct-a', userId: 'user-a' }, background: true };

describe('private outbox transport identity', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage());
    vi.stubGlobal('sessionStorage', storage());
    vi.stubGlobal('window', { dispatchEvent: vi.fn(), location: { origin: 'https://test' } });
    vi.stubGlobal('navigator', { onLine: true });
    setToken(tokenFor('user-a'));
  });
  afterEach(() => { clearToken(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('does not refresh or retry A Compass body after B signs into the same account', async () => {
    let finishFirst!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValueOnce(new Promise(resolve => { finishFirst = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const pending = api.compass.sync([{ id: 'a-offline' }], scope);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    setToken(tokenFor('user-b'));
    finishFirst(new Response(JSON.stringify({ error: 'expired' }), { status: 401 }));
    await expect(pending).rejects.toThrow('signed-in person changed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops a Notes timeout retry when B takes the device', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementationOnce(() => Promise.reject(new TypeError('offline')));
    vi.stubGlobal('fetch', fetchMock);
    const pending = api.notes.sync([{ id: 'a-note' }], scope).catch(error => error as Error);
    await Promise.resolve();
    setToken(tokenFor('user-b'));
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toMatchObject({ message: expect.stringContaining('signed-in person changed') });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not clear B when A refresh is rejected after the person switches', async () => {
    let finishRefresh!: (response: Response) => void;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'expired' }), { status: 401 }))
      .mockReturnValueOnce(new Promise(resolve => { finishRefresh = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const pending = api.compass.sync([{ id: 'a-offline' }], scope);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const bToken = tokenFor('user-b');
    setToken(bToken);
    finishRefresh(new Response(JSON.stringify({ error: 'expired' }), { status: 401 }));
    await expect(pending).rejects.toThrow();
    expect(localStorage.getItem('teajia_token')).toBe(bToken);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries the same Compass body after A refreshes their own token', async () => {
    const renewed = tokenFor('user-a', 'renewed');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'expired' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: renewed }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ syncedIds: ['a-offline'] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.compass.sync([{ id: 'a-offline' }], scope)).resolves.toEqual({ syncedIds: ['a-offline'] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((fetchMock.mock.calls[2][1] as RequestInit).body).toBe(JSON.stringify({ entries: [{ id: 'a-offline' }] }));
    expect(new Headers((fetchMock.mock.calls[2][1] as RequestInit).headers).get('Authorization')).toBe(`Bearer ${renewed}`);
  });

  it('ignores A late sliding token and keeps B local drafts active', async () => {
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-a' });
    useTeaCompassStore.getState().switchAccount('acct-a', 'user-a');
    useTeaCompassStore.getState().startNewCapture('tea');
    const aDraftId = useTeaCompassStore.getState().activeEntryId;
    useTeaCompassStore.getState().updateEntry(aDraftId!, { name: 'A private draft' });
    expect(useTeaCompassStore.getState().pendingEntries.map(entry => entry.id)).toContain(aDraftId);
    let finishMe!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValueOnce(new Promise(resolve => { finishMe = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const pending = api.auth.me();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    clearToken();
    useAppStore.getState().clearAccountState();
    expect(useTeaCompassStore.getState().draftsByAccount[compassPersonKey('acct-a', 'user-a')!].pendingEntries.map(entry => entry.id)).toContain(aDraftId);
    const bToken = tokenFor('user-b');
    setToken(bToken);
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-b' });
    expect(useTeaCompassStore.getState().activeEntryId).toBeNull();
    finishMe(new Response(JSON.stringify({ id: 'user-a', refreshed_token: tokenFor('user-a', 'slid') }), { status: 200 }));
    await pending;
    expect(localStorage.getItem('teajia_token')).toBe(bToken);
    expect(useAppStore.getState().activeUserId).toBe('user-b');
    expect(useTeaCompassStore.getState().activeEntryId).toBeNull();
    expect(useTeaCompassStore.getState().draftsByAccount[compassPersonKey('acct-a', 'user-a')!].pendingEntries.map(entry => entry.id)).toContain(aDraftId);
  });

  it('adopts a sliding token while the initiating person is still signed in', async () => {
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-a' });
    const slid = tokenFor('user-a', 'slid');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'user-a', refreshed_token: slid }), { status: 200 })));
    await api.auth.me();
    expect(localStorage.getItem('teajia_token')).toBe(slid);
    expect(useAppStore.getState().activeUserId).toBe('user-a');
  });

  it('stops immediate A delete retry after B signs in and preserves A tombstone', async () => {
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-a' });
    useTeaCompassStore.getState().switchAccount('acct-a', 'user-a');
    useTeaCompassStore.setState({ entries: [{ ...createEmptyEntry('tea'), id: 'a-saved', synced: true }], deletedIds: [] });
    let finishDelete!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValueOnce(new Promise(resolve => { finishDelete = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    useTeaCompassStore.getState().removeEntry('a-saved');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    setToken(tokenFor('user-b'));
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-b' });
    finishDelete(new Response(JSON.stringify({ error: 'expired' }), { status: 401 }));
    await vi.waitFor(() => expect(useTeaCompassStore.getState().deletedIdsByAccount[compassPersonKey('acct-a', 'user-a')!]).toContain('a-saved'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useTeaCompassStore.getState().deletedIds).toEqual([]);
  });

  it('stops immediate A delete timeout retry after B takes the device', async () => {
    vi.useFakeTimers();
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-a' });
    useTeaCompassStore.getState().switchAccount('acct-a', 'user-a');
    useTeaCompassStore.setState({ entries: [{ ...createEmptyEntry('tea'), id: 'a-timeout-delete', synced: true }], deletedIds: [] });
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('offline'));
    vi.stubGlobal('fetch', fetchMock);
    useTeaCompassStore.getState().removeEntry('a-timeout-delete');
    await Promise.resolve();
    setToken(tokenFor('user-b'));
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-b' });
    await vi.runAllTimersAsync();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useTeaCompassStore.getState().deletedIdsByAccount[compassPersonKey('acct-a', 'user-a')!]).toContain('a-timeout-delete');
  });

  it('clears only A person tombstone when A immediate delete succeeds after switching to B', async () => {
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-a' });
    useTeaCompassStore.getState().switchAccount('acct-a', 'user-a');
    useTeaCompassStore.setState({ entries: [{ ...createEmptyEntry('tea'), id: 'a-saved', synced: true }], deletedIds: [] });
    let finishDelete!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(new Promise(resolve => { finishDelete = resolve; })));
    useTeaCompassStore.getState().removeEntry('a-saved');
    setToken(tokenFor('user-b'));
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-b' });
    useTeaCompassStore.setState({ deletedIds: ['b-only'] });
    finishDelete(new Response(JSON.stringify({ success: true }), { status: 200 }));
    await vi.waitFor(() => expect(useTeaCompassStore.getState().deletedIdsByAccount[compassPersonKey('acct-a', 'user-a')!]).not.toContain('a-saved'));
    expect(useTeaCompassStore.getState().deletedIds).toEqual(['b-only']);
  });
});
