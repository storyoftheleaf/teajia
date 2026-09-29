import { useEffect, useMemo, useRef, useState } from 'react';
import type { InventoryItem } from '../../types';
import { teaPurchaseQuote } from '../../lib/shopPurchase';
import { TEA_PRICING } from '../../lib/teaPricing';

export interface WeighOption {
  grams: number;
  totalUsd: number;
}

/**
 * The amounts one tea can be bought in from the list, smallest first. They are
 * the shop's own sizes run through the same quote the cart and product page
 * use, so a sealed tea snaps to whole pieces and nothing past the stock is
 * offered. Sizes that snap to the same amount collapse to one.
 */
export function weighOptions(item: InventoryItem): WeighOption[] {
  const seen = new Set<number>();
  const options: WeighOption[] = [];
  for (const size of TEA_PRICING.sizesG) {
    const quote = teaPurchaseQuote(item, size);
    if (!quote || seen.has(quote.grams)) continue;
    seen.add(quote.grams);
    options.push({ grams: quote.grams, totalUsd: quote.totalUsd });
  }
  return options.sort((a, b) => a.grams - b.grams);
}

/** Index of the option closest to the weight the shop header is pricing at. */
export function startingIndex(options: WeighOption[], preferredGrams: number): number {
  let best = 0;
  options.forEach((option, index) => {
    if (Math.abs(option.grams - preferredGrams) < Math.abs(options[best].grams - preferredGrams)) best = index;
  });
  return best;
}

interface TeaWeighControlProps {
  item: InventoryItem;
  preferredGrams: number;
  formatPrice: (usd: number) => string;
  onAddToCart?: (item: InventoryItem, grams: number, totalUsd: number) => void;
  /** Weigh itself is a button: it opens the full amount list, custom sizes included. */
  onChooseAmount?: (item: InventoryItem) => void;
}

/**
 * Price on top, weight underneath. The top line adds exactly what it says to
 * the cart; minus and plus step through the amounts and the price follows.
 * Weigh itself opens the full amount list, for a size the steps do not reach.
 */
export function TeaWeighControl({ item, preferredGrams, formatPrice, onAddToCart, onChooseAmount }: TeaWeighControlProps) {
  const options = useMemo(() => weighOptions(item), [item]);
  const [index, setIndex] = useState(() => startingIndex(options, preferredGrams));
  const [added, setAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => setIndex(startingIndex(options, preferredGrams)), [options, preferredGrams]);
  useEffect(() => () => clearTimeout(addedTimer.current), []);

  const current = options[Math.min(index, options.length - 1)];
  if (!current) return null;

  const atMin = index <= 0;
  const atMax = index >= options.length - 1;
  const step = (delta: number) => (event: React.MouseEvent) => {
    event.stopPropagation();
    setIndex(value => Math.max(0, Math.min(options.length - 1, value + delta)));
  };
  const stopKeys = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
  };
  // The box is drawn at 24px; the before: layer widens the hit area to 44px
  // without growing the box, which tap-target would do.
  const stepClass = 'relative inline-flex h-6 w-6 before:absolute before:-inset-2.5 before:content-[\'\'] items-center justify-center rounded border border-tea-border text-ui-14 leading-none transition-colors disabled:cursor-default disabled:opacity-40 focus-visible:outline focus-visible:outline-tea-gold';

  return (
    <div className="flex w-[112px] flex-col items-stretch gap-1.5">
      <button
        type="button"
        disabled={!onAddToCart}
        aria-label={`Add ${current.grams}g of ${item.name} to cart`}
        title="Add to cart"
        onClick={event => {
          event.stopPropagation();
          if (!onAddToCart) return;
          onAddToCart(item, current.grams, current.totalUsd);
          setAdded(true);
          clearTimeout(addedTimer.current);
          addedTimer.current = setTimeout(() => setAdded(false), 1500);
        }}
        onKeyDown={stopKeys}
        className="flex h-8 items-baseline justify-center gap-1 whitespace-nowrap rounded-md border border-tea-border px-1 pt-[8px] transition-colors enabled:hover:border-tea-gold enabled:hover:bg-tea-accent-sub focus-visible:outline focus-visible:outline-tea-gold"
      >
        {added ? (
          <span className="text-ui-12 text-tea-gold-lt" aria-live="polite">Added</span>
        ) : (
          <>
            <span data-testid="grid-price" className="num text-ui-12 font-medium tabular-nums text-tea-text">
              {formatPrice(current.totalUsd)}
            </span>
            <span className="num text-ui-12 tabular-nums text-tea-text-dim">{current.grams}g</span>
          </>
        )}
      </button>

      {(options.length > 1 || onChooseAmount) && (
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Weigh less" disabled={atMin} onClick={step(-1)} onKeyDown={stopKeys} className={`${stepClass} text-tea-text-dim enabled:hover:border-tea-gold`}>
            &minus;
          </button>
          <button
            type="button"
            disabled={!onChooseAmount}
            aria-label={`Choose amount for ${item.name}`}
            aria-haspopup="dialog"
            title="All amounts"
            onClick={event => {
              event.stopPropagation();
              onChooseAmount?.(item);
            }}
            onKeyDown={stopKeys}
            className="group rounded px-1.5 py-1 focus-visible:outline focus-visible:outline-tea-gold"
          >
            <span className="text-ui-9 uppercase tracking-[0.12em] text-tea-text-dim transition-colors group-enabled:group-hover:text-tea-gold-lt">Weigh</span>
          </button>
          <button type="button" aria-label="Weigh more" disabled={atMax} onClick={step(1)} onKeyDown={stopKeys} className={`${stepClass} text-tea-gold-lt enabled:hover:border-tea-gold`}>
            +
          </button>
        </div>
      )}
    </div>
  );
}
