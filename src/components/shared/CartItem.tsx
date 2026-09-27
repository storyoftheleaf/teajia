import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartItem as PublicCartItemType } from '../../types';
import { getTeaLedgerTones, TYPOGRAPHY_CLASSES } from '../../designTokens';
import { useTheme } from '../../context/ThemeContext';
import { minimumOrderGrams, offeredSizes } from '../../lib/teaPricing';
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
 * One tea in the order panel.
 *
 * Two grounds: each tea is laid on `tea-surface`, and the amount strip drops
 * back to `tea-bg` so the control reads as recessed rather than drawn on top.
 * No bronze anywhere in the row; the accent is spent once per panel, on the
 * request button.
 *
 * Compacted to two lines and a single control line. The thumbnail is gone, so
 * the name starts at the edge of the block and the price sits beside it: the
 * collision the old separate price row was written against was the remove X,
 * and remove is a word now, inside the drawer that Edit quantity opens.
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
export const CartItemRow: React.FC<CartItemProps> = ({ item, onRemove, onUpdateQuantity, onUpdatePacks, onNavigate }) => {
  const { total: displayPrice, perGramExact } = useShopPrice();
  const { theme } = useTheme();
  const [showOther, setShowOther] = useState(false);
  /* Pack size is behind a tap; how many packs is not. The line at rest is the
     common edit, and this opens the rarer one. */
  const [editOpen, setEditOpen] = useState(false);

  const isTea = item.category === 'tea';
  /* The weight of one pack and how many, with a line saved before packing
     reading as the single pack it has always been. */
  const packGrams = item.packGrams ?? item.quantityGrams;
  const packs = item.packs ?? 1;
  const [customGrams, setCustomGrams] = useState(String(packGrams));
  const lineKey = lineKeyOf(item);

  // Suppress the variant when it only repeats the product name.
  const showVariant =
    !!item.variant &&
    item.variant.trim().toLowerCase() !== item.name.trim().toLowerCase();

  /**
   * What this amount actually works out to a gram, not the catalogue rate.
   *
   * A line carries a flat handling amount (`TEA_PRICING.handlingUsd`) that a
   * whole pressed piece skips, so the real rate falls as the amount rises and
   * the shop's own Quote type says so: "What that works out to a gram. Falls
   * as grams rise." Printing `item.pricePerGram` here showed a figure that
   * never moved while the weights beside it did, which reads as the rate being
   * fixed and the buying-more advantage being invisible.
   *
   * `totalPrice` is the curve-applied line total the store computes, so the
   * division below is the same arithmetic as `quoteGrams`, after its rounding.
   */
  const effectivePerGram =
    item.quantityGrams > 0 ? item.totalPrice / item.quantityGrams : item.pricePerGram;
  const rateLabel = `${perGramExact(effectivePerGram)} per gram`;

  /**
   * The amounts the shelf offers this tea in, not a second list beside it.
   *
   * These were four numbers typed into this file, and they had drifted: the
   * cart offered 250g where the shop's ladder ends at 200, and never offered
   * the whole pressed piece, which is the one amount that skips the handling
   * and is therefore the best rate a reader can get.
   *
   * `offeredSizes` is the same function the product page's buy footer calls,
   * so the rungs and the minimum-order rule stay in step by construction.
   * Stock is the one input the cart does not carry, and passing Infinity is
   * honest about that: this is what the shelf offers, and whether there is
   * enough leaf is settled in the conversation the panel opens.
   */
  const presets = useMemo(
    () =>
      isTea
        ? offeredSizes(item.pricePerGram, Number.POSITIVE_INFINITY, {
            wholePieceGrams: item.wholePieceGrams,
            unitGrams: item.unitGrams,
          }).map(q => q.grams)
        : [],
    [isTea, item.pricePerGram, item.wholePieceGrams, item.unitGrams],
  );

  const onPresetList = presets.includes(packGrams);
  const otherIsLive = showOther || (isTea && !onPresetList);

  const minimumGrams = isTea ? minimumOrderGrams(item.unitGrams) : 1;
  const setGrams = (grams: number) => onUpdateQuantity(lineKey, Math.min(9999, Math.max(minimumGrams, grams)));
  const setPacks = (next: number) => onUpdatePacks(lineKey, Math.min(99, Math.max(1, next)));

  /**
   * The colour the tea brews, washed across the head of its block.
   *
   * Same tones and same left-to-right fade as a shop ledger row, so a reader
   * who learned the colours browsing reads them again here without being
   * taught twice. Ground rather than a chip: a swatch would be a second thing
   * to look at, and this is meant to be understood at a glance, not examined.
   *
   * Stronger than the shop's, and reaching further across the block, because
   * this block sits on `tea-surface` rather than the shop's darker `tea-bg`:
   * at the shop's own alpha the colour was there and unreadable, which is the
   * one thing a glance cue cannot be.
   */
  const wash = item.type ? getTeaLedgerTones(item.type, theme, 2.6).wash : null;

  return (
    <div
      className="bg-tea-surface rounded-[3px] px-4 pt-3.5 pb-3 flex flex-col gap-3"
      style={wash ? { backgroundImage: `linear-gradient(to right, ${wash}, transparent 72%)` } : undefined}
    >
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
          <span className="num text-ui-17 text-tea-text shrink-0">{displayPrice(item.totalPrice)}</span>
        </div>

        {/* Uppercase is metadata only, and the rate is metadata: it describes
            the tea, while the only price on the block is the one above. */}
        {(showVariant || isTea) && (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ui-11 uppercase tracking-[0.18em] text-tea-text-dim truncate">
              {showVariant ? item.variant : ''}
            </span>
            {isTea && (
              <span className="num text-ui-12 text-tea-text-dim shrink-0">{rateLabel}</span>
            )}
          </div>
        )}

      </div>

      {/* The amount, recessed into the panel ground so the control reads as a
          control.

          Pack size and pack count are named separately. Removing a tea stays
          visible so undoing an addition does not require opening an editor. */}
      <div className="bg-tea-bg rounded-[3px] px-3 py-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0">
          <button
            type="button"
            onClick={() => setEditOpen(v => !v)}
            aria-expanded={editOpen}
            aria-controls={`edit-qty-${lineKey}`}
            className="tap-target justify-start items-center gap-1.5 -ml-1 px-1 text-left text-tea-text-sec hover:text-tea-text transition-colors"
          >
            <span className={`${TYPOGRAPHY_CLASSES.link} text-tea-text-sec`}>
              {isTea ? 'Pack size' : 'Details'}
            </span>
            <span aria-hidden="true" className="text-ui-9">{editOpen ? '\u25B4' : '\u25BE'}</span>
          </button>

          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-0">
            {/* The pack this line is built from, stated where the stepper can
                be read against it: two of a 50g pack, not two of nothing. */}
            {isTea && (
              <span className={`${TYPOGRAPHY_CLASSES.link} text-tea-text-sec`}>{packGrams}g per pack</span>
            )}
            <span className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => (isTea ? setPacks(packs - 1) : setGrams(item.quantityGrams - 1))}
                disabled={isTea && packs <= 1}
                className="num text-ui-16 text-tea-text-sec transition-colors hover:text-tea-text disabled:text-tea-text-dim disabled:hover:text-tea-text-dim tap-target"
                aria-label={isTea ? `One fewer pack of ${item.name}` : 'Decrease quantity'}
              >
                &minus;
              </button>
              <span className="num text-ui-17 text-tea-text" aria-live="polite">
                {isTea ? `${packs} ${packs === 1 ? 'pack' : 'packs'}` : item.quantityGrams}
              </span>
              <button
                type="button"
                onClick={() => (isTea ? setPacks(packs + 1) : setGrams(item.quantityGrams + 1))}
                className="num text-ui-16 text-tea-text-sec hover:text-tea-text transition-colors tap-target"
                aria-label={isTea ? `One more pack of ${item.name}` : 'Increase quantity'}
              >
                +
              </button>
            </span>
          </div>
        </div>

        {/* The drawer: the pack sizes the shelf offers, the free-entry weight,
            and the one control on the block that undoes rather than adjusts. */}
        {editOpen && (
          <div id={`edit-qty-${lineKey}`} className="pb-1">
            <span className="block h-px bg-tea-border" aria-hidden="true" />

            {isTea && (
              <div className="flex flex-wrap items-center justify-between gap-x-1 gap-y-0">
                {presets.map(g => {
                  const on = g === packGrams;
                  return (
                    <button
                      type="button"
                      key={g}
                      onClick={() => { setShowOther(false); setGrams(g); }}
                      aria-pressed={on}
                      className={`num min-h-[44px] flex items-center text-ui-16 underline-offset-[6px] transition-colors ${
                        on ? 'text-tea-text underline decoration-tea-text/50' : 'text-tea-text-dim no-underline hover:text-tea-text'
                      }`}
                    >
                      {g}g
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => { setCustomGrams(String(packGrams)); setShowOther(v => !v); }}
                  className={`font-serif min-h-[44px] flex items-center text-ui-14 transition-colors ${
                    otherIsLive ? 'text-tea-text' : 'text-tea-text-dim hover:text-tea-text'
                  }`}
                >
                  Other
                </button>
              </div>
            )}

            {isTea && otherIsLive && (
              <div className="flex items-baseline gap-2 pb-1.5">
                <label htmlFor={`grams-${lineKey}`} className="font-serif text-ui-14 text-tea-text-dim">Grams</label>
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
                  className="num w-[84px] bg-transparent border-0 border-b border-tea-text/50 text-ui-17 text-tea-text text-center py-1 focus:outline-none focus:border-tea-gold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            )}

          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className={`${TYPOGRAPHY_CLASSES.link} text-tea-text-dim`}>
            {isTea && packs > 1 ? `${packGrams * packs}g in all` : ''}
          </span>
          <button
           type="button"
            onClick={() => onRemove(lineKey)}
            className={`${TYPOGRAPHY_CLASSES.link} tap-target justify-end text-tea-text-sec underline underline-offset-4 hover:text-tea-text`}
            aria-label={`Remove ${item.name} from cart`}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
};
