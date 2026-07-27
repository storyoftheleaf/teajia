import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TeawareAlcoveCard } from './TeawareAlcoveCard';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useAppStore } from '../../lib/store';
import type { InventoryItem } from '../../types';

interface TeawareAlcoveModalProps {
  item: InventoryItem | null;
  items: InventoryItem[];
  onClose: () => void;
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  onItemChange?: (item: InventoryItem) => void;
}

export const TeawareAlcoveModal: React.FC<TeawareAlcoveModalProps> = ({
  item,
  items,
  onClose,
  onAddToCart,
  onItemChange,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const isOpen = !!item;
  useScrollLock(isOpen);

  // Hide the floating BottomTabBar while this full-screen card is open so it
  // can't overlap the card's bottom action bar. Works regardless of whether
  // the call site syncs the open product to the URL.
  const setProductOverlayOpen = useAppStore(s => s.setProductOverlayOpen);
  useEffect(() => {
    setProductOverlayOpen(isOpen);
    return () => setProductOverlayOpen(false);
  }, [isOpen, setProductOverlayOpen]);

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const slideTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cardRef = useRef<HTMLDivElement>(null);
  const justNavigatedRef = useRef(false);

  const currentIndex = item ? items.findIndex(i => i.id === item.id) : -1;
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= items.length - 1;
  const prevItem = !isFirst ? items[currentIndex - 1] : null;
  const nextItem = !isLast ? items[currentIndex + 1] : null;

  const goNext = useCallback(() => {
    if (!item || !onItemChange || isLast) return;
    justNavigatedRef.current = true;
    requestAnimationFrame(() => { justNavigatedRef.current = false; });
    if (slideTimeoutRef.current) clearTimeout(slideTimeoutRef.current);
    slideTimeoutRef.current = setTimeout(() => {}, 350);
    onItemChange(items[currentIndex + 1]);
  }, [item, onItemChange, items, currentIndex, isLast]);

  const goPrev = useCallback(() => {
    if (!item || !onItemChange || isFirst) return;
    justNavigatedRef.current = true;
    requestAnimationFrame(() => { justNavigatedRef.current = false; });
    if (slideTimeoutRef.current) clearTimeout(slideTimeoutRef.current);
    slideTimeoutRef.current = setTimeout(() => {}, 350);
    onItemChange(items[currentIndex - 1]);
  }, [item, onItemChange, items, currentIndex, isFirst]);

  useEffect(() => {
    if (item) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [item]);

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

  useEffect(() => {
    return () => {
      if (slideTimeoutRef.current) clearTimeout(slideTimeoutRef.current);
    };
  }, []);

  if (!item) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (justNavigatedRef.current) return;
    if (cardRef.current && cardRef.current.contains(e.target as Node)) return;
    onClose();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;
    setTouchStart(e.touches[0].clientX);
    setTouchStartTime(Date.now());
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const raw = e.touches[0].clientX - touchStart;
    if ((raw > 0 && isFirst) || (raw < 0 && isLast)) {
      setSwipeOffset(raw * 0.15);
    } else {
      setSwipeOffset(raw);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null || touchStartTime === null) return;

    const diff = touchStart - e.changedTouches[0].clientX;
    const distance = Math.abs(diff);
    const velocity = distance / (Date.now() - touchStartTime);
    const threshold = velocity > 0.3 ? 20 : 40;

    if (distance > threshold && onItemChange) {
      if (diff > 0 && !isLast) {
        goNext();
      } else if (diff < 0 && !isFirst) {
        goPrev();
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
  const peekGap = 40;

  return (
    <div
      className={`fixed inset-0 z-modal transition-all duration-300 ${isVisible ? 'bg-black/95' : 'bg-black/0 pointer-events-none'}`}
      onClick={handleBackdropClick}
    >
      <div
        className="relative flex items-center justify-center w-full h-full overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Previous card (peeking from left) */}
        {hasNavigation && prevItem && (
          <div
            className="absolute hidden md:block pointer-events-auto cursor-pointer"
            style={{
              zIndex: 1,
              width: 'min(480px, 85vw)',
              height: 'min(90vh, 820px)',
              minHeight: '480px',
              left: `calc(50% - min(240px, 42.5vw) - ${peekGap}px - min(480px, 85vw) + 100px)`,
              transform: `translateX(${swipeOffset * 0.5}px) scale(0.88)`,
              transition: touchStart ? 'none' : 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: 0.35,
              filter: 'blur(1px)',
            }}
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
          >
            <TeawareAlcoveCard item={prevItem} onClose={() => {}} />
          </div>
        )}

        {/* Mobile: previous card peek */}
        {hasNavigation && prevItem && (
          <div
            className="absolute md:hidden pointer-events-none"
            style={{
              zIndex: 1,
              width: '85vw',
              maxWidth: '480px',
              height: 'min(90vh, 820px)',
              minHeight: '480px',
              right: `calc(100% - 24px + ${Math.max(0, -swipeOffset) * 0.3}px)`,
              transform: `scale(0.9) translateX(${swipeOffset > 0 ? swipeOffset * 0.5 : 0}px)`,
              transition: touchStart ? 'none' : 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: Math.min(0.3, Math.abs(swipeOffset) / 300 + 0.15),
            }}
          >
            <TeawareAlcoveCard item={prevItem} onClose={() => {}} />
          </div>
        )}

        {/* Current card */}
        <div
          className="flex flex-col items-center justify-center p-4 md:p-8"
          style={{
            zIndex: 5,
            position: 'relative',
            transform: `translateX(${swipeOffset * 0.4}px)`,
            transition: touchStart ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div
            ref={cardRef}
            className="relative w-full max-w-[480px] md:max-w-[560px]"
            style={{
              // Mobile reserves 32px so the commerce footer sits low, close
              // above the floating bottom nav (which stays visible above the
              // alcove), matching the tea alcove. Desktop keeps 90vh / 820px.
              height: 'min(calc(100dvh - 32px - env(safe-area-inset-bottom, 0px)), 820px)',
              minHeight: '480px',
              width: 'min(480px, 85vw)',
            }}
          >
            <TeawareAlcoveCard
              item={item}
              onAddToCart={handleAddToCart}
              onClose={onClose}
            />
            <button
              className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-tea-text/30 hover:bg-tea-text/50 transition-colors"
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

          {/* Mobile counter */}
          {hasNavigation && (
            <div className="mt-3 flex items-center gap-3 md:hidden" onClick={(e) => e.stopPropagation()}>
              <span className="text-xs text-tea-text-sec/70 tracking-wide">
                {currentIndex + 1} of {items.length}
              </span>
            </div>
          )}
        </div>

        {/* Next card (peeking from right) */}
        {hasNavigation && nextItem && (
          <div
            className="absolute hidden md:block pointer-events-auto cursor-pointer"
            style={{
              zIndex: 1,
              width: 'min(480px, 85vw)',
              height: 'min(90vh, 820px)',
              minHeight: '480px',
              right: `calc(50% - min(240px, 42.5vw) - ${peekGap}px - min(480px, 85vw) + 100px)`,
              transform: `translateX(${swipeOffset * 0.5}px) scale(0.88)`,
              transition: touchStart ? 'none' : 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: 0.35,
              filter: 'blur(1px)',
            }}
            onClick={(e) => { e.stopPropagation(); goNext(); }}
          >
            <TeawareAlcoveCard item={nextItem} onClose={() => {}} />
          </div>
        )}

        {/* Mobile: next card peek */}
        {hasNavigation && nextItem && (
          <div
            className="absolute md:hidden pointer-events-none"
            style={{
              zIndex: 1,
              width: '85vw',
              maxWidth: '480px',
              height: 'min(90vh, 820px)',
              minHeight: '480px',
              left: `calc(100% - 24px - ${Math.max(0, swipeOffset) * 0.3}px)`,
              transform: `scale(0.9) translateX(${swipeOffset < 0 ? swipeOffset * 0.5 : 0}px)`,
              transition: touchStart ? 'none' : 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: Math.min(0.3, Math.abs(swipeOffset) / 300 + 0.15),
            }}
          >
            <TeawareAlcoveCard item={nextItem} onClose={() => {}} />
          </div>
        )}

        {/* Desktop prev/next arrows */}
        {hasNavigation && !isFirst && (
          <button
            className="hidden md:flex absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full transition-all border border-tea-border bg-tea-gold/10 hover:bg-tea-gold/25 text-tea-gold"
            style={{ zIndex: 10 }}
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="Previous item"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {hasNavigation && !isLast && (
          <button
            className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full transition-all border border-tea-border bg-tea-gold/10 hover:bg-tea-gold/25 text-tea-gold"
            style={{ zIndex: 10 }}
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="Next item"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
};
