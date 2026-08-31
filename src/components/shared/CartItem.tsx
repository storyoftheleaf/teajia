import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CartItem as PublicCartItemType } from '../../types';
import { useShopPrice } from '../shop/shopPrice';

interface CartItemProps {
  item: PublicCartItemType;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, grams: number) => void;
  /** Closes the cart panel when the row navigates to the product page. */
  onNavigate?: () => void;
}

const PRESETS = [25, 50, 100, 250];

/**
 * One tea in the order panel.
 *
 * Two grounds: each tea is laid on `tea-surface`, and the amount strip drops
 * back to `tea-bg` so the control reads as recessed rather than drawn on top.
 * No bronze anywhere in the row; the accent is spent once per panel, on the
 * request button.
 *
 * Compacted to three lines and a control strip. The thumbnail is gone, so the
 * name starts at the edge of the block and the price sits beside it: the
 * collision the old separate price row was written against was the remove X,
 * and remove is a word now, at the far end of the amount label.
 *
 * The name is the link to the tea. A "View tea" line spent a whole row of
 * control on the thing the reader was going to tap anyway.
 *
 * The rate rides the metadata line for the same reason. It is a fact about the
 * tea, not a second price.
 *
 * A tea is 181px this way, against 262px when it had a thumbnail and its own
 * rows for the price and the links, which is what lets two teas sit on a phone
 * screen without scrolling.
 */
export const CartItemRow: React.FC<CartItemProps> = ({ item, onRemove, onUpdateQuantity, onNavigate }) => {
  const { total: displayPrice, rate: displayRate } = useShopPrice();
  const [showOther, setShowOther] = useState(false);

  const isTea = item.category === 'tea';

  // Suppress the variant when it only repeats the product name.
  const showVariant =
    !!item.variant &&
    item.variant.trim().toLowerCase() !== item.name.trim().toLowerCase();

  const rate = displayRate(item.pricePerGram);
  const onPresetList = PRESETS.includes(item.quantityGrams);
  const otherIsLive = showOther || (isTea && !onPresetList);

  const setGrams = (grams: number) => onUpdateQuantity(item.id, Math.min(9999, Math.max(1, grams)));

  return (
    <div className="bg-tea-surface rounded-[3px] px-4 pt-3.5 pb-3 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          {/* The name is the link. A separate "View tea" line was a whole row
              of control for a thing the reader was already going to tap. */}
          <h3 className="min-w-0 truncate">
            <Link
              to={`/shop/product/${item.id}`}
              onClick={onNavigate}
              className="font-display text-[23px] leading-[1.1] text-tea-text hover:text-tea-gold-lt transition-colors"
            >
              {item.name}
            </Link>
          </h3>
          <span className="num text-ui-15 text-tea-text shrink-0">{displayPrice(item.totalPrice)}</span>
        </div>

        {/* Uppercase is metadata only, and the rate is metadata: it describes
            the tea, while the only price on the block is the one above. */}
        {(showVariant || isTea) && (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ui-9 uppercase tracking-[0.2em] text-tea-text-dim truncate">
              {showVariant ? item.variant : ''}
            </span>
            {isTea && (
              <span className="num text-ui-10 text-tea-text-dim shrink-0">{rate.value} {rate.unit}</span>
            )}
          </div>
        )}

      </div>

      {/* The amount, recessed into the panel ground so the control reads as a control */}
      <div className="bg-tea-bg rounded-[3px] px-3.5 pt-0.5 pb-1.5 flex flex-col gap-0.5">
        {/* Remove rides the far end of the label line. It is the one thing on
            the block that undoes rather than adjusts, so it sits apart from
            the weights without spending a row of its own. */}
        <div className="flex items-center justify-between gap-3">
          <span className="font-serif italic text-[12.5px] text-tea-text-dim">
            {isTea ? 'How much of this tea' : 'How many'}
          </span>
          <button
            onClick={() => onRemove(item.id)}
            className="font-serif text-[12.5px] text-tea-text-sec hover:text-tea-error transition-colors tap-target justify-end"
            aria-label={`Remove ${item.name} from cart`}
          >
            Remove
          </button>
        </div>

        {isTea ? (
          <div className="flex items-center justify-between gap-1">
            {PRESETS.map(g => {
              const on = g === item.quantityGrams;
              return (
                <button
                  key={g}
                  onClick={() => { setShowOther(false); setGrams(g); }}
                  aria-pressed={on}
                  className={`num min-h-[44px] flex items-center text-ui-13 underline-offset-[6px] transition-colors ${
                    on ? 'text-tea-text underline decoration-tea-text/50' : 'text-tea-text-dim no-underline hover:text-tea-text'
                  }`}
                >
                  {g}g
                </button>
              );
            })}
            <button
              onClick={() => setShowOther(v => !v)}
              className={`font-serif min-h-[44px] flex items-center text-[12.5px] transition-colors ${
                otherIsLive ? 'text-tea-text' : 'text-tea-text-dim hover:text-tea-text'
              }`}
            >
              Other
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 min-h-[44px]">
            <button
              onClick={() => setGrams(item.quantityGrams - 1)}
              className="num text-ui-16 text-tea-text-sec hover:text-tea-text transition-colors tap-target"
              aria-label="Decrease quantity"
            >
              &minus;
            </button>
            <span className="num text-ui-15 text-tea-text">{item.quantityGrams}</span>
            <button
              onClick={() => setGrams(item.quantityGrams + 1)}
              className="num text-ui-16 text-tea-text-sec hover:text-tea-text transition-colors tap-target"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        )}

        {isTea && otherIsLive && (
          <div className="flex items-baseline gap-2 pb-1.5">
            <label htmlFor={`grams-${item.id}`} className="font-serif text-[12.5px] text-tea-text-dim">Grams</label>
            <input
              id={`grams-${item.id}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={9999}
              value={item.quantityGrams}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setGrams(v);
              }}
              onBlur={(e) => {
                const v = parseInt(e.target.value, 10);
                if (isNaN(v) || v < 1) setGrams(1);
              }}
              className="num w-[74px] bg-transparent border-0 border-b border-tea-text/50 text-ui-15 text-tea-text text-center py-1 focus:outline-none focus:border-tea-gold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        )}
      </div>
    </div>
  );
};
