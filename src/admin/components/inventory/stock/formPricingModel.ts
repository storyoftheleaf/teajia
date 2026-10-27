import type { ExchangeRate, Product } from '../../../types';
import { calculatePricing } from '../../../utils';
import { isUnrecordedCurrency, rateToUsd } from '../../../../lib/currency';
import { shippingRateUsdFor, shopRateInCurrency } from '../../../../lib/shippingRate';
import { quoteGrams, sellUnitOf, wholePieceOf } from '../../../../lib/teaPricing';

export type FormPricingProduct = Pick<Product,
  'type' | 'costCurrency' | 'shippingRatePerKg' | 'fixedRetailPriceUSD' | 'form' | 'soldInWholeUnits'
> & { costAmount: number | null; quantityPurchased: number | null; pieceWeightG?: number | null };

export interface FormPricingPreview {
  calculatedPerGram: number | null;
  retailPerGram: number | null;
  fullPiece: number | null;
  halfPiece: number | null;
  hasFixedRetail: boolean;
}

const nonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const positive = (value: unknown): value is number => nonnegative(value) && value > 0;

/**
 * The paid amount covers quantityPurchased grams, even when that purchase was
 * only a sample of a larger cake. Full/half prices use the storefront's
 * quote contract, including handling for weighed portions and whole-unit rules;
 * today's on-hand stock is deliberately absent from this pricing boundary.
 */
export function formPricingPreview(
  product: FormPricingProduct,
  rates: readonly ExchangeRate[],
  shopFreightPerKgUsd: number,
): FormPricingPreview {
  const hasFixedRetail = nonnegative(product.fixedRetailPriceUSD);
  const empty: FormPricingPreview = {
    calculatedPerGram: null, retailPerGram: null, fullPiece: null, halfPiece: null, hasFixedRetail,
  };
  // Teaware has a price per item rather than a price per gram.
  if (product.type === 'Teaware') return empty;

  const conversion = isUnrecordedCurrency(product.costCurrency) ? 1 : rateToUsd(rates, product.costCurrency);
  const freightUsd = shippingRateUsdFor(product.shippingRatePerKg, conversion, shopFreightPerKgUsd);
  const freightInCostCurrency = freightUsd !== null && nonnegative(freightUsd)
    ? shopRateInCurrency(freightUsd, conversion)
    : null;
  let calculatedPerGram: number | null = null;
  if (conversion !== null && freightInCostCurrency !== null &&
      nonnegative(product.costAmount) && positive(product.quantityPurchased)) {
    const pricing = calculatePricing(product.costAmount, freightInCostCurrency,
      product.quantityPurchased, product.costCurrency, [...rates]);
    if (pricing.rateUsed > 0 && nonnegative(pricing.suggestedRetailUSD)) {
      calculatedPerGram = pricing.suggestedRetailUSD;
    }
  }
  const retailPerGram = hasFixedRetail ? product.fixedRetailPriceUSD! : calculatedPerGram;
  const pieceWeightG = positive(product.pieceWeightG) ? product.pieceWeightG : undefined;
  const sellUnit = sellUnitOf(product.form, pieceWeightG, product.soldInWholeUnits);
  const wholePiece = sellUnit ?? wholePieceOf(product.form, pieceWeightG);
  const quoteOptions = { wholePieceGrams: wholePiece?.grams };
  const fullPiece = retailPerGram !== null && pieceWeightG !== undefined
    ? quoteGrams(retailPerGram, pieceWeightG, quoteOptions).totalUsd
    : null;
  const halfPiece = retailPerGram !== null && pieceWeightG !== undefined && !product.soldInWholeUnits
    ? quoteGrams(retailPerGram, pieceWeightG / 2, quoteOptions).totalUsd
    : null;
  return { calculatedPerGram, retailPerGram, fullPiece, halfPiece, hasFixedRetail };
}
