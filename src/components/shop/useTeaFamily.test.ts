import { describe, expect, it } from 'vitest';
import type { FamilyPhotograph, FamilySharedPhotograph } from '../../lib/familyContract';
import { buildTeaRow, personPath, readPublicTeaPhotographs } from './useTeaFamily';

const shared = (id: string, name = 'Mei', pageId: string | null = 'c1'): FamilySharedPhotograph => ({
  id, full_url: `https://media.teajia.co/family-photos/a/p/${id}-full.jpg`, small_url: `https://media.teajia.co/family-photos/a/p/${id}-small.jpg`,
  full_width: 2000, full_height: 1333, small_width: 480, small_height: 320, shape: 'square', author: { name, page_id: pageId },
});
const own = (id: string): FamilyPhotograph => ({
  id, product_id: 'p', journal_entry_id: null, page: null,
  full_url: `https://media.teajia.co/family-photos/a/p/${id}-full.jpg`, small_url: `https://media.teajia.co/family-photos/a/p/${id}-small.jpg`,
  full_width: 2000, full_height: 1333, small_width: 480, small_height: 320, share_state: 'private', shape: 'square', created_at: '2026-11-01',
});

const none = { product_id: 'p', lead: null, placed: [], family: [] };

describe('the row under the plaque', () => {
  it('is empty when nobody has added anything, so the page stays as it was', () => {
    expect(buildTeaRow([], null, none)).toEqual([]);
  });
  it("puts the shop's chosen picture first for a visitor, credited to its author", () => {
    const row = buildTeaRow([], null, { ...none, lead: shared('l', 'Mei Lin', 'c9'), family: [shared('f')] });
    expect(row.map(p => p.id)).toEqual(['l', 'f']);
    expect(row[0]).toMatchObject({ isLead: true, mine: false, author: { name: 'Mei Lin', page_id: 'c9' } });
  });
  it("puts the reader's own cover ahead of the shop's picture, with no credit on it", () => {
    const row = buildTeaRow([own('a'), own('mine')], 'mine', { ...none, lead: shared('l') });
    expect(row.map(p => p.id)).toEqual(['mine', 'l', 'a']);
    expect(row[0]).toMatchObject({ isCover: true, mine: true, author: null });
  });
  it('ignores a cover that is no longer among the reader\'s photographs', () => {
    const row = buildTeaRow([own('a')], 'gone', { ...none, lead: shared('l') });
    expect(row.map(p => p.id)).toEqual(['l', 'a']);
    expect(row.some(p => p.isCover)).toBe(false);
  });
  it('shows a photograph once even when it is the reader\'s own, placed and shared', () => {
    const row = buildTeaRow([own('a')], null, { ...none, placed: [shared('a'), shared('b')], family: [shared('b'), shared('c')] });
    expect(row.map(p => p.id)).toEqual(['a', 'b', 'c']);
    expect(row[0].mine).toBe(true);
  });
  it('builds a person link from the page id', () => {
    expect(personPath('c 1')).toBe('/people/c%201');
    expect(personPath(null)).toBeNull();
  });
});

describe('reading the public answer', () => {
  it('reads any other shape as nothing added', () => {
    for (const odd of [[], null, 'x', 7, {}]) {
      const read = readPublicTeaPhotographs(odd);
      expect(read.lead).toBeNull();
      expect(read.family).toEqual([]);
      expect(read.placed).toEqual([]);
    }
  });
  it('keeps what the contract says', () => {
    const read = readPublicTeaPhotographs({ product_id: 'p', lead: shared('l'), placed: [], family: [shared('f')] });
    expect(read.lead?.id).toBe('l');
    expect(read.family).toHaveLength(1);
  });
});
