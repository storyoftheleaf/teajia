import { describe, expect, it } from 'vitest';
import { mergeProductTasting, tastingForShop, tastingHasTerms, tastingTermsSupplied } from '../src/curateImportTasting';
import { receiptRequest, ReceiptDb } from './helpers/receiptHarness';

/**
 * Three things a Curate tasting used to do to the shop's product page:
 * a re-taste replaced the product's whole tasting, deleting the starred notes,
 * teaser and brewing the admin wrote; a score alone stamped the tea as tasted
 * by the shop; and a hand-typed word reached a page that can only print the
 * full tasting's own words.
 */
describe('a tasting from Curate on its way to the shop', () => {
  it('keeps only words the full tasting knows, and everything else as it was', () => {
    const shop = tastingForShop(JSON.stringify({ flavor: ['sweet', 'my-own-word'], body: ['full'], quality: 8, notes: ['lovely'] }));
    expect(shop).toEqual({ flavor: ['sweet'], body: ['full'], quality: 8, notes: ['lovely'] });
  });

  it('a re-taste replaces only the categories it carries words in', () => {
    const stored = JSON.stringify({ flavor: ['floral'], finish: ['finish-long'], notes: [{ text: 'starred', starred: true }], teaser: 'Honey and stone', brewing: ['gaiwan'] });
    const supplied = tastingTermsSupplied(tastingForShop({ flavor: ['sweet'], finish: [] }));
    const { next } = mergeProductTasting(stored, supplied);
    expect(next).toEqual({ flavor: ['sweet'], finish: ['finish-long'], notes: [{ text: 'starred', starred: true }], teaser: 'Honey and stone', brewing: ['gaiwan'] });
  });

  it('a score alone is not the shop\'s tasting', () => {
    expect(tastingHasTerms(tastingForShop({ quality: 9 }))).toBe(false);
    expect(tastingHasTerms(tastingForShop({ flavor: ['made-up'] }))).toBe(false);
    expect(tastingHasTerms(tastingForShop({ flavor: ['sweet'] }))).toBe(true);
  });
});

describe('promoting a tea to the shop', () => {
  it('carries only known words, and claims the tasting only when it has some', async () => {
    const db = ReceiptDb.seeded();
    Object.assign(db.entries.get('entry-a')!, { tasting: JSON.stringify({ quality: 9, flavor: ['not-a-term'] }) });
    const res = await receiptRequest(db, '/api/compass/entries/entry-a/promote', { method: 'POST' });
    expect(res.status).toBe(201);
    const { id } = await res.json() as { id: string };
    const product = db.products.get(id)!;
    expect(product.tasting_source).toBeNull();
    expect(JSON.parse(String(product.tasting))).toEqual({ quality: 9 });
  });

  it('claims it when the tasting carries the full tasting\'s words', async () => {
    const db = ReceiptDb.seeded();
    Object.assign(db.entries.get('entry-a')!, { tasting: JSON.stringify({ flavor: ['sweet'], body: ['full'] }) });
    const res = await receiptRequest(db, '/api/compass/entries/entry-a/promote', { method: 'POST' });
    const { id } = await res.json() as { id: string };
    expect(db.products.get(id)!.tasting_source).toBe('owner');
  });
});
