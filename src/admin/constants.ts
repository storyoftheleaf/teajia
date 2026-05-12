import { ExchangeRate } from './types';

export const INITIAL_RATES: ExchangeRate[] = [
  { currency: 'USD', rateToUSD: 1 },
  { currency: 'NT', rateToUSD: 32.3 },
  { currency: 'Yuan', rateToUSD: 7.2 },
  { currency: 'IDR', rateToUSD: 16210 },
  { currency: 'JPY', rateToUSD: 150.0 },
  { currency: 'MYR', rateToUSD: 4.7 }
];

// Shared status pill styles used by list views (Collections, Magazine, etc.).
// Keep visually identical across surfaces so status reads the same everywhere.
export const STATUS_PILL_STYLES: Record<string, string> = {
  draft:     'bg-tea-elevated text-tea-text-sec',
  active:    'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40',
  published: 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40',
  archived:  'bg-tea-elevated text-tea-text-dim',
};
