import { CostCurrency } from '../types';

/**
 * Currency names and symbols. Not rates.
 *
 * This module used to carry its own exchange table (CNY 7.25, IDR 16250, HKD
 * 7.75) beside a `fetchAndSaveExchangeRates` that had been stubbed out to
 * return null, so nothing ever refreshed it and nothing ever wrote the
 * localStorage key it read from. Those numbers disagreed with the shop's real
 * ones (7.2, 16210, 7.8) and were keyed by ISO code where the shop keys CNY as
 * 'Yuan', which is how two tables end up in one app without either looking
 * wrong.
 *
 * The shop has one rate table: `exchange_rates` in D1, refreshed daily by the
 * worker, served by `/api/rates`, read through `useRates` in
 * `src/admin/hooks/useAdminData.ts`. Everything that converts money reads that,
 * including `useShopPrice` for the storefront and the freight rate in Store
 * Settings. A symbol does not go stale, so the maps below stay here.
 */

export const CURRENCY_SYMBOLS: Record<CostCurrency, string> = {
  USD: '$',
  IDR: 'Rp',
  CNY: 'CN¥',
  TWD: 'NT$',
  MYR: 'RM',
  HKD: 'HK$',
  JPY: 'JP¥',
};

export const CURRENCY_NAMES: Record<CostCurrency, string> = {
  USD: 'US Dollar',
  IDR: 'Indonesian Rupiah',
  CNY: 'Chinese Yuan',
  TWD: 'New Taiwan Dollar',
  MYR: 'Malaysian Ringgit',
  HKD: 'Hong Kong Dollar',
  JPY: 'Japanese Yen',
};

/**
 * Format a price with currency symbol
 * @param amount - The amount to format
 * @param currency - The currency type
 * @returns Formatted string like "$100.00" or "¥725.00"
 */
export function formatPrice(amount: number, currency: CostCurrency = 'USD'): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const formatted = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol}${formatted}`;
}
