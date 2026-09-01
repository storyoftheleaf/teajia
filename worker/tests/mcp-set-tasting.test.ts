import { describe, expect, it } from 'vitest';
import { mergeProductTasting, readStoredTasting, tastingHasTerms } from '../src/curateImportTasting';

/*
 * The set_tasting MCP tool writes one column that holds more than the terms it
 * sets. These cover the two ways that goes wrong silently: losing the parts of
 * the tasting nobody asked to change, and publishing a shorter claim than was
 * requested because a term was quietly dropped.
 */
describe('mergeProductTasting', () => {
  const stored = JSON.stringify({
    flavor: ['honey'],
    teaser: 'A forest red from the old gardens above Yiwu.',
    notes: [{ id: 'n1', text: 'Slow to leave.', starred: true }],
    brewing: ['gongfu'],
    huiGan: true,
  });

  it('keeps everything the caller did not name', () => {
    const { next } = mergeProductTasting(stored, { flavor: ['honey', 'malt'] });
    expect(next.flavor).toEqual(['honey', 'malt']);
    expect(next.teaser).toBe('A forest red from the old gardens above Yiwu.');
    expect(next.notes).toEqual([{ id: 'n1', text: 'Slow to leave.', starred: true }]);
    expect(next.brewing).toEqual(['gongfu']);
    expect(next.huiGan).toBe(true);
  });

  it('reports exactly the categories that were named', () => {
    const { touched } = mergeProductTasting(stored, { feeling: ['grounding'], body: ['silky'] });
    expect(touched).toEqual(['feeling', 'body']);
  });

  it('refuses an unknown term by name instead of dropping it', () => {
    expect(() => mergeProductTasting(stored, { flavor: ['honey', 'not-a-real-term'] }))
      .toThrow(/not-a-real-term/);
  });

  it('treats an empty array as a deliberate clear', () => {
    const { next } = mergeProductTasting(stored, { flavor: [] });
    expect('flavor' in next).toBe(false);
    expect(next.teaser).toBeDefined();
  });

  it('accepts every category the product page reads', () => {
    const { next } = mergeProductTasting('{}', {
      flavor: ['honey', 'dried-fruit', 'malt', 'cocoa'],
      feeling: ['grounding', 'feeling-warming'],
      body: ['medium', 'silky'],
      finish: ['coating', 'finish-long', 'hui-gan'],
      'liquor-color': ['amber'],
    });
    expect(next).toEqual({
      flavor: ['honey', 'dried-fruit', 'malt', 'cocoa'],
      feeling: ['grounding', 'feeling-warming'],
      body: ['medium', 'silky'],
      finish: ['coating', 'finish-long', 'hui-gan'],
      'liquor-color': ['amber'],
    });
  });

  it('refuses to merge onto a tasting it cannot read, rather than onto nothing', () => {
    expect(() => mergeProductTasting('{ this is not json', { flavor: ['honey'] }))
      .toThrow(/not readable JSON/);
  });
});

describe('readStoredTasting', () => {
  it('treats an empty column as an empty tasting', () => {
    expect(readStoredTasting(null)).toEqual({});
    expect(readStoredTasting('')).toEqual({});
    expect(readStoredTasting('{}')).toEqual({});
  });
});

describe('tastingHasTerms', () => {
  it('is true only when a term category actually carries a claim', () => {
    expect(tastingHasTerms({ flavor: ['honey'] })).toBe(true);
    expect(tastingHasTerms({ flavor: [] })).toBe(false);
    // A teaser or a starred note is not the shop claiming a flavour.
    expect(tastingHasTerms({ teaser: 'x', notes: [{ id: 'n', text: 't' }] })).toBe(false);
  });
});
