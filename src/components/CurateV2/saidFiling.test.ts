import { describe, expect, it } from 'vitest';
import { applySaidParts } from './saidFiling';
import { tastingLine } from './curateV2Model';

const tea = (over: Record<string, unknown> = {}) => ({ id: 't', name: 'Yiwu Gushu', notes: '', priceCurrency: 'NT', photos: [], audioClips: [], status: 'noted', category: 'tea', quantity: 1, ...over }) as any;

describe('applying what was said', () => {
  const parts = [
    { kind: 'tea', text: '2019 · spring · gushu', fields: { year: 2019, season: 'Spring', form: 'Cake', origin_region: 'Yiwu', type: 'sheng puer' } },
    { kind: 'price', text: '¥1,200 per cake', fields: { amount: 1200, currency: 'CNY', per: 'cake' } },
    { kind: 'taste', text: 'Full · Sweet · Clean · Long', fields: { weight: 'full', flavours: ['sweet'], clean: 'clean', stays: 'finish-long' } },
    { kind: 'story', text: 'Trees about 300 years old', fields: {} },
    { kind: 'vendor', text: 'Has the 2018 in spring', fields: {} },
    { kind: 'todo', text: 'Ask Wang about the 2018', fields: {} },
  ] as const;

  it('fills the tea, its price in yuan per cake, the fast tasting and a to-do without moving source claims into notes', () => {
    const { updates, todos } = applySaidParts(tea(), parts as any);
    expect(updates).toMatchObject({ year: 2019, season: 'Spring', form: 'Cake', originRegion: 'Yiwu', type: 'Sheng', priceAmount: 1200, priceCurrency: 'Yuan' });
    expect(tastingLine(updates.tasting)).toBe('Clean · Full · Sweet · Long');
    expect(updates.notes).toBeUndefined();
    expect(todos).toEqual(['Ask Wang about the 2018']);
  });

  it('never overwrites what was already entered', () => {
    const { updates } = applySaidParts(tea({ priceAmount: 900, priceCurrency: 'Yuan', year: 2018, notes: 'Bought two' }), parts as any);
    expect(updates.priceAmount).toBeUndefined();
    expect(updates.year).toBeUndefined();
    expect(updates.notes).toBeUndefined();
  });
});
