import { describe, it, expect } from 'vitest';
import {
  TEA_PRICING,
  minimumOrderGrams,
  offeredSizes,
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
