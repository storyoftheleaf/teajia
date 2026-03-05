import { CostCurrency } from '../types';

/**
 * Fetch live exchange rates from exchangerate.host API
 * @returns Record of exchange rates relative to USD, or null on error
 */
export async function fetchLiveExchangeRates(): Promise<Record<CostCurrency, number> | null> {
  try {
    const response = await fetch('https://api.exchangerate.host/latest?base=USD');
    const data = await response.json();

    if (!data.success && data.rates === undefined) {
      console.error('Exchange rate API returned unsuccessful response');
      return null;
    }

    return {
      USD: 1,
      IDR: data.rates.IDR,
      CNY: data.rates.CNY,
      TWD: data.rates.TWD,
      MYR: data.rates.MYR,
      HKD: data.rates.HKD,
      JPY: data.rates.JPY
    };
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);
    return null;
  }
}
