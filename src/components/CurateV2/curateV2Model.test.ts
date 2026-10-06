import { describe, expect, it } from 'vitest';
import taxonomy from '../../data/teajia-tasting-taxonomy.json';
import { FAST_TASTING, applyFast, quotedUnit, readFast, tastingLine, todayItems } from './curateV2Model';
import { createEmptyEntry, type TeaCompassEntry } from './types';

const entry = (over: Partial<TeaCompassEntry>): TeaCompassEntry => ({
  ...createEmptyEntry('tea'),
  id: over.id ?? Math.random().toString(36).slice(2),
  name: 'Yiwu Gushu',
  ...over,
});

describe('the fast tasting speaks only the full tasting\'s words', () => {
  const cats = (taxonomy as { categories?: unknown }).categories ?? taxonomy;
  const ids = new Set<string>();
  for (const c of Object.values(cats as Record<string, { groups: { terms: { id: string }[] }[] }>)) {
    for (const g of c.groups) for (const t of g.terms) ids.add(t.id);
  }
  it('every term answer is a taxonomy id (score, cleanliness and "none" are not terms)', () => {
    for (const q of FAST_TASTING) {
      if (q.q === 'score' || q.q === 'clean') continue;
      for (const o of q.options) {
        if (o.id === 'none') continue;
        expect(ids.has(o.id), `${q.q}: ${o.id}`).toBe(true);
      }
    }
  });
});

describe('applyFast', () => {
  it('records each answer in the field the full tasting uses', () => {
    let t = applyFast(undefined, 'score', '8');
    t = applyFast(t, 'clean', 'clean');
    t = applyFast(t, 'drying', 'finish-dry');
    t = applyFast(t, 'weight', 'full');
    t = applyFast(t, 'flavour', 'sweet');
    t = applyFast(t, 'stays', 'finish-long');
    expect(t).toMatchObject({ quality: 8, cleanliness: 'clean', body: ['full'], flavor: ['sweet'] });
    expect(t.finish).toEqual(['finish-dry', 'finish-long']);
    expect(tastingLine(t)).toBe('8 · Clean · Full · Sweet · Long');
  });

  it('switches a single answer, and a second tap clears it', () => {
    let t = applyFast(undefined, 'weight', 'light');
    t = applyFast(t, 'weight', 'full');
    expect(t.body).toEqual(['full']);
    t = applyFast(t, 'weight', 'full');
    expect(t.body).toEqual([]);
  });

  it('drying moves between a little and astringent without leaving both', () => {
    let t = applyFast(undefined, 'drying', 'finish-dry');
    t = applyFast(t, 'drying', 'dry');
    expect(t.finish).toEqual([]);
    expect(t.body).toEqual(['dry']);
    expect(readFast(t).drying).toEqual(['dry']);
    t = applyFast(t, 'drying', 'none');
    expect(t.body).toEqual([]);
  });

  it('leaves a full tasting\'s deeper terms and notes alone', () => {
    const before = { body: ['silky', 'warm'], finish: ['hui-gan'], notes: ['lovely'], flavor: ['orchid'] };
    const t = applyFast(before, 'weight', 'medium');
    expect(t.body).toEqual(['silky', 'warm', 'medium']);
    expect(t.finish).toEqual(['hui-gan']);
    expect(t.notes).toEqual(['lovely']);
    expect(t.flavor).toEqual(['orchid']);
  });
});

describe('quotedUnit', () => {
  it('reads the price the way the vendor said it', () => {
    expect(quotedUnit({ category: 'tea', form: 'Cake' })).toBe('cake');
    expect(quotedUnit({ category: 'tea', pricePerUnitGrams: 500 })).toBe('jin');
    expect(quotedUnit({ category: 'tea', pricePerUnitGrams: 50 })).toBe('liang');
    expect(quotedUnit({ category: 'tea', pricePerUnitGrams: 100 })).toBe('100 g');
    expect(quotedUnit({ category: 'teaware' })).toBe('each');
  });
});

describe('todayItems', () => {
  it('asks for the one most pressing thing per tea, and nothing of a tea passed on', () => {
    const items = todayItems([
      entry({ id: 'a', name: 'Old oolong', priceAmount: undefined }),
      entry({ id: 'b', priceAmount: 1200, tasting: { quality: 8 } }),
      entry({ id: 'c', priceAmount: 300, sampleState: 'received', name: 'Li Shan' }),
      entry({ id: 'd', priceAmount: 420, status: 'in_stock', name: 'Pasha' }),
      entry({ id: 'e', name: 'Passed', decision: 'passed_on' }),
    ]);
    expect(items.map((i) => [i.entryId, i.action])).toEqual([
      ['c', 'taste'], ['b', 'decide'], ['a', 'add-cost'], ['d', 'shelf'],
    ]);
  });
});
