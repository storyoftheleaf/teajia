import React, { useState, useRef, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import type { InventoryItem } from '../../types';
import { useAppStore } from '../../lib/store';
import { fmtNum } from '../../utils/formatNumber';
import { TeaPlaceholder } from './TeaPlaceholder';

interface AlcoveCardProps {
  item: InventoryItem;
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  onClose?: () => void;
  /** Admin mode — shows edit button */
  isAdmin?: boolean;
  /** Called when admin clicks edit */
  onEdit?: (item: InventoryItem) => void;
  /** Custom price formatter (admin uses formatCurrency with rates) */
  formatPrice?: (pricePerGram: number, grams: number) => string;
}

function BookmarkIcon({ filled, color, strokeColor }: { filled: boolean; color: string; strokeColor: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? color : "none"}
      stroke={filled ? color : strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v18l-7-4-7 4V4z" />
    </svg>
  );
}

function ShareIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
      <polyline points="12 3 12 16" />
      <polyline points="8 7 12 3 16 7" />
    </svg>
  );
}

/** Returns stock status info for display */
function getStockStatus(stockG: number, status?: string, isOneOfAKind?: boolean) {
  if (status === 'Sold Out' || stockG <= 0) {
    return { label: 'Sold Out', color: '#c0392b', level: 'out' as const };
  }
  if (isOneOfAKind) {
    return { label: 'Recommended Selection', color: '#c87533', level: 'limited' as const };
  }
  if (stockG < 50) {
    return { label: `Only ${stockG}g left`, color: '#c87533', level: 'low' as const };
  }
  if (stockG < 100) {
    return { label: 'Low Stock', color: '#c09a51', level: 'low' as const };
  }
  return { label: 'In Stock', color: '#5A6E5A', level: 'ok' as const };
}

export const AlcoveCard: React.FC<AlcoveCardProps> = ({ item, onAddToCart, onClose, isAdmin, onEdit, formatPrice }) => {
  const { favoriteTeas, toggleFavoriteTea } = useAppStore();
  const favorited = favoriteTeas.includes(item.id);
  const [grams, setGrams] = useState(25);
  const [added, setAdded] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  const sliderMin = 5;
  const sliderMax = Math.max(25, Math.floor(item.stock_g || 500));
  const sliderStep = 5;
  const snapPoints = [25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500].filter(p => p <= sliderMax);
  const pricePerGram = parseFloat(item.price_per_gram || '0');
  const total = formatPrice ? formatPrice(pricePerGram, grams) : fmtNum(pricePerGram * grams);
  const perGramDisplay = formatPrice ? formatPrice(pricePerGram, 1) : fmtNum(pricePerGram);
  const sliderPercentage = sliderMax > sliderMin ? ((grams - sliderMin) / (sliderMax - sliderMin)) * 100 : 0;

  // Stock status
  const stockStatus = getStockStatus(item.stock_g, undefined, item.isOneOfAKind);
  const isSoldOut = stockStatus.level === 'out';

  // Quantity presets - only show values that are <= stock
  const presets = [25, 50, 100, 250].filter(p => p <= sliderMax);

  // Snap to nearest marked point on release
  const snapToNearest = (val: number) => {
    const snapThreshold = 10;
    for (const sp of snapPoints) {
      if (Math.abs(val - sp) <= snapThreshold) return sp;
    }
    return val;
  };

  // Move in 5g increments, with magnetic snap near marked points
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value);
    // Round to nearest 5
    const rounded = Math.round(raw / 5) * 5;
    const clamped = Math.max(sliderMin, Math.min(sliderMax, rounded));
    // Magnetic snap to marked points during drag
    const magnetThreshold = 6;
    for (const sp of snapPoints) {
      if (Math.abs(clamped - sp) <= magnetThreshold) {
        if (sp !== grams) {
          setGrams(sp);
          if (navigator.vibrate) navigator.vibrate(8);
        }
        return;
      }
    }
    if (clamped !== grams) {
      setGrams(clamped);
    }
  };

  const noteOpacities = [1, 0.82, 0.65, 0.5];
  const markerOpacities = [0.7, 0.5, 0.35, 0.2];
  const markerWidths = [18, 16, 14, 12];

  // Alcove uses the main Espresso+Gold palette — see designTokens.ts
  const alcoveColors = {
    bg: 'var(--tea-bg)',
    title: 'var(--tea-text)',
    subtitle: 'var(--tea-text-sec)',
    body: 'var(--tea-text-sec)',
    bodyHighlight: 'var(--tea-text)',
    note: 'var(--tea-text-sec)',
    accent: 'var(--tea-gold)',
    muted: 'var(--tea-text-sec)',
    mutedDark: 'var(--tea-text-sec)',
    success: '#5A6E5A',
  };
  const accent = alcoveColors.accent;

  // Derive display values from InventoryItem
  const productName = item.variant || item.name;
  const givenName = item.variant !== item.name ? item.name : '';
  const chineseCharacters = item.chineseName || '';
  const teaType = item.type;
  const origin = item.origin;
  const vintage = item.year;
  const extras = [item.terroir, item.processingNotes].filter(Boolean).join(' ');
  const story = (item.lore || item.description) + (extras ? ' ' + extras : '');
  const notes = item.tags || [];
  const feeling = item.mood || '';
  const feelingDescription = item.experience || '';
  const photoUrl = item.image;
  const magazineUrl = item.magazineUrl;

  // Scroll overflow detection
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      const canScroll = el.scrollHeight > el.clientHeight;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
      setShowFade(canScroll && !atBottom);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  const handleAdd = () => {
    if (isSoldOut) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
    if (onAddToCart) {
      onAddToCart(item, grams, parseFloat(total));
    }
  };

  // Share handler — uses Web Share API with clipboard fallback
  const handleShare = async () => {
    const shareText = `${item.name} — ${origin} ${teaType} from Teajia`;
    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: item.name,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error — silent
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } catch {
        // Clipboard API unavailable
      }
    }
  };

  return (
    <div style={{
      width: "100%",
      height: "100%",
      maxHeight: "100%",
      background: alcoveColors.bg,
      position: "relative",
      overflow: "hidden",
      borderRadius: "3px",
      display: "flex",
      flexDirection: "column",
    }}>



      {/* Layer 1: Multi-stop radial warmth */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 70% 50% at 85% 8%, rgba(180,120,40,0.09) 0%, transparent 60%),
          radial-gradient(ellipse 50% 40% at 90% 0%, rgba(200,140,50,0.05) 0%, transparent 50%)
        `,
      }} />

      {/* Layer 2: Fine noise grain */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.06,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "120px",
      }} />

      {/* === PINNED TOP: Identity === */}
      <div style={{
        position: "relative", zIndex: 1, flexShrink: 0,
        transition: "all 0.3s ease",
      }}>
        {chineseCharacters && (
          <div style={{
            position: "absolute", right: "14px", top: "14px",
            fontFamily: "'Ma Shan Zheng', cursive",
            fontSize: "64px", fontWeight: 400, lineHeight: 1,
            color: "var(--tea-accent-sub)",
            letterSpacing: "0.05em",
            userSelect: "none", pointerEvents: "none",
            whiteSpace: "nowrap",
          }}>
            {chineseCharacters}
          </div>
        )}
        {/* Admin edit button */}
        {isAdmin && onEdit && (
          <button
            onClick={() => onEdit(item)}
            style={{
              position: "absolute", right: chineseCharacters ? "auto" : "14px",
              left: chineseCharacters ? "14px" : "auto",
              top: "14px", zIndex: 10,
              width: "32px", height: "32px",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--tea-surface)", border: "1px solid var(--tea-border)",
              borderRadius: "50%", cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tea-elevated)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tea-surface)"; }}
            title="Edit Product"
          >
            <Pencil size={14} style={{ color: "var(--tea-text-sec)" }} />
          </button>
        )}
        <div style={{
          padding: "24px 20px 8px",
          position: "relative",
        }}>
            <>
              <h1 style={{
                fontFamily: "var(--font-display)",
                fontSize: "30px", fontWeight: 300, color: alcoveColors.title,
                margin: "0 0 6px 0", lineHeight: 1.0, letterSpacing: "-0.01em",
              }}>
                {productName}
              </h1>
              {givenName && (
                <p style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "18px", fontStyle: "italic", fontWeight: 300,
                  color: alcoveColors.subtitle, margin: "0",
                }}>
                  {givenName}
                </p>
              )}
            </>
        </div>
      </div>

      {/* === SCROLLABLE MIDDLE === */}
      <div ref={scrollRef} className="tea-card-scroll" style={{
        position: "relative", zIndex: 1,
        flex: 1,
        overflowY: "auto",
        minHeight: 0,
      }}>

        {/* Inset content panel */}
        <div style={{
          position: "relative",
          margin: "6px 4px 0",
          borderRadius: "6px",
          background: "var(--tea-surface)",
          boxShadow: "inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub), 0 -1px 0 var(--tea-accent-sub)",
          overflow: "hidden",
          flex: 1, minHeight: 0,
          display: "flex", flexDirection: "column",
          animation: "panelReveal 0.5s ease-out",
        }}>
          {/* Fine noise texture overlay */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.08,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: "120px",
          }} />
          {/* Ambient top-glow */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "60%",
            pointerEvents: "none",
            background: "radial-gradient(ellipse 80% 30% at 70% 0%, var(--tea-accent-sub), transparent)",
          }} />

          {/* Tea type · origin · year */}
          <div style={{
            padding: "8px 14px",
            borderBottom: "1px solid var(--tea-border)",
            position: "relative", flexShrink: 0,
          }}>
            <p style={{
              fontFamily: "var(--font-display)",
              fontSize: "14px", fontWeight: 300, fontStyle: "italic",
              color: alcoveColors.subtitle, margin: 0, textAlign: "center",
            }}>
              {teaType}
              {origin && <><span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>{origin}</>}
              {vintage && <><span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>{vintage}</>}
            </p>
          </div>

          {/* Notes + photo section — notes overlaid on photo */}
          <div style={{
            padding: "10px 14px",
            background: "var(--tea-accent-sub)",
            position: "relative",
            overflow: "hidden",
            flexShrink: 0,
            maxHeight: "180px",
            borderBottom: "1px solid var(--tea-border)",
          }}>
            {/* Photo or placeholder behind notes */}
            <div
              style={{
                position: "absolute", top: 0, right: 0, bottom: 0, width: "75%",
                overflow: "hidden", pointerEvents: "none",
              }}
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt=""
                  style={{
                    width: "100%", height: "100%",
                    objectFit: "cover", objectPosition: "center right",
                    transform: "scale(1.05)",
                    WebkitMaskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.02) 15%, rgba(0,0,0,0.08) 30%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.5) 70%, black 90%), linear-gradient(to bottom, black 85%, transparent 100%)",
                    WebkitMaskComposite: "destination-in",
                    maskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.02) 15%, rgba(0,0,0,0.08) 30%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.5) 70%, black 90%), linear-gradient(to bottom, black 85%, transparent 100%)",
                    maskComposite: "intersect",
                  }}
                />
              ) : (
                <div style={{
                  width: "100%", height: "100%",
                  WebkitMaskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.05) 20%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.5) 65%, black 90%), linear-gradient(to bottom, black 85%, transparent 100%)",
                  WebkitMaskComposite: "destination-in",
                  maskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.05) 20%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.5) 65%, black 90%), linear-gradient(to bottom, black 85%, transparent 100%)",
                  maskComposite: "intersect",
                }}>
                  <TeaPlaceholder type={teaType} style={{ width: "100%", height: "100%" }} />
                </div>
              )}
            </div>

            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {feeling && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: `${markerWidths[0]}px`, height: "2px", flexShrink: 0,
                      background: accent, opacity: markerOpacities[0], borderRadius: "1px",
                    }} />
                    <span style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "15px", fontWeight: 300, fontStyle: "italic",
                      color: alcoveColors.note, opacity: noteOpacities[0],
                      textShadow: "0 1px 8px rgba(28,27,25,0.9), 0 0 20px rgba(28,27,25,0.6)",
                    }}>
                      {feeling}
                    </span>
                  </div>
                )}
                {notes.map((note, i) => (
                  <div key={note} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: `${markerWidths[i] ?? 12}px`, height: "2px", flexShrink: 0,
                      background: accent,
                      opacity: markerOpacities[i] ?? 0.2,
                      borderRadius: "1px",
                    }} />
                    <span style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "15px", fontWeight: 300, fontStyle: "italic",
                      color: alcoveColors.note,
                      opacity: noteOpacities[i] ?? 0.5,
                      textShadow: "0 1px 8px rgba(28,27,25,0.9), 0 0 20px rgba(28,27,25,0.6)",
                    }}>
                      {note}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Experience — personal connection */}
          {feelingDescription && (
            <div style={{
              padding: "12px 16px",
              borderBottom: story ? "1px solid var(--tea-border)" : "none",
            }}>
              <p style={{
                fontFamily: "var(--font-body)",
                fontSize: "14px", fontWeight: 300, fontStyle: "italic",
                lineHeight: 1.6,
                color: alcoveColors.subtitle, margin: 0,
              }}>
                {feelingDescription}
              </p>
            </div>
          )}

          {/* Story / Lore — at the very bottom */}
          {story && (
            <div style={{
              padding: "12px 16px",
              position: "relative",
            }}>
              {magazineUrl ? (
                <a
                  href={magazineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseEnter={() => setHovered("magazine")}
                  onMouseLeave={() => setHovered(null)}
                  style={{ textDecoration: "none" }}
                >
                  <p style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "15px", fontWeight: 300, lineHeight: 1.65,
                    color: hovered === "magazine" ? alcoveColors.bodyHighlight : alcoveColors.body,
                    margin: 0, transition: "color 0.2s ease",
                    whiteSpace: "pre-line",
                  }}>
                    {story}
                  </p>
                </a>
              ) : (
                <p style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "15px", fontWeight: 300, lineHeight: 1.65,
                  color: alcoveColors.body, margin: 0,
                  whiteSpace: "pre-line",
                }}>
                  {story}
                </p>
              )}
            </div>
          )}

        </div>
      </div>

      {/* === PINNED BOTTOM: Commerce — price, slider, actions === */}
      <div style={{
        position: "relative", zIndex: 3, flexShrink: 0,
        padding: "10px 14px 14px",
        borderTop: "1px solid var(--tea-border)",
        background: alcoveColors.bg,
      }}>
            {/* Stock status indicator */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: "6px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: stockStatus.color,
                  boxShadow: stockStatus.level === 'low' ? `0 0 4px ${stockStatus.color}` : 'none',
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
              {/* Price per gram display */}
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px", fontWeight: 400,
                color: alcoveColors.body,
                fontVariantNumeric: "tabular-nums lining-nums",
              }}>
                {formatPrice ? perGramDisplay : `$${perGramDisplay}`}/g
              </span>
            </div>

            {/* Quantity presets */}
            {!isSoldOut && presets.length > 1 && (
              <div style={{
                display: "flex", gap: "4px",
                marginBottom: "6px",
              }}>
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
                      transition: "all 0.15s ease",
                    }}
                  >
                    {p}g
                  </button>
                ))}
              </div>
            )}

            {/* Price Tag: price + gram selector */}
            {!isSoldOut && (
              <>
                <div style={{
                  display: "flex", alignItems: "baseline", justifyContent: "space-between",
                  marginBottom: "1px",
                }}>
                  <div style={{ display: "flex", alignItems: "baseline" }}>
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px", fontWeight: 400, color: alcoveColors.body,
                      lineHeight: 1, fontVariantNumeric: "tabular-nums lining-nums",
                    }}>
                      {formatPrice ? total : `$${total}`}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline" }}>
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px", fontWeight: 400, color: alcoveColors.body,
                      lineHeight: 1, fontVariantNumeric: "tabular-nums lining-nums",
                    }}>
                      {grams}
                    </span>
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px", fontWeight: 400, color: alcoveColors.subtitle,
                      marginLeft: "1px",
                    }}>g</span>
                  </div>
                </div>
                {/* Slider with tick marks */}
                <div style={{ position: "relative", width: "100%", height: "16px", display: "flex", alignItems: "center", marginBottom: "8px" }}>
                  <input
                    type="range"
                    min={sliderMin}
                    max={sliderMax}
                    step={sliderStep}
                    value={grams}
                    onChange={handleSliderChange}
                    onMouseUp={() => setGrams(g => snapToNearest(g))}
                    onTouchEnd={() => setGrams(g => snapToNearest(g))}
                    aria-label={`Select quantity: ${grams}g`}
                    style={{
                      position: "absolute", width: "100%", height: "100%",
                      opacity: 0, cursor: "pointer", zIndex: 20, margin: 0,
                    }}
                  />
                  <div style={{
                    width: "100%", height: "3px",
                    background: "var(--tea-accent-sub)",
                    borderRadius: "2px",
                    position: "relative",
                  }}>
                    <div style={{
                      position: "absolute", height: "100%",
                      width: `${sliderPercentage}%`,
                      background: `linear-gradient(90deg, var(--tea-gold), var(--tea-gold-lt))`,
                      borderRadius: "2px",
                      transition: "width 0.075s ease",
                    }} />
                    {snapPoints.map((sp) => {
                      const pct = sliderMax > sliderMin ? ((sp - sliderMin) / (sliderMax - sliderMin)) * 100 : 0;
                      return (
                        <div
                          key={sp}
                          style={{
                            position: "absolute",
                            left: `${pct}%`,
                            top: "-3px",
                            width: "1px", height: "9px",
                            background: grams === sp
                              ? "var(--tea-gold)"
                              : "var(--tea-border)",
                            transition: "background 0.15s ease",
                            pointerEvents: "none",
                          }}
                        />
                      );
                    })}
                  </div>
                  <div style={{
                    position: "absolute",
                    left: `calc(${sliderPercentage}% - 6px)`,
                    width: "12px", height: "12px",
                    borderRadius: "50%",
                    background: accent,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                    pointerEvents: "none", zIndex: 10,
                    transition: "left 0.075s ease",
                  }} />
                </div>
              </>
            )}

            {/* Action row */}
            <div style={{ display: "flex", gap: "4px" }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                height: "36px", boxSizing: "border-box",
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
                  <BookmarkIcon filled={favorited} color={accent} strokeColor={alcoveColors.muted} />
                  <span style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "10px", fontWeight: 400,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: favorited ? accent : alcoveColors.subtitle,
                  }}>Save</span>
                </button>
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
                  <ShareIcon color={shareCopied ? alcoveColors.success : alcoveColors.muted} />
                  <span style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "10px", fontWeight: 400,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: shareCopied ? alcoveColors.success : alcoveColors.subtitle,
                  }}>{shareCopied ? 'Copied' : 'Share'}</span>
                </button>
              </div>

              <button
                onClick={handleAdd}
                disabled={isSoldOut}
                onMouseEnter={() => setHovered("cart")}
                onMouseLeave={() => setHovered(null)}
                style={{
                  flex: 1, height: "36px", boxSizing: "border-box",
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px", fontWeight: 400,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  color: isSoldOut
                    ? 'var(--tea-text-sec)'
                    : added ? alcoveColors.bg : (hovered === "cart" ? alcoveColors.note : alcoveColors.muted),
                  background: isSoldOut
                    ? 'var(--tea-accent-sub)'
                    : added
                      ? alcoveColors.success
                      : hovered === "cart"
                        ? "var(--tea-accent-sub)"
                        : "transparent",
                  border: isSoldOut
                    ? '1px solid var(--tea-border)'
                    : added
                      ? `1px solid ${alcoveColors.success}`
                      : `1px solid var(--tea-border)`,
                  borderRadius: "3px",
                  cursor: isSoldOut ? "not-allowed" : "pointer",
                  transition: "all 0.25s ease",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  opacity: isSoldOut ? 0.6 : 1,
                }}
              >
                <span>{isSoldOut ? "Sold Out" : added ? "Added" : "Add"}</span>
                {!isSoldOut && (
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: 300, fontStyle: "italic", opacity: 0.7, fontSize: "11px",
                  }}>
                    {formatPrice ? total : `$${total}`}
                  </span>
                )}
              </button>
            </div>
      </div>

      {/* Fade indicator at bottom of scrollable area, above pinned commerce */}
      <div style={{
        position: "relative", flexShrink: 0, height: 0,
        pointerEvents: "none", zIndex: 2,
      }}>
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "24px",
          background: `linear-gradient(to top, ${alcoveColors.bg}, transparent)`,
          opacity: showFade ? 1 : 0,
          transition: "opacity 0.3s ease",
        }} />
      </div>

      {/* Fullscreen image overlay */}
      {imageExpanded && (
        <div
          onClick={() => setImageExpanded(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "var(--tea-bg)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={item.name}
              style={{
                maxWidth: "90vw", maxHeight: "90vh",
                objectFit: "contain",
                borderRadius: "4px",
              }}
            />
          ) : (
            <TeaPlaceholder
              type={teaType}
              style={{
                width: "60vmin", height: "60vmin",
                maxWidth: "400px", maxHeight: "400px",
              }}
            />
          )}
          <button
            style={{
              position: "absolute", top: "16px", right: "16px",
              width: "36px", height: "36px",
              background: "var(--tea-accent-sub)", border: "none", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--tea-text-sec)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
