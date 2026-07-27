import React from 'react';
import type { InventoryItem } from '../../../types';
import { Heart, Pencil, QrCode } from 'lucide-react';
import { fmtShopPrice } from '../../../utils/formatNumber';
import { LABEL, NUMERAL } from '../../shared/typeRoles';

/**
 * The commerce row's numerals take the LABEL role's size and nothing else.
 *
 * This footer ran sans at 9 and 10 and mono at 10 and 12, four private steps
 * in the densest 300px on the card. They collapse to one, at the smallest
 * declared role size, because BODY at 15px does not fit a price, a per-gram
 * and four presets across a 303px row without wrapping or scrolling sideways,
 * and sideways is banned. The face is the numeral face for the same reason it
 * is on the product page: a proportional figure reflows the total as the
 * amount changes.
 */
const FOOTER_NUMERAL = `text-ui-11 ${NUMERAL}`;

interface StockStatus {
  label: string;
  color: string;
  level: 'out' | 'low' | 'ok';
}

interface AlcoveCommerceFooterProps {
  item: InventoryItem;
  alcoveBg: string;
  alcoveColors: {
    bg: string;
    body: string;
    muted: string;
    subtitle: string;
    success: string;
  };
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
  added: boolean;
  shareCopied: boolean;
  favorited: boolean;
  inSampleCart: boolean;
  isAdmin?: boolean;
  onEdit?: (item: InventoryItem) => void;
  onTaste?: (item: InventoryItem) => void;
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  toggleFavoriteTea: (id: string) => void;
  toggleSampleCart: (e: React.MouseEvent) => void;
  handleShare: () => void;
  handleAdd: () => void;
  formatPrice?: (pricePerGram: number, grams: number) => string;
}

const STOCK_DOT: React.CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: '50%',
  flexShrink: 0,
};

const DIVIDER: React.CSSProperties = {
  width: 1,
  height: 10,
  background: 'var(--tea-border)',
};

export const AlcoveCommerceFooter: React.FC<AlcoveCommerceFooterProps> = ({
  item,
  alcoveColors,
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
}) => {
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 3,
        flexShrink: 0,
        padding: '14px 14px 10px',
        borderTop: '1px solid var(--tea-border)',
        background: alcoveColors.bg,
      }}
    >
      {/* Row 1: Amount selector */}
      {isSoldOut ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <div style={{ ...STOCK_DOT, background: stockStatus.color }} />
          <span className={LABEL} style={{ color: stockStatus.color }}>
            {stockStatus.label}
          </span>
        </div>
      ) : item.category === 'tea' ? (
        <>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
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
                  className="alcove-qty-btn"
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
                  {opt.sub && <span className={`${FOOTER_NUMERAL} text-tea-text-dim`}>{opt.sub}</span>}
                </button>
              );
            })}
          </div>

          {stockStatus.level !== 'ok' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ ...STOCK_DOT, background: stockStatus.color }} />
              <span className={LABEL} style={{ color: stockStatus.color }}>
                {stockStatus.label}
              </span>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginRight: 4,
              flexShrink: 0,
            }}
          >
            <div style={{ ...STOCK_DOT, background: stockStatus.color }} />
            <span className={FOOTER_NUMERAL} style={{ color: alcoveColors.body }}>
              {formatPrice ? perGramDisplay : `$${perGramDisplay}`}/g
            </span>
          </div>
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              className="alcove-preset-btn"
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

      {/* Row 2: Save/Share(/Edit) + Add button */}
      <div style={{ display: 'flex', gap: 6 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            minHeight: 44,
            border: '1px solid var(--tea-border)',
            borderRadius: 3,
            flexShrink: 0,
            padding: '0 8px',
          }}
        >
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
              <div style={DIVIDER} />
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
          <div style={DIVIDER} />
          <button
            type="button"
            className="alcove-icon-btn"
            onClick={handleShare}
            aria-label="Share"
          >
            <span className={LABEL} style={{ color: shareCopied ? alcoveColors.success : 'currentColor' }}>
              {shareCopied ? 'Copied' : 'Share'}
            </span>
          </button>
          {onTaste && (
            <>
              <div style={DIVIDER} />
              <button
                type="button"
                className="alcove-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onTaste(item);
                }}
                aria-label="Start tasting session"
              >
                <span className={LABEL}>
                  Taste
                </span>
              </button>
            </>
          )}
          {isAdmin && onEdit && (
            <>
              <div style={DIVIDER} />
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
          className="alcove-order-btn"
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
              <span>Sample. 10g</span>
              {pricePerGram > 0 && (
                <span className={FOOTER_NUMERAL}>
                  {formatPrice ? formatPrice(pricePerGram, 10) : fmtShopPrice(pricePerGram * 10)}
                </span>
              )}
            </>
          ) : (
            <>
              <span>Order</span>
              <span className={FOOTER_NUMERAL}>
                {formatPrice ? total : `$${total}`}
              </span>
              {pricePerGram > 0 && (
                <span className={`${FOOTER_NUMERAL} text-tea-bg/70`}>
                  {formatPrice ? perGramDisplay : `$${perGramDisplay}`}/g
                </span>
              )}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
