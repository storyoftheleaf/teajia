import { canonicalCurrency, isUnrecordedCurrency } from './currency';

const SYMBOLS: Record<string, string> = {
  USD: '$', NT: 'NT$', Yuan: 'CN¥', IDR: 'Rp', JPY: 'JP¥', MYR: 'RM', HKD: 'HK$', AUD: 'A$',
};

export function formatSourceMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  const key = canonicalCurrency(currency);
  if (!key || isUnrecordedCurrency(key)) return 'Currency unrecorded: –';
  const prefix = Object.prototype.hasOwnProperty.call(SYMBOLS, key) ? SYMBOLS[key] : `${key} `;
  if (amount == null || !Number.isFinite(amount) || amount < 0) return `${prefix}–`;
  const decimals = ['NT', 'IDR', 'JPY'].includes(key) ? 0 : 2;
  return `${prefix}${amount.toLocaleString(undefined, {minimumFractionDigits: decimals, maximumFractionDigits: decimals})}`;
}

export interface RecordedMoney {
  amount: number | null | undefined;
  currency: string | null | undefined;
}

export function groupRecordedMoney(rows: readonly RecordedMoney[]) {
  const groups = new Map<string, {currency: string; amount: number | null}>();
  for (const row of rows) {
    const currency = canonicalCurrency(row.currency) || 'UNK';
    const group = groups.get(currency) || {currency, amount: 0};
    const known = row.amount != null && Number.isFinite(row.amount) && row.amount >= 0 && !isUnrecordedCurrency(currency);
    group.amount = group.amount === null || !known ? null : group.amount + row.amount!;
    if (!Number.isFinite(group.amount)) group.amount = null;
    groups.set(currency, group);
  }
  return [...groups.values()].map(group => ({
    currency: group.currency,
    amount: group.amount,
  }));
}
