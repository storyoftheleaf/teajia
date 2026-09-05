import { ExchangeRate } from './types';

/**
 * Seeded rates, so a screen renders before anything has been fetched.
 *
 * Every one carries `lastUpdated: null`, which is the whole point: it marks
 * them as never refreshed, so a surface can tell a live rate from a guess. The
 * figures below are from 2024 and several are already visibly wrong (IDR sat at
 * 16210 against a market of 17.5k), which is harmless as a placeholder and was
 * not harmless when it was indistinguishable from a current rate.
 */
export const INITIAL_RATES: ExchangeRate[] = [
  { currency: 'USD', rateToUSD: 1, lastUpdated: null },
  { currency: 'NT', rateToUSD: 32.3, lastUpdated: null },
  { currency: 'Yuan', rateToUSD: 7.2, lastUpdated: null },
  { currency: 'IDR', rateToUSD: 16210, lastUpdated: null },
  { currency: 'JPY', rateToUSD: 150.0, lastUpdated: null },
  { currency: 'MYR', rateToUSD: 4.7, lastUpdated: null },
  { currency: 'AUD', rateToUSD: 1.55, lastUpdated: null },
  { currency: 'HKD', rateToUSD: 7.8, lastUpdated: null }
];

// Shared status pill styles used by list views (Collections, Magazine, etc.).
// Keep visually identical across surfaces so status reads the same everywhere.
export const STATUS_PILL_STYLES: Record<string, string> = {
  draft:     'bg-tea-elevated text-tea-text-sec',
  active:    'bg-tea-gold/12 text-tea-text',
  published: 'bg-tea-gold/12 text-tea-text',
  archived:  'bg-tea-elevated text-tea-text-dim',
};

// Canonical 5-variant status pill set (matches DesignSystemShowcase §8).
// Use this for new list/table views. Pair with STATUS_PILL_BASE for the wrapper classes.
export type StatusPillVariant = 'draft' | 'active' | 'archived' | 'success' | 'error';

export const STATUS_PILL_VARIANTS: Record<StatusPillVariant, string> = {
  draft:    'bg-tea-elevated text-tea-text-sec',
  active:   'bg-tea-gold/12 text-tea-text',
  archived: 'bg-tea-elevated text-tea-text-dim',
  success:  'bg-tea-green/15 text-tea-green',
  error:    'bg-tea-error/15 text-tea-error',
};

export const STATUS_PILL_BASE =
  'inline-flex items-center px-2 py-0.5 rounded-full text-ui-9 uppercase font-sans tracking-caps';
