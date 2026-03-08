import React, { useState, useEffect, useRef } from 'react';
import { AlcoveCard } from './AlcoveCard';
import { useScrollLock } from '../../hooks/useScrollLock';
import type { InventoryItem } from '../../types';

interface AlcoveModalProps {
  item: InventoryItem | null;
  items: InventoryItem[];
  onClose: () => void;
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  onItemChange?: (item: InventoryItem) => void;
}

export const AlcoveModal: React.FC<AlcoveModalProps> = ({
  item,
  items,
  onClose,
  onAddToCart,
  onItemChange,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const isOpen = !!item;
  useScrollLock(isOpen);

  // Swipe navigation state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  useEffect(() => {
    if (item) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [item]);

  // Escape key
  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    // Don't intercept touches on buttons/inputs inside the card
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;
    setTouchStart(e.touches[0].clientX);
    setTouchStartTime(Date.now());
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    setSwipeOffset(e.touches[0].clientX - touchStart);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null || touchStartTime === null) return;

    const diff = touchStart - e.changedTouches[0].clientX;
    const distance = Math.abs(diff);
    const velocity = distance / (Date.now() - touchStartTime);
    const threshold = velocity > 0.3 ? 20 : 40;

    if (distance > threshold && onItemChange) {
      const currentIndex = items.findIndex(i => i.id === item.id);
      if (diff > 0 && currentIndex < items.length - 1) {
        onItemChange(items[currentIndex + 1]);
      } else if (diff < 0 && currentIndex > 0) {
        onItemChange(items[currentIndex - 1]);
      }
    }

    setTouchStart(null);
    setTouchStartTime(null);
    setSwipeOffset(0);
  };

  const handleAddToCart = (addedItem: InventoryItem, qty: number, total: number) => {
    if (onAddToCart) onAddToCart(addedItem, qty, total);
  };

  const story = item.lore || item.description;
  const hasCompanionContent = !!(item.image || story || item.experience);

  return (
    <div
      className={`fixed inset-0 z-[100] transition-all duration-300 ${isVisible ? 'bg-black/90' : 'bg-black/0 pointer-events-none'}`}
      onClick={onClose}
    >
      {/* Card container — clicks on padding/backdrop dismiss the modal */}
      <div
        className="flex items-center justify-center w-full h-full p-4 md:p-8"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${swipeOffset * 0.3}px)`, transition: touchStart ? 'none' : 'transform 0.2s ease' }}
      >
        {/* Stop propagation on the card + companion */}
        <div onClick={(e) => e.stopPropagation()} className="relative flex items-stretch gap-0">

          {/* The Card */}
          <div className="relative">
            <AlcoveCard
              item={item}
              onAddToCart={handleAddToCart}
              onClose={onClose}
            />
            {/* Small close indicator on card corner — mobile only when no companion */}
            <button
              className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 transition-colors lg:hidden"
              onClick={onClose}
              aria-label="Close"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="rgba(200,170,120,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Desktop Companion Panel — "the other side of the card" */}
          {hasCompanionContent && (
            <div
              className="hidden lg:flex flex-col"
              style={{
                width: "340px",
                maxHeight: "720px",
                background: "#161513",
                borderLeft: "1px solid rgba(200,170,120,0.08)",
                borderRadius: "0 3px 3px 0",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Subtle noise texture */}
              <div style={{
                position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.05,
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                backgroundSize: "120px",
              }} />

              {/* Close button on companion panel */}
              <button
                className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 transition-colors"
                onClick={onClose}
                aria-label="Close"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(200,170,120,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              {/* Scrollable companion content */}
              <div className="flex-1 overflow-y-auto tea-card-scroll" style={{ position: "relative", zIndex: 1 }}>

                {/* Full photo */}
                {item.image && (
                  <div style={{ width: "100%", aspectRatio: "4/3", overflow: "hidden" }}>
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{
                        width: "100%", height: "100%",
                        objectFit: "cover",
                        opacity: 0.85,
                      }}
                    />
                  </div>
                )}

                <div style={{ padding: "20px" }}>
                  {/* Chinese name large display */}
                  {item.chineseName && (
                    <p style={{
                      fontFamily: "'Ma Shan Zheng', cursive",
                      fontSize: "32px", lineHeight: 1.2,
                      color: "rgba(200,170,120,0.15)",
                      margin: "0 0 16px 0",
                      letterSpacing: "0.1em",
                    }}>
                      {item.chineseName}
                    </p>
                  )}

                  {/* Full story — no truncation */}
                  {story && (
                    <div style={{ marginBottom: "20px" }}>
                      <p style={{
                        fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                        fontSize: "15px", fontWeight: 300, lineHeight: 1.7,
                        color: "#c0b49a",
                        margin: 0,
                      }}>
                        {story}
                      </p>
                      {item.magazineUrl && (
                        <a
                          href={item.magazineUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-block", marginTop: "10px",
                            fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                            fontSize: "12px", fontStyle: "italic", fontWeight: 300,
                            color: "#b5651d",
                            textDecoration: "none",
                            borderBottom: "1px solid rgba(181,101,29,0.3)",
                            paddingBottom: "1px",
                          }}
                        >
                          Read in the magazine
                        </a>
                      )}
                    </div>
                  )}

                  {/* Divider */}
                  <div style={{
                    height: "1px",
                    background: "rgba(200,170,120,0.08)",
                    margin: "0 0 16px 0",
                  }} />

                  {/* Experience / tasting session */}
                  {item.experience && (
                    <div style={{ marginBottom: "20px" }}>
                      <p style={{
                        fontFamily: "'Bricolage Grotesque', 'Bricolage Fallback', 'Arial', sans-serif",
                        fontSize: "10px", fontWeight: 400,
                        letterSpacing: "0.15em", textTransform: "uppercase",
                        color: "#6a6050",
                        margin: "0 0 8px 0",
                      }}>
                        Experience
                      </p>
                      <p style={{
                        fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                        fontSize: "14px", fontWeight: 300, fontStyle: "italic",
                        lineHeight: 1.6,
                        color: "#9a9080",
                        margin: 0,
                      }}>
                        {item.experience}
                      </p>
                    </div>
                  )}

                  {/* Mood */}
                  {item.mood && (
                    <div style={{ marginBottom: "20px" }}>
                      <p style={{
                        fontFamily: "'Bricolage Grotesque', 'Bricolage Fallback', 'Arial', sans-serif",
                        fontSize: "10px", fontWeight: 400,
                        letterSpacing: "0.15em", textTransform: "uppercase",
                        color: "#6a6050",
                        margin: "0 0 8px 0",
                      }}>
                        Mood
                      </p>
                      <p style={{
                        fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                        fontSize: "14px", fontWeight: 300, fontStyle: "italic",
                        lineHeight: 1.6,
                        color: "#9a9080",
                        margin: 0,
                      }}>
                        {item.mood}
                      </p>
                    </div>
                  )}

                  {/* Origin details */}
                  {item.origin && (
                    <div style={{ marginBottom: "16px" }}>
                      <p style={{
                        fontFamily: "'Bricolage Grotesque', 'Bricolage Fallback', 'Arial', sans-serif",
                        fontSize: "10px", fontWeight: 400,
                        letterSpacing: "0.15em", textTransform: "uppercase",
                        color: "#6a6050",
                        margin: "0 0 8px 0",
                      }}>
                        Origin
                      </p>
                      <p style={{
                        fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                        fontSize: "14px", fontWeight: 300,
                        color: "#9a9080",
                        margin: 0,
                      }}>
                        {item.origin}{item.year ? ` · ${item.year}` : ''}
                      </p>
                    </div>
                  )}

                  {/* Tasting notes spread */}
                  {item.tags && item.tags.length > 0 && (
                    <div>
                      <p style={{
                        fontFamily: "'Bricolage Grotesque', 'Bricolage Fallback', 'Arial', sans-serif",
                        fontSize: "10px", fontWeight: 400,
                        letterSpacing: "0.15em", textTransform: "uppercase",
                        color: "#6a6050",
                        margin: "0 0 10px 0",
                      }}>
                        Notes
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                              fontSize: "12px", fontWeight: 300, fontStyle: "italic",
                              color: "#c4b89a",
                              padding: "4px 10px",
                              border: "1px solid rgba(200,170,120,0.1)",
                              borderRadius: "2px",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* One-of-a-kind badge */}
                  {item.isOneOfAKind && (
                    <div style={{
                      marginTop: "20px",
                      padding: "8px 12px",
                      background: "rgba(181,101,29,0.06)",
                      borderRadius: "2px",
                      border: "1px solid rgba(181,101,29,0.12)",
                    }}>
                      <p style={{
                        fontFamily: "'Fraunces', 'Fraunces Fallback', 'Georgia', serif",
                        fontSize: "12px", fontWeight: 300, fontStyle: "italic",
                        color: "#b5651d",
                        margin: 0,
                      }}>
                        One of a kind — once it's gone, it's gone
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
