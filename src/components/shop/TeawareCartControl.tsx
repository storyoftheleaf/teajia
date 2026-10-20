import { useEffect, useRef, useState } from 'react';
import type { InventoryItem } from '../../types';

interface TeawareCartControlProps {
  item: InventoryItem;
  formatPrice: (usd: number) => string;
  onAddToCart?: (item: InventoryItem, units: number, totalUsd: number) => void;
}

/**
 * Teaware's half of the tea row's price rail, drawn from the same parts as
 * TeaWeighControl so the two shelves read as one. The top line adds exactly
 * what it says to the cart. A piece with more than one in stock steps the
 * count with minus and plus and the price follows; a one-of-a-kind piece is
 * the box alone, since there is nothing to choose. Details open from the row.
 */
export function TeawareCartControl({ item, formatPrice, onAddToCart }: TeawareCartControlProps) {
  // Teaware stock is held in stock_g as whole pieces (legacy field name),
  // and price_50g is the price of one piece, the same reading as its page.
  const inStock = Math.max(0, Math.floor(item.stock_g || 0));
  const unitPrice = parseFloat(item.price_50g || '0');
  const single = item.isOneOfAKind || inStock <= 1;
  const [units, setUnits] = useState(1);
  const [added, setAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(addedTimer.current), []);

  if (inStock <= 0 || !(unitPrice > 0)) {
    return <span className="text-ui-11 uppercase tracking-[0.1em] text-tea-text-dim">Sold out</span>;
  }

  const count = Math.min(units, inStock);
  const total = Math.ceil(unitPrice * count);
  const step = (delta: number) => (event: React.MouseEvent) => {
    event.stopPropagation();
    setUnits(value => Math.max(1, Math.min(inStock, value + delta)));
  };
  const stopKeys = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
  };
  // Same 24px box and 44px hit area as the tea steps.
  const stepClass = 'relative inline-flex h-6 w-6 shrink-0 before:absolute before:-inset-2.5 before:content-[\'\'] items-center justify-center rounded border border-tea-border text-ui-14 leading-none transition-colors disabled:cursor-default disabled:opacity-40 focus-visible:outline focus-visible:outline-tea-gold';

  return (
    <div className="flex w-[92px] flex-col items-stretch gap-0.5 sm:w-[116px] sm:gap-1.5">
      <button
        type="button"
        disabled={!onAddToCart}
        aria-label={`Add ${count} ${item.name} to cart`}
        title="Add to cart"
        onClick={event => {
          event.stopPropagation();
          if (!onAddToCart) return;
          onAddToCart(item, count, total);
          setAdded(true);
          clearTimeout(addedTimer.current);
          addedTimer.current = setTimeout(() => setAdded(false), 1500);
        }}
        onKeyDown={stopKeys}
        className="flex h-8 items-baseline justify-center gap-2 whitespace-nowrap rounded-md border border-tea-border px-1 pt-[8px] transition-colors enabled:hover:border-tea-gold enabled:hover:bg-tea-accent-sub focus-visible:outline focus-visible:outline-tea-gold"
      >
        {added ? (
          <span className="text-ui-12 text-tea-gold-lt" aria-live="polite">Added</span>
        ) : (
          <>
            {/* The count leads only when there is a count to choose, the way
                the weight leads on a tea: dim, then the price bright. */}
            {!single && <span className="num text-ui-12 tabular-nums text-tea-text-dim">{count}</span>}
            <span data-testid="grid-price" className="num text-ui-12 font-medium tabular-nums text-tea-text">
              {formatPrice(total)}
            </span>
          </>
        )}
      </button>

      {!single && (
        <div className="flex items-center justify-between">
          <button type="button" aria-label="One fewer" disabled={count <= 1} onClick={step(-1)} onKeyDown={stopKeys} className={`${stepClass} text-tea-text-dim enabled:hover:border-tea-gold`}>
            &minus;
          </button>
          <span className="text-ui-9 uppercase tracking-[0.12em] text-tea-text-dim">Pieces</span>
          <button type="button" aria-label="One more" disabled={count >= inStock} onClick={step(1)} onKeyDown={stopKeys} className={`${stepClass} text-tea-gold-lt enabled:hover:border-tea-gold`}>
            +
          </button>
        </div>
      )}
    </div>
  );
}
