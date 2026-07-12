import { beforeEach, describe, expect, it } from 'vitest';
import { useNotesStore } from './notesStore';
import {
  entryHasDeliberateInput,
  restoreCompassDraftsForAccount,
  useTeaCompassStore,
} from './teaCompassStore';
import { createEmptyEntry, type TeaCompassEntry } from '../components/TeaCompass/types';

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
      draftAccountScopeId: 'acct-a', draftsByAccount: {},
    });
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
