import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { Product, Currency, ExchangeRate } from '../types';
import { formatCurrency } from '../utils';
import { useAppStore } from '../store';
import { useToast } from './Toast';
import { TeaIllustration } from './TeaIllustration';

interface TeaDetailsModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: Product) => void;
  currency: Currency;
  rates: ExchangeRate[];
  onNext?: () => void;
  onPrev?: () => void;
  isAdmin?: boolean;
  onEdit?: (product: Product) => void;
}

function BookmarkIcon({ filled, color, strokeColor }: { filled: boolean, color: string, strokeColor: string }) {
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

export const TeaDetailsModal: React.FC<TeaDetailsModalProps> = ({ 
  product, isOpen, onClose, currency, rates, onNext, onPrev, isAdmin, onEdit
}) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  const { addToCart, setIsCartOpen } = useAppStore();
  const { showToast } = useToast();

  const [grams, setGrams] = useState(25);
  const [added, setAdded] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowRight' && onNext) onNext();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onNext, onPrev]);

  // Reset state when product changes
  useEffect(() => {
    setGrams(25);
    setAdded(false);
    setFavorited(false);
    setHovered(null);
  }, [product?.id]);

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
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe && onNext) onNext();
    if (isRightSwipe && onPrev) onPrev();
  };

  const getTypeColor = (type: string) => {
    switch (type) {
        case 'Green': return '#859F85';
        case 'Yellow': return '#D4C586';
        case 'White': return '#D6D3CD';
        case 'Oolong': return '#C4A484';
        case 'Red': return '#A67B70';
        case 'Dark': return '#8B8C89';
        case 'Shou': return '#5C544E';
        case 'Sheng': return '#98A67B';
        case 'Herbal': return '#BFA09E';
        case 'Matcha': return '#6F8C60';
        case 'Flower': return '#B596A6';
        default: return '#D4AF37';
    }
  };

  const presets = [25, 50, 100, 150, 300];
  const total = formatCurrency(product.pricePerGramUSD * grams, currency, rates);
  const noteOpacities = [1, 0.82, 0.65, 0.5];
  const markerOpacities = [0.7, 0.5, 0.35, 0.2];
  const markerWidths = [18, 16, 14, 12];
  const accent = getTypeColor(product.type);

  const handleAddToCart = () => {
    addToCart(product, grams);
    setAdded(true);
    showToast("Item added to registry", 'success');
    setTimeout(() => {
        setAdded(false);
        onClose();
        setIsCartOpen(true);
    }, 800);
  };

  const getCleanDescription = () => {
    const raw = product.description || '';
    if (raw.includes('Imported via CSV') || !raw.trim()) {
        const yearStr = product.year ? `${product.year}` : 'Non-Vintage';
        const regionStr = product.originRegion ? `harvested from the terroir of ${product.originRegion}` : 'sourced from select gardens';
        const typeStr = product.type === 'Misc' ? 'Fine Tea' : `${product.type} tea`;
        return `A distinct ${yearStr} ${typeStr}, ${regionStr}.`;
    }
    return raw;
  };

  const story = (product.showWisdom && product.lore) ? product.lore : getCleanDescription();
  const notes = (product.showWisdom && product.tastingNotes) ? product.tastingNotes : [];

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg/90 backdrop-blur-md p-4 animate-in fade-in duration-300" onClick={onClose}>
      
      {/* Scrollbar styles for the Modal */}
      <style>{`
        .tea-card-scroll::-webkit-scrollbar { width: 3px; }
        .tea-card-scroll::-webkit-scrollbar-track { background: transparent; }
        .tea-card-scroll::-webkit-scrollbar-thumb { background: rgba(200,170,120,0.15); border-radius: 2px; }
        @keyframes panelReveal {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {onPrev && (
        <button 
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="hidden md:flex absolute left-4 md:left-12 z-modal p-3 text-tea-text-dim hover:text-tea-text-sec bg-tea-surface/50 hover:bg-tea-surface rounded-full transition-all border border-tea-border"
        >
          <ChevronLeft size={32} />
        </button>
      )}

      {/* ── ALCOVE LAYOUT ── */}
      <div 
        style={{
            width: "100%", maxWidth: "480px",
            minHeight: "580px", maxHeight: "720px",
            background: "var(--tea-surface)",
            position: "relative",
            overflow: "hidden",
            borderRadius: "3px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="absolute top-4 right-4 z-50 flex gap-2">
            {isAdmin && onEdit && (
                <button 
                    onClick={() => { onClose(); onEdit(product); }} 
                    className="p-2 text-tea-text-dim hover:text-tea-text-sec bg-tea-surface/50 hover:bg-tea-surface rounded-full transition-all border border-[rgba(200,170,120,0.2)]"
                    title="Edit Product"
                >
                    <Pencil size={16} />
                </button>
            )}
            <button 
                onClick={onClose} 
                className="p-2 text-tea-text-dim hover:text-tea-text-sec bg-tea-surface/50 hover:bg-tea-surface rounded-full transition-all border border-[rgba(200,170,120,0.2)]"
            >
                <X size={20} />
            </button>
        </div>

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
            <div style={{
                position: "absolute", right: "20px", top: "24px",
                fontFamily: "'Ma Shan Zheng', cursive",
                fontSize: "64px", fontWeight: 400, lineHeight: 1,
                color: "rgba(200,170,120,0.05)",
                letterSpacing: "0.05em",
                userSelect: "none", pointerEvents: "none",
                whiteSpace: "nowrap",
            }}>
                {product.chineseName}
            </div>
            <div style={{ padding: "24px 20px 8px", position: "relative", paddingRight: "48px" }}>
                <h1 style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "30px", fontWeight: 300, color: "#ede6d8",
                    margin: "0 0 6px 0", lineHeight: 1.0, letterSpacing: "-0.01em",
                }}>
                    {product.productName}
                </h1>
                <p style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "18px", fontStyle: "italic", fontWeight: 300,
                    color: "var(--tea-text-dim)", margin: "0",
                }}>
                    {product.givenName}
                </p>
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
                        fontFamily: "var(--font-display)",
                        fontSize: "14px", fontWeight: 300, fontStyle: "italic",
                        color: "var(--tea-text-dim)", margin: 0, textAlign: "center",
                    }}>
                        {product.type}
                        <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>
                        {product.originRegion || 'Unknown Origin'}
                        <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>
                        {product.year || 'N.V.'}
                    </p>
                </div>

                {/* Story */}
                <div style={{ padding: "12px 16px", position: "relative", borderBottom: "1px solid rgba(200,170,120,0.08)" }}>
                    <p style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "17px", fontWeight: 300, lineHeight: 1.6,
                        color: "var(--tea-text-sec)", margin: 0,
                    }}>
                        {story}
                    </p>
                </div>

                {/* Notes + photo */}
                <div style={{
                    padding: "14px 16px",
                    background: "rgba(181,101,29,0.03)",
                    position: "relative",
                    overflow: "hidden",
                }}>
                    {/* Photo */}
                    {product.imageUrl ? (
                        <div style={{
                            position: "absolute", top: 0, right: 0, bottom: 0, width: "60%",
                            overflow: "hidden",
                        }}>
                            <img
                                src={product.imageUrl}
                                alt={product.productName}
                                style={{
                                    width: "100%", height: "100%",
                                    objectFit: "cover", objectPosition: "center right",
                                    transform: "scale(1.05)",
                                    WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.6) 70%, black 90%, black 100%), linear-gradient(to bottom, black 85%, transparent 100%)",
                                    WebkitMaskComposite: "destination-in",
                                    maskImage: "linear-gradient(to right, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.6) 70%, black 90%, black 100%), linear-gradient(to bottom, black 85%, transparent 100%)",
                                    maskComposite: "intersect",
                                }}
                            />
                        </div>
                    ) : (
                        <div 
                            onClick={isAdmin && onEdit ? () => { onClose(); onEdit(product); } : undefined}
                            style={{
                            position: "absolute", top: 0, right: 0, bottom: 0, width: "60%",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: 0.15,
                            cursor: isAdmin && onEdit ? "pointer" : "default",
                            WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.6) 70%, black 90%, black 100%), linear-gradient(to bottom, black 85%, transparent 100%)",
                            WebkitMaskComposite: "destination-in",
                            maskImage: "linear-gradient(to right, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.6) 70%, black 90%, black 100%), linear-gradient(to bottom, black 85%, transparent 100%)",
                            maskComposite: "intersect",
                        }}>
                            <TeaIllustration type={product.type} className="w-full h-full max-w-[150px] max-h-[150px] object-contain" />
                            {isAdmin && onEdit && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-tea-text/20">
                                    <Pencil size={24} className="text-tea-text drop-shadow-md" />
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ position: "relative", zIndex: 1 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                            {product.showWisdom && product.mood && (
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <div style={{
                                        width: `${markerWidths[0]}px`, height: "2px", flexShrink: 0,
                                        background: accent, opacity: markerOpacities[0], borderRadius: "1px",
                                    }} />
                                    <span style={{
                                        fontFamily: "var(--font-display)",
                                        fontSize: "15px", fontWeight: 300, fontStyle: "italic",
                                        color: "var(--tea-text-sec)", opacity: noteOpacities[0],
                                        textShadow: "0 1px 8px rgba(28,27,25,0.9), 0 0 20px rgba(28,27,25,0.6)",
                                    }}>
                                        {product.mood}
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
                                        color: "var(--tea-text-sec)",
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

            {product.showWisdom && product.experience && (
                <p style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "15px", fontWeight: 300, fontStyle: "italic",
                    color: "var(--tea-text-sec)", margin: 0,
                    padding: "10px 20px",
                    lineHeight: 1.6,
                }}>
                    {product.experience}
                </p>
            )}

            {/* Block 4: Commerce */}
            <div style={{ padding: "6px 20px 16px", marginTop: "auto", flexShrink: 0 }}>
                {/* Price Tag */}
                <div style={{
                    display: "flex", alignItems: "center",
                    padding: "10px 14px",
                    background: "rgba(200,170,120,0.03)",
                    borderRadius: "3px",
                    marginBottom: "8px",
                }}>
                    <div style={{ display: "flex", alignItems: "baseline", flexShrink: 0, marginRight: "auto" }}>
                        <span style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "15px", fontWeight: 300, color: "var(--tea-text-sec)",
                            lineHeight: 1,
                        }}>
                            {formatCurrency(product.pricePerGramUSD, currency, rates)}
                        </span>
                        <span style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "11px", fontWeight: 300, color: "var(--tea-text-dim)",
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
                                    fontFamily: "var(--font-sans)",
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
                                        ? "var(--tea-text-sec)"
                                        : hovered === `preset-${g}`
                                            ? "var(--tea-text-dim)"
                                            : "var(--tea-text-dim)",
                                }}
                            >
                                {g}<span style={{ fontSize: "8px", opacity: 0.6 }}>g</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Action row */}
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
                            onClick={() => setFavorited(!favorited)}
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
                            <BookmarkIcon filled={favorited} color={accent} strokeColor="var(--tea-text-dim)" />
                            <span style={{
                                fontFamily: "var(--font-sans)",
                                fontSize: "11px", fontWeight: 400,
                                letterSpacing: "0.08em", textTransform: "uppercase",
                                color: favorited ? accent : "var(--tea-text-dim)",
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
                            <ShareIcon color="var(--tea-text-dim)" />
                            <span style={{
                                fontFamily: "var(--font-sans)",
                                fontSize: "11px", fontWeight: 400,
                                letterSpacing: "0.08em", textTransform: "uppercase",
                                color: "var(--tea-text-dim)",
                            }}>Share</span>
                        </button>
                    </div>

                    <button
                        onClick={handleAddToCart}
                        onMouseEnter={() => setHovered("cart")}
                        onMouseLeave={() => setHovered(null)}
                        style={{
                            flex: 1, height: "44px", boxSizing: "border-box",
                            fontFamily: "var(--font-sans)",
                            fontSize: "12px", fontWeight: 400,
                            letterSpacing: "0.06em", textTransform: "uppercase",
                            color: added ? "#1c1b19" : (hovered === "cart" ? "var(--tea-text-sec)" : "var(--tea-text-dim)"),
                            background: added
                                ? "#7a9a72"
                                : hovered === "cart"
                                    ? "rgba(200,170,120,0.06)"
                                    : "transparent",
                            border: added
                                ? "1px solid #7a9a72"
                                : `1px solid rgba(200,170,120,${hovered === "cart" ? 0.3 : 0.2})`,
                            borderRadius: "3px", cursor: "pointer",
                            transition: "all 0.25s ease",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                        }}
                    >
                        <span>{added ? "Added" : "Add"}</span>
                        <span style={{
                            fontFamily: "var(--font-display)",
                            fontWeight: 300, fontStyle: "italic", opacity: 0.7, fontSize: "12px",
                        }}>
                            {total}
                        </span>
                    </button>
                </div>
            </div>
        </div>

        {/* Bottom fade indicator */}
        <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "24px",
            background: "linear-gradient(to top, var(--tea-surface), transparent)",
            pointerEvents: "none", zIndex: 2,
            opacity: showFade ? 1 : 0,
            transition: "opacity 0.3s ease",
        }} />
      </div>

      {onNext && (
        <button 
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="hidden md:flex absolute right-4 md:right-12 z-modal p-3 text-tea-text-dim hover:text-tea-text-sec bg-tea-surface/50 hover:bg-tea-surface rounded-full transition-all border border-tea-border"
        >
          <ChevronRight size={32} />
        </button>
      )}
    </div>
  );
};