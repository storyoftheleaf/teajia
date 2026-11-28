import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { InventoryItem } from '../../types';
import { teaPurchaseQuote } from '../../lib/shopPurchase';
import { TEA_PRICING } from '../../lib/teaPricing';
import { formatPersonalTeaMoney } from '../../lib/personalTeaMoney';
import { TeaCup } from '../TeaCupIcon';

export interface WeighOption {
  grams: number;
  totalUsd: number;
  /** What the amount reads as when it is not grams (an invoice's "2 pieces"). */
  label?: string;
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
  /**
   * Outside the shop (a profile, a session, a recap) the price box and the
   * count open the tea's own page instead of adding to the cart, and the
   * count always shows, saying "Pack" for a personal offer or "Weigh".
   */
  href?: string;
  count?: 'pack' | 'weigh';
  /** The amounts to step through, when they are not the shop's own (a collection's quoted price). */
  options?: WeighOption[];
  /** A teacup under the price that opens the tasting from the list (Adrian, 2026-11-27). */
  onTaste?: (item: InventoryItem) => void;
}

/**
 * Price on top, weight underneath. The top line adds exactly what it says to
 * the cart; minus and plus step through the amounts and the price follows.
 * Weigh itself opens the full amount list, for a size the steps do not reach.
 */
export function TeaWeighControl({ item, preferredGrams, formatPrice, onAddToCart, onChooseAmount, href, count, options: given, onTaste }: TeaWeighControlProps) {
  const options = useMemo(() => given ?? weighOptions(item), [given, item]);
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
  // The box is drawn at 24px; the before: layer grows the hit area to 44px tall
  // without growing the box, which tap-target would do. Only 6px sideways, so a
  // step never takes a tap meant for Weigh between them.
  const stepClass = 'relative inline-flex h-6 w-6 before:absolute before:-inset-y-2.5 before:-inset-x-1.5 before:content-[\'\'] items-center justify-center rounded border border-tea-border text-ui-14 leading-none transition-colors disabled:cursor-default disabled:opacity-40 focus-visible:outline focus-visible:outline-tea-gold';

  // Outside the shop every price box reads the same way, in the visitor's chosen currency.
  const priceText = item.exactPackPriceUsd == null || href ? formatPrice(current.totalUsd) : formatPersonalTeaMoney(current.totalUsd, 'USD');
  const priceBox = 'flex h-9 items-baseline justify-center gap-2 whitespace-nowrap rounded-md border border-tea-border px-1 pt-[10px] transition-colors focus-visible:outline focus-visible:outline-tea-gold';
  const countClass = 'rounded px-1.5 py-2 -my-1 focus-visible:outline focus-visible:outline-tea-gold';
  const countWord = (count ?? (item.exactPackPriceUsd == null ? 'weigh' : 'pack')) === 'pack' ? 'Pack' : 'Weigh';

  return (
    // 92px on a phone, what its widest line (the steps either side of Weigh)
    // needs, so the name beside it gets the rest of the row. The two lines sit
    // close so the price and the steps that change it read as one control.
    <div className="flex w-[92px] flex-col items-stretch gap-0.5 sm:w-[116px] sm:gap-1.5">
      {href ? (
        <Link to={href} onClick={event => event.stopPropagation()} onKeyDown={stopKeys}
          aria-label={`${item.name}, ${current.label ?? `${current.grams}g`} for ${priceText}`} className={`${priceBox} hover:border-tea-gold hover:bg-tea-accent-sub`}>
          <span className="num text-ui-12 tabular-nums text-tea-text-dim">{current.label ?? `${current.grams}g`}</span>
          <span className="num text-ui-12 font-medium tabular-nums text-tea-text">{priceText}</span>
        </Link>
      ) : <button
        type="button"
        disabled={!onAddToCart}
        aria-label={onAddToCart ? `Add ${current.grams}g of ${item.name} to cart` : `${item.name}, ${current.label ?? `${current.grams}g`} for ${priceText}`}
        title={onAddToCart ? 'Add to cart' : undefined}
        onClick={event => {
          event.stopPropagation();
          if (!onAddToCart) return;
          onAddToCart(item, current.grams, current.totalUsd);
          setAdded(true);
          clearTimeout(addedTimer.current);
          addedTimer.current = setTimeout(() => setAdded(false), 1500);
        }}
        onKeyDown={stopKeys}
        className={`${priceBox} enabled:hover:border-tea-gold enabled:hover:bg-tea-accent-sub`}
      >
        {added ? (
          <span className="text-ui-12 text-tea-gold-lt" aria-live="polite">Added</span>
        ) : (
          <>
            {/* Weight first, then what it costs: minus and plus change the
                grams and the price answers, so the line reads in that order.
                Contrast separates them, the weight dim and the price bright. */}
            <span className="num text-ui-12 tabular-nums text-tea-text-dim">{current.label ?? `${current.grams}g`}</span>
            <span data-testid="grid-price" className="num text-ui-12 font-medium tabular-nums text-tea-text">
              {priceText}
            </span>
          </>
        )}
      </button>}

      {(href || (item.exactPackPriceUsd == null && (options.length > 1 || onChooseAmount))) && (
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Weigh less" disabled={atMin} onClick={step(-1)} onKeyDown={stopKeys} className={`${stepClass} text-tea-text-dim enabled:hover:border-tea-gold`}>
            &minus;
          </button>
          {href ? (
            <Link to={href} onClick={event => event.stopPropagation()} onKeyDown={stopKeys} className={countClass}>
              <span className="text-ui-9 uppercase tracking-[0.12em] text-tea-text-dim">{countWord}</span>
            </Link>
          ) : <button
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
            className={`group ${countClass}`}
          >
            <span className="text-ui-9 uppercase tracking-[0.12em] text-tea-text-dim transition-colors group-enabled:group-hover:text-tea-gold-lt">Weigh</span>
          </button>}
          <button type="button" aria-label="Weigh more" disabled={atMax} onClick={step(1)} onKeyDown={stopKeys} className={`${stepClass} text-tea-gold-lt enabled:hover:border-tea-gold`}>
            +
          </button>
        </div>
      )}
      {onTaste && (
        <button type="button" aria-label={`Taste ${item.name}`} data-testid="row-taste"
          onClick={event => { event.stopPropagation(); onTaste(item); }} onKeyDown={stopKeys}
          className="relative inline-flex h-6 items-center justify-center gap-1.5 rounded text-tea-text-sec transition-colors before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-[''] hover:text-tea-gold-lt focus-visible:outline focus-visible:outline-tea-gold">
          <TeaCup size={14} strokeWidth={1.5} aria-hidden="true" />
          <span className="text-ui-9 uppercase tracking-[0.12em]">Taste</span>
        </button>
      )}
    </div>
  );
}
