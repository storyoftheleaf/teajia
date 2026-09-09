import { describe, it, expect } from 'vitest';
import {
  TEA_PRICING,
  minimumOrderGrams,
  offeredSizes,
  quoteForDisplay,
  quoteGrams,
  sellUnitOf,
  snapToUnit,
  wholePieceOf,
} from './teaPricing';

/**
 * A shop that cannot open the box must not offer half of one.
 *
 * The 1993 Y562 arrives as a sealed 100 g box. The ladder offered 10 g of it,
 * priced that, and would have taken the order: an amount a reader could choose
 * and nobody could send. These pin the rule that replaced it, on the arithmetic
 * as much as the shape, because a wrong minimum is a wrong price too.
 */

const UNIT = 100;
const PER_GRAM = 0.6; // roughly the Y562, in the record currency

describe('a tea sold only in whole units', () => {
  it('is not a unit tea until the operator says so', () => {
    expect(sellUnitOf('Loose Leaf', UNIT, false)).toBeUndefined();
    expect(sellUnitOf('Loose Leaf', UNIT, undefined)).toBeUndefined();
  });

  it('is not a unit tea without a weight to count in', () => {
    expect(sellUnitOf('Box', undefined, true)).toBeUndefined();
    expect(sellUnitOf('Box', 0, true)).toBeUndefined();
  });

  it('names the unit from the form, and falls back rather than inventing one', () => {
    expect(sellUnitOf('Box', UNIT, true)).toEqual({ label: 'Box', grams: UNIT });
    expect(sellUnitOf('Cake', 357, true)).toEqual({ label: 'Cake', grams: 357 });
    expect(sellUnitOf('Loose Leaf', UNIT, true)).toEqual({ label: 'Unit', grams: UNIT });
  });

  it('offers whole units and nothing below one', () => {
    const sizes = offeredSizes(PER_GRAM, 1000, { unitGrams: UNIT, wholePieceGrams: UNIT });
    expect(sizes.map(q => q.grams)).toEqual([100, 200, 300, 400]);
  });

  it('offers only what is in stock', () => {
    const sizes = offeredSizes(PER_GRAM, 250, { unitGrams: UNIT, wholePieceGrams: UNIT });
    expect(sizes.map(q => q.grams)).toEqual([100, 200]);
  });

  it('keeps the one box on offer even when it is cheap', () => {
    // The minimum-total rule would drop a rung worth less than $5. On a unit
    // tea there is nothing smaller to fall back to, so dropping it would leave
    // the tea listed with nothing anyone could buy.
    const cheap = 0.01;
    expect(quoteGrams(cheap, UNIT, {}).totalUsd).toBeLessThan(TEA_PRICING.minTotalUsd);
    const sizes = offeredSizes(cheap, 300, { unitGrams: UNIT, wholePieceGrams: UNIT });
    expect(sizes.map(q => q.grams)).toEqual([100, 200, 300]);
  });

  it('leaves every other tea on the ordinary ladder', () => {
    const withUnit = offeredSizes(PER_GRAM, 1000, { unitGrams: UNIT });
    const without = offeredSizes(PER_GRAM, 1000, {});
    expect(without.map(q => q.grams)).not.toEqual(withUnit.map(q => q.grams));
    expect(without.map(q => q.grams)).toEqual(
      TEA_PRICING.sizesG.filter(g => quoteGrams(PER_GRAM, g, {}).totalUsd >= TEA_PRICING.minTotalUsd),
    );
  });
});

describe('the minimum a reader can order', () => {
  it('is one unit for a sealed tea', () => {
    expect(minimumOrderGrams(UNIT)).toBe(UNIT);
  });

  it('is the shop floor for everything else', () => {
    expect(minimumOrderGrams()).toBe(Math.min(...TEA_PRICING.sizesG));
    expect(minimumOrderGrams(0)).toBe(Math.min(...TEA_PRICING.sizesG));
  });
});

describe('rounding an amount to something sendable', () => {
  it('rounds up, never down, so nobody is quietly handed less than they asked for', () => {
    expect(snapToUnit(130, UNIT, 1000)).toBe(200);
    expect(snapToUnit(101, UNIT, 1000)).toBe(200);
    expect(snapToUnit(200, UNIT, 1000)).toBe(200);
  });

  it('never lands below one unit', () => {
    expect(snapToUnit(5, UNIT, 1000)).toBe(UNIT);
    expect(snapToUnit(0, UNIT, 1000)).toBe(UNIT);
  });

  it('never lands above what is on the shelf', () => {
    expect(snapToUnit(900, UNIT, 250)).toBe(200);
  });

  it('leaves a weighed tea alone', () => {
    expect(snapToUnit(37, 0, 1000)).toBe(37);
  });
});

describe('the discount curve stops at one whole thing', () => {
  // The curve spreads one handling amount across the grams in an order, so the
  // rate eases as the amount grows. That reasoning runs out at the piece:
  // nothing is opened to send a cake, so a cake is the cheapest a gram gets,
  // and two cakes are two of those. The shop was doing the opposite, quoting
  // 200 g of a 100 g box below the box itself.
  const CAKE = 357;
  const RATE = 0.2;

  it('charges no handling on any number of whole pieces', () => {
    for (const n of [1, 2, 3]) {
      const q = quoteGrams(RATE, CAKE * n, { wholePieceGrams: CAKE });
      expect(q.whole).toBe(true);
      expect(q.totalUsd).toBeCloseTo(RATE * CAKE * n, 10);
    }
  });

  it('never lets a bigger order beat one piece on rate', () => {
    const one = quoteGrams(RATE, CAKE, { wholePieceGrams: CAKE });
    for (const n of [2, 3, 4]) {
      const many = quoteGrams(RATE, CAKE * n, { wholePieceGrams: CAKE });
      expect(many.perGramUsd).toBeCloseTo(one.perGramUsd, 10);
    }
  });

  it('is the shop 100 g box, which used to cost more per gram than two of itself', () => {
    const box = 100;
    const one = quoteGrams(RATE, box, { wholePieceGrams: box });
    const two = quoteGrams(RATE, box * 2, { wholePieceGrams: box });
    expect(two.perGramUsd).toBeCloseTo(one.perGramUsd, 10);
    expect(two.totalUsd).toBeCloseTo(one.totalUsd * 2, 10);
  });

  it('still charges handling below one piece, where the leaf is weighed out', () => {
    const half = quoteGrams(RATE, 50, { wholePieceGrams: CAKE });
    expect(half.whole).toBe(false);
    expect(half.totalUsd).toBeCloseTo(RATE * 50 + TEA_PRICING.handlingUsd, 10);
    expect(half.perGramUsd).toBeGreaterThan(quoteGrams(RATE, CAKE, { wholePieceGrams: CAKE }).perGramUsd);
  });

  it('charges it once on a remainder above a piece, which is weighed out too', () => {
    const q = quoteGrams(RATE, CAKE + 40, { wholePieceGrams: CAKE });
    expect(q.whole).toBe(false);
    expect(q.totalUsd).toBeCloseTo(RATE * (CAKE + 40) + TEA_PRICING.handlingUsd, 10);
  });

  it('leaves loose leaf on the curve all the way up, having no piece to stop at', () => {
    const small = quoteGrams(RATE, 25, {});
    const large = quoteGrams(RATE, 400, {});
    expect(small.whole).toBe(false);
    expect(large.whole).toBe(false);
    expect(large.perGramUsd).toBeLessThan(small.perGramUsd);
  });
});

describe('what a sealed unit costs', () => {
  it('carries no handling, because nothing is opened or repacked', () => {
    const one = quoteGrams(PER_GRAM, UNIT, { wholePieceGrams: UNIT });
    expect(one.whole).toBe(true);
    expect(one.totalUsd).toBe(PER_GRAM * UNIT);
  });

  it('still reads as a whole piece for pressed tea, which is unchanged', () => {
    expect(wholePieceOf('Cake', 357)).toEqual({ label: 'Cake', grams: 357 });
    expect(wholePieceOf('Tuo', 5)).toBeUndefined();
  });
});

/**
 * The one figure the shop grid, the product page's ladder, the cart and the
 * order total all name for a chosen weight. The grid used to work this out
 * on its own with a bare multiplication, which is the same shape of bug the
 * whole-piece curve above exists to prevent, just for the handling fee
 * instead of the discount: it disagreed with everything downstream of it by
 * exactly the $2 the ladder adds and the grid did not.
 */
describe('quoteForDisplay, the one quote every surface reads', () => {
  it('matches quoteGrams for ordinary loose leaf, handling fee included', () => {
    const q = quoteForDisplay(0.25, 100, { stockG: 1000 });
    expect(q.totalUsd).toBe(quoteGrams(0.25, 100, {}).totalUsd);
    expect(q.totalUsd).toBe(27); // 0.25 * 100 + the $2 handling fee
    expect(q.grams).toBe(100);
  });

  it('rounds a sealed unit tea up to the unit it can actually send', () => {
    // Asked for 50g of a tea sold only in 100g boxes, the reader cannot be
    // quoted 50g: the shop cannot open the box. The same rounding the
    // product page's own slider applies before it ever prices anything.
    const q = quoteForDisplay(0.6, 50, {
      form: 'Box',
      pieceWeightG: 100,
      soldInWholeUnits: true,
      stockG: 1000,
    });
    expect(q.grams).toBe(100);
    expect(q.whole).toBe(true);
    expect(q.totalUsd).toBe(60); // one box, no handling fee
  });

  it('never rounds a sealed unit tea past what is on the shelf', () => {
    const q = quoteForDisplay(0.6, 250, {
      form: 'Box',
      pieceWeightG: 100,
      soldInWholeUnits: true,
      stockG: 150,
    });
    expect(q.grams).toBe(100);
  });

  it('charges the handling fee below a pressed piece, same as the ladder', () => {
    const q = quoteForDisplay(0.2, 50, { form: 'Cake', pieceWeightG: 357, stockG: 1000 });
    expect(q.whole).toBe(false);
    expect(q.totalUsd).toBeCloseTo(0.2 * 50 + TEA_PRICING.handlingUsd, 10);
  });
});
