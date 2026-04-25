import React from 'react';
import type { InventoryItem } from '../../../types';
import { Heart, Pencil, QrCode } from 'lucide-react';
import { fmtShopPrice } from '../../../utils/formatNumber';

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
  hovered: string | null;
  setHovered: (v: string | null) => void;
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

export const AlcoveCommerceFooter: React.FC<AlcoveCommerceFooterProps> = ({
  item,
  alcoveBg,
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
  hovered,
  setHovered,
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
  void alcoveBg;
  return (
    <div style={{
      position: "relative", zIndex: 3, flexShrink: 0,
      padding: "6px 14px 8px",
      borderTop: "1px solid var(--tea-border)",
      background: alcoveColors.bg,
    }}>
      {/* Row 1: Amount selector */}
      {isSoldOut ? (
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          marginBottom: "4px",
        }}>
          <div style={{
            width: "5px", height: "5px", borderRadius: "50%",
            background: stockStatus.color,
          }} />
          <span style={{
            fontFamily: "var(--font-sans)",
            fontSize: "10px", fontWeight: 400,
            letterSpacing: "0.08em", textTransform: "uppercase",
            color: stockStatus.color,
          }}>
            {stockStatus.label}
          </span>
        </div>
      ) : item.category === 'tea' ? (
        <>
          {/* Tea: Sample | 50g | 100g | Custom */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
            {[
              { key: 'sample', label: 'Sample', sub: '10g' },
              ...(50 <= sliderMax ? [{ key: '50', label: '50g', sub: '' }] : []),
              ...(100 <= sliderMax ? [{ key: '100', label: '100g', sub: '' }] : []),
              { key: 'custom', label: 'Custom', sub: '' },
            ].map(opt => {
              const isActive =
                opt.key === 'sample' ? sampleMode :
                opt.key === 'custom' ? customMode :
                (!sampleMode && !customMode && grams === parseInt(opt.key));
              return (
                <button
                  key={opt.key}
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(8);
                    if (opt.key === 'sample') {
                      setSampleMode(true); setCustomMode(false);
                    } else if (opt.key === 'custom') {
                      setCustomMode(true); setSampleMode(false);
                    } else {
                      setGrams(parseInt(opt.key)); setSampleMode(false); setCustomMode(false);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: "5px 0",
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px", fontWeight: 400,
                    letterSpacing: "0.05em",
                    color: isActive ? 'var(--tea-gold)' : 'var(--tea-text-dim)',
                    background: 'var(--tea-accent-sub)',
                    border: isActive ? '1px solid var(--tea-gold)' : '1px solid var(--tea-border)',
                    borderRadius: "3px",
                    cursor: "pointer",
                    transition: "border-color 0.15s, color 0.15s",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: "1px",
                  }}
                >
                  <span>{opt.label}</span>
                  {opt.sub && <span style={{ fontSize: "9px", opacity: 0.6 }}>{opt.sub}</span>}
                </button>
              );
            })}
          </div>

          {/* Stock status */}
          {stockStatus.level !== 'ok' && (
            <div style={{
              display: "flex", alignItems: "center", gap: "6px",
              marginBottom: "4px",
            }}>
              <div style={{
                width: "5px", height: "5px", borderRadius: "50%",
                background: stockStatus.color,
                boxShadow: stockStatus.level === 'low' ? `0 0 4px ${stockStatus.color}` : 'none',
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: "var(--font-sans)",
                fontSize: "10px",
                color: stockStatus.color,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}>
                {stockStatus.label}
              </span>
            </div>
          )}
        </>
      ) : (
        /* Teaware / non-tea: original preset row */
        <div style={{
          display: "flex", gap: "4px", alignItems: "center",
          marginBottom: "4px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginRight: "4px", flexShrink: 0 }}>
            <div style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: stockStatus.color,
              boxShadow: stockStatus.level === 'low' ? `0 0 4px ${stockStatus.color}` : 'none',
            }} />
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px", fontWeight: 400,
              color: alcoveColors.body,
              fontVariantNumeric: "tabular-nums lining-nums",
            }}>
              {formatPrice ? perGramDisplay : `$${perGramDisplay}`}/g
            </span>
          </div>
          {presets.map(p => (
            <button
              key={p}
              onClick={() => { setGrams(p); if (navigator.vibrate) navigator.vibrate(8); }}
              style={{
                flex: 1,
                padding: "4px 0",
                fontFamily: "var(--font-mono)",
                fontSize: "10px", fontWeight: 400,
                letterSpacing: "0.04em",
                color: grams === p ? 'var(--tea-bg)' : 'var(--tea-text-sec)',
                background: grams === p ? 'var(--tea-gold)' : 'var(--tea-accent-sub)',
                border: grams === p ? '1px solid var(--tea-gold)' : '1px solid var(--tea-border)',
                borderRadius: "3px",
                cursor: "pointer",
                transition: "all 0.2s ease-out",
              }}
            >
              {p}g
            </button>
          ))}
        </div>
      )}

      {/* Session reserve soft warning */}
      {item.sessionReserveGrams != null && item.sessionReserveGrams > 0 && item.stock_g <= item.sessionReserveGrams && !isSoldOut && (
        <div style={{ marginBottom: "4px" }}>
          <span className="text-tea-gold text-xs">
            Last ~{item.stock_g}g available — we'll confirm quantity before dispatching.
          </span>
        </div>
      )}

      {/* Row 2: Save/Share(/Edit) + Add button */}
      <div style={{ display: "flex", gap: "4px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
          height: "34px", boxSizing: "border-box",
          border: "1px solid var(--tea-border)",
          borderRadius: "3px",
          flexShrink: 0,
          padding: "0 10px",
        }}>
          <button
            onClick={() => toggleFavoriteTea(item.id)}
            onMouseEnter={() => setHovered("fav")}
            onMouseLeave={() => setHovered(null)}
            aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
            style={{
              background: "none", border: "none", padding: "0",
              cursor: "pointer", transition: "all 0.2s ease",
              display: "inline-flex", alignItems: "center", gap: "4px",
              opacity: favorited ? 1 : (hovered === "fav" ? 0.9 : 0.7),
            }}
          >
            <Heart
              size={13}
              color={favorited ? accent : alcoveColors.muted}
              fill={favorited ? accent : "none"}
              strokeWidth={1.5}
            />
          </button>
          {isAdmin && (
            <>
              <div style={{ width: "1px", height: "10px", background: "var(--tea-border)" }} />
              <button
                onClick={toggleSampleCart}
                onMouseEnter={() => setHovered("sample")}
                onMouseLeave={() => setHovered(null)}
                aria-label={inSampleCart ? "Remove from sample pack" : "Add to sample pack"}
                title={inSampleCart ? "In sample pack" : "Add to sample pack"}
                style={{
                  background: "none", border: "none", padding: "0",
                  cursor: "pointer", transition: "all 0.2s ease",
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  opacity: inSampleCart ? 1 : (hovered === "sample" ? 0.9 : 0.7),
                }}
              >
                <QrCode size={13} color={inSampleCart ? "var(--tea-gold)" : alcoveColors.muted} />
              </button>
            </>
          )}
          <div style={{ width: "1px", height: "10px", background: "var(--tea-border)" }} />
          <button
            onClick={handleShare}
            onMouseEnter={() => setHovered("share")}
            onMouseLeave={() => setHovered(null)}
            aria-label="Share"
            style={{
              background: "none", border: "none", padding: "0",
              cursor: "pointer", transition: "all 0.2s ease",
              display: "inline-flex", alignItems: "center", gap: "4px",
              opacity: hovered === "share" ? 0.9 : 0.7,
            }}
          >
            <span style={{
              fontFamily: "var(--font-sans)",
              fontSize: "10px", fontWeight: 400,
              letterSpacing: "0.08em", textTransform: "uppercase",
              color: shareCopied ? alcoveColors.success : alcoveColors.subtitle,
            }}>{shareCopied ? 'Copied' : 'Share'}</span>
          </button>
          {onTaste && (
            <>
              <div style={{ width: "1px", height: "10px", background: "var(--tea-border)" }} />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onTaste(item); }}
                onMouseEnter={() => setHovered("taste")}
                onMouseLeave={() => setHovered(null)}
                aria-label="Start tasting session"
                style={{
                  background: "none", border: "none", padding: "4px 0",
                  cursor: "pointer", transition: "all 0.2s ease",
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  opacity: hovered === "taste" ? 0.9 : 0.7,
                }}
              >
                <span style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "10px", fontWeight: 400,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  color: alcoveColors.subtitle,
                }}>Taste</span>
              </button>
            </>
          )}
          {isAdmin && onEdit && (
            <>
              <div style={{ width: "1px", height: "10px", background: "var(--tea-border)" }} />
              <button
                onClick={() => onEdit(item)}
                onMouseEnter={() => setHovered("edit")}
                onMouseLeave={() => setHovered(null)}
                aria-label="Edit Product"
                style={{
                  background: "none", border: "none", padding: "0",
                  cursor: "pointer", transition: "all 0.2s ease",
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  opacity: hovered === "edit" ? 0.9 : 0.7,
                }}
              >
                <Pencil size={14} style={{ color: alcoveColors.muted }} />
              </button>
            </>
          )}
        </div>

        <button
          onClick={handleAdd}
          disabled={isSoldOut}
          onMouseEnter={() => setHovered("cart")}
          onMouseLeave={() => setHovered(null)}
          style={{
            flex: 1, height: "34px", boxSizing: "border-box",
            fontFamily: "var(--font-sans)",
            fontSize: "12px", fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase",
            color: isSoldOut
              ? 'var(--tea-text-sec)'
              : added ? alcoveColors.bg : alcoveColors.bg,
            background: isSoldOut
              ? 'var(--tea-accent-sub)'
              : added
                ? alcoveColors.success
                : hovered === "cart"
                  ? 'var(--tea-gold-lt, #bfa06a)'
                  : 'var(--tea-gold, #a8874d)',
            border: isSoldOut
              ? '1px solid var(--tea-border)'
              : added
                ? `1px solid ${alcoveColors.success}`
                : '1px solid transparent',
            borderRadius: "4px",
            cursor: isSoldOut ? "not-allowed" : "pointer",
            transition: "all 0.25s ease",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            opacity: isSoldOut ? 0.6 : 1,
          }}
        >
          {isSoldOut ? (
            <span>Sold Out</span>
          ) : added ? (
            <span>Added</span>
          ) : sampleMode ? (
            <>
              <span>Sample — 10g</span>
              {pricePerGram > 0 && (
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "12px" }}>
                  {formatPrice ? formatPrice(pricePerGram, 10) : fmtShopPrice(pricePerGram * 10)}
                </span>
              )}
            </>
          ) : (
            <>
              <span>Order</span>
              <span style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 500, fontSize: "12px",
              }}>
                {formatPrice ? total : `$${total}`}
              </span>
              {pricePerGram > 0 && (
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 400, fontSize: "10px", opacity: 0.55,
                }}>
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
