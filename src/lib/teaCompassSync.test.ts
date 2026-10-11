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

// Exercise the real worker codec without adding Worker sources to the frontend
// TypeScript project (the Worker has its own typecheck).
const workerCodecPath = '../../worker/src/compassCodec.ts';
const { COMPASS_COLUMNS, decodeCompassWrite } = await import(workerCodecPath);
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
    listMock.mockResolvedValue({ entries: [] });
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

  it('roundtrips private shop and transport fields through the server codec', async () => {
    listMock.mockResolvedValue({ entries: [{ ...entry('sourcing'), shop_name: '惜物堂', transport_mode: 'air', photos: '[]', audio_clips: '[]' }] });
    await hydrateCompassEntries('acct-a');
    expect(useTeaCompassStore.getState().entries[0]).toMatchObject({ shopName: '惜物堂', transportMode: 'air', synced: true });
    useTeaCompassStore.getState().updateEntry('sourcing', { notes: 'changed' });
    syncMock.mockResolvedValue({ success: true });
    await syncCompassEntries('acct-a');
    expect(syncMock.mock.calls[0][0][0]).toMatchObject({ shop_name: '惜物堂', transport_mode: 'air' });
  });

  it('roundtrips structured sourcing fields, route arrays, zero and explicit clears', async () => {
    const route = { id: 'air-quote', mode: 'air' as const, amount: 0, currency: 'HKD', basis: 'kg' as const, basis_quantity: 1, price_kind: 'landed' as const };
    useTeaCompassStore.setState({ entries: [{ ...entry('structured'), ageQuoted: 'About 20 years', grade: 'Special', packSizeGrams: 357,
      packSizeLabel: 'Cake', vendorItemNumber: 'PE1', discountPercent: 0, quoteId: 'vendor-quote', shopName: 'Shop name', transportMode: 'air', routeQuotes: [route] }] });
    syncMock.mockResolvedValue({ syncedIds: ['structured'] });
    listMock.mockImplementation(async () => ({ entries: syncMock.mock.calls.at(-1)![0] }));
    expect(await syncCompassEntries('acct-a')).toBe(1);
    const payload = syncMock.mock.calls[0][0][0];
    expect(payload).toMatchObject({ age_quoted: 'About 20 years', grade: 'Special', pack_size_grams: 357, pack_size_label: 'Cake', vendor_item_number: 'PE1', discount_percent: 0, quote_id: 'vendor-quote' });
    expect(payload.route_quotes).toEqual([route]);
    expect(useTeaCompassStore.getState().entries[0]).toMatchObject({ routeQuotes: [route], discountPercent: 0, quoteId: 'vendor-quote' });
    useTeaCompassStore.getState().updateEntry('structured', { ageQuoted: null, grade: null, packSizeGrams: null, packSizeLabel: null, vendorItemNumber: null, discountPercent: null, quoteId: null, shopName: null, transportMode: null, routeQuotes: [] });
    await syncCompassEntries('acct-a');
    expect(syncMock.mock.calls.at(-1)![0][0]).toMatchObject({ age_quoted: null, grade: null, pack_size_grams: null, pack_size_label: null, vendor_item_number: null, discount_percent: null, quote_id: null, shop_name: null, transport_mode: null, route_quotes: [] });
    expect(decodeCompassWrite(syncMock.mock.calls.at(-1)![0][0], true)).toHaveProperty('values');
  });

  it('syncs an edited hydrated row through strict worker validation while retaining read metadata and local fields', async () => {
    const route = { id: 'zero-route', mode: 'air', amount: 0, currency: 'HKD', basis: 'kg', basis_quantity: 1, price_kind: 'landed' };
    const hydrated = { id: 'PE1', name: 'Original', account_id: 'acct-a', import_item_id: 'receipt-line',
      archived_at: null, deleted_at: null, merged_into_id: null, stock_grams: 0,
      origin_country: 'China', vendor_item_number: 'LKY-PE1', price_amount: 0,
      grade: null, discount_percent: 0, route_quotes: JSON.stringify([route]),
      photos: '[]', audio_clips: '[]', created_at: '2026-10-08T00:00:00Z', updated_at: '2026-10-08T00:00:00Z' };
    listMock.mockResolvedValue({ entries: [hydrated] });
    await hydrateCompassEntries('acct-a');
    expect(useTeaCompassStore.getState().entries[0]).toMatchObject({ import_item_id: 'receipt-line', stock_grams: 0, originCountry: 'China' });
    useTeaCompassStore.getState().updateEntry('PE1', { name: 'Edited', sampleGrams: 0, sampleVerdict: 'like', sampleWouldBuy: false,
      tasteOrder: 1, tastingHistory: [], vendorDetails: { phone: 'local' } });
    syncMock.mockImplementation(async (entries) => {
      for (const payload of entries) expect(decodeCompassWrite(payload, true)).toHaveProperty('values');
      return { syncedIds: entries.map((item: any) => item.id) };
    });
    expect(await syncCompassEntries('acct-a')).toBe(1);
    const payload = syncMock.mock.calls[0][0][0];
    expect(payload).toMatchObject({ id: 'PE1', name: 'Edited', origin_country: 'China', vendor_item_number: 'LKY-PE1',
      price_amount: 0, grade: null, discount_percent: 0, route_quotes: [route] });
    for (const key of ['account_id','import_item_id','archived_at','deleted_at','merged_into_id','stock_grams','sampleGrams',
      'sampleVerdict','sampleWouldBuy','tasteOrder','tastingHistory','vendorDetails','synced']) expect(payload).not.toHaveProperty(key);
    expect(useTeaCompassStore.getState().entries[0]).toMatchObject({ synced: true, import_item_id: 'receipt-line', sampleGrams: 0, sampleWouldBuy: false });
  });

  it('clears a nullable local route value as the strict API empty array without changing nullable scalars', async () => {
    useTeaCompassStore.setState({ entries: [{ ...entry('clear-routes'), routeQuotes: null, grade: null, discountPercent: 0 } as any] });
    syncMock.mockImplementation(async (entries) => {
      expect(decodeCompassWrite(entries[0], true)).toHaveProperty('values');
      return { syncedIds: ['clear-routes'] };
    });
    expect(await syncCompassEntries('acct-a')).toBe(1);
    expect(syncMock.mock.calls[0][0][0]).toMatchObject({ route_quotes: [], grade: null, discount_percent: 0 });
  });

  it('still writes origin_country on older local rows carrying the snake-case field', async () => {
    const oldLocal = Object.assign(entry('legacy-origin'), { origin_country: 'China' });
    useTeaCompassStore.setState({ entries: [oldLocal] });
    syncMock.mockResolvedValue({ syncedIds: ['legacy-origin'] });
    await syncCompassEntries('acct-a');
    expect(syncMock.mock.calls[0][0][0]).toMatchObject({ origin_country: 'China' });
    expect(syncMock.mock.calls[0][0][0]).not.toHaveProperty('originCountry');
  });

  it('keeps every accepted editable column while excluding unknown hydrated extensions', async () => {
    const record = Object.fromEntries(COMPASS_COLUMNS.map(column => [column, null]));
    Object.assign(record, { id: 'all-columns', name: 'All editable columns', photos: '[]', audio_clips: '[]', route_quotes: '[]', tasting: '{}',
      unexpected_future_metadata: 'read only', import_item_id: 'import' });
    listMock.mockResolvedValue({ entries: [record] });
    await hydrateCompassEntries('acct-a');
    useTeaCompassStore.getState().updateEntry('all-columns', { name: 'Edited all columns' });
    syncMock.mockResolvedValue({ syncedIds: ['all-columns'] });
    await syncCompassEntries('acct-a');
    const payload = syncMock.mock.calls[0][0][0];
    expect(Object.keys(payload).sort()).toEqual(['id', ...COMPASS_COLUMNS].sort());
    expect(decodeCompassWrite(payload, true)).toHaveProperty('values');
  });

  it('hydrates route quotes already decoded as arrays without discarding evidence', async () => {
    const route = { id: 'sea-quote', mode: 'sea', amount: 20, currency: 'HKD', basis: 'total', basis_quantity: 1, price_kind: 'tea_only' };
    listMock.mockResolvedValue({ entries: [{ ...entry('array-route'), route_quotes: [route], photos: [], audio_clips: [] }] });
    await hydrateCompassEntries('acct-a');
    expect(useTeaCompassStore.getState().entries[0]).toMatchObject({ routeQuotes: [route], synced: true });
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

  it('keeps an entry unsynced when it was edited while its save was in the air', async () => {
    useTeaCompassStore.setState({ entries: [{ ...entry('typing'), updatedAt: '2026-10-07T01:00:00.000Z' }] });
    syncMock.mockImplementation(async () => {
      // The note typed during the request, before the server answers.
      useTeaCompassStore.setState((state) => ({
        entries: state.entries.map((e) => (e.id === 'typing' ? { ...e, notes: 'typed mid-save', updatedAt: '2026-10-07T01:00:01.000Z' } : e)),
      }));
      return { synced: 1, syncedIds: ['typing'] };
    });

    await syncCompassEntries('acct-a');
    const after = useTeaCompassStore.getState().entries.find((e) => e.id === 'typing')!;
    expect(after.synced).toBe(false);
    expect(after.notes).toBe('typed mid-save');
  });

  it('rehydrates canonical sample links and lifecycle after an acknowledged save', async () => {
    useTeaCompassStore.setState({ entries: [{ ...entry('sampled'), sampleState: 'requested' }] });
    syncMock.mockResolvedValue({ syncedIds: ['sampled'] });
    listMock.mockResolvedValue({ entries: [{ ...entry('sampled'), sample_state: 'received', sample_set_id: 'canonical-vendor-set', photos: '[]', audio_clips: '[]' }] });
    expect(await syncCompassEntries('acct-a')).toBe(1);
    expect(useTeaCompassStore.getState().entries[0]).toMatchObject({ sampleState: 'received', sampleSetId: 'canonical-vendor-set', synced: true });
  });

  it('keeps newer local edits dirty when canonical hydration is in flight', async () => {
    useTeaCompassStore.setState({ entries: [entry('editing')] });
    syncMock.mockResolvedValue({ syncedIds: ['editing'] });
    listMock.mockImplementation(async () => {
      useTeaCompassStore.getState().updateEntry('editing', { notes: 'New note during refresh' });
      return { entries: [{ ...entry('editing'), notes: 'Saved note', photos: '[]', audio_clips: '[]' }] };
    });
    expect(await syncCompassEntries('acct-a')).toBe(1);
    expect(useTeaCompassStore.getState().entries[0]).toMatchObject({ notes: 'New note during refresh', synced: false });
  });

  it('retains acknowledgement when the canonical refresh fails', async () => {
    useTeaCompassStore.setState({ entries: [entry('saved')] });
    syncMock.mockResolvedValue({ syncedIds: ['saved'] });
    listMock.mockRejectedValue(new Error('Read unavailable'));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await syncCompassEntries('acct-a')).toBe(1);
    expect(useTeaCompassStore.getState().entries[0]).toMatchObject({ id: 'saved', synced: true });
    expect(useTeaCompassStore.getState().syncError).toBe(false);
    warning.mockRestore();
  });

  it('ignores a canonical read after leaving and returning to the same account', async () => {
    useTeaCompassStore.setState({ entries: [entry('saved')] });
    syncMock.mockResolvedValue({ syncedIds: ['saved'] });
    listMock.mockImplementation(async () => {
      useTeaCompassStore.getState().switchAccount('acct-b');
      useTeaCompassStore.getState().switchAccount('acct-a');
      return { entries: [{ ...entry('foreign-generation'), photos: '[]', audio_clips: '[]' }] };
    });
    expect(await syncCompassEntries('acct-a')).toBe(1);
    expect(useTeaCompassStore.getState().entries.map(row => row.id)).toEqual(['saved']);
  });

  it('runs one sync at a time', async () => {
    let release!: () => void;
    syncMock.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ synced: 1, syncedIds: ['one'] }); }));
    useTeaCompassStore.setState({ entries: [entry('one')] });
    const first = syncCompassEntries('acct-a');
    const second = syncCompassEntries('acct-a');
    await new Promise((r) => setTimeout(r, 0));
    release();
    await Promise.all([first, second]);
    expect(syncMock).toHaveBeenCalledTimes(1);
  });

  it('marks only acknowledged ids synced and keeps collisions queued', async () => {
    syncMock.mockResolvedValue({
      synced: 1,
      syncedIds: ['accepted'],
      conflicts: ['collision'],
    });
    useTeaCompassStore.setState({ entries: [entry('accepted'), entry('collision')] });

    expect(await syncCompassEntries('acct-a')).toBe(1);
    // Read by id, not position: sync sorts newest first by createdAt, which
    // createEmptyEntry stamps with the current time, so two entries made in
    // different milliseconds swap places. Comparing the list in order failed
    // whenever they did (main's check, 2026-10-10; every run in isolation).
    expect(Object.fromEntries(useTeaCompassStore.getState().entries.map(({ id, synced }) => [id, synced]))).toEqual({
      accepted: true,
      collision: false,
    });
    expect(useTeaCompassStore.getState().syncError).toBe(true);
  });

  it('marks automatic hydration and sync requests as background work', async () => {
    listMock.mockResolvedValue({ entries: [] });

    await hydrateCompassEntries('acct-a');

    expect(listMock).toHaveBeenCalledWith(undefined, { background: true });
    expect(samplesListMock).not.toHaveBeenCalled();

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
    expect(listMock).toHaveBeenCalledTimes(2);
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
