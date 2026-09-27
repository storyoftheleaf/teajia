import React, { useEffect, useRef, useState } from 'react';
import type { InventoryItem } from '../../../types';
import { Heart, Pencil, FlaskConical, Share } from 'lucide-react';
import { fmtShopPrice, fmtShopPricePerGram } from '../../../utils/formatNumber';
import { quoteGrams, sellUnitOf, wholePieceOf } from '../../../lib/teaPricing';
import { useAppStore } from '../../../lib/store';
import { AmountCellList, buildTeaAmountCells, TeaAmountList, type TeaAmountCell } from './TeaAmountList';

interface StockStatus {
  label: string;
  color: string;
  level: 'out' | 'low' | 'ok';
}

interface AlcoveCommerceFooterProps {
  item: InventoryItem;
  alcoveBg: string;
  stockStatus: StockStatus;
  isSoldOut: boolean;
  grams: number;
  setGrams: (g: number) => void;
  customMode: boolean;
  setCustomMode: (v: boolean) => void;
  sliderMax: number;
  presets: number[];
  pricePerGram: number;
  /** Complete display rate, including its unit (for example "$0.15/g"). */
  rateLabel?: string;
  /** Legacy unit-price fragment retained for the teaware caller. */
  perGramDisplay?: string;
  total: string;
  added: boolean;
  shareCopied: boolean;
  favorited: boolean;
  inSampleCart: boolean;
  isAdmin?: boolean;
  onEdit?: (item: InventoryItem) => void;
  onTaste?: (item: InventoryItem) => void;
  toggleFavoriteTea: (id: string) => void;
  toggleSampleCart: (e: React.MouseEvent) => void;
  handleShare: () => void;
  handleAdd: () => void;
  formatPrice?: (pricePerGram: number, grams: number) => string;
  /** Formats a rate. Separate from formatPrice because a rate keeps its cents. */
  formatPerGram?: (usdPerGram: number) => string;
  /**
   * The rate split from its unit. Needed because the unit is not always the
   * gram: a currency where a gram costs a few units is quoted per 100 g, and
   * the list sets figure and unit on two lines, so it has to be told which
   * unit it got rather than read it off the end of a formatted string.
   */
  formatRate?: (usdPerGram: number) => { value: string; unit: string };
  /** Formats a plain USD total, for figures that are already totals. */
  formatTotal?: (usd: number) => string;
  /**
   * The same total with the currency's own name taken off the front, for the
   * figures inside the price list.
   *
   * The list names its currency once, in the picker beside its heading, so the
   * six rows under it are bare numbers that can share a left edge. Absent on
   * the admin surfaces, which format against their own rate table and keep
   * quoting it on every figure.
   */
  formatPlainTotal?: (usd: number) => string;
  /**
   * Choosing an amount IS adding it, on the page bar. The row already carries
   * the amount, the rate and the total, so the tap is an informed decision and
   * asking for a second yes afterwards is asking someone to agree with
   * themselves. Passing this switches the bar out of Add-to-order and into
   * reporting what is in the order.
   */
  onChooseAmount?: (grams: number) => void;
  /** Opens the order. Only meaningful alongside onChooseAmount. */
  onOpenOrder?: () => void;
  /**
   * Commit the amount currently chosen to the order, carrying BOTH the weight
   * and the total the reader was just shown. The card used to recompute the
   * total from its own copy of the weight, and the two drifted: the bar quoted
   * $42 and the order stored $40, because one of them had lost the handling
   * the pricing curve folds in. Whatever the bar displayed is what gets added.
   */
  onAdd?: (grams: number, totalUsd: number) => void;
  /**
   * 'pinned' (default) is the modal card's bottom bar: top hairline + solid
   * card bg. 'rail' is the product page's desktop order module: the enclosing
   * box owns the border, the background stays transparent, and the action row
   * stacks vertically with a full-width order button. 'docked' is the phone
   * page's bar sitting on the navigation's top edge, where the dock owns the
   * border, the blur and the background, so this draws neither.
   */
  variant?: 'pinned' | 'rail' | 'docked';
}

export { wholePieceOf };

const STOCK_DOT: React.CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: '50%',
  flexShrink: 0,
};

const DIVIDER = <span aria-hidden="true" className="h-3 w-px shrink-0 bg-tea-border" />;

/**
 * Aman-style commerce footer: quiet centered stock line, one segmented
 * quantity strip with a gold inner keyline on the active cell, a bordered
 * action cluster, and exactly one solid element, the gold order button.
 */
export const AlcoveCommerceFooter: React.FC<AlcoveCommerceFooterProps> = ({
  item,
  alcoveBg,
  stockStatus,
  isSoldOut,
  grams,
  setGrams,
  customMode,
  setCustomMode,
  sliderMax,
  presets,
  pricePerGram,
  rateLabel,
  perGramDisplay,
  total,
  added,
  shareCopied,
  favorited,
  inSampleCart,
  isAdmin,
  onEdit,
  onTaste,
  toggleFavoriteTea,
  toggleSampleCart,
  handleShare,
  handleAdd,
  formatPrice,
  formatPerGram,
  formatRate,
  formatTotal,
  formatPlainTotal,
  onChooseAmount,
  onOpenOrder,
  onAdd,
  variant = 'pinned',
}) => {
  const isTea = item.category === 'tea';
  const isRail = variant === 'rail';
  const isDocked = variant === 'docked';
  /* A whole cake / brick / tuo earns a cell of its own, but only when the tea
     itself says how heavy one is and one is worth buying whole. A 5 g tuo is
     how the tea is packed, not an amount: nobody orders one, they order 25 g
     and receive five.

     A sealed unit is the same fact from the other side: one indivisible thing
     the shop sends as it is. It takes that cell too, and it also replaces the
     ladder, because for such a tea the units ARE the sizes. */
  const sellUnit = isTea ? sellUnitOf(item.form, item.pieceWeightG, item.soldInWholeUnits) : undefined;
  const wholePiece = sellUnit ?? (isTea ? wholePieceOf(item.form, item.pieceWeightG) : undefined);
  /* The rate beside the total is the rate you are ACTUALLY paying, not the
     shelf rate. With handling folded into the curve those two diverge: 50 g of
     a $0.15/g tea comes to $9.50, which is $0.19 a gram, and a button reading
     "$10" next to "$0.15/g" is contradicting itself in the same breath. The
     ladder above already quotes effective rates, so this quotes the same one
     for whatever amount is currently chosen. An explicit rateLabel from an
     admin override still wins. */
  const effectivePerGram =
    isTea && pricePerGram > 0 && grams > 0
      ? quoteGrams(pricePerGram, grams, { wholePieceGrams: wholePiece?.grams }).perGramUsd
      : pricePerGram;
  const completeRateLabel = rateLabel ?? (perGramDisplay
    ? isTea
      ? formatPerGram
        ? formatPerGram(effectivePerGram)
        : fmtShopPricePerGram(effectivePerGram)
      : `${formatPrice ? perGramDisplay : `$${perGramDisplay}`} each`
    : '');

  const selectWeight = (g: number) => {
    setGrams(g);
    setCustomMode(false);
  };

  const teaAmountProps = {
    item, pricePerGram, maxGrams: sliderMax, selectedGrams: grams, customMode,
    formatPrice, formatPerGram, formatRate, formatPlainTotal,
    onChoose: (amount: number) => {
      if (onChooseAmount) onChooseAmount(amount);
      else selectWeight(amount);
      setAmountsOpen(false);
    },
    onCustom: () => {
      setCustomMode(true);
      setAmountsOpen(false);
    },
  };
  const teaCells = isTea ? buildTeaAmountCells(teaAmountProps) : [];

  // Teaware / non-tea presets are whole units ("pieces"), not grams. Same
  // segmented visual grammar, with the price as each cell's sub-line.
  const teawareCells: TeaAmountCell[] = presets.map(p => ({
    key: String(p),
    label: p === 1 ? '1 piece' : `${p} pieces`,
    sub: formatPlainTotal ? formatPlainTotal(pricePerGram * p) : formatPrice ? formatPrice(pricePerGram, p) : fmtShopPrice(pricePerGram * p),
    subFull: formatPrice ? formatPrice(pricePerGram, p) : fmtShopPrice(pricePerGram * p),
    active: grams === p,
    onSelect: () => { setGrams(p); setAmountsOpen(false); },
  }));

  const cells = isTea ? teaCells : teawareCells;
  // Resting the amounts closed is the point: the price list appears when
  // someone goes to choose, not before. Opening is local to this footer, so
  // the card and the page rail each keep their own.
  /* A cart total is a total, not a rate times a weight. This used to call
     formatPrice(total, 1), which runs the figure through the pricing curve as
     though it were a per-gram price for one gram, and so added the handling fee
     to it a second time. */
  const resolvedTotal = (usd: number) => (formatTotal ? formatTotal(usd) : fmtShopPrice(usd));
  /* What Add commits, from the same call the list and the bar display. */
  const addTotalUsd = isTea
    ? quoteGrams(pricePerGram, grams, { wholePieceGrams: wholePiece?.grams }).totalUsd
    : pricePerGram * grams;
  const publicCart = useAppStore(st => st.publicCart);
  const orderTotalUsd = publicCart.reduce((sum, line) => sum + (line.totalPrice ?? 0), 0);
  /* What the order actually holds of THIS tea, which is not the same fact as
     which row is highlighted. A tea can be on the order at more than one pack
     size, so this is every line of it added up, and it is stated as packs
     because packs are what the shop is being asked to send. */
  const orderedPacks = publicCart
    .filter(line => line.id === item.id)
    .map(line => ({ grams: line.packGrams ?? line.quantityGrams, packs: line.packs ?? 1 }));
  const inOrderGrams = orderedPacks.reduce((sum, p) => sum + p.grams * p.packs, 0);
  const inOrderLabel = orderedPacks
    .map(p => (p.packs > 1 ? `${p.packs} \u00d7 ${p.grams}g` : `${p.grams}g`))
    .join(' and ');
  /* What the chosen amount works out to a gram, short enough to live on a
     phone bar: "28.8k/g". The bar used to carry the line TOTAL here, which
     said the same thing as the total two inches to its right and told the
     reader nothing about whether this rung of the ladder was a good one. The
     rate is the fact that changes as the amount changes, so it is the one
     worth the space. */
  const dockRate =
    formatRate && isTea && effectivePerGram > 0
      ? `${formatRate(effectivePerGram).value}/g`
      : completeRateLabel;
  const [amountsOpen, setAmountsOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  /* A list this tall covers the page it was opened from, so the way out has to
     be the whole rest of the screen. Tapping anywhere outside the assembly
     shuts it, and so does Escape; without either, the only way back to the tea
     was to find the caret again. */
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!amountsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setAmountsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAmountsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [amountsOpen]);
  // The rail has the room, so the amounts stand open in it and the toggle is
  // only for the surfaces that do not: the phone bar and the quick-view card.
  const amountsShown = isRail || amountsOpen;
  const amountsId = `alcove-amounts-${item.id}`;
  const activeCell = cells.find(c => c.active);

  const amountToggle = (
    <button
      type="button"
      onClick={() => setAmountsOpen(open => !open)}
      aria-expanded={amountsOpen}
      aria-controls={amountsId}
      className={
        isDocked
          ? 'tap-target flex min-h-[44px] flex-1 items-center gap-2.5 px-1 text-left transition-colors'
          : 'tap-target flex min-h-[44px] w-full items-center justify-between gap-3 border border-tea-border px-3 transition-colors hover:border-tea-gold/40'
      }
    >
      <span className="flex items-baseline gap-2">
        <span className="font-display text-ui-17 tabular-nums text-tea-text">
          {activeCell ? activeCell.label : 'Amount'}
        </span>
        {activeCell?.subFull && (
          <span className="font-sans text-ui-12 tabular-nums text-tea-text-dim">{activeCell.subFull}</span>
        )}
      </span>
      <span
        aria-hidden="true"
        className="font-sans text-ui-11 text-tea-text-sec"
      >
        {amountsOpen ? '\u25B4' : '\u25BE'}
      </span>
    </button>
  );

  return (
    <div
      ref={rootRef}
      className={
        isRail
          ? 'relative px-3.5 pb-3 pt-3.5'
          : isDocked
            ? 'relative z-[3] flex-shrink-0'
            : 'relative z-[3] flex-shrink-0 border-t border-tea-border px-3.5 pb-2 pt-2.5'
      }
      style={isRail || isDocked ? undefined : { background: alcoveBg }}
    >
      {/* Stock line, only when it carries a warning. "In stock" is implied by
          an enabled order button, and the pinned bar pays for every row. */}
      {stockStatus.level !== 'ok' && (
        <div className="mb-2.5 flex items-center justify-center gap-[7px]">
          <span aria-hidden="true" style={{ ...STOCK_DOT, background: stockStatus.color }} />
          <span
            className="font-sans text-ui-11 uppercase tracking-[0.16em]"
            style={{ color: stockStatus.color }}
          >
            {stockStatus.label}
          </span>
        </div>
      )}

      {/* Session reserve soft warning */}
      {item.sessionReserveGrams != null &&
        item.sessionReserveGrams > 0 &&
        item.stock_g <= item.sessionReserveGrams &&
        !isSoldOut && (
          <p className="m-0 mb-2 text-center font-sans text-ui-10 tracking-[0.04em] text-tea-gold">
            Last ~{item.stock_g}g available. We&rsquo;ll confirm quantity before dispatching.
          </p>
        )}

      {/* The amounts, behind one tap.
          Standing them open put the whole price list permanently on screen,
          which reads as a rate card rather than a shop. Resting, this is one
          line: what is currently chosen, and the way to change it. */}
      {!isSoldOut && cells.length > 0 && (
        <div className={isDocked ? '' : 'mb-1.5'}>
          {isRail || (isDocked && onChooseAmount) ? null : amountToggle}

          {amountsShown && (
            isTea ? (
              <TeaAmountList
                {...teaAmountProps}
                variant={variant}
                id={amountsId}
                inOrderLabel={inOrderGrams > 0 ? inOrderLabel : undefined}
              />
            ) : (
              <AmountCellList
                cells={teawareCells}
                variant={variant}
                id={amountsId}
                showCurrency={!!formatPlainTotal}
                inOrderLabel={inOrderGrams > 0 ? inOrderLabel : undefined}
              />
            )
          )}
        </div>
      )}

      {/* The docked strip has exactly two states and never both at once.
          Before an amount is chosen it says what the tea starts at and offers
          the one way in, a filled block flush to the right edge. Once an
          amount is chosen that block is gone: the amount and its total take
          the space, and the whole line is the way back to change it, because
          choosing in the list above already added it and there is nothing
          left to confirm. */}
      {isDocked && onChooseAmount ? (
        <div className="alcove-dock-strip">
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              className="alcove-dock-icon tap-target"
              data-active={favorited}
              onClick={() => toggleFavoriteTea(item.id)}
              aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={favorited}
            >
              <Heart size={17} color="currentColor" fill={favorited ? 'currentColor' : 'none'} strokeWidth={1.4} />
            </button>
            <button type="button" className="alcove-dock-icon tap-target" onClick={handleShare} aria-label="Share">
              <Share size={17} strokeWidth={1.4} />
            </button>
            <span aria-hidden="true" className="alcove-dock-divider" />
          </div>
          {activeCell ? (
            /* The amount is a control and has to look like one. Bare type in
               the middle of a bar is something to read, not something to press,
               and nothing said this was where you change how much you are
               buying. A keyline, a fill, the caret and the word for what
               pressing it does, which together say it without a tour. */
            <button
              type="button"
              onClick={() => setAmountsOpen(open => !open)}
              aria-expanded={amountsOpen}
              aria-controls={amountsId}
              aria-label={`Change amount, currently ${activeCell.label}`}
              className="alcove-dock-amount tap-target"
            >
              <span className="shrink-0 font-display text-ui-17 tabular-nums text-tea-text">{activeCell.label}</span>
              <span aria-hidden="true" className="ml-auto shrink-0 font-sans text-ui-9 text-tea-text-dim">
                {amountsOpen ? '\u25B4' : '\u25BE'}
              </span>
            </button>
          ) : (
            /* Nothing chosen yet, so the bar says what the tea starts at
               rather than sitting empty until someone opens the list. */
            <span className="flex min-w-0 flex-1 items-baseline gap-[7px] whitespace-nowrap">
              <span className="font-sans text-ui-11 uppercase tracking-[0.16em] text-tea-text-dim">from</span>
              <span className="font-display text-ui-20 tabular-nums text-tea-text">
                {cells.length > 0 ? cells[0].subFull : ''}
              </span>
            </span>
          )}
          {/* Two controls, not one. The block used to be a single thing that
              meant whatever the state made it mean, and because choosing an
              amount also added it, there was nothing left for it to do except
              open the order. Adding is its own act now: Add commits the amount
              showing to its left, and the order sits beyond it as the way to
              what has already been committed. The order only appears once
              there is one, which is what keeps a 343px bar from carrying four
              controls at the same time. */}
          {activeCell && (
            <span className="alcove-dock-cta-total shrink-0 tabular-nums" aria-hidden="true">
              {resolvedTotal(addTotalUsd)}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(8);
              setJustAdded(true);
              window.setTimeout(() => setJustAdded(false), 1600);
              onAdd?.(grams, addTotalUsd);
            }}
            disabled={isSoldOut}
            className="alcove-dock-add tap-target inline-flex items-center"
            data-state={justAdded ? 'added' : 'default'}
          >
            {justAdded ? 'Added' : 'Add'}
          </button>
          {orderTotalUsd > 0 && (
            <button
              type="button"
              onClick={onOpenOrder}
              className="alcove-dock-cta tap-target"
              aria-label={`Open cart, ${resolvedTotal(orderTotalUsd)}`}
            >
              <span className="alcove-dock-cta-verb">Cart</span>
              <span className="alcove-dock-cta-total tabular-nums">{resolvedTotal(orderTotalUsd)}</span>
            </button>
          )}
        </div>
      ) : (
      <div className={isRail ? 'flex flex-col gap-2' : 'flex gap-2'}>
        {isRail ? (
          /* Words, stacked. A heart is guessable and a conical flask is not:
             a first-time reader takes it for chemistry or for nothing. The
             sidebar and the navigation are text only, so words here are the
             house style rather than an exception to it. */
          <div className="order-2 flex flex-col items-center gap-1 pt-1">
            <button
              type="button"
              onClick={() => toggleFavoriteTea(item.id)}
              aria-pressed={favorited}
              className="tap-target min-h-[36px] font-sans text-ui-10 uppercase tracking-[0.16em] text-tea-text-sec transition-colors hover:text-tea-text"
            >
              {favorited ? 'Saved' : 'Save it'}
            </button>
            {/* No sample of a sealed tea. A sample is a few grams off a larger
                amount, and there is no larger amount to take it off: the shop
                would have to open the box it just said it cannot open. */}
            {isTea && !sellUnit && (
              <button
                type="button"
                onClick={toggleSampleCart}
                aria-pressed={inSampleCart}
                className="tap-target min-h-[36px] font-sans text-ui-10 uppercase tracking-[0.16em] text-tea-text-sec transition-colors hover:text-tea-text"
              >
                {inSampleCart ? 'In sample list' : 'Add to sample list'}
              </button>
            )}
            <button
              type="button"
              onClick={handleShare}
              className="tap-target min-h-[36px] font-sans text-ui-10 uppercase tracking-[0.16em] text-tea-text-sec transition-colors hover:text-tea-text"
            >
              {shareCopied ? 'Copied' : 'Share'}
            </button>
          </div>
        ) : (
        <div className="flex min-h-[44px] shrink-0 items-center justify-center border border-tea-border px-1.5">
          <button
            type="button"
            className="alcove-icon-btn"
            data-active={favorited}
            onClick={() => toggleFavoriteTea(item.id)}
            aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={favorited}
          >
            <Heart
              size={13}
              color="currentColor"
              fill={favorited ? 'currentColor' : 'none'}
              strokeWidth={1.6}
            />
          </button>
          {isAdmin && isTea && !sellUnit && (
            <>
              {DIVIDER}
              <button
                type="button"
                className="alcove-icon-btn"
                data-active={inSampleCart}
                onClick={toggleSampleCart}
                aria-label={inSampleCart ? 'Remove from sample pack' : 'Add to sample pack'}
                aria-pressed={inSampleCart}
                title={inSampleCart ? 'In sample pack' : 'Add to sample pack'}
              >
                {/* Sample pack, not a QR code. This carried the QrCode glyph
                    for a while, which read on the public page as a stray QR
                    button; the real QR generator lives in the edit panel. */}
                <FlaskConical size={13} />
              </button>
            </>
          )}
          {DIVIDER}
          <button
            type="button"
            className="alcove-icon-btn"
            onClick={handleShare}
            aria-label="Share"
          >
            <span style={shareCopied ? { color: 'var(--tea-leaf)' } : undefined}>
              {shareCopied ? 'Copied' : 'Share'}
            </span>
          </button>
          {isAdmin && onEdit && (
            <>
              {DIVIDER}
              <button
                type="button"
                className="alcove-icon-btn"
                onClick={() => onEdit(item)}
                aria-label="Edit Product"
              >
                <Pencil size={13} />
              </button>
            </>
          )}
        </div>
        )}

        <button
          type="button"
          className={`alcove-order-btn${isRail ? ' alcove-order-btn--rail' : ''}`}
          onClick={handleAdd}
          disabled={isSoldOut}
          data-state={added ? 'added' : isSoldOut ? 'sold-out' : 'default'}
        >
          {isSoldOut ? (
            <span className="alcove-order-verb">Sold Out</span>
          ) : added ? (
            <span className="alcove-order-verb">Added ✓</span>
          ) : (
            <>
              <span className="alcove-order-verb">{isRail ? 'Add' : 'Add to order'}</span>
              {/* The total is what the reader is deciding about; the rate is a
                  footnote to it, not its equal. */}
              <span className="alcove-order-amt">
                <span className="alcove-order-total">
                  {formatPrice ? total : `$${total}`}
                </span>
                {pricePerGram > 0 && completeRateLabel && (isTea || grams > 1) && (
                  <span className="alcove-order-rate">{completeRateLabel}</span>
                )}
              </span>
            </>
          )}
        </button>
      </div>
      )}
    </div>
  );
};
