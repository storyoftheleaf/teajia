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

// Canonical 5-variant status pill set (matches DesignSystemShowcase §8).
// Use this for new list/table views. Pair with STATUS_PILL_BASE for the wrapper classes.
export type StatusPillVariant = 'draft' | 'active' | 'archived' | 'success' | 'error';

export const STATUS_PILL_VARIANTS: Record<StatusPillVariant, string> = {
  draft:    'bg-tea-elevated text-tea-text-sec',
  active:   'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40',
  archived: 'bg-tea-elevated text-tea-text-dim',
  success:  'bg-tea-green/10 text-tea-green ring-1 ring-inset ring-tea-green/40',
  error:    'bg-tea-error/10 text-tea-error ring-1 ring-inset ring-tea-error/40',
};

export const STATUS_PILL_BASE =
  'inline-flex items-center px-2 py-0.5 rounded-full text-ui-9 uppercase font-sans tracking-caps';
