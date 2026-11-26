import { describe, expect, it } from 'vitest';
import type { CustomerTasting } from '../types';
import { journalEntriesForDeepLink } from '../components/tasting/TastingJournal';
import { journalTastingForDeepLink, readJournalDeepLink } from './JournalPage';
import type { CellarItem } from '../lib/teaChestTypes';
import { keptSetupTastingHref } from '../lib/keptSetupTasting';
import { fromApiRow } from '../lib/tastingJournalRead';

const entry = (id: string, productId: string): CustomerTasting => ({
  id,
  productId,
  productName: productId,
  productType: 'Oolong',
  note: { tasting: {}, updatedAt: '2026-08-10T00:00:00Z' },
  tastings: [{ id: `${id}-sitting`, tasting: {}, createdAt: '2026-08-10T00:00:00Z' }],
  createdAt: '2026-08-10T00:00:00Z',
});

describe('inventory to personal journal deep links', () => {
  it('reads both the tea and exact entry from the address', () => {
    expect(readJournalDeepLink('?tea=tea-1&entry=journal-2')).toEqual({
      productId: 'tea-1',
      entryId: 'journal-2',
    });
  });

  it('uses the exact entry when it belongs to the selected tea', () => {
    const entries = [entry('journal-1', 'tea-1'), entry('journal-2', 'tea-1'), entry('journal-3', 'tea-2')];
    expect(journalEntriesForDeepLink(entries, 'tea-1', 'journal-2').map(item => item.id)).toEqual(['journal-2']);
  });

  it('resolves a link to the previous offline ID after the Journal learns the server ID', () => {
    const canonical = { ...entry('server-entry', 'tea-1'), previousIds: ['offline-entry'] };
    expect(journalEntriesForDeepLink([canonical], 'tea-1', 'offline-entry')).toEqual([canonical]);
    expect(journalEntriesForDeepLink([canonical], 'tea-2', 'offline-entry')).toEqual([]);
  });

  it('never opens an entry from another tea through a mismatched link', () => {
    const entries = [entry('journal-1', 'tea-1'), entry('journal-2', 'tea-2')];
    expect(journalEntriesForDeepLink(entries, 'tea-1', 'journal-2')).toEqual([]);
  });

  it('normalizes a reloaded API row into the canonical journal shape', () => {
    expect(fromApiRow({
      id: 'journal-2', product_id: 'tea-1', product_name: 'Rou Gui', product_type: 'Oolong', product_image: '/rou-gui.jpg',
      note: JSON.stringify({ tasting: { rating: 9 }, personalNote: 'Returning sweetness', updatedAt: '2026-08-09T10:00:00Z' }),
      tastings: JSON.stringify([{ id: 'sitting-1', tasting: { rating: 9 }, createdAt: '2026-08-09T10:00:00Z' }]),
      compass_entry_id: 'compass-1', archived: 0, created_at: '2026-08-09T10:00:00Z',
    })).toEqual(expect.objectContaining({
      id: 'journal-2', productId: 'tea-1', productName: 'Rou Gui', productType: 'Oolong', productImage: '/rou-gui.jpg',
      note: expect.objectContaining({ personalNote: 'Returning sweetness', tasting: { rating: 9 } }),
      tastings: [expect.objectContaining({ id: 'sitting-1', tasting: { rating: 9 } })],
      compassEntryId: 'compass-1', archived: false, synced: true,
    }));
  });

  it('upgrades a legacy API row without losing its one recorded tasting', () => {
    const normalized = fromApiRow({
      id: 'legacy-1', product_id: 'tea-1', product_name: 'Rou Gui', product_type: 'Oolong',
      tasting: '{"rating":8}', personal_note: 'Old note', rating: 8, created_at: '2026-08-01T00:00:00Z',
    });
    expect(normalized.note).toMatchObject({ tasting: { rating: 8 }, personalNote: 'Old note', rating: 8 });
    expect(normalized.tastings).toHaveLength(1);
    expect(normalized.tastings[0]).toMatchObject({ tasting: { rating: 8 }, createdAt: '2026-08-01T00:00:00Z' });
  });
});

describe('Tea Chest to personal journal deep links', () => {
  const chestTea = (linkedProductId: string | null): CellarItem => ({
    id: 'chest-1',
    name: 'Gifted Rou Gui',
    type: 'Oolong',
    grams: 25,
    placementStatus: 'private',
    linkedProductId,
    shelfPublished: false,
    createdAt: '2026-11-26T00:00:00Z',
    updatedAt: '2026-11-26T00:00:00Z',
  });

  it('uses the linked shop product while keeping the chest tea identity', () => {
    const deepLink = readJournalDeepLink('?chest=chest-1');
    expect(deepLink).toMatchObject({ chestItemId: 'chest-1' });
    expect(journalTastingForDeepLink(deepLink, [chestTea('product-1')])).toEqual({
      id: 'product-1',
      name: 'Gifted Rou Gui',
      type: 'Oolong',
    });
  });

  it('starts an unlinked chest tea under its own stable journal key', () => {
    const deepLink = readJournalDeepLink('?chest=chest-1');
    expect(journalTastingForDeepLink(deepLink, [chestTea(null)])).toEqual({
      id: 'member-tea:chest:chest-1',
      name: 'Gifted Rou Gui',
      type: 'Oolong',
    });
  });
});

describe('saved setup to exact Journal tasting', () => {
  const tea = { id: 'menu-first', name: 'Shui Xian', productId: 'product' };
  const second = { ...tea, id: 'menu-second' };
  const otherEvent = {
    id: 'event-tasting:other:menu-first', eventId: 'other', tasting: {}, createdAt: '2026-08-10T00:00:00Z',
  };

  it('links the exact pour even when the two menu lines use the same product', () => {
    const record = { ...otherEvent, id: 'event-tasting:sit:menu-first', eventId: 'sit' };
    const ours = { ...entry('journal-entry', 'product'), tastings: [otherEvent, record] };
    const href = keptSetupTastingHref([ours], 'sit', [tea, second], tea);
    expect(readJournalDeepLink(new URL(href!, 'https://teajia.test').search)).toEqual({
      productId: 'product', entryId: 'journal-entry', recordId: record.id,
    });
    expect(keptSetupTastingHref([ours], 'sit', [tea, second], second)).toBeNull();
    expect(keptSetupTastingHref([{ ...ours, archived: true }], 'sit', [tea], tea)).toBeNull();
  });

  it('reuses a single legacy event note only when the menu line is unambiguous', () => {
    const record = { ...otherEvent, id: 'older-id', eventId: 'sit', sourceType: 'event' as const };
    const ours = { ...entry('journal-entry', 'product'), tastings: [otherEvent, record] };
    expect(keptSetupTastingHref([ours], 'sit', [tea], tea)).toContain('tasting=older-id');
    expect(keptSetupTastingHref([ours], 'sit', [tea, second], tea)).toBeNull();
    expect(keptSetupTastingHref([ours], 'sit', [{ ...tea, productId: 'different' }], { ...tea, productId: 'different' })).toBeNull();
  });
});
