import { describe, expect, it } from 'vitest';
import type { CustomerTasting } from '../types';
import { journalEntriesForDeepLink } from '../components/tasting/TastingJournal';
import { fromApiRow, readJournalDeepLink } from './JournalPage';

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
