import { describe, expect, it } from 'vitest';
import taxonomy from '../../data/teajia-tasting-taxonomy.json';
import { FAST_TASTING, applyFast, costPerGramUsd, currencyForNewPrice, linePriceFields, pieceWeightGrams, shownCurrency, orderLinePrice, quotedUnit, readFast, readLinePrice, tastingLine, todayItems, todaySections } from './curateV2Model';
import type { ExchangeRate } from '../../admin/types';
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

describe('todaySections', () => {
  const now = Date.parse('2026-10-08T12:00:00.000Z');
  it('sorts teas into the sections Today shows, with days on the way', () => {
    const s = todaySections([
      entry({ id: 'a', name: 'Sample', sampleState: 'received', priceAmount: 300 }),
      entry({ id: 'b', priceAmount: 1200, tasting: { quality: 8 } }),
      entry({ id: 'c', name: 'No cost', priceAmount: undefined }),
      entry({ id: 'd', name: 'Arrived', priceAmount: 420, status: 'in_stock' }),
      entry({ id: 'e', name: 'Coming', priceAmount: 260, status: 'incoming', vendorName: 'Wang', updatedAt: '2026-10-02T12:00:00.000Z' }),
      entry({ id: 'f', name: 'Shelved', priceAmount: 420, status: 'in_stock', draftProductId: 'p1' }),
    ], now);
    expect(s.decide.map((i) => i.entryId)).toEqual(['a', 'b']);
    expect(s.cost.map((i) => i.entryId)).toEqual(['c']);
    expect(s.shelve.map((i) => i.entryId)).toEqual(['d']);
    expect(s.onTheWay).toEqual([{ entryId: 'e', name: 'Coming', vendor: 'Wang', days: 6, ordering: false }]);
  });
});

describe('readLinePrice', () => {
  it('reads a price the way it is said at the table', () => {
    expect(readLinePrice('Mengku 2018 ¥450/cake')).toMatchObject({ amount: 450, currency: 'Yuan', unit: 'cake', rest: 'Mengku 2018' });
    expect(readLinePrice('Jingmai 380 a jin')).toMatchObject({ amount: 380, unit: 'jin', rest: 'Jingmai' });
    expect(readLinePrice('Li Shan NT$1,800 per 150g')).toMatchObject({ amount: 1800, currency: 'NT', grams: 150, rest: 'Li Shan' });
    expect(linePriceFields(readLinePrice('Li Shan NT$1,800 per 150g')!)).toEqual({ priceAmount: 1800, priceCurrency: 'NT', pricePerUnitGrams: 150 });
    expect(readLinePrice('old oolong 120元一两')).toMatchObject({ amount: 120, currency: 'Yuan', unit: 'liang' });
  });

  it('never reads a year or a bare number as a price', () => {
    expect(readLinePrice('Yiwu 2019 sheng')).toBeNull();
    expect(readLinePrice('7572 Menghai')).toBeNull();
  });

  it('writes the fields Curate already uses', () => {
    expect(linePriceFields({ amount: 380, unit: 'jin', rest: '' })).toEqual({ priceAmount: 380, pricePerUnitGrams: 500 });
    expect(linePriceFields({ amount: 450, currency: 'Yuan', unit: 'cake', rest: '' })).toEqual({ priceAmount: 450, priceCurrency: 'Yuan', form: 'Cake' });
  });
});

describe('orderLinePrice', () => {
  it('turns a per-100 g quote into a per-gram price so 250 g costs ¥300, not ¥30,000', () => {
    const line = orderLinePrice({ category: 'tea', priceAmount: 120, pricePerUnitGrams: 100 });
    expect(line).toEqual({ pricePerUnit: 1.2, priceIsPerGram: true });
    expect(line.pricePerUnit * 250).toBeCloseTo(300);
  });
  it('prices a cake or teaware per piece', () => {
    expect(orderLinePrice({ category: 'tea', priceAmount: 450, form: 'Cake', pricePerUnitGrams: 357 })).toEqual({ pricePerUnit: 450, priceIsPerGram: false });
    expect(orderLinePrice({ category: 'teaware', priceAmount: 800 })).toEqual({ pricePerUnit: 800, priceIsPerGram: false });
  });
});

describe('the money shown beside a price nobody has entered', () => {
  // What the shop sync hands back for a tea with no price: the currency is the
  // stamp 'NT', and touchedFields (a local-only record) does not travel.
  const hydrated = (over: Partial<TeaCompassEntry> = {}) =>
    ({ ...entry({ priceCurrency: 'NT', priceAmount: undefined }), touchedFields: undefined, ...over }) as TeaCompassEntry;

  it('is Yuan for a tea that came back with no price, not the stamped NT', () => {
    expect(shownCurrency(hydrated())).toBe('Yuan');
  });

  it('is the open table\'s money when there is one', () => {
    expect(shownCurrency(hydrated(), 'HKD')).toBe('HKD');
  });

  it('still does not trust the stamp after an unrelated edit made touchedFields an array', () => {
    expect(shownCurrency(hydrated({ touchedFields: ['name'] }), 'Yuan')).toBe('Yuan');
  });

  it('is the stored money once a price is on the tea, or the currency was picked', () => {
    expect(shownCurrency(hydrated({ priceAmount: 1800 }), 'Yuan')).toBe('NT');
    expect(shownCurrency(hydrated({ touchedFields: ['priceCurrency'] }), 'Yuan')).toBe('NT');
  });

  it('stores the shown money only when a price is typed, and only once', () => {
    expect(currencyForNewPrice(hydrated(), 'Yuan')).toBe('Yuan');
    expect(currencyForNewPrice(hydrated({ priceAmount: 12 }), 'Yuan')).toBeUndefined();
    expect(currencyForNewPrice(hydrated({ touchedFields: ['priceCurrency'] }), 'Yuan')).toBeUndefined();
  });
});

describe('what a piece weighs, and what a gram cost', () => {
  const rates: ExchangeRate[] = [
    { currency: 'USD', rateToUSD: 1 },
    { currency: 'Yuan', rateToUSD: 7 },
    { currency: 'NT', rateToUSD: 30 },
  ];
  it('a cake weighs what was written on it, else its usual 357 g', () => {
    expect(pieceWeightGrams({ form: 'Cake' })).toBe(357);
    expect(pieceWeightGrams({ form: 'Cake', pricePerUnitGrams: 200 })).toBe(200);
    expect(pieceWeightGrams({ form: 'Loose', pricePerUnitGrams: 100 })).toBeNull();
  });
  it('ranks teas bought in different money by their dollars, not their bare numbers', () => {
    const yuan = costPerGramUsd(entry({ priceAmount: 700, priceCurrency: 'Yuan', pricePerUnitGrams: 100, form: 'Loose' }), rates);
    const nt = costPerGramUsd(entry({ priceAmount: 600, priceCurrency: 'NT', pricePerUnitGrams: 100, form: 'Loose' }), rates);
    expect(yuan).toBeCloseTo(1, 10);
    expect(nt).toBeCloseTo(0.2, 10);
    expect(nt).toBeLessThan(yuan);
  });
  it('has no figure for a currency without a rate, a tea without a price, or teaware', () => {
    expect(costPerGramUsd(entry({ priceAmount: 5, priceCurrency: 'HKD', pricePerUnitGrams: 100 }), rates)).toBe(Infinity);
    expect(costPerGramUsd(entry({ priceAmount: undefined, pricePerUnitGrams: 100 }), rates)).toBe(Infinity);
    expect(costPerGramUsd(entry({ category: 'teaware', priceAmount: 40, priceCurrency: 'USD', pricePerUnitGrams: 1 }), rates)).toBe(Infinity);
  });
});
