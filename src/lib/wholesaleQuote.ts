import { isUnrecordedCurrency, sameCurrency } from './currency';

export function wholesaleCurrenciesMatch(left: string, right: string): boolean {
  return !isUnrecordedCurrency(left) && !isUnrecordedCurrency(right)
    && sameCurrency(left, right);
}

export function wholesaleLineTotal(grams: number, pricePerGram: number): number {
  return grams * pricePerGram;
}
