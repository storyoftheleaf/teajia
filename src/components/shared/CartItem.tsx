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
 * Three grounds, all existing tokens. The panel scrolls in `tea-bg`, each tea
 * is laid on `tea-surface`, and the amount strip drops back to `tea-bg` so the
 * control reads as recessed rather than drawn on top of the row. The thumbnail
 * goes up to `tea-elevated` so it separates from the paper beneath it.
 *
 * Two rules this layout exists to keep:
 *
 * 1. Remove and the price never share a line. The old row had the remove X
 *    absolutely positioned at the top right while the price sat at the right of
 *    the title row, so on touch, where the X never fades, the glyph sat on top
 *    of the figure.
 * 2. The amount says what it belongs to. Bare preset numbers on the quantity
 *    row read as options rather than weights; they carry their unit now and sit
 *    under a sentence naming the tea they change.
 *
 * No bronze anywhere in the row. The accent is spent once per panel, on the
 * request button.
 */
export const CartItemRow: React.FC<CartItemProps> = ({ item, onRemove, onUpdateQuantity, onNavigate }) => {
  const { total: displayPrice, rate: displayRate } = useShopPrice();
  const [showOther, setShowOther] = useState(false);

  const isTea = item.category === 'tea';
  const initial = item.name.trim().charAt(0).toUpperCase();

  // Suppress the variant when it only repeats the product name.
  const showVariant =
    !!item.variant &&
    item.variant.trim().toLowerCase() !== item.name.trim().toLowerCase();

  const rate = displayRate(item.pricePerGram);
  const onPresetList = PRESETS.includes(item.quantityGrams);
  const otherIsLive = showOther || (isTea && !onPresetList);

  const setGrams = (grams: number) => onUpdateQuantity(item.id, Math.min(9999, Math.max(1, grams)));

  return (
    <div className="bg-tea-surface rounded-[3px] px-4 pt-4 pb-3.5 flex flex-col gap-3.5">
      <div className="flex gap-3.5">
        {/* Thumbnail, one step up the ground ladder so it lifts off the paper */}
        <div className="w-16 h-16 shrink-0 rounded-[2px] bg-tea-elevated flex items-center justify-center overflow-hidden">
          {item.image ? (
            <img src={item.image} className="w-full h-full object-cover" alt={item.name} loading="eager" />
          ) : (
            <span className="font-serif text-[19px] leading-none text-tea-text-dim select-none">{initial}</span>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <h3 className="font-display text-[23px] leading-[1.1] text-tea-text truncate">{item.name}</h3>

          {/* Uppercase is metadata only, never an instruction */}
          {showVariant && (
            <p className="text-ui-9 uppercase tracking-[0.2em] text-tea-text-dim">{item.variant}</p>
          )}

          <div className="flex items-center gap-3.5 mt-0.5">
            <Link
              to={`/shop/product/${item.id}`}
              onClick={onNavigate}
              className="font-serif text-[12.5px] text-tea-text hover:text-tea-gold-lt underline decoration-tea-border hover:decoration-tea-gold-lt underline-offset-[5px] transition-colors tap-target"
            >
              View tea
            </Link>
            <button
              onClick={() => onRemove(item.id)}
              className="font-serif text-[12.5px] text-tea-text-sec hover:text-tea-error transition-colors tap-target"
              aria-label={`Remove ${item.name} from cart`}
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      {/* The amount, recessed into the panel ground so the control reads as a control */}
      <div className="bg-tea-bg rounded-[3px] px-3.5 pt-2.5 pb-2 flex flex-col gap-0.5">
        <span className="font-serif italic text-[12.5px] text-tea-text-dim">
          {isTea ? 'How much of this tea' : 'How many'}
        </span>

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

      {/* The price sits alone on the closing line, nothing can overlap it.
          The rate arrives already split from its unit, and the unit carries its
          own preposition ("a gram", "per 100 g"), because a currency where a
          gram costs a few units is quoted per 100 g. Writing the preposition
          here instead is what printed "per per 100 g". */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="num text-ui-10 text-tea-text-dim">
          {isTea ? `${rate.value} ${rate.unit}` : 'each'}
        </span>
        <span className="num text-ui-15 text-tea-text">{displayPrice(item.totalPrice)}</span>
      </div>
    </div>
  );
};
