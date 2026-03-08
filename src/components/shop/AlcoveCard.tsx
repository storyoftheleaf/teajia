import React, { useState, useRef, useEffect } from 'react';
import type { InventoryItem } from '../../types';
import { useAppStore } from '../../lib/store';

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
  const [storyExpanded, setStoryExpanded] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const storyScrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);
  const [storyFadeTop, setStoryFadeTop] = useState(false);
  const [storyFadeBottom, setStoryFadeBottom] = useState(false);

  const presets = [25, 50, 100, 150, 300];
  const pricePerGram = parseFloat(item.price_per_gram || '0');
  const total = (pricePerGram * grams).toFixed(2);
  const noteOpacities = [1, 0.82, 0.65, 0.5];
  const markerOpacities = [0.7, 0.5, 0.35, 0.2];
  const markerWidths = [18, 16, 14, 12];
  // Themeable color tokens — override via CSS custom properties on a parent element
  const alcoveColors = {
    bg: 'var(--alcove-bg, #1c1b19)',
    title: 'var(--alcove-title, #ede6d8)',
    subtitle: 'var(--alcove-subtitle, #8a7e6a)',
    body: 'var(--alcove-body, #c0b49a)',
    bodyHighlight: 'var(--alcove-body-highlight, #d0c4aa)',
    note: 'var(--alcove-note, #c4b89a)',
    accent: 'var(--alcove-accent, #b5651d)',
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

  // Story scroll fade detection
  useEffect(() => {
    const el = storyScrollRef.current;
    if (!el) return;
    const checkStory = () => {
      const canScroll = el.scrollHeight > el.clientHeight;
      const atTop = el.scrollTop < 4;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 4;
      setStoryFadeTop(canScroll && !atTop);
      setStoryFadeBottom(canScroll && !atBottom);
    };
    checkStory();
    el.addEventListener("scroll", checkStory, { passive: true });
    return () => el.removeEventListener("scroll", checkStory);
  }, [item]);

  const handleAdd = () => {
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
    if (onAddToCart) {
      onAddToCart(item, grams, parseFloat(total));
    }
  };

  return (
    <div style={{
      width: "100%", maxWidth: "480px",
      minHeight: "580px", maxHeight: "720px",
      background: alcoveColors.bg,
      position: "relative",
      overflow: "hidden",
      borderRadius: "3px",
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

      {/* Scrollable content wrapper */}
      <div ref={scrollRef} className="tea-card-scroll" style={{
        position: "relative", zIndex: 1,
        minHeight: "580px", maxHeight: "720px",
        overflowY: "auto",
        display: "flex", flexDirection: "column",
      }}>

        {/* Block 1: Identity */}
        {chineseCharacters && (
          <div style={{
            position: "absolute", right: "20px", top: "24px",
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
        <div style={{ padding: "24px 20px 8px", position: "relative" }}>
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
        </div>

        {/* Inset content panel */}
        <div style={{
          position: "relative",
          margin: "8px 8px 10px",
          borderRadius: "6px",
          background: "rgba(0,0,0,0.25)",
          boxShadow: "inset 0 1px 0 rgba(200,170,120,0.06), inset 0 -1px 0 rgba(200,170,120,0.04), 0 -1px 0 rgba(200,170,120,0.06)",
          overflow: "hidden",
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
            background: "radial-gradient(ellipse 80% 30% at 70% 0%, rgba(200,170,120,0.04), transparent)",
          }} />

          {/* Tea details */}
          <div style={{
            padding: "10px 16px",
            borderBottom: "1px solid rgba(200,170,120,0.08)",
            position: "relative",
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

          {/* Story — inline scrollable, expandable */}
          {story && (
            <div style={{
              position: "relative",
              borderBottom: "1px solid rgba(200,170,120,0.08)",
            }}>
              {/* Top fade */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: "20px",
                background: "linear-gradient(to bottom, rgba(0,0,0,0.25), transparent)",
                pointerEvents: "none", zIndex: 1, borderRadius: "6px 6px 0 0",
                opacity: storyFadeTop ? 1 : 0,
                transition: "opacity 0.2s ease",
              }} />
              <div
                ref={storyScrollRef}
                className="tea-card-scroll"
                style={{
                  maxHeight: storyExpanded ? "400px" : "130px",
                  overflowY: "auto",
                  padding: "12px 16px",
                  transition: "max-height 0.4s ease",
                }}
              >
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
                      fontSize: "17px", fontWeight: 300, lineHeight: 1.6,
                      color: hovered === "magazine" ? alcoveColors.bodyHighlight : alcoveColors.body,
                      margin: 0, transition: "color 0.2s ease",
                    }}>
                      {story}
                    </p>
                  </a>
                ) : (
                  <p style={{
                    fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                    fontSize: "17px", fontWeight: 300, lineHeight: 1.6,
                    color: alcoveColors.body, margin: 0,
                  }}>
                    {story}
                  </p>
                )}
              </div>
              {/* Bottom fade */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: "20px",
                background: "linear-gradient(to top, rgba(0,0,0,0.25), transparent)",
                pointerEvents: "none", zIndex: 1,
                opacity: storyFadeBottom ? 1 : 0,
                transition: "opacity 0.2s ease",
              }} />
              {/* Expand/collapse toggle — only show when story overflows */}
              {(storyFadeBottom || storyExpanded) && (
                <button
                  onClick={() => setStoryExpanded(prev => !prev)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: "6px", width: "100%",
                    padding: "4px 0",
                    background: "none", border: "none", cursor: "pointer",
                  }}
                >
                  <span style={{
                    fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                    fontSize: "11px", fontWeight: 300, fontStyle: "italic",
                    color: alcoveColors.mutedDark,
                    letterSpacing: "0.05em",
                    transition: "color 0.2s ease",
                  }}>
                    {storyExpanded ? 'less' : 'more'}
                  </span>
                  <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke={alcoveColors.mutedDark} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{
                      transition: "transform 0.3s ease",
                      transform: storyExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Notes + photo */}
          <div style={{
            padding: "14px 16px",
            background: "rgba(181,101,29,0.03)",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Photo behind notes */}
            {photoUrl && (
              <div
                onClick={() => setImageExpanded(true)}
                style={{
                  position: "absolute", top: 0, right: 0, bottom: 0, width: "75%",
                  overflow: "hidden", cursor: "pointer",
                }}
              >
                <img
                  src={photoUrl}
                  alt="Tea leaves"
                  style={{
                    width: "100%", height: "100%",
                    objectFit: "cover", objectPosition: "center right",
                    transform: "scale(1.05)",
                    WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.12) 25%, rgba(0,0,0,0.3) 45%, rgba(0,0,0,0.55) 60%, black 85%, black 100%), linear-gradient(to bottom, black 85%, transparent 100%)",
                    WebkitMaskComposite: "destination-in",
                    maskImage: "linear-gradient(to right, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.12) 25%, rgba(0,0,0,0.3) 45%, rgba(0,0,0,0.55) 60%, black 85%, black 100%), linear-gradient(to bottom, black 85%, transparent 100%)",
                    maskComposite: "intersect",
                  }}
                />
                {/* Expand icon hint */}
                <div style={{
                  position: "absolute", bottom: "8px", right: "8px",
                  width: "28px", height: "28px",
                  background: "rgba(0,0,0,0.45)", borderRadius: "4px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: 0.7, transition: "opacity 0.2s ease",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="rgba(200,170,120,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </div>
              </div>
            )}

            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
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
                      fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
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
        </div>

        {feelingDescription && (
          <p style={{
            fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
            fontSize: "15px", fontWeight: 300, fontStyle: "italic",
            color: alcoveColors.body, margin: 0,
            padding: "10px 20px",
            lineHeight: 1.6,
          }}>
            {feelingDescription}
          </p>
        )}

        {/* Block 4: Commerce */}
        <div style={{ padding: "6px 20px 16px", marginTop: "auto", flexShrink: 0 }}>

          {/* Price Tag: price + gram selector */}
          <div style={{
            display: "flex", alignItems: "center",
            padding: "10px 14px",
            background: "rgba(200,170,120,0.03)",
            borderRadius: "3px",
            marginBottom: "8px",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", flexShrink: 0, marginRight: "auto" }}>
              <span style={{
                fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                fontSize: "15px", fontWeight: 300, color: alcoveColors.body,
                lineHeight: 1,
              }}>
                ${pricePerGram.toFixed(2)}
              </span>
              <span style={{
                fontFamily: "'Bricolage Grotesque', 'Bricolage Fallback', 'Arial', sans-serif",
                fontSize: "11px", fontWeight: 300, color: alcoveColors.subtitle,
                marginLeft: "2px",
              }}>/g</span>
            </div>

            <div style={{ display: "flex", gap: "2px", flexWrap: "wrap" }}>
              {presets.map((g) => (
                <button
                  key={g}
                  onClick={() => setGrams(g)}
                  onMouseEnter={() => setHovered(`preset-${g}`)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    fontFamily: "'Bricolage Grotesque', 'Bricolage Fallback', 'Arial', sans-serif",
                    fontSize: "11px",
                    fontWeight: grams === g ? 500 : 300,
                    padding: "6px 8px",
                    border: "none", borderRadius: "2px",
                    cursor: "pointer", transition: "all 0.2s ease",
                    background: grams === g
                      ? "rgba(200,170,120,0.15)"
                      : hovered === `preset-${g}`
                        ? "rgba(200,170,120,0.08)"
                        : "transparent",
                    color: grams === g
                      ? alcoveColors.body
                      : hovered === `preset-${g}`
                        ? alcoveColors.muted
                        : alcoveColors.subtitle,
                  }}
                >
                  {g}<span style={{ fontSize: "8px", opacity: 0.6 }}>g</span>
                </button>
              ))}
              <button
                onMouseEnter={() => setHovered("preset-other")}
                onMouseLeave={() => setHovered(null)}
                style={{
                  fontFamily: "'Bricolage Grotesque', 'Bricolage Fallback', 'Arial', sans-serif",
                  fontSize: "11px", fontWeight: 300,
                  padding: "6px 8px",
                  border: "none", borderRadius: "2px",
                  cursor: "pointer", transition: "all 0.2s ease",
                  background: hovered === "preset-other"
                    ? "rgba(200,170,120,0.08)"
                    : "transparent",
                  color: hovered === "preset-other"
                    ? alcoveColors.muted
                    : alcoveColors.subtitle,
                }}
              >
                Other
              </button>
            </div>
          </div>

          {/* Action row: Save/Share + Cart */}
          <div style={{ display: "flex", gap: "6px" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "14px",
              height: "44px", boxSizing: "border-box",
              border: "1px solid rgba(200,170,120,0.2)",
              borderRadius: "3px",
              flexShrink: 0,
              padding: "0 16px",
            }}>
              <button
                onClick={() => toggleFavoriteTea(item.id)}
                onMouseEnter={() => setHovered("fav")}
                onMouseLeave={() => setHovered(null)}
                aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
                style={{
                  background: "none", border: "none", padding: "0",
                  cursor: "pointer", transition: "all 0.2s ease",
                  display: "inline-flex", alignItems: "center", gap: "5px",
                  opacity: favorited ? 1 : (hovered === "fav" ? 0.9 : 0.7),
                }}
              >
                <BookmarkIcon filled={favorited} color={accent} strokeColor={alcoveColors.muted} />
                <span style={{
                  fontFamily: "'Bricolage Grotesque', 'Bricolage Fallback', 'Arial', sans-serif",
                  fontSize: "11px", fontWeight: 400,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  color: favorited ? accent : alcoveColors.subtitle,
                }}>Save</span>
              </button>
              <div style={{ width: "1px", height: "10px", background: "rgba(200,170,120,0.15)" }} />
              <button
                onMouseEnter={() => setHovered("share")}
                onMouseLeave={() => setHovered(null)}
                aria-label="Share"
                style={{
                  background: "none", border: "none", padding: "0",
                  cursor: "pointer", transition: "all 0.2s ease",
                  display: "inline-flex", alignItems: "center", gap: "5px",
                  opacity: hovered === "share" ? 0.9 : 0.7,
                }}
              >
                <ShareIcon color={alcoveColors.muted} />
                <span style={{
                  fontFamily: "'Bricolage Grotesque', 'Bricolage Fallback', 'Arial', sans-serif",
                  fontSize: "11px", fontWeight: 400,
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
                flex: 1, height: "44px", boxSizing: "border-box",
                fontFamily: "'Bricolage Grotesque', 'Bricolage Fallback', 'Arial', sans-serif",
                fontSize: "12px", fontWeight: 400,
                letterSpacing: "0.06em", textTransform: "uppercase",
                color: added ? alcoveColors.bg : (hovered === "cart" ? alcoveColors.note : alcoveColors.muted),
                background: added
                  ? alcoveColors.success
                  : hovered === "cart"
                    ? "rgba(200,170,120,0.06)"
                    : "transparent",
                border: added
                  ? `1px solid ${alcoveColors.success}`
                  : `1px solid rgba(200,170,120,${hovered === "cart" ? 0.3 : 0.2})`,
                borderRadius: "3px", cursor: "pointer",
                transition: "all 0.25s ease",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              }}
            >
              <span>{added ? "Added" : "Add"}</span>
              <span style={{
                fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                fontWeight: 300, fontStyle: "italic", opacity: 0.7, fontSize: "12px",
              }}>
                ${total}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom fade indicator */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "24px",
        background: `linear-gradient(to top, ${alcoveColors.bg}, transparent)`,
        pointerEvents: "none", zIndex: 2,
        opacity: showFade ? 1 : 0,
        transition: "opacity 0.3s ease",
      }} />

      {/* Fullscreen image overlay */}
      {imageExpanded && photoUrl && (
        <div
          onClick={() => setImageExpanded(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <img
            src={photoUrl}
            alt={item.name}
            style={{
              maxWidth: "90vw", maxHeight: "90vh",
              objectFit: "contain",
              borderRadius: "4px",
            }}
          />
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
