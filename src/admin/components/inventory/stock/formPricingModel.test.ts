import { describe, expect, it } from 'vitest';
import type { ExchangeRate } from '../../../types';
import { quoteGrams, sellUnitOf, TEA_PRICING, wholePieceOf } from '../../../../lib/teaPricing';
import { formPricingPreview, type FormPricingProduct } from './formPricingModel';

const rates: ExchangeRate[] = [{ currency: 'Yuan', rateToUSD: 7 }, { currency: 'USD', rateToUSD: 1 }];
const sample: FormPricingProduct = {
  type: 'Oolong', form: 'Cake', costAmount: 35, costCurrency: 'CNY', quantityPurchased: 50,
  shippingRatePerKg: null, fixedRetailPriceUSD: null, pieceWeightG: 357,
};

describe('form and purchased-weight pricing', () => {
  it('prices the purchased sample per gram, then sizes the full and half cake', () => {
    const result = formPricingPreview(sample, rates, 10);
    expect(result.calculatedPerGram).toBeCloseTo(.33);
    expect(result.retailPerGram).toBeCloseTo(.33);
    expect(result.fullPiece).toBeCloseTo(117.81);
    expect(result.halfPiece).toBeCloseTo(60.905);
    expect(result.hasFixedRetail).toBe(false);
  });

  it('does not use current stock as the purchase denominator or piece weight', () => {
    const original = { ...sample, stockGrams: 50 };
    const depleted = { ...sample, stockGrams: 3 };
    expect(formPricingPreview(original, rates, 10)).toEqual(formPricingPreview(depleted, rates, 10));
    expect(formPricingPreview({ ...sample, pieceWeightG: 100 }, rates, 10).calculatedPerGram)
      .toEqual(formPricingPreview(sample, rates, 10).calculatedPerGram);
  });

  it('follows changing shop freight unless the tea deliberately owns a rate, zero included', () => {
    expect(formPricingPreview(sample, rates, 20).calculatedPerGram).toBeCloseTo(.36);
    expect(formPricingPreview({ ...sample, shippingRatePerKg: 0 }, rates, 20).calculatedPerGram).toBeCloseTo(.3);
    expect(formPricingPreview({ ...sample, shippingRatePerKg: 70 }, rates, 20).calculatedPerGram).toBeCloseTo(.33);
    expect(formPricingPreview({ ...sample, shippingRatePerKg: undefined }, rates, 10)).toEqual(formPricingPreview(sample, rates, 10));
  });

  it('keeps a fixed retail of zero and separates it from calculated retail', () => {
    expect(formPricingPreview({ ...sample, fixedRetailPriceUSD: 0 }, rates, 10)).toEqual({
      calculatedPerGram: expect.closeTo(.33), retailPerGram: 0, fullPiece: 0, halfPiece: TEA_PRICING.handlingUsd, hasFixedRetail: true,
    });
    const fixed = formPricingPreview({ ...sample, fixedRetailPriceUSD: .5 }, rates, 10);
    expect(fixed.fullPiece).toBe(178.5);
    expect(fixed.halfPiece).toBe(91.25);
  });

  it('refuses a missing rate or missing purchased basis instead of inventing a price', () => {
    for (const product of [
      { ...sample, costCurrency: 'UNKNOWN' },
      { ...sample, quantityPurchased: 0 },
      { ...sample, quantityPurchased: undefined },
      { ...sample, quantityPurchased: NaN },
      { ...sample, costAmount: null },
      { ...sample, costAmount: NaN },
    ]) {
      const result = formPricingPreview(product as FormPricingProduct, rates, 10);
      expect(result).toEqual({ calculatedPerGram: null, retailPerGram: null, fullPiece: null, halfPiece: null, hasFixedRetail: false });
    }
    expect(formPricingPreview(sample, [], 10).calculatedPerGram).toBeNull();
  });

  it('can display an entered retail independently of an unknown purchase basis', () => {
    const result = formPricingPreview({ ...sample, quantityPurchased: 0, fixedRetailPriceUSD: 0 }, [], 10);
    expect(result).toEqual({ calculatedPerGram: null, retailPerGram: 0, fullPiece: 0, halfPiece: TEA_PRICING.handlingUsd, hasFixedRetail: true });
  });

  it('preserves explicitly free tea and the established unrecorded currency convention', () => {
    expect(formPricingPreview({ ...sample, costAmount: 0 }, rates, 10).calculatedPerGram).toBeCloseTo(.03);
    expect(formPricingPreview({ ...sample, costCurrency: 'UNK', costAmount: 5 }, [], 10).calculatedPerGram).toBeCloseTo(.33);
  });


  it('matches storefront quotes for pressed pieces, loose packs and sealed whole units', () => {
    for (const product of [
      { ...sample, form: 'Cake' as const },
      { ...sample, form: 'Loose' as const, pieceWeightG: 100 },
      { ...sample, form: 'Bag' as const, pieceWeightG: 100, soldInWholeUnits: true },
    ]) {
      const result = formPricingPreview(product, rates, 10);
      const unit = sellUnitOf(product.form, product.pieceWeightG!, product.soldInWholeUnits);
      const whole = unit ?? wholePieceOf(product.form, product.pieceWeightG!);
      const opts = { wholePieceGrams: whole?.grams };
      expect(result.fullPiece).toBe(quoteGrams(result.retailPerGram!, product.pieceWeightG!, opts).totalUsd);
      expect(result.halfPiece).toBe(product.soldInWholeUnits ? null : quoteGrams(result.retailPerGram!, product.pieceWeightG! / 2, opts).totalUsd);
    }
    const loose = formPricingPreview({ ...sample, form: 'Loose', pieceWeightG: 100 }, rates, 10);
    expect(loose.fullPiece).toBeCloseTo(35);
    expect(loose.halfPiece).toBeCloseTo(18.5);
    const sealed = formPricingPreview({ ...sample, form: 'Loose', pieceWeightG: 100, soldInWholeUnits: true }, rates, 10);
    expect(sealed.fullPiece).toBeCloseTo(33);
    expect(sealed.halfPiece).toBeNull();
  });

  it('requires a positive piece weight for full/half prices and does not price teaware by gram', () => {
    for (const pieceWeightG of [undefined, 0, -1, NaN]) {
      const result = formPricingPreview({ ...sample, pieceWeightG }, rates, 10);
      expect(result.retailPerGram).toBeCloseTo(.33);
      expect(result.fullPiece).toBeNull();
      expect(result.halfPiece).toBeNull();
    }
    expect(formPricingPreview({ ...sample, type: 'Teaware' }, rates, 10)).toEqual({
      calculatedPerGram: null, retailPerGram: null, fullPiece: null, halfPiece: null, hasFixedRetail: false,
    });
  });
});
