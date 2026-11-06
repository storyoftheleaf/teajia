import { beforeEach, describe, expect, it } from 'vitest';
import { useNotesStore } from './notesStore';
import {
  entryHasDeliberateInput,
  compassPersonKey,
  restoreCompassDraftsForAccount,
  migrateCompassPersistedState,
  mergeCompassPersistedState,
  useTeaCompassStore,
} from './teaCompassStore';
import { useAppStore } from './store';
import { createEmptyEntry, type TeaCompassEntry } from '../components/TeaCompass/types';

beforeEach(() => useAppStore.setState({ activeUserId: 'user-a', activeAccountId: null }));

const deliberateFragments: Array<[string, Partial<TeaCompassEntry>]> = [
  ['cost price', { priceAmount: 480 }],
  ['retail price', { sellPrice: 12 }],
  ['tea type', { type: 'Oolong' }],
  ['origin', { originRegion: 'Lishan' }],
  ['year', { year: 2024 }],
  ['form', { form: 'Loose' }],
  ['classification or decision', { status: 'want' }],
  ['buying quantity', { buyQuantityGrams: 600 }],
  ['teaware quantity', { quantity: 3 }],
  ['teaware material', { material: 'Porcelain' }],
  ['teaware category', { teawareCategory: 'Gaiwan' }],
  ['vendor', { vendorName: 'Lin Tea House' }],
  ['photo', { photos: ['data:image/jpeg;base64,field-photo'] }],
];

describe('Curate deliberate-input contract', () => {
  beforeEach(() => {
    useNotesStore.setState({ notes: [], sessions: [] });
    useTeaCompassStore.setState({
      entries: [],
      pendingEntries: [],
      activeEntryId: null,
      sessionEntryIds: [],
      currentSessionId: null,
      lastCaptureAt: null,
      lastVendorId: null,
      lastVendorName: null,
      lastCurrency: 'NT',
    });
  });

  it.each(deliberateFragments)('keeps a %s fragment by itself', (_label, update) => {
    const id = useTeaCompassStore.getState().startNewCapture(
      'teawareCategory' in update || 'material' in update || update.quantity === 3 ? 'teaware' : 'tea',
    );

    useTeaCompassStore.getState().updateEntry(id, update);
    const pending = useTeaCompassStore.getState().getEntry(id)!;

    expect(pending.touchedFields).toEqual(expect.arrayContaining(Object.keys(update)));
    expect(entryHasDeliberateInput(pending)).toBe(true);

    useTeaCompassStore.getState().commitEntry(id);
    expect(useTeaCompassStore.getState().entries.some((entry) => entry.id === id)).toBe(true);
  });

  it('keeps a thread note fragment by itself', () => {
    const id = useTeaCompassStore.getState().startNewCapture('tea');
    const entry = useTeaCompassStore.getState().getEntry(id)!;
    useNotesStore.getState().addNote({
      accountId: 'acct-bali',
      compassEntryId: id,
      text: 'Vendor said this is the last spring lot.',
      sourceType: 'manual',
      authorId: 'operator',
      authorName: 'Adrian',
      visibility: 'private',
    });

    expect(entryHasDeliberateInput(entry)).toBe(true);
    useTeaCompassStore.getState().commitEntry(id);
    expect(useTeaCompassStore.getState().entries.some((saved) => saved.id === id)).toBe(true);
  });

  it('discards an untouched auto-created shell including inherited defaults', () => {
    useTeaCompassStore.setState({
      lastVendorId: 'vendor-1',
      lastVendorName: 'Inherited Vendor',
      lastCurrency: 'USD',
    });
    const id = useTeaCompassStore.getState().startNewCapture('tea');
    const entry = useTeaCompassStore.getState().getEntry(id)!;

    expect(entry.vendorName).toBe('Inherited Vendor');
    expect(entry.priceCurrency).toBe('USD');
    expect(entry.touchedFields).toEqual([]);
    expect(entryHasDeliberateInput(entry)).toBe(false);

    useTeaCompassStore.getState().commitEntry(id);
    expect(useTeaCompassStore.getState().getEntry(id)).toBeUndefined();
  });

  it('does not treat metadata-only updates as deliberate field input', () => {
    const entry = createEmptyEntry('tea');
    const metadataOnly = { ...entry, touchedFields: ['draftProductId', 'synced', 'updatedAt'] };
    expect(entryHasDeliberateInput(metadataOnly)).toBe(false);
  });

  it('preserves value fallback when sync bookkeeping updates a populated legacy entry', () => {
    const legacy = { ...createEmptyEntry('tea'), id: 'legacy-server-entry', name: 'Legacy Dong Ding' };
    delete legacy.touchedFields;
    useTeaCompassStore.setState({ entries: [legacy] });

    useTeaCompassStore.getState().updateEntry(legacy.id, { synced: true });

    const afterSync = useTeaCompassStore.getState().getEntry(legacy.id)!;
    expect(afterSync.touchedFields).toBeUndefined();
    expect(entryHasDeliberateInput(afterSync)).toBe(true);
  });

  it('recognizes a directly populated constructor even when touch metadata is empty', () => {
    const sampleSetLikeEntry = {
      ...createEmptyEntry('tea'),
      name: 'Directly constructed sample',
      type: 'Oolong' as const,
      isSample: true,
      sampleGrams: 10,
    };

    expect(sampleSetLikeEntry.touchedFields).toEqual([]);
    expect(entryHasDeliberateInput(sampleSetLikeEntry)).toBe(true);
    expect(entryHasDeliberateInput(createEmptyEntry('tea'))).toBe(false);
  });
});

describe('account-scoped Curate draft restoration', () => {
  it('restores only meaningful drafts belonging to the active account', () => {
    const bali = { ...createEmptyEntry('tea'), id: 'bali', draftAccountId: 'acct-bali', touchedFields: ['priceAmount'], priceAmount: 100 };
    const taipei = { ...createEmptyEntry('tea'), id: 'taipei', draftAccountId: 'acct-taipei', touchedFields: ['name'], name: 'Taipei tea' };
    const blank = { ...createEmptyEntry('tea'), id: 'blank', draftAccountId: 'acct-bali', touchedFields: [] };

    expect(restoreCompassDraftsForAccount({
      pendingEntries: [bali, taipei, blank],
      activeEntryId: 'taipei',
      sessionEntryIds: ['bali', 'taipei', 'blank'],
    }, 'acct-bali')).toEqual({
      pendingEntries: [bali],
      activeEntryId: 'bali',
      sessionEntryIds: ['bali'],
    });
  });

  it('restores no account draft into a signed-out or unknown account', () => {
    const draft = { ...createEmptyEntry('tea'), draftAccountId: 'acct-bali', touchedFields: ['name'], name: 'Scoped tea' };
    expect(restoreCompassDraftsForAccount({ pendingEntries: [draft], activeEntryId: draft.id, sessionEntryIds: [draft.id] }, null))
      .toEqual({ pendingEntries: [], activeEntryId: null, sessionEntryIds: [] });
  });

  it('normalizes legacy drafts with nullable required capture fields', () => {
    const malformed = {
      ...createEmptyEntry('tea'),
      id: 'legacy-nullable',
      draftAccountId: 'acct-bali',
      touchedFields: ['priceAmount'],
      priceAmount: 100,
      name: null,
      notes: null,
      photos: null,
      audioClips: null,
    } as unknown as ReturnType<typeof createEmptyEntry>;

    const restored = restoreCompassDraftsForAccount({
      pendingEntries: [malformed],
      activeEntryId: malformed.id,
      sessionEntryIds: [malformed.id],
    }, 'acct-bali');

    expect(restored.pendingEntries[0]).toMatchObject({
      name: '', notes: '', photos: [], audioClips: [],
    });
  });

  it('isolates and restores pending, active, and session drafts across A to B to A', () => {
    useTeaCompassStore.setState({
      pendingEntries: [], activeEntryId: null, sessionEntryIds: [],
      accountScopeId: null, userScopeId: null, draftAccountScopeId: null, draftsByAccount: {},
    });
    useTeaCompassStore.getState().switchAccount('acct-a');
    const a = useTeaCompassStore.getState().startNewCapture('tea');
    useTeaCompassStore.getState().updateEntry(a, { priceAmount: 120 });

    useTeaCompassStore.getState().switchDraftAccount('acct-b');
    expect(useTeaCompassStore.getState().pendingEntries).toEqual([]);
    expect(useTeaCompassStore.getState().activeEntryId).toBeNull();
    expect(useTeaCompassStore.getState().sessionEntryIds).toEqual([]);

    const b = useTeaCompassStore.getState().startNewCapture('teaware');
    useTeaCompassStore.getState().updateEntry(b, { material: 'Porcelain' });
    expect(useTeaCompassStore.getState().pendingEntries.map((entry) => entry.id)).toEqual([b]);

    useTeaCompassStore.getState().switchDraftAccount('acct-a');
    expect(useTeaCompassStore.getState().pendingEntries.map((entry) => entry.id)).toEqual([a]);
    expect(useTeaCompassStore.getState().activeEntryId).toBe(a);
    expect(useTeaCompassStore.getState().sessionEntryIds).toEqual([a]);

    useTeaCompassStore.getState().switchDraftAccount('acct-b');
    expect(useTeaCompassStore.getState().pendingEntries.map((entry) => entry.id)).toEqual([b]);
    expect(useTeaCompassStore.getState().activeEntryId).toBe(b);
    expect(useTeaCompassStore.getState().sessionEntryIds).toEqual([b]);
  });
});

describe('account-scoped committed Curate entries', () => {
  beforeEach(() => {
    useTeaCompassStore.setState({
      entries: [],
      entriesByAccount: {},
      accountScopeId: null,
      userScopeId: null,
      pendingEntries: [],
      activeEntryId: null,
      sessionEntryIds: [],
      draftAccountScopeId: null,
      draftsByAccount: {},
      deletedIds: [],
      pendingPromotions: [],
    });
  });

  it('exposes only committed entries for the selected account across A to B to A', () => {
    const a = { ...createEmptyEntry('tea'), id: 'entry-a', name: 'Account A tea' };
    const b = { ...createEmptyEntry('tea'), id: 'entry-b', name: 'Account B tea' };

    useTeaCompassStore.getState().switchAccount('acct-a');
    useTeaCompassStore.getState().addEntry(a);
    useTeaCompassStore.getState().switchAccount('acct-b');
    expect(useTeaCompassStore.getState().entries).toEqual([]);

    useTeaCompassStore.getState().addEntry(b);
    expect(useTeaCompassStore.getState().entries.map((item) => item.id)).toEqual(['entry-b']);

    useTeaCompassStore.getState().switchAccount('acct-a');
    expect(useTeaCompassStore.getState().entries.map((item) => item.id)).toEqual(['entry-a']);
    useTeaCompassStore.getState().switchAccount('acct-b');
    expect(useTeaCompassStore.getState().entries.map((item) => item.id)).toEqual(['entry-b']);
  });

  it('exposes no committed entries for a missing or signed-out account', () => {
    useTeaCompassStore.getState().switchAccount('acct-a');
    useTeaCompassStore.getState().addEntry({ ...createEmptyEntry('tea'), id: 'private-a', name: 'Private' });

    useTeaCompassStore.getState().switchAccount(null);

    expect(useTeaCompassStore.getState().entries).toEqual([]);
    expect(useTeaCompassStore.getState().pendingEntries).toEqual([]);
  });

  it('quarantines legacy unbucketed entries without guessing an author', () => {
    const legacy = { ...createEmptyEntry('tea'), id: 'legacy', name: 'Legacy tea' };
    useTeaCompassStore.setState({ entries: [legacy], entriesByAccount: {}, accountScopeId: null });

    useTeaCompassStore.getState().switchAccount('acct-first');
    expect(useTeaCompassStore.getState().entries).toEqual([]);

    useTeaCompassStore.getState().switchAccount('acct-second');
    expect(useTeaCompassStore.getState().entries).toEqual([]);
    expect(useTeaCompassStore.getState().entriesByAccount['__legacy_unscoped__']?.map((item) => item.id)).toEqual(['legacy']);
    expect(useTeaCompassStore.getState().entriesByAccount['acct-second']).toBeUndefined();
  });

  it('restores entries, tombstones, and promotions across A to B to A', () => {
    const a = { ...createEmptyEntry('tea'), id: 'entry-a', name: 'A' };
    const b = { ...createEmptyEntry('tea'), id: 'entry-b', name: 'B' };
    useTeaCompassStore.getState().switchAccount('acct-a');
    useTeaCompassStore.setState({ entries: [a], deletedIds: ['deleted-a'], pendingPromotions: ['promote-a'] });

    useTeaCompassStore.getState().switchAccount('acct-b');
    useTeaCompassStore.setState({ entries: [b], deletedIds: ['deleted-b'], pendingPromotions: ['promote-b'] });

    useTeaCompassStore.getState().switchAccount('acct-a');
    expect(useTeaCompassStore.getState()).toMatchObject({
      entries: [{ id: 'entry-a' }], deletedIds: ['deleted-a'], pendingPromotions: ['promote-a'],
    });
    useTeaCompassStore.getState().switchAccount('acct-b');
    expect(useTeaCompassStore.getState()).toMatchObject({
      entries: [{ id: 'entry-b' }], deletedIds: ['deleted-b'], pendingPromotions: ['promote-b'],
    });
  });

  it('migrates v7 committed entries, tombstones, and promotions into the active account only', () => {
    useAppStore.setState({ activeAccountId: 'acct-active' });
    const legacy = { ...createEmptyEntry('tea'), id: 'legacy-v7', name: 'Legacy' };

    const migrated = migrateCompassPersistedState({
      entries: [legacy], deletedIds: ['deleted-v7'], pendingPromotions: ['promote-v7'],
      draftAccountScopeId: 'acct-old-draft',
    }, 7) as ReturnType<typeof useTeaCompassStore.getState>;

    expect(migrated.entriesByAccount).toEqual({ 'acct-old-draft': [legacy] });
    expect(migrated.deletedIdsByAccount).toEqual({ 'acct-old-draft': ['deleted-v7'] });
    expect(migrated.pendingPromotionsByAccount).toEqual({ 'acct-old-draft': ['promote-v7'] });
    expect(migrated.entriesByAccount['acct-active']).toBeUndefined();
  });

  it('keeps v8 account-only facade, bucket, and unfinished capture for restricted recovery across reloads', () => {
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-b' });
    const bucket = { ...createEmptyEntry('tea'), id: 'old-bucket', name: 'Older local save', synced: false };
    const facade = { ...createEmptyEntry('tea'), id: 'old-facade', name: 'Newer local save', synced: false };
    const draft = { ...createEmptyEntry('tea'), id: 'old-draft', draftAccountId: 'acct-a', name: 'Unfinished' };
    const old = {
      accountScopeId: 'acct-a', draftAccountScopeId: 'acct-a',
      entries: [facade], entriesByAccount: { 'acct-a': [bucket] },
      deletedIds: ['old-delete'], pendingPromotions: ['old-promotion'],
      pendingEntries: [draft], activeEntryId: 'old-draft', sessionEntryIds: ['old-draft'],
    };
    const merged = mergeCompassPersistedState(old, useTeaCompassStore.getState());
    expect(merged.entries).toEqual([]);
    expect(merged.pendingEntries).toEqual([]);
    expect(merged.deletedIds).toEqual([]);
    expect(merged.entriesByAccount['acct-a']).toEqual([bucket]);
    expect(merged.entriesByAccount['__legacy_facade__:acct-a']).toEqual([facade]);
    expect(merged.draftsByAccount['acct-a'].pendingEntries).toEqual([draft]);

    const persisted = JSON.parse(JSON.stringify(merged)) as typeof old;
    const reloaded = mergeCompassPersistedState(persisted, useTeaCompassStore.getState());
    expect(reloaded.entries).toEqual([]);
    expect(reloaded.pendingEntries).toEqual([]);
    expect(reloaded.entriesByAccount['acct-a']).toEqual([bucket]);
    expect(reloaded.entriesByAccount['__legacy_facade__:acct-a']).toEqual([facade]);
    expect(reloaded.draftsByAccount['acct-a'].pendingEntries).toEqual([draft]);
    expect(reloaded.entriesByAccount[compassPersonKey('acct-a', 'user-b')!]).toBeUndefined();
  });

  it('reloads only the author bucket after same-account identity changes', () => {
    useTeaCompassStore.setState({
      accountScopeId: null, userScopeId: null, draftAccountScopeId: null,
      entries: [], pendingEntries: [], entriesByAccount: {}, draftsByAccount: {},
    });
    useTeaCompassStore.getState().switchAccount('acct-a', 'user-a');
    const id = useTeaCompassStore.getState().startNewCapture('tea');
    useTeaCompassStore.getState().updateEntry(id, { name: 'A private draft' });
    useTeaCompassStore.getState().addEntry({ ...createEmptyEntry('tea'), id: 'a-offline', name: 'A offline', synced: false });
    const persisted = JSON.parse(JSON.stringify(useTeaCompassStore.getState()));
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-b' });
    const b = mergeCompassPersistedState(persisted, useTeaCompassStore.getState());
    expect(b.entries).toEqual([]);
    expect(b.pendingEntries).toEqual([]);
    useAppStore.setState({ activeAccountId: 'acct-a', activeUserId: 'user-a' });
    const a = mergeCompassPersistedState(persisted, useTeaCompassStore.getState());
    expect(a.entries.map(e => e.id)).toEqual(['a-offline']);
    expect(a.pendingEntries.map(e => e.id)).toEqual([id]);
  });

  it('keeps capture vendor, run, and encounter defaults with A rather than B', () => {
    useTeaCompassStore.setState({
      accountScopeId: null, userScopeId: null, draftAccountScopeId: null,
      entries: [], pendingEntries: [], entriesByAccount: {}, draftsByAccount: {},
      workspaceByPerson: {}, encounterContextByAccount: {},
    });
    useTeaCompassStore.getState().switchAccount('acct-a', 'user-a');
    const a = useTeaCompassStore.getState().startNewCapture('tea');
    useTeaCompassStore.getState().updateEntry(a, { name: 'A tea' });
    useTeaCompassStore.getState().setLastVendor('vendor-a', 'A supplier');
    useTeaCompassStore.getState().setEncounterContext(a, 'journey-a', 'visit-a');
    const aRun = useTeaCompassStore.getState().currentSessionId;

    useTeaCompassStore.getState().switchAccount('acct-a', 'user-b');
    expect(useTeaCompassStore.getState()).toMatchObject({
      pendingEntries: [], lastVendorId: null, lastVendorName: null,
      currentSessionId: null, lastCaptureAt: null,
    });
    const b = useTeaCompassStore.getState().startNewCapture('tea');
    expect(useTeaCompassStore.getState().getEntry(b)).toMatchObject({ vendorId: undefined, journeyId: null, visitId: null });

    useTeaCompassStore.getState().switchAccount('acct-a', 'user-a');
    expect(useTeaCompassStore.getState()).toMatchObject({
      lastVendorId: 'vendor-a', lastVendorName: 'A supplier', currentSessionId: aRun,
    });
    expect(useTeaCompassStore.getState().pendingEntries.map(e => e.id)).toEqual([a]);
  });

  it('does not restore account A facade data when reloading under account B', () => {
    useAppStore.setState({ activeAccountId: 'acct-b' });
    const a = { ...createEmptyEntry('tea'), id: 'persisted-a', name: 'Account A' };
    const current = useTeaCompassStore.getState();

    const merged = mergeCompassPersistedState({
      accountScopeId: 'acct-a',
      entries: [a], deletedIds: ['deleted-a'], pendingPromotions: ['promote-a'],
      entriesByAccount: { 'acct-a': [a] },
      deletedIdsByAccount: { 'acct-a': ['deleted-a'] },
      pendingPromotionsByAccount: { 'acct-a': ['promote-a'] },
    }, current);

    expect(merged.accountScopeId).toBe('acct-b');
    expect(merged.entries).toEqual([]);
    expect(merged.deletedIds).toEqual([]);
    expect(merged.pendingPromotions).toEqual([]);
    expect(merged.entriesByAccount['acct-b']).toBeUndefined();
    expect(merged.entriesByAccount['acct-a']?.map((item) => item.id)).toEqual(['persisted-a']);
  });
});

describe('saving an encounter before acquisition', () => {
  it('makes a partial capture eligible for sync without ending the active capture', () => {
    useTeaCompassStore.setState({ pendingEntries: [], entries: [], activeEntryId: null, sessionEntryIds: [] });
    const store = useTeaCompassStore.getState();
    const id = store.startNewCapture();
    store.updateEntry(id, { name: 'Purchase quote' });
    store.retainEntry(id);
    expect(useTeaCompassStore.getState().entries.find(entry => entry.id === id)?.name).toBe('Purchase quote');
    expect(useTeaCompassStore.getState().activeEntryId).toBe(id);
    expect(useTeaCompassStore.getState().sessionEntryIds).toContain(id);
  });
});
