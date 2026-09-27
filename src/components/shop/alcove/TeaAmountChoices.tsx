import { ShopCurrencyPicker } from '../ShopCurrencyPicker';

export interface SegCell {
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

interface TeaAmountChoicesProps {
  id: string;
  cells: SegCell[];
  variant: 'pinned' | 'rail' | 'docked';
  wholePieceLabel?: string;
  inOrderGrams: number;
  inOrderLabel: string;
  showCurrency: boolean;
  onSelect: (cell: SegCell) => void;
}

/** The amount list shared by the product description and the shop ledger. */
export function TeaAmountChoices({
  id,
  cells,
  variant,
  wholePieceLabel,
  inOrderGrams,
  inOrderLabel,
  showCurrency,
  onSelect,
}: TeaAmountChoicesProps) {
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
        isRail
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
          {wholePieceLabel
            ? `Quantity provides a lower price, down to one ${wholePieceLabel.toLowerCase()}.`
            : 'Quantity provides a lower price.'}
        </span>
        {showCurrency && <ShopCurrencyPicker />}
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
          onClick={() => onSelect(cell)}
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
