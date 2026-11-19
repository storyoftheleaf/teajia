import { describe, expect, it } from 'vitest';
import type { FamilyPhotograph, FamilySharedPhotograph } from '../../lib/familyContract';
import { mergeStrip, personPath, pickPlatePicture, readPublicTeaPhotographs } from './useTeaFamily';

const shared = (id: string, name = 'Mei', pageId: string | null = 'c1'): FamilySharedPhotograph => ({
  id, full_url: `https://media.teajia.co/family-photos/a/p/${id}-full.jpg`, small_url: `https://media.teajia.co/family-photos/a/p/${id}-small.jpg`,
  full_width: 2000, full_height: 1333, small_width: 480, small_height: 320, author: { name, page_id: pageId },
});
const own = (id: string): FamilyPhotograph => ({
  id, product_id: 'p', journal_entry_id: null, page: null,
  full_url: `https://media.teajia.co/family-photos/a/p/${id}-full.jpg`, small_url: `https://media.teajia.co/family-photos/a/p/${id}-small.jpg`,
  full_width: 2000, full_height: 1333, small_width: 480, small_height: 320, share_state: 'private', created_at: '2026-11-01',
});

describe('the plate picture', () => {
  it('is nothing when there is no cover and no lead, so the page stays as it was', () => {
    expect(pickPlatePicture('Liu Bao', [], null, null)).toBeNull();
    expect(pickPlatePicture('Liu Bao', [own('a')], null, null)).toBeNull();
  });
  it('is the shop lead with a credit that links to the person', () => {
    const picture = pickPlatePicture('Liu Bao', [], null, shared('x', 'Mei Lin', 'c9'));
    expect(picture?.kind).toBe('lead');
    expect(picture?.credit).toEqual({ name: 'Mei Lin', href: '/people/c9' });
  });
  it('credits without a link when the person has no page', () => {
    expect(pickPlatePicture('Liu Bao', [], null, shared('x', 'Mei Lin', null))?.credit).toEqual({ name: 'Mei Lin', href: null });
  });
  it("is the reader's own cover over the lead, and carries no credit", () => {
    const picture = pickPlatePicture('Liu Bao', [own('mine')], 'mine', shared('x'));
    expect(picture?.kind).toBe('cover');
    expect(picture?.credit).toBeUndefined();
    expect(picture?.src).toContain('mine-full');
  });
  it("falls back to the lead when the chosen cover is no longer among the reader's photographs", () => {
    expect(pickPlatePicture('Liu Bao', [own('other')], 'gone', shared('x'))?.kind).toBe('lead');
  });
});

describe('the family strip', () => {
  it('shows a photograph once even when it is both placed and shared', () => {
    expect(mergeStrip([shared('a'), shared('b')], [shared('b'), shared('c')]).map(p => p.id)).toEqual(['a', 'b', 'c']);
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
