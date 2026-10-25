import { describe, expect, it } from 'vitest';
import { createEmptyEntry } from './types';
import { libraryEntryChosen, libraryEntryRejected, librarySupplierGroups } from './librarySupplierGroups';

describe('supplier identity grouping', () => {
  it('groups the same shared supplier despite old snapshots and keeps distinct IDs separate', () => {
    const entries = [
      { ...createEmptyEntry(), id: '1', linkedCustomerId: 'a', vendorName: 'Old name' },
      { ...createEmptyEntry(), id: '2', linkedCustomerId: 'a', vendorName: 'New name' },
      { ...createEmptyEntry(), id: '3', linkedCustomerId: 'b', vendorName: 'Old name' },
    ];
    const groups = librarySupplierGroups(entries);
    expect(groups).toHaveLength(2);
    expect(groups.find(g => g.key === 'supplier:a')?.entries.map(e => e.id)).toEqual(['1', '2']);
  });
  it('recognizes chat-imported and durable orders without confusing drafts with orders', () => {
    const entry = createEmptyEntry();
    expect(libraryEntryChosen({ ...entry, status: 'incoming' })).toBe(true);
    expect(libraryEntryChosen(entry, 'ordered')).toBe(true);
    expect(libraryEntryChosen({ ...entry, status: 'buying' }, 'draft')).toBe(false);
    expect(libraryEntryChosen({ ...entry, decision: 'passed_on' }, 'received')).toBe(false);
    expect(libraryEntryRejected({ ...entry, status: 'pass' })).toBe(true);
  });
});
