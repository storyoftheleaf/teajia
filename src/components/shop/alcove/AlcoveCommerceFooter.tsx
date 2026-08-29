import React from 'react';
import type { InventoryItem } from '../../../types';
import { Heart, Pencil, FlaskConical } from 'lucide-react';
import { fmtShopPrice } from '../../../utils/formatNumber';

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
  sampleMode: boolean;
  setSampleMode: (v: boolean) => void;
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
  /**
   * 'pinned' (default) is the card's bottom bar: top hairline + solid card bg.
   * 'rail' is the product page's desktop order module: the enclosing box owns
   * the border, the background stays transparent, and the action row stacks
   * vertically with a full-width order button.
   */
  variant?: 'pinned' | 'rail';
}

/** Sessions from grams. A session is ~5 g of leaf. */
const sessionsFor = (grams: number) => Math.round(grams / 5);

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
  sampleMode,
  setSampleMode,
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
  variant = 'pinned',
}) => {
  const isTea = item.category === 'tea';
  const isRail = variant === 'rail';
  const completeRateLabel = rateLabel ?? (perGramDisplay
    ? `${formatPrice ? perGramDisplay : `$${perGramDisplay}`}${isTea ? '/g' : ' each'}`
    : '');

  const selectWeight = (g: number) => {
    setGrams(g);
    setSampleMode(false);
    setCustomMode(false);
  };

  // The custom cell stays lit after the modal commits an off-preset amount,
  // so the chosen quantity always has a visible home in the strip.
  const gramPresetKeys = [50, 100].filter(p => p <= sliderMax);
  const customActive =
    customMode || (!sampleMode && isTea && !gramPresetKeys.includes(grams));

  const teaCells: SegCell[] = [
    {
      key: 'sample',
      label: 'Sample',
      sub: '10 g',
      active: sampleMode,
      onSelect: () => { setSampleMode(true); setCustomMode(false); },
    },
    ...gramPresetKeys.map((p, i) => ({
      key: String(p),
      label: `${p} g`,
      sub: `≈ ${sessionsFor(p)}${i === 0 ? ' sessions' : ''}`,
      active: !sampleMode && !customActive && grams === p,
      onSelect: () => selectWeight(p),
    })),
    {
      key: 'custom',
      label: 'Custom',
      sub: customActive && !customMode ? `${grams} g` : ' ',
      active: customActive,
      ariaLabel: 'Custom amount',
      onSelect: () => { setCustomMode(true); setSampleMode(false); },
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

  return (
    <div
      className={
        isRail
          ? 'relative px-3.5 pb-3 pt-3.5'
          : 'relative z-[3] flex-shrink-0 border-t border-tea-border px-3.5 pb-2 pt-2.5'
      }
      style={isRail ? undefined : { background: alcoveBg }}
    >
      {/* Stock line, only when it carries a warning. "In stock" is implied by
          an enabled order button, and the pinned bar pays for every row. */}
      {stockStatus.level !== 'ok' && (
        <div className="mb-2.5 flex items-center justify-center gap-[7px]">
          <span aria-hidden="true" style={{ ...STOCK_DOT, background: stockStatus.color }} />
          <span
            className="font-sans text-ui-9 uppercase tracking-[0.16em]"
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

      {/* Segmented quantity strip */}
      {!isSoldOut && cells.length > 0 && (
        <div
          role="group"
          aria-label="Amount"
          className="mb-1.5 flex border border-tea-border"
        >
          {cells.map(cell => (
            <button
              key={cell.key}
              type="button"
              className="alcove-seg-btn"
              data-active={cell.active}
              aria-pressed={cell.active}
              aria-label={cell.ariaLabel}
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(8);
                cell.onSelect();
              }}
            >
              <span>{cell.label}</span>
              <small>{cell.sub}</small>
            </button>
          ))}
        </div>
      )}

      {/* Action row: bordered cluster + the one solid gold button.
          Rail variant stacks vertically so the order button spans the rail. */}
      <div className={isRail ? 'flex flex-col gap-2' : 'flex gap-2'}>
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
          {onTaste && (
            <>
              {DIVIDER}
              <button
                type="button"
                className="alcove-icon-btn"
                onClick={e => {
                  e.stopPropagation();
                  onTaste(item);
                }}
                aria-label="Start tasting session"
              >
                <span>Taste</span>
              </button>
            </>
          )}
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

        <button
          type="button"
          className="alcove-order-btn"
          onClick={handleAdd}
          disabled={isSoldOut}
          data-state={added ? 'added' : isSoldOut ? 'sold-out' : 'default'}
        >
          {isSoldOut ? (
            <span className="alcove-order-verb">Sold Out</span>
          ) : added ? (
            <span className="alcove-order-verb">Added ✓</span>
          ) : sampleMode ? (
            <>
              <span className="alcove-order-verb">Add to order</span>
              {pricePerGram > 0 && (
                <span className="alcove-order-amt">
                  {formatPrice ? formatPrice(pricePerGram, 10) : fmtShopPrice(pricePerGram * 10)}
                  {' · 10 g'}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="alcove-order-verb">Add to order</span>
              <span className="alcove-order-amt">
                {formatPrice ? total : `$${total}`}
                {isTea && pricePerGram > 0 && completeRateLabel && (
                  <> · {completeRateLabel}</>
                )}
                {!isTea && grams > 1 && pricePerGram > 0 && completeRateLabel && (
                  <> · {completeRateLabel}</>
                )}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
