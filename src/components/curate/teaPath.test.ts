import { describe, expect, it } from 'vitest';
import { libraryWaiting, teaPath } from './teaPath';
import type { TeaCompassEntry } from '../TeaCompass/types';
import type { Product } from '../../admin/types';
import type { CuratePurchaseReceipt } from '../../lib/api';

const tea = (over: Partial<TeaCompassEntry> = {}): TeaCompassEntry => ({
  id: 'tea-1', name: 'Old tree sheng', category: 'tea', status: 'noted', priceCurrency: 'Yuan', quantity: 1,
  notes: '', photos: [], audioClips: [], createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', synced: true,
  ...over,
} as TeaCompassEntry);
const stock = (over: Partial<Product> = {}) => ({
  id: 'p-1', sourceCompassEntryId: 'tea-1', inventoryPurpose: 'working', status: 'Draft', stockGrams: 0, stockKnownAt: '2026-11-27T00:00:00Z', stockVerifiedAt: null,
  costAmount: null, description: '', quantityUnits: undefined, ...over,
} as unknown as Product);
const tasted = { tasting: { score: 8 } } as Partial<TeaCompassEntry>;

describe('teaPath', () => {
  it('starts a new tea at tasting, then the decision', () => {
    const path = teaPath({ entry: tea() });
    expect(path.steps.map(s => s.id)).toEqual(['taste', 'decide', 'stock', 'amount', 'cost', 'writeup', 'priced', 'photo', 'public']);
    expect(path.next?.id).toBe('taste');
    expect(teaPath({ entry: tea(tasted) }).next?.id).toBe('decide');
  });

  it('never asks a sample to be weighed', () => {
    const path = teaPath({ entry: tea({ sampleState: 'received' }) });
    expect(path.steps.some(s => s.todoLabel.toLowerCase().includes('weigh'))).toBe(false);
  });

  it('puts a waiting arrival first', () => {
    expect(teaPath({ entry: tea(tasted), arrivalWaiting: true }).next?.id).toBe('arrival');
  });

  it('walks a Stock tea through amount, cost and write-up', () => {
    const entry = tea({ ...tasted, decision: 'selected' });
    expect(teaPath({ entry, stock: stock() }).next?.id).toBe('amount');
    expect(teaPath({ entry, stock: stock({ stockGrams: 250 }) }).next?.id).toBe('cost');
    // A typed zero is a cost.
    expect(teaPath({ entry, stock: stock({ stockGrams: 250, costAmount: 0 }) }).next?.id).toBe('writeup');
    const done = teaPath({ entry, stock: stock({ stockGrams: 250, costAmount: 0, description: 'A bright sheng.' }) });
    expect(done.next?.id).toBe('priced');
    expect(done.passed).toBe(false);
  });

  it('a fresh Stock record\'s zero is not an amount, a checked zero is', () => {
    const entry = tea({ ...tasted, decision: 'selected' });
    expect(teaPath({ entry, stock: stock() }).next?.id).toBe('amount');
    expect(teaPath({ entry, stock: stock({ stockVerifiedAt: '2026-11-20T00:00:00Z' }) }).next?.id).toBe('cost');
    expect(teaPath({ entry, stock: stock({ status: 'Sold Out' }) }).next?.id).toBe('cost');
  });

  it('stops at a rejection', () => {
    const path = teaPath({ entry: tea({ ...tasted, decision: 'passed_on' }) });
    expect(path.passed).toBe(true);
    expect(path.next).toBeNull();
    expect(path.steps.map(s => s.id)).toEqual(['taste', 'decide']);
  });

  it('an ordered tea is already decided', () => {
    expect(teaPath({ entry: tea(), purchaseStatus: 'ordered' }).steps.find(s => s.id === 'decide')?.done).toBe(true);
  });

  it('teaware is not tasted', () => {
    expect(teaPath({ entry: tea({ category: 'teaware' }) }).next?.id).toBe('decide');
  });
});

describe('libraryWaiting', () => {
  const pending = (entryId: string) => ({ id: `r-${entryId}`, compass_entry_id: entryId, status: 'pending' } as CuratePurchaseReceipt);
  const run = (entries: TeaCompassEntry[], products: Product[] = [], proposals: CuratePurchaseReceipt[] = [], status: Record<string, string> = {}) =>
    Object.fromEntries(libraryWaiting({
      entries, products, proposals,
      purchaseStatusFor: (entry) => (status[entry.id] ?? 'none') as never,
    }).map(group => [group.id, group.entries.map(e => e.id)]));

  it('lists each tea once, under the step that is Adrian\'s', () => {
    const groups = run([
      tea({ id: 'arrived' }),
      tea({ id: 'sample', sampleState: 'received' }),
      tea({ id: 'tasted', ...tasted }),
      tea({ id: 'chosen', ...tasted, decision: 'selected' }),
      tea({ id: 'costless', ...tasted, decision: 'selected' }),
    ], [stock({ id: 'p-c', sourceCompassEntryId: 'costless', stockGrams: 100 })], [pending('arrived')]);
    expect(groups).toEqual({ arrival: ['arrived'], taste: ['sample'], decide: ['tasted'], stock: ['chosen'], cost: ['costless'] });
  });

  it('leaves out what waits on others or on nobody', () => {
    const groups = run([
      tea({ id: 'noted' }), // just in the Library
      tea({ id: 'requested', sampleState: 'requested' }), // the supplier owes the sample
      tea({ id: 'ordered', ...tasted, decision: 'selected' }), // the supplier owes the tea
      tea({ id: 'rejected', ...tasted, decision: 'passed_on' }),
    ], [], [], { ordered: 'ordered' });
    expect(groups).toEqual({});
  });

  it('shows a bought tea\'s Stock gaps even before it is tasted', () => {
    const groups = run([tea({ id: 'bought', status: 'in_stock' })], [stock({ id: 'p-b', sourceCompassEntryId: 'bought' })]);
    expect(groups).toEqual({ amount: ['bought'] });
  });
});

describe('past the write-up', () => {
  const entry = tea({ ...tasted, decision: 'selected' });
  const ready = { stockGrams: 250, costAmount: 40, description: 'Written.' };
  const onSite = { ...ready, pricePerGramUSD: 0.5, imageUrl: 'https://img/x.jpg', isPublic: true, shownInShop: true, status: 'Active' as const };

  it('walks a written-up tea through price, photo and going public', () => {
    expect(teaPath({ entry, stock: stock(ready) }).next?.id).toBe('priced');
    // A price of zero is a price.
    expect(teaPath({ entry, stock: stock({ ...ready, pricePerGramUSD: 0 }) }).next?.id).toBe('photo');
    expect(teaPath({ entry, stock: stock({ ...ready, pricePerGramUSD: 0.5, imageUrl: 'x' }) }).next?.id).toBe('public');
    expect(teaPath({ entry, stock: stock({ ...onSite, shownInShop: false }) }).next?.id).toBe('public');
    expect(teaPath({ entry, stock: stock(onSite) }).next).toBeNull();
  });

  it('adds the Tea Wisdom entry only once the entries are known', () => {
    expect(teaPath({ entry, stock: stock(onSite) }).steps.some(s => s.id === 'entry')).toBe(false);
    expect(teaPath({ entry, stock: stock(onSite), wisdomEntry: false }).next?.id).toBe('entry');
    expect(teaPath({ entry, stock: stock(onSite), wisdomEntry: true }).next).toBeNull();
    expect(teaPath({ entry: tea({ ...tasted, decision: 'selected', category: 'teaware' }), stock: stock(onSite), wisdomEntry: false })
      .steps.some(s => s.id === 'entry')).toBe(false);
  });

  it('lists public teas without an entry, and never price, photo or going public', () => {
    const waiting = (over: Partial<Product>, ids?: Set<string>) => libraryWaiting({
      entries: [entry], products: [stock(over)], proposals: [], purchaseStatusFor: () => 'received', wisdomEntryIds: ids,
    }).map(group => group.id);
    expect(waiting(ready, new Set())).toEqual([]);
    expect(waiting({ ...onSite, isPublic: false }, new Set())).toEqual([]);
    expect(waiting(onSite, new Set())).toEqual(['entry']);
    expect(waiting(onSite, new Set(['p-1']))).toEqual([]);
    expect(waiting(onSite)).toEqual([]);
  });
});
