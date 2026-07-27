import React from 'react';
import type { InventoryItem } from '../../../types';
import { Heart, Pencil, QrCode } from 'lucide-react';
import { LABEL, LABEL_NUMERAL } from '../../shared/typeRoles';
import type { StockStatus } from '../stockStatus';

/**
 * The commerce row is set in the four roles, like everything else.
 *
 * It ran sans at 9 and 10 and mono at 10 and 12, four private steps in the
 * densest 300px on the card. Two of those four survived round five because they
 * were declared in card-utilities.css, which loads after Tailwind and therefore
 * beat every class the component put on the element: the quantity row was
 * pinned at 10px and the order button at 12px no matter what the JSX said. That
 * is the same trap that hid a bronze-on-bronze term row in round four, and it
 * was sitting on the one control a customer presses to spend money.
 *
 * The stylesheet no longer states a size. Words take LABEL, figures take
 * LABEL_NUMERAL, and that is the whole scale down here.
 */

interface AlcoveCommerceFooterProps {
  item: InventoryItem;
  accent: string;
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
  perGramDisplay: string;
  total: string;
  sampleTotal: string;
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
}

/**
 * The stock line, when there is something to say.
 *
 * No dot. A coloured dot sitting a gap away from the words "Low Stock", in the
 * colour of those words, encodes exactly what the words already say, and the
 * two colours it was drawn in were literal hex values invisible to the colour
 * lint. The label carries the colour, so the signal survives and the ornament
 * does not. Same reading the product page settled on in round five.
 */
const StockLine: React.FC<{ status: StockStatus }> = ({ status }) => (
  <div className="mb-1.5">
    <span className={`${LABEL} ${status.colorClass}`}>{status.label}</span>
  </div>
);

export const AlcoveCommerceFooter: React.FC<AlcoveCommerceFooterProps> = ({
  item,
  accent,
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
  perGramDisplay,
  total,
  sampleTotal,
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
}) => {
  return (
    <div className="alcove-commerce">
      {/* Row 1: Amount selector */}
      {isSoldOut ? (
        <StockLine status={stockStatus} />
      ) : item.category === 'tea' ? (
        <>
          <div className="mb-1.5 flex gap-1">
            {[
              { key: 'sample', label: 'Sample', sub: '10g' },
              ...(50 <= sliderMax ? [{ key: '50', label: '50g', sub: '' }] : []),
              ...(100 <= sliderMax ? [{ key: '100', label: '100g', sub: '' }] : []),
              { key: 'custom', label: 'Custom', sub: '' },
            ].map((opt) => {
              const isActive =
                opt.key === 'sample'
                  ? sampleMode
                  : opt.key === 'custom'
                    ? customMode
                    : !sampleMode && !customMode && grams === parseInt(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  className={`alcove-qty-btn ${LABEL}`}
                  data-active={isActive}
                  aria-pressed={isActive}
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(8);
                    if (opt.key === 'sample') {
                      setSampleMode(true);
                      setCustomMode(false);
                    } else if (opt.key === 'custom') {
                      setCustomMode(true);
                      setSampleMode(false);
                    } else {
                      setGrams(parseInt(opt.key));
                      setSampleMode(false);
                      setCustomMode(false);
                    }
                  }}
                >
                  <span>{opt.label}</span>
                  {opt.sub && <span className={`${LABEL_NUMERAL} text-tea-text-dim`}>{opt.sub}</span>}
                </button>
              );
            })}
          </div>

          {stockStatus.level !== 'ok' && <StockLine status={stockStatus} />}
        </>
      ) : (
        <>
          {stockStatus.level !== 'ok' && <StockLine status={stockStatus} />}
          <div className="mb-1.5 flex items-center gap-1">
            <span className={`${LABEL_NUMERAL} mr-1 shrink-0 text-tea-text-sec`}>
              {perGramDisplay}
            </span>
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                className={`alcove-preset-btn ${LABEL_NUMERAL}`}
                data-active={grams === p}
                aria-pressed={grams === p}
                onClick={() => {
                  setGrams(p);
                  if (navigator.vibrate) navigator.vibrate(8);
                }}
              >
                {p}g
              </button>
            ))}
          </div>
        </>
      )}

      {/* Session reserve soft warning */}
      {item.sessionReserveGrams != null &&
        item.sessionReserveGrams > 0 &&
        item.stock_g <= item.sessionReserveGrams &&
        !isSoldOut && (
          <div className="mb-1">
            <span className="text-tea-gold text-ui-11">
              Last ~{item.stock_g}g available. We'll confirm quantity before dispatching.
            </span>
          </div>
        )}

      {/* Row 2: Save/Share(/Edit) + Order button */}
      <div className="flex gap-1.5">
        <div className="alcove-icon-cluster">
          <button
            type="button"
            className="alcove-icon-btn"
            data-active={favorited}
            onClick={() => toggleFavoriteTea(item.id)}
            aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={favorited}
          >
            <Heart
              size={14}
              color={favorited ? accent : 'currentColor'}
              fill={favorited ? accent : 'none'}
              strokeWidth={1.5}
            />
          </button>
          {isAdmin && (
            <>
              <div className="alcove-icon-divider" />
              <button
                type="button"
                className="alcove-icon-btn"
                data-active={inSampleCart}
                onClick={toggleSampleCart}
                aria-label={inSampleCart ? 'Remove from sample pack' : 'Add to sample pack'}
                aria-pressed={inSampleCart}
                title={inSampleCart ? 'In sample pack' : 'Add to sample pack'}
              >
                <QrCode size={14} />
              </button>
            </>
          )}
          <div className="alcove-icon-divider" />
          <button
            type="button"
            className="alcove-icon-btn"
            onClick={handleShare}
            aria-label="Share"
          >
            <span className={`${LABEL} ${shareCopied ? 'text-tea-green' : ''}`}>
              {shareCopied ? 'Copied' : 'Share'}
            </span>
          </button>
          {onTaste && (
            <>
              <div className="alcove-icon-divider" />
              <button
                type="button"
                className="alcove-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onTaste(item);
                }}
                aria-label="Start tasting session"
              >
                <span className={LABEL}>Taste</span>
              </button>
            </>
          )}
          {isAdmin && onEdit && (
            <>
              <div className="alcove-icon-divider" />
              <button
                type="button"
                className="alcove-icon-btn"
                onClick={() => onEdit(item)}
                aria-label="Edit Product"
              >
                <Pencil size={14} />
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          className={`alcove-order-btn ${LABEL}`}
          onClick={handleAdd}
          disabled={isSoldOut}
          data-state={added ? 'added' : isSoldOut ? 'sold-out' : 'default'}
        >
          {isSoldOut ? (
            <span>Sold Out</span>
          ) : added ? (
            <span>Added</span>
          ) : sampleMode ? (
            <>
              <span>Sample</span>
              {/* The quantity was inside the word ("Sample. 10g"), which put a
                  unit symbol in the button's capitals and set it as "10G". A
                  figure is a figure. */}
              <span className={LABEL_NUMERAL}>10g</span>
              {pricePerGram > 0 && <span className={LABEL_NUMERAL}>{sampleTotal}</span>}
            </>
          ) : (
            <>
              <span>Order</span>
              <span className={LABEL_NUMERAL}>{total}</span>
              {pricePerGram > 0 && (
                <span className={`${LABEL_NUMERAL} text-tea-bg/70`}>{perGramDisplay}</span>
              )}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
