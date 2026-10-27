import { isUnrecordedCurrency, rateToUsd, type RateRow } from '../../../../lib/currency';
import { shopRateInCurrency } from '../../../../lib/shippingRate';

export function freightSelection(mode: 'shop' | 'custom', input: string, currency: string, rates: readonly RateRow[]): { storedRate: number | null; error: string | null } {
  if (mode === 'shop') return { storedRate: null, error: null };
  const parsed = input.trim() === '' ? NaN : Number(input);
  if (!Number.isFinite(parsed) || parsed < 0) return { storedRate: null, error: 'Enter a rate of zero or more in USD per kg.' };
  const conversion = isUnrecordedCurrency(currency) ? 1 : rateToUsd(rates, currency);
  const storedRate = shopRateInCurrency(parsed, conversion);
  if (storedRate === null || !Number.isFinite(storedRate)) return { storedRate: null, error: `A current exchange rate for ${currency} is needed to save a custom rate.` };
  return { storedRate, error: null };
}
