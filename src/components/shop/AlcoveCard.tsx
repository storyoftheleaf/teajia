import React, { useState, useRef, useEffect } from 'react';
import type { InventoryItem } from '../../types';
import { useAppStore } from '../../lib/store';
import { fmtNum } from '../../utils/formatNumber';
import { TeaPlaceholder } from './TeaPlaceholder';

interface AlcoveCardProps {
  item: InventoryItem;
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  onClose?: () => void;
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

export const AlcoveCard: React.FC<AlcoveCardProps> = ({ item, onAddToCart, onClose }) => {
  const { favoriteTeas, toggleFavoriteTea } = useAppStore();
  const favorited = favoriteTeas.includes(item.id);
  const [grams, setGrams] = useState(25);
  const [added, setAdded] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [imageExpanded, setImageExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  const sliderMin = 25;
  const sliderMax = Math.max(25, Math.floor(item.stock_g || 500));
  const sliderStep = 1;
  const snapPoints = [25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500].filter(p => p <= sliderMax);
  const pricePerGram = parseFloat(item.price_per_gram || '0');
  const total = fmtNum(pricePerGram * grams);
  const sliderPercentage = sliderMax > sliderMin ? ((grams - sliderMin) / (sliderMax - sliderMin)) * 100 : 0;

  // Snap to nearest point
  const snapToNearest = (val: number) => {
    const snapThreshold = 8;
    for (const sp of snapPoints) {
      if (Math.abs(val - sp) <= snapThreshold) return sp;
    }
    return val;
  };

  // Snap during drag when very close to a snap point
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value);
    const magnetThreshold = 4; // tighter threshold during drag
    for (const sp of snapPoints) {
      if (Math.abs(raw - sp) <= magnetThreshold) {
        if (sp !== grams) {
          setGrams(sp);
          if (navigator.vibrate) navigator.vibrate(8);
        }
        return;
      }
    }
    if (raw !== grams) {
      setGrams(raw);
    }
  };

  const noteOpacities = [1, 0.82, 0.65, 0.5];
  const markerOpacities = [0.7, 0.5, 0.35, 0.2];
  const markerWidths = [18, 16, 14, 12];

  const alcoveColors = {
    bg: 'var(--alcove-bg, #1c1b19)',
    title: 'var(--alcove-title, #ede6d8)',
    subtitle: 'var(--alcove-subtitle, #8a7e6a)',
    body: 'var(--alcove-body, #c0b49a)',
    bodyHighlight: 'var(--alcove-body-highlight, #d0c4aa)',
    note: 'var(--alcove-note, #c4b89a)',
    accent: 'var(--alcove-accent, #b8924e)',
    muted: 'var(--alcove-muted, #9a9080)',
    mutedDark: 'var(--alcove-muted-dark, #6a6050)',
    success: 'var(--alcove-success, #7a9a72)',
  };
  const accent = alcoveColors.accent;

  // Derive display values from InventoryItem
  const productName = item.variant || item.name;
  const givenName = item.variant !== item.name ? item.name : '';
  const chineseCharacters = item.chineseName || '';
  const teaType = item.type;
  const origin = item.origin;
  const vintage = item.year;
  const story = item.lore || item.description;
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
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
    if (onAddToCart) {
      onAddToCart(item, grams, parseFloat(total));
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
            color: "rgba(200,170,120,0.05)",
            letterSpacing: "0.05em",
            userSelect: "none", pointerEvents: "none",
            whiteSpace: "nowrap",
          }}>
            {chineseCharacters}
          </div>
        )}
        <div style={{
          padding: "24px 20px 8px",
          position: "relative",
        }}>
            <>
              <h1 style={{
                fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                fontSize: "30px", fontWeight: 300, color: alcoveColors.title,
                margin: "0 0 6px 0", lineHeight: 1.0, letterSpacing: "-0.01em",
              }}>
                {productName}
              </h1>
              {givenName && (
                <p style={{
                  fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
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

        {/* Hero image — leads the content */}
        <div style={{
          position: "relative",
          margin: "4px 4px 0",
          borderRadius: "6px 6px 0 0",
          overflow: "hidden",
          flexShrink: 0,
        }}>
          {photoUrl ? (
            <div
              onClick={() => setImageExpanded(true)}
              style={{ cursor: "pointer", position: "relative" }}
            >
              <img
                src={photoUrl}
                alt={productName}
                style={{
                  width: "100%",
                  aspectRatio: "4 / 3",
                  objectFit: "cover",
                  display: "block",
                }}
              />
              {/* Bottom fade into panel */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: "40%",
                background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)",
                pointerEvents: "none",
              }} />
            </div>
          ) : (
            <div style={{ aspectRatio: "4 / 3", background: "rgba(0,0,0,0.2)" }}>
              <TeaPlaceholder type={teaType} style={{ width: "100%", height: "100%" }} />
            </div>
          )}
        </div>

        {/* Inset content panel */}
        <div style={{
          position: "relative",
          margin: "0 4px 0",
          borderRadius: "0 0 6px 6px",
          background: "rgba(0,0,0,0.25)",
          boxShadow: "inset 0 1px 0 rgba(200,170,120,0.06), inset 0 -1px 0 rgba(200,170,120,0.04), 0 -1px 0 rgba(200,170,120,0.06)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          animation: "panelReveal 0.5s ease-out",
        }}>
          {/* Fine noise texture overlay */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.08,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: "120px",
          }} />

          {/* Tea type · origin · year */}
          <div style={{
            padding: "10px 14px",
            borderBottom: "1px solid rgba(200,170,120,0.08)",
            position: "relative", flexShrink: 0,
          }}>
            <p style={{
              fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
              fontSize: "14px", fontWeight: 300, fontStyle: "italic",
              color: alcoveColors.subtitle, margin: 0, textAlign: "center",
            }}>
              {teaType}
              {origin && <><span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>{origin}</>}
              {vintage && <><span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>{vintage}</>}
            </p>
          </div>

          {/* Tasting notes */}
          {(feeling || notes.length > 0) && (
            <div style={{
              padding: "10px 14px",
              background: "rgba(184,146,78,0.03)",
              position: "relative",
              flexShrink: 0,
              borderBottom: "1px solid rgba(200,170,120,0.08)",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {feeling && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: `${markerWidths[0]}px`, height: "2px", flexShrink: 0,
                      background: accent, opacity: markerOpacities[0], borderRadius: "1px",
                    }} />
                    <span style={{
                      fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                      fontSize: "15px", fontWeight: 300, fontStyle: "italic",
                      color: alcoveColors.note, opacity: noteOpacities[0],
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
                      fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                      fontSize: "15px", fontWeight: 300, fontStyle: "italic",
                      color: alcoveColors.note,
                      opacity: noteOpacities[i] ?? 0.5,
                    }}>
                      {note}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Story / Lore — single instance */}
          {story && (
            <div style={{
              padding: "12px 16px",
              position: "relative",
              borderBottom: feelingDescription ? "1px solid rgba(200,170,120,0.08)" : "none",
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
                    fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                    fontSize: "15px", fontWeight: 300, lineHeight: 1.65,
                    color: hovered === "magazine" ? alcoveColors.bodyHighlight : alcoveColors.body,
                    margin: 0, transition: "color 0.2s ease",
                  }}>
                    {story}
                  </p>
                </a>
              ) : (
                <p style={{
                  fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                  fontSize: "15px", fontWeight: 300, lineHeight: 1.65,
                  color: alcoveColors.body, margin: 0,
                }}>
                  {story}
                </p>
              )}
            </div>
          )}

          {/* Experience — personal connection */}
          {feelingDescription && (
            <div style={{ padding: "12px 16px" }}>
              <p style={{
                fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                fontSize: "14px", fontWeight: 300, fontStyle: "italic",
                lineHeight: 1.6,
                color: alcoveColors.subtitle, margin: 0,
              }}>
                {feelingDescription}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* === PINNED BOTTOM: Commerce === */}
      <div style={{
        position: "relative", zIndex: 1, flexShrink: 0,
        padding: "6px 20px 16px",
        background: alcoveColors.bg,
        borderTop: "1px solid rgba(200,170,120,0.06)",
      }}>

          {/* Price Tag: price + gram selector */}
          <div style={{
            display: "flex", alignItems: "baseline", justifyContent: "space-between",
            marginBottom: "1px",
          }}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{
                fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                fontSize: "12px", fontWeight: 300, color: alcoveColors.body,
                lineHeight: 1,
              }}>
                ${fmtNum(pricePerGram)}
              </span>
              <span style={{
                fontFamily: "'Bricolage Grotesque', 'Bricolage Fallback', 'Arial', sans-serif",
                fontSize: "9px", fontWeight: 300, color: alcoveColors.subtitle,
                marginLeft: "1px",
              }}>/g</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{
                fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                fontSize: "12px", fontWeight: 300, color: alcoveColors.body,
                lineHeight: 1,
              }}>
                {grams}
              </span>
              <span style={{
                fontFamily: "'Bricolage Grotesque', 'Bricolage Fallback', 'Arial', sans-serif",
                fontSize: "9px", fontWeight: 300, color: alcoveColors.subtitle,
                marginLeft: "1px",
              }}>g</span>
            </div>
          </div>
          {/* Slider with tick marks */}
          <div style={{ position: "relative", width: "100%", height: "16px", display: "flex", alignItems: "center" }}>
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
              background: "rgba(200,170,120,0.1)",
              borderRadius: "2px",
              position: "relative",
            }}>
              <div style={{
                position: "absolute", height: "100%",
                width: `${sliderPercentage}%`,
                background: `linear-gradient(90deg, rgba(184,146,78,0.45), rgba(184,146,78,0.75))`,
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
                        ? "rgba(200,170,120,0.4)"
                        : "rgba(200,170,120,0.12)",
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
        </div>

        {/* Action row */}
        <div style={{ display: "flex", gap: "4px" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
            height: "36px", boxSizing: "border-box",
            border: "1px solid rgba(200,170,120,0.18)",
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
                fontFamily: "'Bricolage Grotesque', 'Bricolage Fallback', 'Arial', sans-serif",
                fontSize: "10px", fontWeight: 400,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: favorited ? accent : alcoveColors.subtitle,
              }}>Save</span>
            </button>
            <div style={{ width: "1px", height: "10px", background: "rgba(200,170,120,0.12)" }} />
            <button
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
              <ShareIcon color={alcoveColors.muted} />
              <span style={{
                fontFamily: "'Bricolage Grotesque', 'Bricolage Fallback', 'Arial', sans-serif",
                fontSize: "10px", fontWeight: 400,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: alcoveColors.subtitle,
              }}>Share</span>
            </button>
          </div>

          <button
            onClick={handleAdd}
            onMouseEnter={() => setHovered("cart")}
            onMouseLeave={() => setHovered(null)}
            style={{
              flex: 1, height: "36px", boxSizing: "border-box",
              fontFamily: "'Bricolage Grotesque', 'Bricolage Fallback', 'Arial', sans-serif",
              fontSize: "11px", fontWeight: 400,
              letterSpacing: "0.06em", textTransform: "uppercase",
              color: added ? alcoveColors.bg : (hovered === "cart" ? alcoveColors.note : alcoveColors.muted),
              background: added
                ? alcoveColors.success
                : hovered === "cart"
                  ? "rgba(200,170,120,0.06)"
                  : "transparent",
              border: added
                ? `1px solid ${alcoveColors.success}`
                : `1px solid rgba(200,170,120,${hovered === "cart" ? 0.3 : 0.18})`,
              borderRadius: "3px", cursor: "pointer",
              transition: "all 0.25s ease",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
          >
            <span>{added ? "Added" : "Add"}</span>
            <span style={{
              fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
              fontWeight: 300, fontStyle: "italic", opacity: 0.7, fontSize: "11px",
            }}>
              ${total}
            </span>
          </button>
        </div>

      {/* Scrollable middle fade indicator */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "24px",
        background: `linear-gradient(to top, ${alcoveColors.bg}, transparent)`,
        pointerEvents: "none", zIndex: 2,
        opacity: showFade ? 1 : 0,
        transition: "opacity 0.3s ease",
      }} />

      {/* Fullscreen image overlay */}
      {imageExpanded && (
        <div
          onClick={() => setImageExpanded(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.92)",
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
              background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
