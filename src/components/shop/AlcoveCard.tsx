import React, { useState, useRef, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import type { InventoryItem } from '../../types';
import { useAppStore } from '../../lib/store';
import { fmtNum } from '../../utils/formatNumber';
import { TeaPlaceholder } from './TeaPlaceholder';
import {
  flattenTastingNotes,
  resolveTermLabel,
  resolveTermIcon,
  LIQUOR_COLORS,
  TERM_MAP,
} from '../../data/tastingTaxonomy';

interface AlcoveCardProps {
  item: InventoryItem;
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  onClose?: () => void;
  /** Admin mode — shows edit button */
  isAdmin?: boolean;
  /** Called when admin clicks edit */
  onEdit?: (item: InventoryItem) => void;
  /** Called when user clicks a tasting note for cross-reference filtering */
  onTermClick?: (termId: string, categoryId: string) => void;
  /** Custom price formatter (admin uses formatCurrency with rates) */
  formatPrice?: (pricePerGram: number, grams: number) => string;
  /** Called when user wants to start a tasting session */
  onTaste?: (item: InventoryItem) => void;
  /** All available items for "You might also like" recommendations */
  items?: InventoryItem[];
  /** Called when a recommended item is selected */
  onItemSelect?: (item: InventoryItem) => void;
}

/** Converts a string to Title Case */
function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
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
function getStockStatus(stockG: number, status?: string, isOneOfAKind?: boolean, isCurated?: boolean) {
  if (status === 'Sold Out' || stockG <= 0) {
    return { label: 'Sold Out', color: '#c0392b', level: 'out' as const };
  }
  if (isCurated) {
    return { label: 'Curated Selection', color: '#c87533', level: 'limited' as const };
  }
  if (isOneOfAKind) {
    return { label: 'Curated Selection', color: '#c87533', level: 'limited' as const };
  }
  if (stockG < 100) {
    return { label: 'Low Stock', color: '#c09a51', level: 'low' as const };
  }
  return { label: 'In Stock', color: '#5A6E5A', level: 'ok' as const };
}

export const AlcoveCard: React.FC<AlcoveCardProps> = ({ item, onAddToCart, onClose, isAdmin, onEdit, formatPrice, onTermClick, onTaste, items, onItemSelect }) => {
  const { favoriteTeas, toggleFavoriteTea } = useAppStore();
  const favorited = favoriteTeas.includes(item.id);
  const [grams, setGrams] = useState(25);
  const [added, setAdded] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
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
  const stockStatus = getStockStatus(item.stock_g, undefined, item.isOneOfAKind, item.isCurated);
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
  // Strip numbers and latin characters — only show actual CJK characters
  const chineseCharacters = (item.chineseName || '').replace(/[0-9A-Za-z\s]/g, '');
  const teaType = item.type;
  const origin = item.origin;
  const vintage = item.year;
  const mainStory = item.lore || '';
  const introduction = item.description || '';
  const terroir = item.terroir || '';
  const processing = item.processingNotes || '';
  const notes = item.tags || [];
  const feeling = item.mood || '';
  const feelingDescription = item.experience || '';
  const photoUrl = item.image;
  const magazineUrl = item.magazineUrl;

  // Collect all available images (main + additional), max 3
  const allImages = [photoUrl, ...(item.additionalImages || [])].filter(Boolean).slice(0, 3);

  // Parse mood into individual tags (comma-separated or single phrase)
  const moodTags = feeling
    ? feeling.includes(',')
      ? feeling.split(',').map(t => t.trim()).filter(Boolean)
      : [feeling]
    : [];

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

      {/* Vertical calligraphy watermark — top-right, flowing down like a hanging scroll */}
      {chineseCharacters && (
        <div style={{
          position: "absolute", right: "16px", bottom: "90px",
          writingMode: "vertical-rl",
          fontFamily: "'Ma Shan Zheng', cursive",
          fontSize: "92px", fontWeight: 400, lineHeight: 1,
          color: "var(--tea-text-dim)",
          letterSpacing: "0.18em",
          userSelect: "none", pointerEvents: "none",
          whiteSpace: "nowrap",
          opacity: 0.065,
          zIndex: 4,
        }}>
          {chineseCharacters}
        </div>
      )}

      {/* === PINNED TOP: Identity === */}
      <div style={{
        position: "relative", zIndex: 1, flexShrink: 0,
      }}>
        <div style={{
          padding: "16px 20px 0",
          position: "relative",
        }}>
              <h1 style={{
                fontFamily: "var(--font-display)",
                fontSize: "26px", fontWeight: 340, color: alcoveColors.title,
                margin: 0, lineHeight: 1.1, letterSpacing: "-0.01em",
                textShadow: "0 0 20px rgba(0,0,0,0.3)",
                textAlign: "center",
              }}>
                {productName}
              </h1>
              {givenName && (
                <p style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "16px", fontStyle: "italic", fontWeight: 300,
                  lineHeight: 1.3,
                  color: alcoveColors.subtitle, margin: "5px 0 0",
                  textAlign: "center",
                }}>
                  {givenName}
                </p>
              )}
              {/* Tea type · origin · year — descriptive bar */}
              <div style={{
                padding: "6px 0 5px",
                borderTop: "1px solid var(--tea-border)",
                borderBottom: "1px solid var(--tea-border)",
                margin: givenName ? "6px -20px 0" : "8px -20px 0",
              }}>
                <p style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "13px", fontWeight: 300, fontStyle: "italic",
                  color: alcoveColors.subtitle, margin: 0,
                  textAlign: "center",
                }}>
                  {teaType}
                  {origin && <><span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>{origin}</>}
                  {vintage && <><span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>{vintage}</>}
                </p>
              </div>
        </div>
      </div>

      {/* === SCROLLABLE MIDDLE === */}
      <div ref={scrollRef} className="tea-card-scroll" style={{
        position: "relative", zIndex: 1,
        flex: 1,
        overflowY: "auto",
        minHeight: 0,
      }}>

        {/* === VISUAL ZONE — compact image strip, click to expand fullscreen === */}
        {allImages.length > 0 && (
        <div style={{
          animation: "panelReveal 0.5s ease-out",
          padding: "12px 12px 0",
          flexShrink: 0,
        }}>
          {allImages.length === 1 ? (
            <div
              onClick={() => { setExpandedImageUrl(allImages[0]); setImageExpanded(true); }}
              style={{
                width: "100%", height: "180px",
                borderRadius: "4px", overflow: "hidden",
                cursor: "pointer",
              }}
            >
              <img src={allImages[0]} alt="" style={{
                width: "100%", height: "100%", objectFit: "cover",
                opacity: 0.9, transition: "opacity 0.3s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.9"; }}
              />
            </div>
          ) : (
            <div style={{
              display: "flex", gap: "4px",
              justifyContent: "center",
            }}>
              {allImages.map((img, i) => (
                <div
                  key={i}
                  onClick={() => { setExpandedImageUrl(img); setImageExpanded(true); }}
                  style={{
                    width: "100px", height: "100px",
                    borderRadius: "4px", overflow: "hidden",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <img src={img} alt="" style={{
                    width: "100%", height: "100%", objectFit: "cover",
                    opacity: 0.9, transition: "opacity 0.3s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.9"; }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* === STORY — prose (intro + lore + experience description merged) === */}
        {(() => {
          // Collect all narrative prose into one flow
          const storyParts: string[] = [];
          if (feelingDescription) storyParts.push(feelingDescription);
          if (introduction) storyParts.push(introduction);
          if (mainStory) storyParts.push(mainStory);
          const fullStory = storyParts.join('\n\n');
          if (!fullStory) return null;

          const storyStyle = {
            fontFamily: "var(--font-body)",
            fontSize: "15px", fontWeight: 300 as const, lineHeight: 1.65,
            color: alcoveColors.body, margin: 0,
            whiteSpace: "pre-line" as const,
          };

          return (
            <div style={{
              padding: "0 20px",
              marginTop: allImages.length > 0 ? "20px" : "16px",
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
                    ...storyStyle,
                    color: hovered === "magazine" ? alcoveColors.bodyHighlight : alcoveColors.body,
                    transition: "color 0.2s ease",
                  }}>
                    {fullStory}
                  </p>
                </a>
              ) : (
                <p style={storyStyle}>
                  {fullStory}
                </p>
              )}
            </div>
          );
        })()}

        {/* === SENSORY PANEL — unified: experience tags + tasting notes in one box === */}
        {(() => {
          const tasting = item.tasting;
          const hasTasting = tasting && Object.values(tasting).some(arr => arr && arr.length > 0);
          const sensoryNotes = hasTasting ? flattenTastingNotes(tasting) : [];
          const legacyNotes = !hasTasting ? notes : [];
          const hasAnySensory = sensoryNotes.length > 0 || legacyNotes.length > 0;
          const hasMood = moodTags.length > 0;

          if (!hasAnySensory && !hasMood) return null;

          // Collect note items for the grid
          const noteItems = sensoryNotes.map((termId) => {
            const Icon = resolveTermIcon(termId);
            const label = resolveTermLabel(termId);
            const termInfo = TERM_MAP.get(termId);
            const isLiquorColor = termInfo?.categoryId === 'liquor-color';
            const swatchColor = isLiquorColor ? LIQUOR_COLORS[termId] : null;
            return { key: termId, label, termId, icon: Icon, swatchColor, categoryId: termInfo?.categoryId || 'flavor' };
          });

          // Legacy notes as fallback
          const legacyItems = legacyNotes.map((note) => {
            const termId = note.toLowerCase().replace(/\s+/g, '-');
            const Icon = resolveTermIcon(termId);
            return { key: `legacy-${note}`, label: toTitleCase(note), termId, icon: Icon, swatchColor: null as string | null, categoryId: 'flavor' };
          });

          const allNotes = [...noteItems, ...legacyItems];
          const noteTotalRows = Math.ceil(allNotes.length / 2);

          return (
        <div style={{
          marginTop: "24px",
          background: "rgba(0,0,0,0.12)",
          borderTop: "1px solid var(--tea-border)",
          borderBottom: "1px solid var(--tea-border)",
          padding: "4px 16px",
        }}>
          {/* Mood tags — centered single column with dashed dividers */}
          {hasMood && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "6px 0",
              borderBottom: hasAnySensory ? "1px solid var(--tea-border)" : "none",
            }}>
              {moodTags.map((tag, i) => (
                <React.Fragment key={`mood-${tag}`}>
                  {i > 0 && (
                    <div style={{
                      width: "40px",
                      borderTop: "1px dashed var(--tea-border)",
                      margin: "2px 0",
                    }} />
                  )}
                  <span
                    onClick={onTermClick ? () => onTermClick(tag.toLowerCase().trim(), 'mood') : undefined}
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "13px",
                      fontWeight: 300,
                      fontStyle: "italic",
                      letterSpacing: "0.06em",
                      color: "var(--tea-text-sec)",
                      cursor: onTermClick ? "pointer" : "default",
                      padding: "5px 4px",
                      transition: "color 0.15s",
                      textAlign: "center",
                    }}
                    onMouseEnter={onTermClick ? (e) => { e.currentTarget.style.color = "var(--tea-gold)"; } : undefined}
                    onMouseLeave={onTermClick ? (e) => { e.currentTarget.style.color = "var(--tea-text-sec)"; } : undefined}
                  >
                    {toTitleCase(tag)}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Tasting notes grid */}
          {allNotes.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
            }}>
              {allNotes.map((item, idx) => {
                const isLeftCol = idx % 2 === 0;
                const rowIdx = Math.floor(idx / 2);
                const isLastRow = rowIdx === noteTotalRows - 1;
                const isOddLast = idx === allNotes.length - 1 && allNotes.length % 2 === 1;
                const NoteIcon = item.icon;

                return (
                  <span
                    key={item.key}
                    onClick={onTermClick ? () => onTermClick(item.termId, item.categoryId || 'flavor') : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      gap: "7px",
                      fontFamily: "var(--font-body)",
                      fontSize: "13px",
                      fontWeight: 300,
                      color: "var(--tea-text-sec)",
                      cursor: onTermClick ? "pointer" : "default",
                      padding: "9px 4px",
                      transition: "color 0.15s",
                      ...(isOddLast ? { gridColumn: "1 / -1" } : {}),
                      borderRight: (isLeftCol && !isOddLast) ? "1px solid var(--tea-border)" : "none",
                      borderBottom: isLastRow ? "none" : "1px solid var(--tea-border)",
                    }}
                    onMouseEnter={onTermClick ? (e) => { e.currentTarget.style.color = "var(--tea-gold)"; } : undefined}
                    onMouseLeave={onTermClick ? (e) => { e.currentTarget.style.color = "var(--tea-text-sec)"; } : undefined}
                  >
                    {item.swatchColor ? (
                      <span style={{
                        width: "16px", height: "16px", borderRadius: "50%",
                        background: item.swatchColor,
                        border: "1px solid var(--tea-border)",
                        flexShrink: 0,
                      }} />
                    ) : NoteIcon ? (
                      <NoteIcon size={16} style={{ opacity: 0.7, flexShrink: 0, color: "var(--tea-gold)" }} />
                    ) : null}
                    <span>{item.label}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
          );
        })()}

        {/* === TERROIR & PROCESSING — quiet appendix === */}
        {(terroir || processing) && (
          <div style={{
            padding: "0 20px",
            marginTop: "28px",
            marginBottom: "8px",
          }}>
              {terroir && (
                <div>
                  <h3 style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "10px", fontWeight: 400,
                    textTransform: "uppercase", letterSpacing: "0.12em",
                    color: "var(--tea-gold)",
                    margin: "0 0 6px 0",
                  }}>
                    Terroir
                  </h3>
                  <p style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "15px", fontWeight: 300, lineHeight: 1.75,
                    color: alcoveColors.body, margin: 0,
                    whiteSpace: "pre-line",
                  }}>
                    {terroir}
                  </p>
                </div>
              )}
              {processing && (
                <div style={{ marginTop: terroir ? "20px" : 0 }}>
                  {terroir && (
                    <div style={{
                      height: "1px", marginBottom: "14px",
                      background: "linear-gradient(90deg, transparent, rgba(184, 146, 78, 0.25) 20%, rgba(184, 146, 78, 0.4) 50%, rgba(184, 146, 78, 0.25) 80%, transparent)",
                    }} />
                  )}
                  <h3 style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "10px", fontWeight: 400,
                    textTransform: "uppercase", letterSpacing: "0.12em",
                    color: "var(--tea-gold)",
                    margin: "0 0 6px 0",
                  }}>
                    Processing
                  </h3>
                  <p style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "15px", fontWeight: 300, lineHeight: 1.75,
                    color: alcoveColors.body, margin: 0,
                    whiteSpace: "pre-line",
                  }}>
                    {processing}
                  </p>
                </div>
              )}
          </div>
        )}

        {/* === YOU MIGHT ALSO LIKE === */}
        {(() => {
          if (!items || items.length <= 1) return null;
          const related = items
            .filter(i => i.id !== item.id && i.type === item.type)
            .slice(0, 4);
          if (related.length === 0) return null;
          return (
            <div style={{
              marginTop: "28px",
              padding: "0 20px 16px",
            }}>
              <h3 style={{
                fontFamily: "var(--font-display)",
                fontSize: "10px", fontWeight: 400,
                textTransform: "uppercase", letterSpacing: "0.12em",
                color: "var(--tea-gold)",
                margin: "0 0 10px 0",
              }}>
                You might also like
              </h3>
              <div style={{
                display: "flex",
                gap: "10px",
                overflowX: "auto",
                paddingBottom: "4px",
              }}
              className="no-scrollbar"
              >
                {related.map(rec => (
                  <button
                    key={rec.id}
                    onClick={() => onItemSelect?.(rec)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      flexShrink: 0,
                      width: "56px",
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: onItemSelect ? "pointer" : "default",
                    }}
                  >
                    <div style={{
                      width: "40px", height: "40px",
                      borderRadius: "4px",
                      overflow: "hidden",
                      background: "var(--tea-elevated)",
                      marginBottom: "4px",
                    }}>
                      {rec.image ? (
                        <img src={rec.image} alt={rec.name} style={{
                          width: "100%", height: "100%", objectFit: "cover",
                        }} loading="lazy" />
                      ) : (
                        <TeaPlaceholder type={rec.type} style={{ width: '100%', height: '100%' }} />
                      )}
                    </div>
                    <span style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "10px",
                      fontWeight: 300,
                      color: "var(--tea-text-sec)",
                      textAlign: "center",
                      lineHeight: 1.2,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical" as any,
                      overflow: "hidden",
                      width: "100%",
                    }}>
                      {rec.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

      </div>

      {/* === PINNED BOTTOM: Commerce (compressed 2-row) === */}
      <div style={{
        position: "relative", zIndex: 3, flexShrink: 0,
        padding: "8px 14px 10px",
        borderTop: "1px solid var(--tea-border)",
        background: alcoveColors.bg,
      }}>
            {/* Row 1: Presets with integrated stock + price */}
            {!isSoldOut && presets.length > 1 ? (
              <div style={{
                display: "flex", gap: "4px", alignItems: "center",
                marginBottom: "6px",
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
                      transition: "all 0.15s ease",
                    }}
                  >
                    {p}g
                  </button>
                ))}
              </div>
            ) : (
              <div style={{
                display: "flex", alignItems: "center", gap: "6px",
                marginBottom: "6px",
              }}>
                <div style={{
                  width: "5px", height: "5px", borderRadius: "50%",
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
                {onTaste && (
                  <>
                    <div style={{ width: "1px", height: "10px", background: "var(--tea-border)" }} />
                    <button
                      onClick={() => onTaste(item)}
                      onMouseEnter={() => setHovered("taste")}
                      onMouseLeave={() => setHovered(null)}
                      aria-label="Start tasting session"
                      style={{
                        background: "none", border: "none", padding: "0",
                        cursor: "pointer", transition: "all 0.2s ease",
                        display: "inline-flex", alignItems: "center", gap: "4px",
                        opacity: hovered === "taste" ? 0.9 : 0.7,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={alcoveColors.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
                      </svg>
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
                  flex: 1, height: "38px", boxSizing: "border-box",
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px", fontWeight: 700,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  color: isSoldOut
                    ? 'var(--tea-text-sec)'
                    : added ? alcoveColors.bg : (hovered === "cart" ? alcoveColors.bg : alcoveColors.bg),
                  background: isSoldOut
                    ? 'var(--tea-accent-sub)'
                    : added
                      ? alcoveColors.success
                      : hovered === "cart"
                        ? 'var(--tea-gold-lt, #d4ac66)'
                        : 'var(--tea-gold, #b8924e)',
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
                <span>{isSoldOut ? "Sold Out" : added ? "Added" : "Add"}</span>
                {!isSoldOut && (
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500, fontStyle: "normal", opacity: 0.85, fontSize: "12px",
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
      {imageExpanded && expandedImageUrl && (
        <div
          onClick={() => { setImageExpanded(false); setExpandedImageUrl(null); }}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "var(--tea-bg)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            animation: "panelReveal 0.3s ease-out",
          }}
        >
          <img
            src={expandedImageUrl}
            alt={item.name}
            style={{
              maxWidth: "90vw", maxHeight: "90vh",
              objectFit: "contain",
              borderRadius: "4px",
            }}
          />
          <button
            style={{
              position: "absolute", top: "14px", right: "14px",
              width: "32px", height: "32px",
              background: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "1px solid var(--tea-border)", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              transition: "background 0.2s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.25)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--tea-text-sec)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
