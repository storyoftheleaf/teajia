import React, { useState, useRef } from 'react';
import { BookmarkIcon, ShareIcon } from './alcove/icons';
import { useScrollFade } from './alcove/hooks/useScrollFade';
import { AlcoveShell } from './alcove/AlcoveShell';
import type { InventoryItem } from '../../types';
import { useAppStore } from '../../lib/store';
import { fmtNum } from '../../utils/formatNumber';
import { TeaPlaceholder } from './TeaPlaceholder';

interface TeawareAlcoveCardProps {
  item: InventoryItem;
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  onClose?: () => void;
}


export const TeawareAlcoveCard: React.FC<TeawareAlcoveCardProps> = ({ item, onAddToCart, onClose }) => {
  const { favoriteTeas, toggleFavoriteTea, activeAccount } = useAppStore();
  const favorited = favoriteTeas.includes(item.id);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const showFade = useScrollFade(scrollRef as React.RefObject<HTMLElement>);
  const galleryTouchStart = useRef<number | null>(null);

  // Share handler — builds ?product=<id> URL, uses Web Share API with clipboard fallback
  const handleShare = async () => {
    const shareText = `${item.name} — ${item.type} from Teajia`;
    const url = new URL(window.location.href);
    url.searchParams.set('product', item.id);
    if (!url.pathname.includes('/shop') && !url.pathname.includes('/store')) {
      url.pathname = '/shop';
    }
    const shareUrl = url.toString();

    if (navigator.share) {
      try {
        await navigator.share({ title: item.name, text: shareText, url: shareUrl });
      } catch {
        // User cancelled — silent
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } catch {
        // Clipboard API unavailable
      }
    }
  };

  const whatsappNumber = activeAccount?.whatsapp_number;
  const handleSampleRequest = () => {
    if (!whatsappNumber) return;
    const msg = `Hi, I'd like to request a sample of ${item.name} (${item.type}). Is that possible?`;
    const phone = whatsappNumber.replace(/\D/g, '').replace(/^0+/, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Build gallery: primary image + additional images
  const allImages = [item.image, ...(item.additionalImages || [])].filter(Boolean);
  const hasGallery = allImages.length > 1;
  const currentImage = allImages[activeImageIndex] || '';

  const isSoldOut = (item.stock_g || 0) <= 0;
  const maxStock = Math.max(1, Math.floor(item.stock_g || 1));
  // price_50g is per-unit price for teaware (legacy field name)
  const unitPrice = parseFloat(item.price_50g || '0');
  const total = fmtNum(unitPrice * quantity);

  const colors = {
    bg: 'var(--tea-bg)',
    title: 'var(--tea-text)',
    subtitle: 'var(--tea-text-sec)',
    body: 'var(--tea-text-sec)',
    bodyHighlight: 'var(--tea-text)',
    note: 'var(--tea-text-sec)',
    accent: 'var(--tea-gold)',
    muted: 'var(--tea-text-sec)',
    success: '#5A6E5A',
  };
  const accent = colors.accent;

  // Derive display values
  const productName = item.variant || item.name;
  const givenName = item.variant !== item.name ? item.name : '';
  const chineseCharacters = item.chineseName || '';
  const material = item.material || '';
  const capacity = item.capacityMl ? `${item.capacityMl}ml` : '';
  const story = item.lore || item.description || '';
  const technique = item.processingNotes || '';
  const origin = item.terroir || item.origin || '';
  const feeling = item.mood || '';
  const feelingDescription = item.experience || '';
  const hasContent = !!(story || technique || feeling);

  // Scroll overflow detection — handled by useScrollFade(scrollRef)

  const handleAdd = () => {
    if (isSoldOut) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
    if (onAddToCart) {
      onAddToCart(item, quantity, parseFloat(total));
    }
  };

  // Gallery swipe handlers
  const handleGalleryTouchStart = (e: React.TouchEvent) => {
    galleryTouchStart.current = e.touches[0].clientX;
  };

  const handleGalleryTouchEnd = (e: React.TouchEvent) => {
    if (galleryTouchStart.current === null) return;
    const diff = galleryTouchStart.current - e.changedTouches[0].clientX;
    const threshold = 40;
    if (Math.abs(diff) > threshold && hasGallery) {
      if (diff > 0 && activeImageIndex < allImages.length - 1) {
        setActiveImageIndex(i => i + 1);
      } else if (diff < 0 && activeImageIndex > 0) {
        setActiveImageIndex(i => i - 1);
      }
    }
    galleryTouchStart.current = null;
  };

  const commerceFooter = (
    /* === PINNED BOTTOM: Commerce === */
    <div style={{
      position: "relative", zIndex: 3, flexShrink: 0,
      padding: "10px 14px 14px",
      borderTop: "1px solid var(--tea-border)",
      background: colors.bg,
    }}>
      {/* Quantity + Price row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "8px",
      }}>
        <div style={{
          display: "flex", alignItems: "center",
          borderRadius: "3px",
          border: "1px solid var(--tea-border)",
          overflow: "hidden",
        }}>
          <button
            onClick={() => setQuantity(q => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            style={{
              width: "32px", height: "32px",
              background: "none", border: "none",
              color: colors.subtitle,
              cursor: quantity <= 1 ? "default" : "pointer",
              opacity: quantity <= 1 ? 0.3 : 0.7,
              fontFamily: "var(--font-mono)",
              fontSize: "14px",
              transition: "opacity 0.2s ease-out",
            }}
          >-</button>
          <span style={{
            width: "36px", textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "13px", fontWeight: 400, color: colors.body,
            borderLeft: "1px solid var(--tea-accent-sub)",
            borderRight: "1px solid var(--tea-accent-sub)",
            lineHeight: "32px",
          }}>
            {quantity}
          </span>
          <button
            onClick={() => setQuantity(q => Math.min(maxStock, q + 1))}
            disabled={quantity >= maxStock}
            style={{
              width: "32px", height: "32px",
              background: "none", border: "none",
              color: colors.subtitle,
              cursor: quantity >= maxStock ? "default" : "pointer",
              opacity: quantity >= maxStock ? 0.3 : 0.7,
              fontFamily: "var(--font-mono)",
              fontSize: "14px",
              transition: "opacity 0.2s ease-out",
            }}
          >+</button>
        </div>

        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12px", fontWeight: 400, color: colors.subtitle,
            marginRight: "4px",
          }}>
            ${fmtNum(unitPrice)}
          </span>
          {quantity > 1 && (
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px", fontWeight: 400, color: colors.subtitle,
              opacity: 0.6,
            }}>
              each
            </span>
          )}
        </div>
      </div>

      {/* Sample request link */}
      {whatsappNumber && (
        <div style={{ marginBottom: "8px" }}>
          <button
            onClick={handleSampleRequest}
            style={{
              background: "none", border: "none", padding: 0,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              color: "var(--tea-text-sec)",
              textDecoration: "underline",
              textDecorationColor: "var(--tea-border)",
              textUnderlineOffset: "2px",
              transition: "color 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--tea-text)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--tea-text-sec)"; }}
          >
            Request a sample →
          </button>
        </div>
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
            <BookmarkIcon filled={favorited} color={accent} strokeColor={colors.muted} />
            <span style={{
              fontFamily: "var(--font-sans)",
              fontSize: "10px", fontWeight: 400,
              letterSpacing: "0.08em", textTransform: "uppercase",
              color: favorited ? accent : colors.subtitle,
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
            <ShareIcon color={shareCopied ? colors.success : colors.muted} />
            <span style={{
              fontFamily: "var(--font-sans)",
              fontSize: "10px", fontWeight: 400,
              letterSpacing: "0.08em", textTransform: "uppercase",
              color: shareCopied ? colors.success : colors.subtitle,
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
              : added ? colors.bg : (hovered === "cart" ? colors.note : colors.muted),
            background: isSoldOut
              ? 'var(--tea-accent-sub)'
              : added
                ? colors.success
                : hovered === "cart"
                  ? "var(--tea-accent-sub)"
                  : "transparent",
            border: isSoldOut
              ? '1px solid var(--tea-border)'
              : added
                ? `1px solid ${colors.success}`
                : `1px solid rgba(200,170,120,${hovered === "cart" ? 0.3 : 0.18})`,
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
              ${total}
            </span>
          )}
        </button>
      </div>
    </div>
  );

  const modals = imageExpanded ? (
    <div
      onClick={() => setImageExpanded(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "var(--tea-bg)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {currentImage ? (
        <img
          key={currentImage}
          src={currentImage}
          alt={item.name}
          style={{
            maxWidth: "90vw", maxHeight: "80vh",
            objectFit: "contain",
            borderRadius: "4px",
            animation: "fadeIn 0.2s ease-out",
          }}
        />
      ) : (
        <TeaPlaceholder
          type={item.type}
          style={{ width: "60vmin", height: "60vmin", maxWidth: "400px", maxHeight: "400px" }}
        />
      )}

      {/* Gallery navigation in fullscreen */}
      {hasGallery && (
        <div style={{
          display: "flex", gap: "8px", marginTop: "16px",
        }}>
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setActiveImageIndex(i); }}
              style={{
                width: "48px", height: "48px",
                borderRadius: "4px",
                overflow: "hidden",
                border: i === activeImageIndex ? `2px solid ${accent}` : "2px solid var(--tea-border)",
                padding: 0,
                cursor: "pointer",
                opacity: i === activeImageIndex ? 1 : 0.5,
                transition: "all 0.2s ease",
              }}
            >
              <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); setImageExpanded(false); }}
        style={{
          position: "absolute", top: "16px", right: "16px",
          width: "36px", height: "36px",
          background: "var(--tea-accent-sub)", border: "none", borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="var(--tea-text-sec)" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Prev/Next arrows in fullscreen */}
      {hasGallery && activeImageIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setActiveImageIndex(i => i - 1); }}
          style={{
            position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)",
            width: "40px", height: "40px",
            background: "var(--tea-accent-sub)", border: "none", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="var(--tea-text-sec)" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      {hasGallery && activeImageIndex < allImages.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setActiveImageIndex(i => i + 1); }}
          style={{
            position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)",
            width: "40px", height: "40px",
            background: "var(--tea-accent-sub)", border: "none", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="var(--tea-text-sec)" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  ) : null;

  return (
    <AlcoveShell
      alcoveBg={colors.bg}
      chineseCharacters=""
      scrollRef={scrollRef}
      showFade={showFade}
      commerceFooter={commerceFooter}
      modals={modals}
      grainOpacity={0.04}
      warmthOpacities={[0.06, 0.03]}
    >

        {/* === GALLERY SECTION === */}
        {currentImage && (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1 / 1",
            maxHeight: hasContent ? "55%" : "65%",
            background: "var(--tea-surface)",
            overflow: "hidden",
            cursor: "pointer",
            flexShrink: 0,
          }}
          onClick={() => setImageExpanded(true)}
          onTouchStart={handleGalleryTouchStart}
          onTouchEnd={handleGalleryTouchEnd}
        >
          <img
            key={currentImage}
            src={currentImage}
            alt={productName}
            style={{
              width: "100%", height: "100%",
              objectFit: "cover",
              animation: "fadeIn 0.3s ease-out",
            }}
          />

          {/* Bottom gradient fade */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "40%",
            background: `linear-gradient(to top, ${colors.bg}, transparent)`,
            pointerEvents: "none",
          }} />

          {/* Gallery dot indicators */}
          {hasGallery && (
            <div style={{
              position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)",
              display: "flex", gap: "6px", zIndex: 2,
            }}>
              {allImages.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setActiveImageIndex(i); }}
                  style={{
                    width: i === activeImageIndex ? "16px" : "6px",
                    height: "6px",
                    borderRadius: "3px",
                    background: i === activeImageIndex ? accent : "var(--tea-gold-lt)",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                />
              ))}
            </div>
          )}
        </div>
        )}

        {/* === IDENTITY + INFO === */}
        <div style={{
          position: "relative",
          padding: "16px 20px 8px",
        }}>
          {/* Chinese characters watermark */}
          {chineseCharacters && (
            <div style={{
              position: "absolute", right: "14px", top: "8px",
              fontFamily: "'Ma Shan Zheng', cursive",
              fontSize: "56px", fontWeight: 400, lineHeight: 1,
              color: "var(--tea-accent-sub)",
              letterSpacing: "0.05em",
              userSelect: "none", pointerEvents: "none",
              whiteSpace: "nowrap",
            }}>
              {chineseCharacters}
            </div>
          )}

          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "28px", fontWeight: 300, color: colors.title,
            margin: "0 0 4px 0", lineHeight: 1.0, letterSpacing: "-0.01em",
          }}>
            {productName}
          </h1>

          {givenName && (
            <p style={{
              fontFamily: "var(--font-display)",
              fontSize: "17px", fontStyle: "italic", fontWeight: 300,
              color: colors.subtitle, margin: "0 0 8px 0",
            }}>
              {givenName}
            </p>
          )}

          {/* Material / Capacity / Origin line */}
          {(material || capacity || origin) && (
            <p style={{
              fontFamily: "var(--font-display)",
              fontSize: "13px", fontWeight: 300, fontStyle: "italic",
              color: colors.subtitle, margin: "0 0 4px 0",
            }}>
              {[material, capacity, origin].filter(Boolean).map((val, i, arr) => (
                <React.Fragment key={i}>
                  {val}
                  {i < arr.length - 1 && <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>}
                </React.Fragment>
              ))}
            </p>
          )}
        </div>

        {/* === CRAFT CONTENT (only if present) === */}
        {hasContent && (
          <div style={{
            margin: "4px 4px 0",
            borderRadius: "6px",
            background: "var(--tea-surface)",
            boxShadow: "inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)",
            overflow: "hidden",
          }}>
            {/* Fine noise texture overlay */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.06,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize: "120px",
            }} />

            {/* Mood line */}
            {feeling && (
              <div style={{
                padding: "10px 14px",
                borderBottom: (story || technique) ? "1px solid var(--tea-border)" : "none",
                display: "flex", alignItems: "center", gap: "10px",
              }}>
                <div style={{
                  width: "18px", height: "2px", flexShrink: 0,
                  background: accent, opacity: 0.7, borderRadius: "1px",
                }} />
                <span style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "15px", fontWeight: 300, fontStyle: "italic",
                  color: colors.note, opacity: 0.9,
                }}>
                  {feeling}
                </span>
              </div>
            )}

            {/* Craft story */}
            {story && (
              <div style={{
                padding: "12px 16px",
                borderBottom: (technique || feelingDescription) ? "1px solid var(--tea-border)" : "none",
                position: "relative",
              }}>
                <p style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "15px", fontWeight: 300, lineHeight: 1.65,
                  color: colors.body, margin: 0,
                }}>
                  {story}
                </p>
              </div>
            )}

            {/* Technique / Processing */}
            {technique && (
              <div style={{
                padding: "10px 16px",
                borderBottom: feelingDescription ? "1px solid var(--tea-border)" : "none",
              }}>
                <p style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "13px", fontWeight: 300, fontStyle: "italic",
                  lineHeight: 1.55,
                  color: colors.subtitle, margin: 0,
                }}>
                  {technique}
                </p>
              </div>
            )}

            {/* Experience */}
            {feelingDescription && (
              <div style={{ padding: "10px 16px" }}>
                <p style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "14px", fontWeight: 300, fontStyle: "italic",
                  lineHeight: 1.6,
                  color: colors.subtitle, margin: 0,
                }}>
                  {feelingDescription}
                </p>
              </div>
            )}
          </div>
        )}
    </AlcoveShell>
  );
};
