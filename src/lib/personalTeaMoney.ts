import { isoCurrencyCode, knownCurrency, SHOP_CURRENCY_KEYS } from './currency';

export const personalTeaCurrencies = SHOP_CURRENCY_KEYS.filter(currency => currency !== 'UNK');

function moneyFormat(currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: isoCurrencyCode(currency),
    currencyDisplay: 'code',
  });
}

export function readPersonalTeaMoney(amount: unknown, currency: unknown) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || typeof currency !== 'string') return null;
  const key = knownCurrency(currency);
  if (!key || key === 'UNK') return null;
  const places = moneyFormat(key).resolvedOptions().maximumFractionDigits ?? 2;
  if (Number(amount.toFixed(places)) !== amount || !Number.isSafeInteger(Math.round(amount * 10 ** places))) return null;
  return { amount, currency: key };
}

export function formatPersonalTeaMoney(amount: number, currency: string): string {
  return moneyFormat(currency).format(amount);
}
