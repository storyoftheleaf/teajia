/**
 * A line never lands cheaper than it was bought because a rate was missing.
 *
 * An intake spreads one shipping total across the staged lines, and each share
 * has to be read in that line's own currency before it can be folded into the
 * cost. The workspace answered NaN when the shop had no rate for one of those
 * currencies, with a comment saying that surfaces as a dash. It did not: the
 * only reader was `stagedToProduct(it, extra)`, which takes `extraCost || 0`,
 * and NaN is falsy. So the whole freight share vanished and the tea was stored
 * at its bare purchase price, in silence, which is exactly how a missing cost
 * comes to look like a cheap tea.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  convertAmount,
  freightRefusalWords,
  splitByConvertibleFreight,
} from '../../src/admin/lib/intakeFreight';
import { stagedToProduct, type StagedItem } from '../../src/admin/lib/intakeMapping';

const ROOT = join(__dirname, '..', '..');

/* The live sandbox rates table, read on 2026-09-09. It holds no AUD row, which
   is the ordinary way a currency goes unresolvable: the shop keys it, the
   refresh covers it, and the row simply is not there yet. */
const RATES = [
  { currency: 'Yuan', rateToUSD: 6.728858 },
  { currency: 'NT', rateToUSD: 31.630012 },
  { currency: 'USD', rateToUSD: 1 },
];

const line = (over: Partial<StagedItem> = {}): StagedItem => ({
  id: 'l1', sourceId: 's1', givenName: 'Y562', chineseName: '', productName: 'Y562',
  type: 'Sheng', form: 'Cake', year: '1993', originCountry: 'China', originRegion: 'Yunnan',
  vendor: 'a vendor', costAmount: 100, costCurrency: 'Yuan', stockGrams: 357,
  quantityPurchased: 357, quantityUnits: 0, teawareCategory: '', sizeEstimate: 30,
  description: '', imageUrl: '', isPersonal: false, needsReview: false, include: true,
  order: {}, ...over,
});

describe('a share of the shipping is added, or the line is refused', () => {
  it('reads a share into another currency at the shop rate', () => {
    // 60 yuan of freight, read as Taiwan dollars: 60 / 6.728858 x 31.630012.
    expect(convertAmount(60, 'Yuan', 'NT', RATES)).toBeCloseTo(282.04, 2);
    // Spelled either way, because 'CNY' and 'Yuan' are the same money.
    expect(convertAmount(60, 'CNY', 'NT', RATES)).toBeCloseTo(282.04, 2);
  });

  it('needs no rate when the money is the same either side', () => {
    expect(convertAmount(60, 'Yuan', 'Yuan', RATES)).toBe(60);
    expect(convertAmount(60, 'CNY', 'Yuan', RATES)).toBe(60);
    // And an empty rate table does not stop an ordinary single-currency batch.
    expect(convertAmount(60, 'NT', 'NT', [])).toBe(60);
  });

  it('refuses rather than answering a number for a currency it cannot read', () => {
    expect(convertAmount(60, 'Yuan', 'AUD', RATES)).toBeNull();
    expect(convertAmount(60, 'AUD', 'Yuan', RATES)).toBeNull();
    expect(convertAmount(60, 'Yuan', 'NT', [])).toBeNull();
    // Never NaN. NaN is falsy, and every reader of this number takes `|| 0`.
    for (const answer of [
      convertAmount(60, 'Yuan', 'AUD', RATES),
      convertAmount(60, 'AUD', 'Yuan', RATES),
    ]) {
      expect(Number.isNaN(answer as number)).toBe(false);
    }
  });

  it('costs nothing when there is no shipping to spread', () => {
    // A batch with no freight has nothing to lose, so an unresolvable currency
    // must not cost the operator the import.
    expect(convertAmount(0, 'Yuan', 'AUD', RATES)).toBe(0);
    const split = splitByConvertibleFreight([line({ costCurrency: 'AUD' })], 'Yuan', () => 0, RATES);
    expect(split.unconvertible.size).toBe(0);
    expect(split.priced).toHaveLength(1);
    expect(split.priced[0].extra).toBe(0);
  });

  it('keeps the line out of the import rather than storing it cheaper than it was bought', () => {
    const items = [
      line({ id: 'a', costCurrency: 'Yuan', costAmount: 1200 }),
      line({ id: 'b', costCurrency: 'AUD', costAmount: 100 }),
    ];
    const { priced, unconvertible } = splitByConvertibleFreight(items, 'Yuan', () => 60, RATES);

    expect(priced.map((p) => p.it.id)).toEqual(['a']);
    expect(priced[0].extra).toBe(60);
    expect(unconvertible.get('AUD')).toBe(1);

    // The line that was kept carries its share; the refused one is not sent at
    // all, so nothing is stored at a cost nobody paid.
    expect(stagedToProduct(priced[0].it, priced[0].extra).cost_amount).toBe(1260);
    expect(priced.some((p) => p.it.id === 'b')).toBe(false);
  });

  it('a cost with no currency on it takes its share in the shipping currency, as it always did', () => {
    const { priced, unconvertible } = splitByConvertibleFreight(
      [line({ costCurrency: 'UNK', costAmount: 40 })], 'Yuan', () => 60, RATES,
    );
    expect(unconvertible.size).toBe(0);
    expect(priced[0].extra).toBe(60);
    expect(stagedToProduct(priced[0].it, priced[0].extra).cost_amount).toBe(100);
  });

  it('says what is wrong in the words of the thing to fix', () => {
    const words = freightRefusalWords(new Map([['AUD', 2], ['MYR', 1]]));
    // Plural for several lines, singular for one, so it reads as English and
    // not as a template: "2 lines in AUD", never "2 in AUD".
    expect(words).toContain('2 lines in AUD');
    expect(words).toContain('1 line in MYR');
    expect(words).toContain('Currency page');
    // No column names and no jargon: this sentence is read by Adrian.
    expect(words).not.toMatch(/cost_currency|NaN|null|rateToUSD/);
  });

  it('the workspace refuses through this helper and sends only the priced lines', () => {
    /* The regression it replaces was invisible to a source scan, so this pins
       the wiring rather than the arithmetic: the products sent are built from
       the split's own list, and the refusal reaches the toast. */
    const src = readFileSync(join(ROOT, 'src/admin/views/IntakeWorkspace.tsx'), 'utf8');
    expect(src).toMatch(/splitByConvertibleFreight\(included, shipCur, shareShip, rates\)/);
    expect(src).toMatch(/priced\.map\(\(\{ it, extra \}\) => stagedToProduct\(it, extra\)\)/);
    expect(src).toMatch(/skipReasons\.add\(freightRefusalWords\(unconvertible\)\)/);
    // The NaN converter is gone, and so is the comment that vouched for it.
    expect(src).not.toMatch(/\?\?\s*NaN/);
    expect(src).not.toMatch(/NaN\s+surfaces as a dash/);
  });

  it('nothing is cleared when every line was refused', () => {
    // Clearing the staged rows after importing none of them takes away the only
    // screen the operator could have fixed them on.
    const src = readFileSync(join(ROOT, 'src/admin/views/IntakeWorkspace.tsx'), 'utf8');
    const guard = src.indexOf('if (products.length === 0)');
    // The last one is the commit's own; the earlier two belong to the reset
    // handlers, which are meant to clear.
    const clear = src.lastIndexOf('setSources([]); setItems([]);');
    expect(guard).toBeGreaterThan(-1);
    expect(clear).toBeGreaterThan(guard);
  });
});
