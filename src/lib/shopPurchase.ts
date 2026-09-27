import type { InventoryItem } from '../types';
import { minimumOrderGrams, quoteGrams, sellUnitOf, snapToUnit, wholePieceOf } from './teaPricing';

/** One complete pack quote, shared by the catalogue and product page. */
export function teaPurchaseQuote(item: InventoryItem, preferredGrams = 50) {
  const pricePerGram = Number.parseFloat(item.price_per_gram ?? '');
  const stock = Math.floor(item.stock_g ?? 0);
  const sellUnit = sellUnitOf(item.form, item.pieceWeightG, item.soldInWholeUnits);
  const minimum = minimumOrderGrams(sellUnit?.grams);
  if (!Number.isFinite(pricePerGram) || pricePerGram < 0 || stock < minimum) return null;
  const requested = Number.isFinite(preferredGrams) ? Math.round(preferredGrams) : minimum;
  const grams = sellUnit
    ? snapToUnit(requested, sellUnit.grams, stock)
    : Math.min(stock, Math.max(minimum, requested));
  const wholePiece = sellUnit ?? wholePieceOf(item.form, item.pieceWeightG);
  const quote = quoteGrams(pricePerGram, grams, { wholePieceGrams: wholePiece?.grams });
  return {
    grams,
    totalUsd: Math.ceil(quote.totalUsd),
    unitGrams: sellUnit?.grams,
    wholePieceGrams: wholePiece?.grams,
  };
}
