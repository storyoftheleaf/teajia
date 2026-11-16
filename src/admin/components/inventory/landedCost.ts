import { sameCurrency } from '../../../lib/currency';

/**
 * The per-line landed figure: paid cost plus allocated freight. Only meaningful
 * when both are in the same money, and 'CNY' and 'Yuan' are the same money, so
 * the two currencies are compared through the shop's alias map, never as strings.
 */
export function landedCost(
  costAmount: number | null | undefined,
  costCurrency: string | null | undefined,
  allocatedFreight: number | null | undefined,
  freightCurrency: string | null | undefined,
): number | null {
  if (costAmount == null || allocatedFreight == null) return null;
  if (!sameCurrency(costCurrency, freightCurrency)) return null;
  return costAmount + allocatedFreight;
}
