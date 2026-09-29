import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartItem as PublicCartItemType } from '../../types';
import { minimumOrderGrams, offeredSizes } from '../../lib/teaPricing';
import { mediaUrl } from '../../lib/mediaUrl';
import { useShopPrice } from '../shop/shopPrice';
import { lineKeyOf, normalizeCartPackGrams } from '../../lib/store';

interface CartItemProps {
  item: PublicCartItemType;
  onRemove: (lineKey: string) => void;
  /** Sets the PACK size. How many packs is its own control. */
  onUpdateQuantity: (lineKey: string, grams: number) => void;
  onUpdatePacks: (lineKey: string, packs: number) => void;
  /** Closes the cart panel when the row navigates to the product page. */
  onNavigate?: () => void;
}

/**
 * One tea in the order panel, drawn as the Gallery direction (chosen
 * 2026-09-29 from four stylings of the Apothecary cart).
 *
 * The photo leads, but only when the tea has one. Most teas on the shelf have
 * no photograph yet, and an empty plate would be a picture of nothing, so a
 * tea without one starts at its name. A photo that fails to load is treated
 * the same as no photo.
 *
 * The pack sizes are on the row, not behind a tap, each with its own price:
 * the old drawer hid the one decision a reader most often came back to make.
 *
 * Every figure is set in the numeral face and every line that holds a figure
 * aligns on the baseline, so a price never sits lower than the name beside it.
 */
export const CartItemRow: React.FC<CartItemProps> = ({ item, onRemove, onUpdateQuantity, onUpdatePacks, onNavigate }) => {
  const { total: displayPrice, plainTotal, symbol, perGramExact } = useShopPrice();
  /* The size tiles carry the bare mark of the money, "¥142" or "$15", not the
     country-qualified one ("CN¥", "NT$") the rest of the panel uses: the
     picker above already says which yuan or dollar it is, and six tiles in a
     row repeating "CN" was the clutter Adrian asked to remove. */
  const tileMark = symbol.replace(/^[A-Z]+(?=[^A-Za-z])/, '');
  const tilePrice = (usd: number) => {
    const plain = plainTotal(usd);
    const lead = /^[~-]/.test(plain) ? plain[0] : '';
    return lead + tileMark + plain.slice(lead.length);
  };
  const [showOther, setShowOther] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  const isTea = item.category === 'tea';
  /* The weight of one pack and how many, with a line saved before packing
     reading as the single pack it has always been. */
  const packGrams = item.packGrams ?? item.quantityGrams;
  const packs = item.packs ?? 1;
  const [customGrams, setCustomGrams] = useState(String(packGrams));
  const lineKey = lineKeyOf(item);
  const photo = photoFailed ? undefined : mediaUrl(item.image);
  const productPath = `/shop/product/${item.id}`;

  // Suppress the variant when it only repeats the product name.
  const showVariant =
    !!item.variant &&
    item.variant.trim().toLowerCase() !== item.name.trim().toLowerCase();

  /**
   * What this amount actually works out to a gram, not the catalogue rate.
   *
   * A line carries a flat handling amount that a whole pressed piece skips, so
   * the real rate falls as the amount rises. `totalPrice` is the
   * curve-applied line total the store computes.
   */
  const effectivePerGram =
    item.quantityGrams > 0 ? item.totalPrice / item.quantityGrams : item.pricePerGram;

  /**
   * The amounts the shelf offers this tea in, with what one pack of each costs.
   *
   * `offeredSizes` is the same function the product page's buy footer calls,
   * so the rungs, the whole piece and the minimum-order rule stay in step by
   * construction. Stock is the one input the cart does not carry, and passing
   * Infinity is honest about that.
   */
  const quotes = useMemo(
    () =>
      isTea
        ? offeredSizes(item.pricePerGram, Number.POSITIVE_INFINITY, {
            wholePieceGrams: item.wholePieceGrams,
            unitGrams: item.unitGrams,
          })
        : [],
    [isTea, item.pricePerGram, item.wholePieceGrams, item.unitGrams],
  );

  const onPresetList = quotes.some(q => q.grams === packGrams);
  const otherIsLive = showOther || (isTea && !onPresetList);

  const minimumGrams = isTea ? minimumOrderGrams(item.unitGrams) : 1;
  const setGrams = (grams: number) => onUpdateQuantity(lineKey, Math.min(9999, Math.max(minimumGrams, grams)));
  const setPacks = (next: number) => onUpdatePacks(lineKey, Math.min(99, Math.max(1, next)));

  const meta = showVariant ? item.variant : item.type;

  return (
    <article className="flex flex-col gap-3" aria-label={item.name}>
      {photo && (
        <Link to={productPath} onClick={onNavigate} tabIndex={-1} aria-hidden="true" className="block">
          <img
            src={photo}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setPhotoFailed(true)}
            className="block w-full h-[150px] object-cover bg-tea-elevated"
          />
        </Link>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="min-w-0">
            <Link
              to={productPath}
              onClick={onNavigate}
              className="font-display text-ui-26 leading-[1.1] text-tea-text hover:text-tea-gold-lt transition-colors"
            >
              {item.name}
            </Link>
          </h3>
          <span className="num text-ui-20 leading-none text-tea-text shrink-0">{displayPrice(item.totalPrice)}</span>
        </div>
        <p className="flex items-baseline gap-1.5 font-body text-ui-13 text-tea-text-sec">
          {meta && <span>{meta}</span>}
          {meta && isTea && <span aria-hidden="true">·</span>}
          {isTea && <span className="num">{perGramExact(effectivePerGram)} per gram</span>}
        </p>
      </div>

      {isTea && (
        <div
          role="group"
          aria-label={`Pack size for ${item.name}`}
          className="grid grid-cols-[repeat(auto-fit,minmax(50px,1fr))] gap-1"
        >
          {quotes.map(q => {
            const on = q.grams === packGrams && !otherIsLive;
            return (
              <button
                type="button"
                key={q.grams}
                onClick={() => { setShowOther(false); setGrams(q.grams); }}
                aria-pressed={on}
                aria-label={`${q.whole ? 'Whole piece, ' : ''}${q.grams}g pack, ${displayPrice(q.totalUsd)}`}
                className={`flex flex-col items-center gap-0.5 min-h-[48px] px-1 py-2 transition-colors ${
                  on
                    ? 'bg-tea-elevated text-tea-text shadow-[inset_0_-2px_0_rgb(var(--tea-gold-rgb))]'
                    : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'
                }`}
              >
                <span className="num text-ui-13 leading-none">{q.whole ? `Whole ${q.grams}g` : `${q.grams}g`}</span>
                <span className="num text-ui-12 leading-none text-tea-text-sec">{tilePrice(q.totalUsd)}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => { setCustomGrams(String(packGrams)); setShowOther(v => !v); }}
            aria-expanded={otherIsLive}
            aria-label="A different weight"
            className={`flex flex-col items-center justify-center gap-0.5 min-h-[48px] px-1 py-2 transition-colors ${
              otherIsLive
                ? 'bg-tea-elevated text-tea-text shadow-[inset_0_-2px_0_rgb(var(--tea-gold-rgb))]'
                : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'
            }`}
          >
            <span className="font-body text-ui-13 leading-none">Other</span>
            <span className="font-body text-ui-12 leading-none text-tea-text-sec">weight</span>
          </button>
        </div>
      )}

      {isTea && otherIsLive && (
        <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="flex items-baseline gap-2">
              <label htmlFor={`grams-${lineKey}`} className="font-body text-ui-13 text-tea-text-sec">Grams per pack</label>
              <input
                id={`grams-${lineKey}`}
                type="number"
                inputMode="numeric"
                min={minimumGrams}
                step={item.unitGrams ?? 1}
                max={9999}
                value={customGrams}
                onChange={(e) => setCustomGrams(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                onBlur={() => {
                  const value = Number.parseInt(customGrams, 10);
                  const next = normalizeCartPackGrams(item, value);
                  setCustomGrams(String(next));
                  setGrams(next);
                }}
                className="num w-[72px] bg-tea-surface border-0 text-ui-15 text-tea-text text-center py-1.5 focus:outline-none focus:ring-1 focus:ring-tea-gold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex items-center bg-tea-surface">
          <button
            type="button"
            onClick={() => (isTea ? setPacks(packs - 1) : setGrams(item.quantityGrams - 1))}
            disabled={isTea && packs <= 1}
            className="w-11 h-11 flex items-center justify-center num text-ui-16 text-tea-text-sec hover:text-tea-text disabled:text-tea-text-dim transition-colors"
            aria-label={isTea ? `One fewer pack of ${item.name}` : 'Decrease quantity'}
          >
            &minus;
          </button>
          <span className="num text-ui-15 text-tea-text min-w-[64px] text-center" aria-live="polite">
            {isTea ? `${packs} ${packs === 1 ? 'pack' : 'packs'}` : item.quantityGrams}
          </span>
          <button
            type="button"
            onClick={() => (isTea ? setPacks(packs + 1) : setGrams(item.quantityGrams + 1))}
            className="w-11 h-11 flex items-center justify-center num text-ui-16 text-tea-text-sec hover:text-tea-text transition-colors"
            aria-label={isTea ? `One more pack of ${item.name}` : 'Increase quantity'}
          >
            +
          </button>
        </div>
        <span className="flex-1 num text-ui-13 text-tea-text-sec">
          {isTea && packs > 1 ? `${packGrams * packs}g in all` : ''}
        </span>
        <button
          type="button"
          onClick={() => onRemove(lineKey)}
          className="checkout-text-action text-ui-13"
          aria-label={`Remove ${item.name} from cart`}
        >
          Remove
        </button>
      </div>
    </article>
  );
};
