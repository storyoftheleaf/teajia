import { isUnrecordedCurrency, rateToUsd } from '../../../../lib/currency';
import { shippingRateUsdFor, shopRateInCurrency } from '../../../../lib/shippingRate';
import { calculatePricing } from '../../../utils';
import type { ExchangeRate, Product } from '../../../types';

/**
 * A tea's own freight rate is no longer typed anywhere (Adrian, 2026-11-27:
 * freight prices live in Logistics). A tea that already carries one keeps it,
 * and keeps its price, until it is cleared. Clearing hands it back to its
 * logistics service or the shop default, and this is the price before and
 * after, so the change is shown before it applies.
 */
export interface FreightClearPreview {
  /** USD a kilo the tea's own rate is worth today, or null without a conversion. */
  ownPerKgUsd: number | null;
  /** Calculated retail a gram now, and once cleared; null when it cannot be priced. */
  before: number | null;
  after: number | null;
}

type Priced = Pick<Product, 'type' | 'costAmount' | 'costCurrency' | 'quantityPurchased' | 'shippingRatePerKg'>;

export function freightClearPreview(product: Priced, rates: ExchangeRate[], fallbackPerKgUsd: number | null): FreightClearPreview {
  const conversion = isUnrecordedCurrency(product.costCurrency) ? 1 : rateToUsd(rates, product.costCurrency);
  const priceWith = (storedRate: number | null) => {
    if (storedRate === null || conversion === null || product.costAmount == null || !(product.quantityPurchased > 0)) return null;
    const calc = calculatePricing(product.costAmount, storedRate, product.quantityPurchased, product.costCurrency || 'UNK', rates, product.type === 'Teaware');
    return calc.suggestedRetailUSD > 0 ? calc.suggestedRetailUSD : null;
  };
  return {
    ownPerKgUsd: product.shippingRatePerKg == null ? null : shippingRateUsdFor(product.shippingRatePerKg, conversion, fallbackPerKgUsd),
    before: priceWith(product.shippingRatePerKg ?? shopRateInCurrency(fallbackPerKgUsd, conversion)),
    after: priceWith(shopRateInCurrency(fallbackPerKgUsd, conversion)),
  };
}

const usd = (value: number | null) => value === null ? '—' : `$${value.toFixed(2)}`;

/** "$0.42 → $0.40 a gram", or the reason there is no figure. */
export function clearPriceLine(preview: FreightClearPreview): string {
  if (preview.before === null && preview.after === null) return 'Retail cannot be calculated yet.';
  return `${usd(preview.before)} → ${usd(preview.after)} a gram`;
}
