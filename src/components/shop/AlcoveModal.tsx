import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AlcoveCard } from './AlcoveCard';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useAppStore } from '../../lib/store';
import type { InventoryItem } from '../../types';

interface AlcoveModalProps {
  item: InventoryItem | null;
  items: InventoryItem[];
  onClose: () => void;
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  onItemChange?: (item: InventoryItem) => void;
  onTermClick?: (termId: string, categoryId: string) => void;
  onTaste?: (item: InventoryItem) => void;
  onEditProductTasting?: (item: InventoryItem) => void;
  isAdmin?: boolean;
}

export const AlcoveModal: React.FC<AlcoveModalProps> = ({
  item,
  items,
  onClose,
  onAddToCart,
  onItemChange,
  onTermClick,
  onTaste,
  onEditProductTasting,
  isAdmin,
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

  // Swipe navigation state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // Slide transition direction
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const slideTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cardRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
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
    setSlideDirection('left');
    if (slideTimeoutRef.current) clearTimeout(slideTimeoutRef.current);
    slideTimeoutRef.current = setTimeout(() => setSlideDirection(null), 350);
    onItemChange(items[currentIndex + 1]);
  }, [item, onItemChange, items, currentIndex, isLast]);

  const goPrev = useCallback(() => {
    if (!item || !onItemChange || isFirst) return;
    justNavigatedRef.current = true;
    requestAnimationFrame(() => { justNavigatedRef.current = false; });
    setSlideDirection('right');
    if (slideTimeoutRef.current) clearTimeout(slideTimeoutRef.current);
    slideTimeoutRef.current = setTimeout(() => setSlideDirection(null), 350);
    onItemChange(items[currentIndex - 1]);
  }, [item, onItemChange, items, currentIndex, isFirst]);

  useEffect(() => {
    if (item) {
      previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      requestAnimationFrame(() => setIsVisible(true));
      requestAnimationFrame(() => {
        dialogRef.current?.querySelectorAll<HTMLElement>('[data-alcove-preview]').forEach((el) => {
          (el as HTMLElement & { inert: boolean }).inert = true;
        });
        closeButtonRef.current?.focus();
      });
    } else {
      setIsVisible(false);
      previouslyFocusedRef.current?.focus();
    }
  }, [item]);

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

  useEffect(() => {
    return () => {
      if (slideTimeoutRef.current) clearTimeout(slideTimeoutRef.current);
    };
  }, []);

  if (!item) return null;

  // Close when clicking anywhere outside the active card
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
    // Add resistance at boundaries
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

  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.stopPropagation();
      goPrev();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.stopPropagation();
      goNext();
      return;
    }
    if (e.key !== 'Tab') return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
      ) ?? []
    ).filter(el => !el.closest('[aria-hidden="true"]') && el.offsetParent !== null);

    if (focusable.length === 0) {
      e.preventDefault();
      closeButtonRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`alcove-title-${item.id}`}
      className={`fixed inset-0 z-panel-modal transition-all duration-300 ${isVisible ? 'bg-black/85 backdrop-blur-sm' : 'bg-black/0 pointer-events-none'}`}
      onClick={handleBackdropClick}
      onKeyDown={handleDialogKeyDown}
    >
      {/* Carousel container */}
      <div
        className="relative flex items-center justify-center w-full h-full overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Previous card (peeking from left) */}
        {hasNavigation && prevItem && (
          <div
            data-alcove-preview
            aria-hidden="true"
            className="absolute hidden md:block pointer-events-auto cursor-pointer"
            style={{
              zIndex: 1,
              width: 'min(480px, 85vw)',
              height: 'min(90vh, 780px)',
              minHeight: '480px',
              left: `calc(50% - min(240px, 42.5vw) - ${peekGap}px - min(480px, 85vw) + 100px)`,
              transform: `translateX(${swipeOffset * 0.5}px) scale(0.88)`,
              transition: touchStart ? 'none' : 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: 0.2,
              filter: 'blur(8px)',
            }}
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
          >
            <AlcoveCard item={prevItem} onClose={() => {}} />
          </div>
        )}

        {/* Mobile: previous card peek */}
        {hasNavigation && prevItem && (
          <div
            data-alcove-preview
            aria-hidden="true"
            className="absolute md:hidden pointer-events-none"
            style={{
              zIndex: 1,
              width: '85vw',
              maxWidth: '480px',
              height: 'min(90vh, 780px)',
              minHeight: '480px',
              right: `calc(100% - 24px + ${Math.max(0, -swipeOffset) * 0.3}px)`,
              transform: `scale(0.9) translateX(${swipeOffset > 0 ? swipeOffset * 0.5 : 0}px)`,
              transition: touchStart ? 'none' : 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: Math.min(0.3, Math.abs(swipeOffset) / 300 + 0.15),
            }}
          >
            <AlcoveCard item={prevItem} onClose={() => {}} />
          </div>
        )}

        {/* Current card */}
        <div
          className="flex flex-col items-center justify-center p-0 md:p-8"
          style={{
            zIndex: 5,
            position: 'relative',
            transform: `translateX(${swipeOffset * 0.4}px)`,
            transition: touchStart ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            width: '100%',
            height: '100%',
          }}
        >
          <div
            ref={cardRef}
            className="relative w-full md:max-w-[560px] md:flex md:items-center md:justify-center"
            style={{
              height: '100%',
              maxHeight: '100dvh',
              width: '100%',
            }}
          >
          {/* On desktop, constrain size */}
          <style>{`
            [data-alcove-card-wrapper] {
              height: calc(100dvh - 44px - env(safe-area-inset-bottom, 0px));
              max-height: calc(100dvh - 44px - env(safe-area-inset-bottom, 0px));
            }
            @media (min-width: 768px) {
              [data-alcove-card-wrapper] {
                height: min(90vh, 780px) !important;
                min-height: 480px !important;
                width: min(480px, 85vw) !important;
                max-height: min(90vh, 780px) !important;
                border-radius: 3px;
              }
            }
          `}</style>
          <div data-alcove-card-wrapper className="relative w-full md:rounded-[3px] overflow-hidden">
            <AlcoveCard
              item={item}
              onAddToCart={handleAddToCart}
              onClose={onClose}
              onTermClick={onTermClick}
              onTaste={onTaste}
              onEditProductTasting={onEditProductTasting}
              isAdmin={isAdmin}
            />
            {/* Close button — top-left of the card per CLAUDE.md panel header rule */}
            <button
              ref={closeButtonRef}
              className="tap-target absolute top-2 left-2 z-10 flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
              onClick={onClose}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          </div>
        </div>

        {/* Next card (peeking from right) */}
        {hasNavigation && nextItem && (
          <div
            data-alcove-preview
            aria-hidden="true"
            className="absolute hidden md:block pointer-events-auto cursor-pointer"
            style={{
              zIndex: 1,
              width: 'min(480px, 85vw)',
              height: 'min(90vh, 780px)',
              minHeight: '480px',
              right: `calc(50% - min(240px, 42.5vw) - ${peekGap}px - min(480px, 85vw) + 100px)`,
              transform: `translateX(${swipeOffset * 0.5}px) scale(0.88)`,
              transition: touchStart ? 'none' : 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: 0.2,
              filter: 'blur(8px)',
            }}
            onClick={(e) => { e.stopPropagation(); goNext(); }}
          >
            <AlcoveCard item={nextItem} onClose={() => {}} />
          </div>
        )}

        {/* Mobile: next card peek */}
        {hasNavigation && nextItem && (
          <div
            data-alcove-preview
            aria-hidden="true"
            className="absolute md:hidden pointer-events-none"
            style={{
              zIndex: 1,
              width: '85vw',
              maxWidth: '480px',
              height: 'min(90vh, 780px)',
              minHeight: '480px',
              left: `calc(100% - 24px - ${Math.max(0, swipeOffset) * 0.3}px)`,
              transform: `scale(0.9) translateX(${swipeOffset < 0 ? swipeOffset * 0.5 : 0}px)`,
              transition: touchStart ? 'none' : 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: Math.min(0.3, Math.abs(swipeOffset) / 300 + 0.15),
            }}
          >
            <AlcoveCard item={nextItem} onClose={() => {}} />
          </div>
        )}

        {/* Desktop prev/next arrows */}
        {hasNavigation && !isFirst && (
          <button
            className="hidden md:flex absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full transition-all glass-panel hover:bg-tea-gold/15 text-tea-gold"
            style={{ zIndex: 10 }}
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="Previous tea"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {hasNavigation && !isLast && (
          <button
            className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full transition-all glass-panel hover:bg-tea-gold/15 text-tea-gold"
            style={{ zIndex: 10 }}
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="Next tea"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
};
