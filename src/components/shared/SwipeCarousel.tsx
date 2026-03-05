import React, { useState, useEffect, useRef } from 'react';
import { Icons } from '../Icons';

interface SwipeCarouselProps {
  children: React.ReactNode[];
  itemWidth?: number | 'auto';
  gap?: number;
  showArrows?: boolean;
  showDots?: boolean;
  peek?: number; // Percentage of container width to show next/prev items
  onActiveChange?: (index: number) => void;
  className?: string;
  arrowClassName?: string;
}

/**
 * SwipeCarousel - Hybrid scroll-snap + momentum swipe component
 *
 * Features:
 * - CSS scroll-snap for native, smooth scrolling (hardware-accelerated)
 * - JS touch handlers for velocity-based momentum
 * - Active item detection with visual feedback
 * - Keyboard and arrow button navigation
 * - Accessible fallback (works without JS)
 *
 * IMPORTANT: This component only applies transforms to the carousel container,
 * never to individual children. This preserves aspect ratios (critical for 3:4 article cards).
 */
export const SwipeCarousel: React.FC<SwipeCarouselProps> = ({
  children,
  itemWidth = 'auto',
  gap = 16,
  showArrows = true,
  showDots = false,
  peek = 5,
  onActiveChange,
  className = '',
  arrowClassName = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Touch handlers for momentum scrolling
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setTouchStartTime(Date.now());
    setIsDragging(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || !touchStartTime || !containerRef.current) {
      setIsDragging(false);
      setTouchStart(null);
      setTouchStartTime(null);
      return;
    }

    const touchEnd = e.changedTouches[0].clientX;
    const distance = Math.abs(touchStart - touchEnd);
    const duration = Date.now() - touchStartTime;
    const velocity = distance / duration;

    setIsDragging(false);
    setTouchStart(null);
    setTouchStartTime(null);

    // High velocity swipe: momentum scroll to next/prev item
    // Same threshold as PopupModal and Reader (0.3 px/ms)
    if (velocity > 0.3) {
      const direction = touchStart > touchEnd ? 1 : -1;
      const targetIndex = Math.max(
        0,
        Math.min(children.length - 1, activeIndex + direction)
      );
      scrollToIndex(targetIndex);
    }
    // Low velocity: let native scroll-snap handle it
  };

  // Scroll to specific index
  const scrollToIndex = (index: number) => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const firstChild = container.children[0] as HTMLElement;
    if (!firstChild) return;

    const itemWidth = firstChild.offsetWidth;
    const scrollLeft = index * (itemWidth + gap);

    container.scrollTo({
      left: scrollLeft,
      behavior: 'smooth'
    });
  };

  // Detect active item on scroll
  const handleScroll = () => {
    if (!containerRef.current || isDragging) return;

    const container = containerRef.current;
    const scrollLeft = container.scrollLeft;
    const firstChild = container.children[0] as HTMLElement;
    if (!firstChild) return;

    const itemWidth = firstChild.offsetWidth;
    const newIndex = Math.round(scrollLeft / (itemWidth + gap));

    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < children.length) {
      setActiveIndex(newIndex);
      onActiveChange?.(newIndex);
    }
  };

  // Arrow navigation
  const goToPrev = () => {
    const newIndex = Math.max(0, activeIndex - 1);
    scrollToIndex(newIndex);
  };

  const goToNext = () => {
    const newIndex = Math.min(children.length - 1, activeIndex + 1);
    scrollToIndex(newIndex);
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrev();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, children.length]);

  return (
    <div className={`relative ${className}`}>
      {/* Arrow buttons (desktop only) */}
      {showArrows && (
        <>
          <button
            onClick={goToPrev}
            disabled={activeIndex === 0}
            className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all disabled:opacity-0 disabled:pointer-events-none ${arrowClassName}`}
            aria-label="Previous item"
          >
            <Icons.Back className="w-6 h-6" />
          </button>
          <button
            onClick={goToNext}
            disabled={activeIndex === children.length - 1}
            className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all disabled:opacity-0 disabled:pointer-events-none ${arrowClassName}`}
            aria-label="Next item"
          >
            <Icons.Next className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Scroll container */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onScroll={handleScroll}
        className="overflow-x-scroll overflow-y-hidden snap-x snap-mandatory scroll-smooth hide-scrollbar pb-4"
        style={{
          scrollPaddingLeft: `${peek}%`,
          scrollPaddingRight: `${peek}%`
        }}
      >
        <div
          className="inline-flex"
          style={{ gap: `${gap}px`, padding: `0 ${peek}%` }}
        >
          {children.map((child, index) => (
            <div
              key={index}
              className={`snap-center shrink-0 transition-all duration-200 ${
                index === activeIndex
                  ? 'scale-105'
                  : 'scale-100'
              }`}
              style={{
                width: itemWidth === 'auto' ? 'auto' : `${itemWidth}px`
              }}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* Pagination dots (optional) */}
      {showDots && children.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {children.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToIndex(index)}
              className={`h-2 rounded-full transition-all ${
                index === activeIndex
                  ? 'bg-white w-6'
                  : 'bg-white/30 w-2'
              }`}
              aria-label={`Go to item ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
