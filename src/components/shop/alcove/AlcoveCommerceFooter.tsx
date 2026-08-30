import React, { useState } from 'react';
import type { InventoryItem } from '../../../types';
import { Heart, Pencil, FlaskConical, Share } from 'lucide-react';
import { fmtShopPrice, fmtShopPricePerGram } from '../../../utils/formatNumber';
import { offeredSizes, quoteGrams } from '../../../lib/teaPricing';
import { useAppStore } from '../../../lib/store';

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
   * 'pinned' (default) is the modal card's bottom bar: top hairline + solid
   * card bg. 'rail' is the product page's desktop order module: the enclosing
   * box owns the border, the background stays transparent, and the action row
   * stacks vertically with a full-width order button. 'docked' is the phone
   * page's bar sitting on the navigation's top edge, where the dock owns the
   * border, the blur and the background, so this draws neither.
   */
  variant?: 'pinned' | 'rail' | 'docked';
}

/**
 * Forms that are sold as one whole pressed piece, and what one piece weighs.
 * Mirrors DEFAULT_GRAMS in TeaCompass/types.ts, kept local so the shop footer
 * does not pull the whole tea-wisdom module into the customer bundle.
 */
export const WHOLE_PIECE: Record<string, { label: string; grams: number }> = {
  Cake: { label: 'Cake', grams: 357 },
  Brick: { label: 'Brick', grams: 250 },
  Tuo: { label: 'Tuo', grams: 100 },
  Ball: { label: 'Ball', grams: 100 },
};

const STOCK_DOT: React.CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: '50%',
  flexShrink: 0,
};

const DIVIDER = <span aria-hidden="true" className="h-3 w-px shrink-0 bg-tea-border" />;

interface SegCell {
  key: string;
  label: string;
  sub: string;
  /** The rate this amount works out to, shown beside its total in the list. */
  perGram?: string;
  /** What the amount is for, under its weight. Omitted for unusual sizes. */
  caption?: string;
  /** The weight this cell stands for, when it stands for a fixed one. */
  chooseGrams?: number;
  active: boolean;
  ariaLabel?: string;
  onSelect: () => void;
}

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
  onChooseAmount,
  onOpenOrder,
  variant = 'pinned',
}) => {
  const isTea = item.category === 'tea';
  const isRail = variant === 'rail';
  const isDocked = variant === 'docked';
  /* The rate beside the total is the rate you are ACTUALLY paying, not the
     shelf rate. With handling folded into the curve those two diverge: 50 g of
     a $0.15/g tea comes to $9.50, which is $0.19 a gram, and a button reading
     "$10" next to "$0.15/g" is contradicting itself in the same breath. The
     ladder above already quotes effective rates, so this quotes the same one
     for whatever amount is currently chosen. An explicit rateLabel from an
     admin override still wins. */
  const effectivePerGram =
    isTea && pricePerGram > 0 && grams > 0
      ? quoteGrams(pricePerGram, grams, { wholePieceGrams: WHOLE_PIECE[item.form ?? '']?.grams }).perGramUsd
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

  // Every figure a reader sees comes through here, so the ladder and the
  // add-to-order total can never drift apart. An admin override formats
  // against its own rate table and keeps that job.
  const priceFor = (g: number) =>
    formatPrice
      ? formatPrice(pricePerGram, g)
      : fmtShopPrice(quoteGrams(pricePerGram, g, { wholePieceGrams: wholePiece?.grams }).totalUsd);

  // A whole cake / brick / tuo is one of the amounts a reader actually buys, so
  // it earns a cell of its own whenever there is enough leaf to press one, and
  // it is the one amount that carries no handling.
  const wholePiece = isTea ? WHOLE_PIECE[item.form ?? ''] : undefined;

  // Which sizes this tea shows, and what each costs, both from one place.
  const sizeQuotes = isTea
    ? offeredSizes(pricePerGram, sliderMax, { wholePieceGrams: wholePiece?.grams })
    : [];
  const stripGrams = sizeQuotes.map(q => q.grams);
  const customActive = customMode || (isTea && !stripGrams.includes(grams));

  /* What each amount is FOR, in the words the design file uses. A price list
     that says only "25 g" makes the reader do the arithmetic of their own
     week; this says how long it lasts, which is the actual question. Keyed by
     the standard sizes, so a tea with an unusual size simply shows no caption
     rather than a wrong one. */
  const SIZE_CAPTION: Record<number, string> = {
    10: 'a few sittings',
    25: 'enough to know it',
    50: 'a fortnight of it',
    100: 'a month',
    200: 'a season',
  };

  const teaCells: SegCell[] = [
    ...sizeQuotes.map(q => {
      const isWhole = q.whole && wholePiece != null;
      return {
        key: isWhole ? 'whole-piece' : String(q.grams),
        label: isWhole ? `The ${wholePiece!.label.toLowerCase()}` : `${q.grams} g`,
        sub: priceFor(q.grams),
        caption: isWhole
          ? `${q.grams} g, unbroken, keeps ageing`
          : SIZE_CAPTION[q.grams],
        perGram: formatPerGram ? formatPerGram(q.perGramUsd) : undefined,
        chooseGrams: q.grams,
        active: !customActive && grams === q.grams,
        ariaLabel: isWhole
          ? `One whole ${wholePiece!.label.toLowerCase()}, ${q.grams} grams`
          : undefined,
        onSelect: () => selectWeight(q.grams),
      };
    }),
    {
      key: 'custom',
      label: customActive ? `${grams} g` : 'Other amount',
      sub: customActive ? priceFor(grams) : '',
      caption: 'any weight, priced on the same curve',
      active: customActive,
      ariaLabel: 'Custom amount, including sample sizes',
      onSelect: () => setCustomMode(true),
    },
  ];

  // Teaware / non-tea presets are whole units ("pieces"), not grams. Same
  // segmented visual grammar, with the price as each cell's sub-line.
  const teawareCells: SegCell[] = presets.map(p => ({
    key: String(p),
    label: p === 1 ? '1 piece' : `${p} pieces`,
    sub: formatPrice ? formatPrice(pricePerGram, p) : fmtShopPrice(pricePerGram * p),
    active: grams === p,
    onSelect: () => setGrams(p),
  }));

  const cells = isTea ? teaCells : teawareCells;
  // Resting the amounts closed is the point: the price list appears when
  // someone goes to choose, not before. Opening is local to this footer, so
  // the card and the page rail each keep their own.
  const resolvedTotal = (usd: number) => (formatPrice ? formatPrice(usd, 1) : fmtShopPrice(usd));
  const publicCart = useAppStore(st => st.publicCart);
  const orderTotalUsd = publicCart.reduce((sum, line) => sum + (line.totalPrice ?? 0), 0);
  const [amountsOpen, setAmountsOpen] = useState(false);
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
        {activeCell?.sub && (
          <span className="font-sans text-ui-12 tabular-nums text-tea-text-dim">{activeCell.sub}</span>
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
      className={
        isRail
          ? 'relative px-3.5 pb-3 pt-3.5'
          : isDocked
            ? 'relative z-[3] flex-shrink-0 px-3.5 pb-2.5 pt-2.5'
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
            <div
              id={amountsId}
              role="group"
              aria-label="Amount"
              className={isRail ? 'border border-tea-border' : 'mt-1.5 border border-tea-border'}
            >
              <div className={`flex items-baseline justify-between gap-2 ${isRail ? 'px-3.5 pb-2 pt-3' : 'px-3.5 pb-2 pt-3'}`}>
                <span className={`whitespace-nowrap font-sans uppercase tracking-[0.16em] text-tea-text-dim ${isRail ? 'text-ui-11' : 'text-ui-10'}`}>How much</span>
                <span className={`whitespace-nowrap font-sans tracking-[0.02em] text-tea-text-dim ${isRail ? 'text-ui-10' : 'text-ui-10'}`}>
                  less a gram, the more you take
                </span>
              </div>
              {cells.map(cell => (
                <button
                  key={cell.key}
                  type="button"
                  data-active={cell.active}
                  aria-pressed={cell.active}
                  aria-label={cell.ariaLabel}
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(8);
                    if (onChooseAmount && cell.chooseGrams != null) {
                      onChooseAmount(cell.chooseGrams);
                    } else {
                      cell.onSelect();
                    }
                    setAmountsOpen(false);
                  }}
                  className={`tap-target flex w-full items-baseline border-t border-tea-border text-left transition-colors ${
                    isRail ? 'min-h-[44px] gap-2 px-3.5' : 'min-h-[52px] gap-2.5 px-3.5'
                  } ${cell.active ? 'bg-tea-gold/8 shadow-[inset_0_0_0_1px_rgb(var(--tea-gold-rgb)/0.5)]' : 'hover:bg-tea-gold/6'}`}
                >
                  <span className="min-w-0 flex-1 text-left">
                    <span
                      className={`block whitespace-nowrap font-display tabular-nums ${
                        isRail ? 'text-ui-15' : 'text-ui-16'
                      } ${cell.active ? 'text-tea-text' : 'text-tea-text-sec'}`}
                    >
                      {cell.label}
                    </span>
                    {cell.active ? (
                      <span className="mt-[3px] block font-sans text-ui-10 uppercase tracking-[0.16em] text-tea-leaf">
                        {'\u2713'} in your order
                      </span>
                    ) : (
                      cell.caption && (
                        <span className="mt-0.5 block font-body text-ui-12 leading-[1.35] text-tea-text-dim">
                          {cell.caption}
                        </span>
                      )
                    )}
                  </span>
                  {cell.perGram && (
                    <span className={`shrink-0 text-right ${isRail ? 'w-[58px]' : 'w-[74px]'}`}>
                      <span
                        className={`block whitespace-nowrap font-sans tabular-nums ${
                          isRail ? 'text-ui-13' : 'text-ui-15'
                        } ${cell.active ? 'text-tea-gold-lt' : 'text-tea-text-dim'}`}
                      >
                        {cell.perGram.replace(/\s*\/\s*g$/, '')}
                      </span>
                      <span className="mt-px block font-sans text-ui-9 uppercase tracking-[0.14em] text-tea-text-dim/70">
                        a gram
                      </span>
                    </span>
                  )}
                  <span className={`shrink-0 text-right font-display tabular-nums ${isRail ? 'w-[52px] text-ui-15' : 'w-[66px] text-ui-16'} ${cell.active ? 'text-tea-gold-lt' : 'text-tea-text-sec'}`}>
                    {cell.sub || '\u203A'}
                  </span>
                </button>
              ))}
            </div>
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
            <button
              type="button"
              onClick={() => setAmountsOpen(open => !open)}
              aria-expanded={amountsOpen}
              aria-controls={amountsId}
              className="tap-target flex min-w-0 flex-1 items-center justify-start gap-2 self-stretch whitespace-nowrap pr-[18px] text-left"
            >
              <span className="font-display text-ui-20 tabular-nums text-tea-text">{activeCell.label}</span>
              {activeCell.sub && (
                <span className="font-sans text-ui-14 tabular-nums text-tea-text-dim">{activeCell.sub}</span>
              )}
              <span aria-hidden="true" className="font-sans text-ui-9 text-tea-text-dim">
                {amountsOpen ? '\u25B4' : '\u25BE'}
              </span>
            </button>
          ) : (
            <>
              <span className="flex min-w-0 flex-1 items-baseline gap-[7px] whitespace-nowrap">
                <span className="font-sans text-ui-11 uppercase tracking-[0.16em] text-tea-text-dim">from</span>
                <span className="font-display text-ui-20 tabular-nums text-tea-text">
                  {cells.length > 0 ? cells[0].sub : ''}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setAmountsOpen(open => !open)}
                aria-expanded={amountsOpen}
                aria-controls={amountsId}
                className="alcove-dock-cta tap-target"
              >
                How much
              </button>
            </>
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
            {isTea && (
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
          {isAdmin && isTea && (
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
