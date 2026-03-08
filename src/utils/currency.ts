import { CostCurrency } from '../types';

// Exchange rates relative to USD (1 USD = X of the currency)
// Users can update these manually in the app
export const DEFAULT_EXCHANGE_RATES: Record<CostCurrency, number> = {
  USD: 1,
  IDR: 16250, // Indonesian Rupiah
  CNY: 7.25, // Chinese Yuan
  TWD: 32.5, // New Taiwan Dollar
  MYR: 4.75, // Malaysian Ringgit
  HKD: 7.75, // Hong Kong Dollar
  JPY: 145, // Japanese Yen
};

export const CURRENCY_SYMBOLS: Record<CostCurrency, string> = {
  USD: '$',
  IDR: 'Rp',
  CNY: '¥',
  TWD: 'NT$',
  MYR: 'RM',
  HKD: 'HK$',
  JPY: '¥',
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
 * Convert cost from any currency to USD
 * @param amount - The cost amount
 * @param fromCurrency - The currency the amount is in
 * @param exchangeRates - Custom exchange rates (optional)
 * @returns The amount converted to USD
 */
export function convertToUSD(
  amount: number,
  fromCurrency: CostCurrency,
  exchangeRates: Record<CostCurrency, number> = DEFAULT_EXCHANGE_RATES
): number {
  if (fromCurrency === 'USD') {
    return amount;
  }
  const rate = exchangeRates[fromCurrency];
  return amount / rate;
}

/**
 * Convert cost from USD to another currency
 * @param amountUSD - The amount in USD
 * @param toCurrency - The currency to convert to
 * @param exchangeRates - Custom exchange rates (optional)
 * @returns The amount converted to the target currency
 */
export function convertFromUSD(
  amountUSD: number,
  toCurrency: CostCurrency,
  exchangeRates: Record<CostCurrency, number> = DEFAULT_EXCHANGE_RATES
): number {
  if (toCurrency === 'USD') {
    return amountUSD;
  }
  const rate = exchangeRates[toCurrency];
  return amountUSD * rate;
}

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

/**
 * Load exchange rates from localStorage or use defaults
 */
export function loadExchangeRates(): Record<CostCurrency, number> {
  const stored = localStorage.getItem('exchangeRates');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return DEFAULT_EXCHANGE_RATES;
    }
  }
  return DEFAULT_EXCHANGE_RATES;
}

/**
 * Save exchange rates to localStorage
 */
export function saveExchangeRates(rates: Record<CostCurrency, number>): void {
  localStorage.setItem('exchangeRates', JSON.stringify(rates));
}

/**
 * Fetch live exchange rates and save to localStorage
 * Falls back to existing rates if fetch fails
 */
export async function fetchAndSaveExchangeRates(): Promise<void> {
  const { fetchLiveExchangeRates } = await import('./exchangeRateApi');
  const rates = await fetchLiveExchangeRates();
  if (rates) {
    saveExchangeRates(rates);
  }
}
