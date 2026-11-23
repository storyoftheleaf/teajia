import { describe, expect, it } from 'vitest';
import { listingFacts, listingFactsFromInventoryItem, listingFactsFromPublicProduct } from './listingFacts';

describe('listingFacts', () => {
  it('builds Naka exactly as the contract table says', () => {
    expect(listingFactsFromPublicProduct({
      type: 'Shou Puer',
      form: 'Cake',
      originRegion: 'Mengsong, Menghai, Yunnan',
      productName: 'Naka Gushu',
    })).toEqual({
      type: 'Shou',
      originParts: ['mengsong', 'menghai', 'yunnan'],
      nameTokens: ['naka', 'gushu'],
      form: 'Cake',
    });
  });

  it('never reads a grade, type, form or place from the name', () => {
    const facts = listingFacts({ name: 'Jingmai Gong Ting Shou Cake' });
    expect(facts.grade).toBeUndefined();
    expect(facts.type).toBeUndefined();
    expect(facts.form).toBeUndefined();
    expect(facts.originParts).toEqual([]);
    expect(facts.nameTokens).toEqual(['jingmai', 'gong', 'ting', 'shou', 'cake']);
  });

  it('takes a grade only from the explicit field', () => {
    expect(listingFacts({ grade: 'gong-ting' }).grade).toBe('gong-ting');
    expect(listingFactsFromInventoryItem({ name: 'Gong Ting', type: 'Shou' }).grade).toBeUndefined();
  });

  it('keeps the inventory origin whole-part, country included', () => {
    expect(listingFactsFromInventoryItem({ origin: 'Mengsong, Menghai, Yunnan, China', variant: 'Naka Gushu' }).originParts)
      .toEqual(['mengsong', 'menghai', 'yunnan', 'china']);
  });

  it('returns no type for an unknown spelling rather than guessing', () => {
    expect(listingFacts({ type: 'Mystery' }).type).toBeUndefined();
  });
});
