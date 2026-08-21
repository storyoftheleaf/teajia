export interface OrderExchangeRate {
  currency: string;
  rateToUSD: number;
}

export interface ConvertedOrderAmount {
  amount: number;
  currency: string;
  rate: number;
  converted: boolean;
}

export function convertOrderAmount(
  amountUsd: number,
  requestedCurrency: string | null | undefined,
  rates: readonly OrderExchangeRate[],
): ConvertedOrderAmount {
  if (!Number.isFinite(amountUsd) || amountUsd < 0) {
    throw new RangeError('Order amount must be a finite nonnegative USD value');
  }

  const currency = requestedCurrency?.trim().toUpperCase() || 'USD';
  if (currency === 'USD') {
    return { amount: amountUsd, currency: 'USD', rate: 1, converted: true };
  }

  const rate = rates.find(candidate => candidate.currency.toUpperCase() === currency)?.rateToUSD;
  if (!/^[A-Z]{3}$/.test(currency) || !Number.isFinite(rate) || (rate ?? 0) <= 0) {
    return { amount: amountUsd, currency: 'USD', rate: 1, converted: false };
  }

  const amount = amountUsd * rate!;
  if (!Number.isFinite(amount)) {
    return { amount: amountUsd, currency: 'USD', rate: 1, converted: false };
  }

  return { amount, currency, rate: rate!, converted: true };
}

export function formatOrderAmount(
  amountUsd: number,
  requestedCurrency: string | null | undefined,
  rates: readonly OrderExchangeRate[],
): string {
  const converted = convertOrderAmount(amountUsd, requestedCurrency, rates);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: converted.currency,
      maximumFractionDigits: 2,
    }).format(converted.amount);
  } catch {
    return `${converted.currency} ${converted.amount.toFixed(2)}`;
  }
}
