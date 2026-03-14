import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

  // First-visit swipe hint
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  const currentIndex = item ? items.findIndex(i => i.id === item.id) : -1;
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= items.length - 1;

  const goNext = useCallback(() => {
    if (!item || !onItemChange || isLast) return;
    onItemChange(items[currentIndex + 1]);
  }, [item, onItemChange, items, currentIndex, isLast]);

  const goPrev = useCallback(() => {
    if (!item || !onItemChange || isFirst) return;
    onItemChange(items[currentIndex - 1]);
  }, [item, onItemChange, items, currentIndex, isFirst]);

  useEffect(() => {
    if (item) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [item]);

  // First-visit swipe hint
  useEffect(() => {
    if (!item || items.length <= 1) return;
    const hintShown = localStorage.getItem('teajia_swipeHintShown');
    if (!hintShown) {
      setShowSwipeHint(true);
      localStorage.setItem('teajia_swipeHintShown', '1');
      const timer = setTimeout(() => setShowSwipeHint(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [item, items.length]);

  // Keyboard navigation (Escape + arrow keys)
  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose, goPrev, goNext]);

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

  const hasNavigation = items.length > 1 && onItemChange;

  return (
    <div
      className={`fixed inset-0 z-modal transition-all duration-300 group ${isVisible ? 'bg-tea-text/90' : 'bg-tea-text/0 pointer-events-none'}`}
      onClick={onClose}
    >
      {/* Desktop prev/next arrows — visible on hover */}
      {hasNavigation && (
        <>
          <button
            className={`hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-tea-surface/60 hover:bg-tea-surface/80 text-tea-text-sec transition-all opacity-0 group-hover:opacity-100 ${isFirst ? '!opacity-0 !pointer-events-none group-hover:!opacity-30 cursor-default' : ''}`}
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            disabled={isFirst}
            aria-label="Previous tea"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            className={`hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-tea-surface/60 hover:bg-tea-surface/80 text-tea-text-sec transition-all opacity-0 group-hover:opacity-100 ${isLast ? '!opacity-0 !pointer-events-none group-hover:!opacity-30 cursor-default' : ''}`}
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            disabled={isLast}
            aria-label="Next tea"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      {/* Card container */}
      <div
        className="flex flex-col items-center justify-center w-full h-full p-4 md:p-8"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${swipeOffset * 0.3}px)`, transition: touchStart ? 'none' : 'transform 0.2s ease' }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[480px] md:max-w-[560px]"
          style={{
            height: "min(90vh, 780px)",
            minHeight: "480px",
          }}
        >
          <AlcoveCard
            item={item}
            onAddToCart={handleAddToCart}
            onClose={onClose}

          />
          {/* Close button — top-left to avoid Chinese characters in top-right */}
          <button
            className="absolute top-2 left-2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-tea-text/30 hover:bg-tea-text/50 transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="var(--tea-gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Mobile nav buttons + counter */}
        {hasNavigation && (
          <div className="mt-3 flex items-center gap-3 md:hidden" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => goPrev()}
              disabled={isFirst}
              className={`w-8 h-8 flex items-center justify-center rounded-full bg-tea-surface/60 border border-tea-border transition-all ${isFirst ? 'opacity-30 cursor-default' : 'hover:bg-tea-surface/80 text-tea-text-sec'}`}
              aria-label="Previous tea"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs text-tea-text-sec tracking-wide">
                {currentIndex + 1} of {items.length}
              </span>
              {showSwipeHint && (
                <span className="text-xs text-tea-text-sec animate-pulse transition-opacity duration-500">
                  ← swipe →
                </span>
              )}
            </div>
            <button
              onClick={() => goNext()}
              disabled={isLast}
              className={`w-8 h-8 flex items-center justify-center rounded-full bg-tea-surface/60 border border-tea-border transition-all ${isLast ? 'opacity-30 cursor-default' : 'hover:bg-tea-surface/80 text-tea-text-sec'}`}
              aria-label="Next tea"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
