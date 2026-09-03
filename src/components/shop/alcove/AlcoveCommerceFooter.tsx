import React, { useState } from 'react';
import type { InventoryItem } from '../../../types';
import { Heart, Pencil, FlaskConical, Share } from 'lucide-react';
import { fmtShopPrice, fmtShopPricePerGram } from '../../../utils/formatNumber';
import { offeredSizes, quoteGrams, sellUnitOf, wholePieceOf } from '../../../lib/teaPricing';
import { useAppStore } from '../../../lib/store';
import { ShopCurrencyPicker } from '../ShopCurrencyPicker';

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

interface SegCell {
  key: string;
  label: string;
  /** The line total, bare, for the list that names its currency in its heading. */
  sub: string;
  /**
   * The same total carrying its currency, for the bar.
   *
   * The bar is on screen with the list shut, and the list's picker is what
   * names the currency, so a figure repeated out here with the name stripped
   * off is a number with nothing saying what it is.
   */
  subFull: string;
  /** The rate this amount works out to, shown beside its total in the list. */
  perGram?: string;
  /** The same rate as figure and unit, for the list's two-line cell. */
  rate?: { value: string; unit: string };
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
  formatRate,
  formatTotal,
  formatPlainTotal,
  onChooseAmount,
  onOpenOrder,
  onAdd,
  variant = 'pinned',
}) => {
  const isTea = item.category === 'tea';
  /* "One box", "two boxes". Sealed tea is counted, not weighed, so the strip
     says how many of the thing rather than how many grams, and the gram figure
     moves to the caption where it belongs. */
  const pluralUnit = (label: string) => {
    const word = label.toLowerCase();
    return /(s|x|z|ch|sh)$/.test(word) ? `${word}es` : `${word}s`;
  };
  const unitLabel = (count: number, label: string) => {
    const spelled = ['', 'One', 'Two', 'Three', 'Four'][count] || String(count);
    return `${spelled} ${count === 1 ? label.toLowerCase() : pluralUnit(label)}`;
  };
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

  // Every figure a reader sees comes through here, so the ladder and the
  // add-to-order total can never drift apart. An admin override formats
  // against its own rate table and keeps that job.
  const priceFor = (g: number) =>
    formatPrice
      ? formatPrice(pricePerGram, g)
      : fmtShopPrice(quoteGrams(pricePerGram, g, { wholePieceGrams: wholePiece?.grams }).totalUsd);

  /* The same figure, without the currency's name on the front. Same curve,
     same call: this is priceFor with the label stripped, not a second way of
     working out what a weight costs. */
  const plainPriceFor = (g: number) =>
    formatPlainTotal
      ? formatPlainTotal(quoteGrams(pricePerGram, g, { wholePieceGrams: wholePiece?.grams }).totalUsd)
      : priceFor(g);

  // Which sizes this tea shows, and what each costs, both from one place.
  const sizeQuotes = isTea
    ? offeredSizes(pricePerGram, sliderMax, { wholePieceGrams: wholePiece?.grams, unitGrams: sellUnit?.grams })
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
      // How many sealed units this rung is, for the teas that come that way.
      const units = sellUnit ? Math.round(q.grams / sellUnit.grams) : 0;
      return {
        key: isWhole ? 'whole-piece' : String(q.grams),
        label: sellUnit
          ? unitLabel(units, sellUnit.label)
          : isWhole ? `The ${wholePiece!.label.toLowerCase()}` : `${q.grams}g`,
        sub: plainPriceFor(q.grams),
        subFull: priceFor(q.grams),
        caption: sellUnit
          ? `${q.grams}g, sealed${units === 1 ? ', the smallest amount there is' : ''}`
          : isWhole
            ? `${q.grams}g, unbroken, keeps ageing`
            : SIZE_CAPTION[q.grams],
        perGram: formatPerGram ? formatPerGram(q.perGramUsd) : undefined,
        rate: formatRate ? formatRate(q.perGramUsd) : undefined,
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
      label: customActive ? `${grams}g` : 'Other amount',
      sub: customActive ? plainPriceFor(grams) : '',
      subFull: customActive ? priceFor(grams) : '',
      caption: sellUnit
        ? `more than four, in whole ${pluralUnit(sellUnit.label)}`
        : 'any weight, priced on the same curve',
      active: customActive,
      ariaLabel: sellUnit ? 'A larger number of units' : 'Custom amount, including sample sizes',
      onSelect: () => setCustomMode(true),
    },
  ];

  // Teaware / non-tea presets are whole units ("pieces"), not grams. Same
  // segmented visual grammar, with the price as each cell's sub-line.
  const teawareCells: SegCell[] = presets.map(p => ({
    key: String(p),
    label: p === 1 ? '1 piece' : `${p} pieces`,
    sub: formatPlainTotal ? formatPlainTotal(pricePerGram * p) : formatPrice ? formatPrice(pricePerGram, p) : fmtShopPrice(pricePerGram * p),
    subFull: formatPrice ? formatPrice(pricePerGram, p) : fmtShopPrice(pricePerGram * p),
    active: grams === p,
    onSelect: () => setGrams(p),
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
  const [amountsOpen, setAmountsOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
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
            <div
              id={amountsId}
              role="group"
              aria-label="Amount"
              /* Closed at the top, open at the bottom. The list grows upward
                 out of the bar, so its top edge is the top edge of the whole
                 assembly and a square one there reads as a panel that got cut
                 off by the screen. The bottom stays square because the bar is
                 immediately under it. */
              className={
                isRail
                  ? 'overflow-hidden rounded-t-[12px] border border-tea-border'
                  : isDocked
                    ? 'border-b border-tea-border px-3.5 pb-1 pt-1'
                    : 'mt-1.5 overflow-hidden rounded-t-[12px] border border-tea-border'
              }
            >
              {/* The heading, the currency, and what the list is telling you.
                  The currency sits with the heading rather than on each of the
                  eleven figures below it: said once it is a control, said
                  eleven times it is noise holding the columns apart. */}
              <div className="flex items-start justify-between gap-2 px-3.5 pb-2 pt-3">
                <span className="flex items-center gap-2">
                  <span className={`whitespace-nowrap font-sans uppercase tracking-[0.16em] text-tea-text-dim ${isRail ? 'text-ui-11' : 'text-ui-10'}`}>How much</span>
                  {formatPlainTotal && <ShopCurrencyPicker />}
                </span>
                {/* Wraps rather than truncates. Cut off at "a lower pri..."
                    the sentence loses the only word that says what happens. */}
                <span className="min-w-0 text-right font-sans text-ui-10 leading-[1.35] tracking-[0.02em] text-tea-text-dim">
                  Quantity provides a lower price.
                </span>
              </div>
              {/* Said once, where it is true. Adding the same tea again puts
                  the weight onto the line already there rather than starting a
                  second one, so this is a running total and the reader can
                  watch it move when they press Add. */}
              {inOrderGrams > 0 && (
                <p className="m-0 px-3.5 pb-2 font-sans text-ui-10 tracking-[0.02em] text-tea-gold-lt">
                  {inOrderLabel} of this already in your order
                </p>
              )}
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
                    isRail ? 'min-h-[40px] gap-2 px-3.5' : 'min-h-[44px] gap-3 px-3.5'
                  } ${cell.active ? 'bg-tea-gold/8 shadow-[inset_0_0_0_1px_rgb(var(--tea-gold-rgb)/0.5)]' : 'hover:bg-tea-gold/6'}`}
                >
                  <span className="min-w-0 flex-1 text-left">
                    <span
                      className={`block whitespace-nowrap font-display tabular-nums ${
                        isRail ? 'text-ui-14' : 'text-ui-15'
                      } ${cell.active ? 'text-tea-text' : 'text-tea-text-sec'}`}
                    >
                      {cell.label}
                    </span>
                    {cell.active ? (
                      /* The highlighted row is the amount CHOSEN. It used to
                         say "in your order", which was true only in an earlier
                         design where choosing was adding; a separate Add came
                         in afterwards and the words stayed behind, so the list
                         claimed an order existed the moment a size was tapped,
                         with an empty basket underneath. What is really in the
                         order is stated once, above, where it can be true. */
                      <span className="mt-px block font-sans text-ui-9 uppercase tracking-[0.16em] text-tea-gold-lt">
                        {'\u2713'} your amount
                      </span>
                    ) : (
                      cell.caption && (
                        <span className="mt-px block font-body text-ui-11 leading-[1.3] text-tea-text-dim">
                          {cell.caption}
                        </span>
                      )
                    )}
                  </span>
                  {/* Two columns of numbers, each starting on its own left
                      edge, because a column of prices is read down and a ragged
                      left edge is read one figure at a time. Fixed widths are
                      what make the edge, and they hold now that the currency is
                      named once above rather than repeated on every figure:
                      "1295k" fits where "IDR 1295k" never did. */}
                  {cell.rate && (
                    <span className={`shrink-0 text-left ${isRail ? 'w-[62px]' : 'w-[68px]'}`}>
                      <span
                        className={`block whitespace-nowrap font-sans tabular-nums ${
                          isRail ? 'text-ui-12' : 'text-ui-13'
                        } ${cell.active ? 'text-tea-gold-lt' : 'text-tea-text-dim'}`}
                      >
                        {cell.rate.value}
                      </span>
                      <span className="mt-px block whitespace-nowrap font-sans text-ui-9 uppercase tracking-[0.14em] text-tea-text-dim/70">
                        {cell.rate.unit}
                      </span>
                    </span>
                  )}
                  <span className={`shrink-0 whitespace-nowrap text-left font-display tabular-nums ${isRail ? 'w-[58px] text-ui-14' : 'w-[64px] text-ui-15'} ${cell.active ? 'text-tea-gold-lt' : 'text-tea-text-sec'}`}>
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
              {/* On a 343px bar there is room for four controls or for three
                  and a price, and the two icons alone hold 93px of it because
                  a tap target has a floor. So the price steps aside for
                  Checkout, which is carrying money of its own two inches to
                  the right; with no order there yet, Checkout is not on the
                  bar and this is where the figure lives. Wider screens show
                  both. */}
              {activeCell.subFull && (
                <span
                  className={`min-w-0 truncate font-sans text-ui-13 tabular-nums text-tea-text-dim ${
                    orderTotalUsd > 0 ? 'hidden sm:inline' : ''
                  }`}
                >
                  {orderTotalUsd > 0 ? activeCell.sub : activeCell.subFull}
                </span>
              )}
              <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-1.5">
                {/* The word is worth about 55px, which a phone bar does not
                    have to spare and would take out of the price. The keyline
                    and the caret carry it there. */}
                <span className="hidden font-sans text-ui-9 uppercase tracking-[0.14em] text-tea-text-dim sm:inline">
                  Change
                </span>
                <span aria-hidden="true" className="font-sans text-ui-9 text-tea-text-dim">
                  {amountsOpen ? '\u25B4' : '\u25BE'}
                </span>
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
            /* The total leads and the word sits under it. What the reader
               wants off this corner of the bar is the number, so the number is
               the larger of the two and the first thing the eye lands on;
               Checkout underneath is what turns it from a figure into a way
               out of the page. This is also the one figure in the assembly
               that keeps its currency, because the list's picker is behind a
               tap and the bar is not. */
            <button
              type="button"
              onClick={onOpenOrder}
              className="alcove-dock-cta tap-target"
              aria-label={`Checkout, ${resolvedTotal(orderTotalUsd)}`}
            >
              <span className="alcove-dock-cta-total font-display tabular-nums">
                {resolvedTotal(orderTotalUsd)}
              </span>
              <span className="alcove-dock-cta-verb">Checkout</span>
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
