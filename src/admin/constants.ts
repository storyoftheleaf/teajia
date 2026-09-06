
/**
 * There is no seeded rate table any more, deliberately.
 *
 * There used to be one here, and it was wrong: IDR 16210 against a market of
 * 17.5k, CNY 7.2, HKD 7.8, figures from 2024 that rendered on every boot before
 * the real rates arrived and stayed forever if they never did. A wrong price
 * shown confidently is worse than no price: nobody checks a number that looks
 * finished.
 *
 * The shop has exactly one rate table, `exchange_rates` in D1, refreshed daily
 * by the worker and served by `/api/rates`. When it has not loaded, or cannot
 * be reached, the shop shows its own USD rather than converting through a
 * guess. `useShopPrice` already does exactly that: `localised` is false when
 * the table is empty.
 */

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
