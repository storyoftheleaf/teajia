import React from 'react';
import type { InventoryItem } from '../../../types';
import { fmtShopPrice } from '../../../utils/formatNumber';
import { offeredSizes, quoteGrams, sellUnitOf, wholePieceOf } from '../../../lib/teaPricing';
import { ShopCurrencyPicker } from '../ShopCurrencyPicker';

export interface TeaAmountListProps {
  item: InventoryItem;
  pricePerGram: number;
  maxGrams: number;
  selectedGrams?: number;
  customMode?: boolean;
  formatPrice?: (pricePerGram: number, grams: number) => string;
  formatPerGram?: (usdPerGram: number) => string;
  formatRate?: (usdPerGram: number) => { value: string; unit: string };
  formatPlainTotal?: (usd: number) => string;
  inOrderLabel?: string;
  onChoose: (grams: number) => void;
  onCustom: () => void;
  variant?: 'rail' | 'docked' | 'pinned' | 'picker';
  id?: string;
}

export interface TeaAmountCell {
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

/** Shared amount labels and quotes, also read by the product page's closed bar. */
export function buildTeaAmountCells({
  item, pricePerGram, maxGrams, selectedGrams: grams, customMode = false,
  formatPrice, formatPerGram, formatRate, formatPlainTotal, onChoose, onCustom,
}: TeaAmountListProps): TeaAmountCell[] {
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
  const sellUnit = sellUnitOf(item.form, item.pieceWeightG, item.soldInWholeUnits);
  const wholePiece = sellUnit ?? wholePieceOf(item.form, item.pieceWeightG);
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
  const sizeQuotes = offeredSizes(pricePerGram, maxGrams, { wholePieceGrams: wholePiece?.grams, unitGrams: sellUnit?.grams });
  const stripGrams = sizeQuotes.map(q => q.grams);
  const customActive = grams != null && (customMode || !stripGrams.includes(grams));

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

  return [
    ...sizeQuotes.map(q => {
      /* The piece's OWN cell, not merely an amount that carries no handling.
         Two cakes are whole too now, and they are not "the cake": they would
         take its key and its name, and React would be handed the same key
         twice down one strip. */
      const isWhole = wholePiece != null && q.grams === wholePiece.grams;
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
        onSelect: () => onChoose(q.grams),
      };
    }),
    {
      key: 'custom',
      label: customActive ? `${grams}g` : 'Other amount',
      sub: customActive ? plainPriceFor(grams!) : '',
      subFull: customActive ? priceFor(grams!) : '',
      caption: sellUnit
        ? `more than four, in whole ${pluralUnit(sellUnit.label)}`
        : 'any weight, priced on the same curve',
      active: customActive,
      ariaLabel: sellUnit ? 'A larger number of units' : 'Custom amount, including sample sizes',
      onSelect: onCustom,
    },
  ];
}

/** The existing list layout also renders the footer's counted teaware cells. */
export function AmountCellList({
  cells, wholePiece, variant = 'pinned', id, showCurrency, inOrderLabel,
}: {
  cells: TeaAmountCell[];
  wholePiece?: { label: string };
  variant?: TeaAmountListProps['variant'];
  id?: string;
  showCurrency?: boolean;
  inOrderLabel?: string;
}) {
  const isRail = variant === 'rail';
  const isDocked = variant === 'docked';
  return (
    <div
      id={id}
      role="group"
      aria-label="Amount"
      /* Closed at the top, open at the bottom. The list grows upward
         out of the bar, so its top edge is the top edge of the whole
         assembly and a square one there reads as a panel that got cut
         off by the screen. The bottom stays square because the bar is
         immediately under it. */
      className={
        isRail || variant === 'picker'
          ? 'overflow-hidden rounded-t-[12px] border border-tea-border'
          : isDocked
            ? 'border-b border-tea-border px-3.5 pb-1 pt-1'
            : 'mt-1.5 overflow-hidden rounded-t-[12px] border border-tea-border'
      }
    >
      {/* What the list is telling you, and the currency it tells it
          in. The sentence leads because it is the reason to read the
          rows; the currency is a control, so it sits at the trailing
          edge where the other controls on this page sit. Said once
          here rather than on each of the eleven figures below: said
          eleven times it is noise holding the columns apart.

          "How much" is gone from this row. The sentence under it named
          the same thing in words a reader can act on, so the caps
          label was a heading over a heading. */}
      <div className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-3">
        {/* Wraps rather than truncates. Cut off at "a lower pri..."
            the sentence loses the only word that says what happens. */}
        {/* True for loose leaf all the way up. For a tea that comes
            as a piece the rate stops falling at one of them, because
            nothing is opened to send it, so the sentence says where
            the bottom is rather than promising a discount that no
            longer arrives. */}
        <span className="min-w-0 font-sans text-ui-10 leading-[1.35] tracking-[0.02em] text-tea-text-dim">
          {wholePiece
            ? `Quantity provides a lower price, down to one ${wholePiece.label.toLowerCase()}.`
            : 'Quantity provides a lower price.'}
        </span>
        {showCurrency && <ShopCurrencyPicker />}
      </div>
      {/* Said once, where it is true. Adding the same tea again puts
          the weight onto the line already there rather than starting a
          second one, so this is a running total and the reader can
          watch it move when they press Add. */}
      {inOrderLabel && (
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
            cell.onSelect();
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
          <span
            data-testid={`amount-total-${cell.key}`}
            className={`shrink-0 whitespace-nowrap text-left font-display tabular-nums ${isRail ? 'w-[58px] text-ui-14' : 'w-[64px] text-ui-15'} ${cell.active ? 'text-tea-gold-lt' : 'text-tea-text-sec'}`}
          >
            {cell.sub || '\u203A'}
          </span>
        </button>
      ))}
    </div>
  );
}

export function TeaAmountList(props: TeaAmountListProps) {
  const { item } = props;
  const wholePiece = sellUnitOf(item.form, item.pieceWeightG, item.soldInWholeUnits)
    ?? wholePieceOf(item.form, item.pieceWeightG);
  return <AmountCellList
    cells={buildTeaAmountCells(props)}
    wholePiece={wholePiece}
    variant={props.variant}
    id={props.id}
    showCurrency={!!props.formatPlainTotal}
    inOrderLabel={props.inOrderLabel}
  />;
}
