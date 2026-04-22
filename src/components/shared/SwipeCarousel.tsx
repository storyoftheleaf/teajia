import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icons } from '../Icons';

interface SwipeCarouselProps {
  children: React.ReactNode[];
  itemWidth?: number | string | 'auto';
  gap?: number | string;
  showArrows?: boolean;
  showDots?: boolean;
  peek?: number; // Percentage of container width to show next/prev items
  onActiveChange?: (index: number) => void;
  className?: string;
  arrowClassName?: string;
  /** 'dark' arrows (default) for dark backgrounds, 'light' for light backgrounds */
  arrowTheme?: 'dark' | 'light';
}

/**
 * SwipeCarousel - Native scroll-snap carousel
 *
 * Relies on CSS scroll-snap for smooth, hardware-accelerated scrolling.
 * No per-item transforms — items stay at scale(1) always to avoid layout thrashing.
 * Uses proximity snap to avoid fighting with momentum scrolling.
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
  arrowClassName = '',
  arrowTheme = 'dark',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRafRef = useRef<number | null>(null);

  // Scroll to specific index
  const scrollToIndex = useCallback((index: number) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const child = container.children[0]?.children[index] as HTMLElement;
    if (!child) return;

    // Use the child's actual offset for accuracy
    const scrollLeft = child.offsetLeft - container.offsetWidth * (peek / 100);
    container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  }, [peek]);

  // Throttled scroll handler via rAF — no state updates during scroll momentum
  const handleScroll = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      if (!containerRef.current) return;

      const container = containerRef.current;
      const scrollLeft = container.scrollLeft;
      const inner = container.children[0] as HTMLElement;
      if (!inner || !inner.children.length) return;

      // Find the child closest to the scroll position
      let closest = 0;
      let closestDist = Infinity;
      const containerCenter = scrollLeft + container.offsetWidth / 2;
      for (let i = 0; i < inner.children.length; i++) {
        const child = inner.children[i] as HTMLElement;
        const childCenter = child.offsetLeft + child.offsetWidth / 2;
        const dist = Math.abs(containerCenter - childCenter);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      }

      if (closest !== activeIndex) {
        setActiveIndex(closest);
        onActiveChange?.(closest);
      }
    });
  }, [activeIndex, onActiveChange]);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  const goToPrev = useCallback(() => {
    const newIndex = Math.max(0, activeIndex - 1);
    scrollToIndex(newIndex);
  }, [activeIndex, scrollToIndex]);

  const goToNext = useCallback(() => {
    const newIndex = Math.min(children.length - 1, activeIndex + 1);
    scrollToIndex(newIndex);
  }, [activeIndex, children.length, scrollToIndex]);

  // Keyboard support — only when carousel is focused or hovered
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goToNext(); }
  }, [goToPrev, goToNext]);

  // Arrow styling based on theme
  const arrowBase = 'absolute top-1/2 -translate-y-1/2 z-10 hidden md:flex p-2 rounded-full transition-all disabled:opacity-0 disabled:pointer-events-none';
  const arrowColors = arrowTheme === 'light'
    ? 'bg-tea-text/8 hover:bg-tea-text/15 text-tea-text/50 hover:text-tea-text/80'
    : 'bg-tea-text-sec/10 hover:bg-tea-text-sec/20 text-tea-text-sec/60 hover:text-tea-text-sec';

  // Dot styling based on theme
  const dotActive = arrowTheme === 'light' ? 'bg-tea-gold' : 'bg-tea-text-sec';
  const dotInactive = arrowTheme === 'light' ? 'bg-tea-text/15' : 'bg-tea-text-sec/30';

  return (
    <div className={`relative focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 ${className}`} onKeyDown={handleKeyDown} tabIndex={0} role="region" aria-label="Carousel">
      {/* Arrow buttons */}
      {showArrows && (
        <>
          <button
            onClick={goToPrev}
            disabled={activeIndex === 0}
            className={`${arrowBase} left-0 ${arrowColors} ${arrowClassName}`}
            aria-label="Previous"
          >
            <Icons.Back className="w-5 h-5" />
          </button>
          <button
            onClick={goToNext}
            disabled={activeIndex === children.length - 1}
            className={`${arrowBase} right-0 ${arrowColors} ${arrowClassName}`}
            aria-label="Next"
          >
            <Icons.Next className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Scroll container — proximity snap avoids fighting with momentum */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-x-auto overflow-y-hidden hide-scrollbar"
        style={{
          scrollSnapType: 'x proximity',
          WebkitOverflowScrolling: 'touch',
          scrollPaddingLeft: `${peek}%`,
          scrollPaddingRight: `${peek}%`,
        }}
      >
        <div
          className="inline-flex"
          style={{ gap: typeof gap === 'string' ? gap : `${gap}px`, padding: `0 ${peek}%` }}
        >
          {children.map((child, index) => (
            <div
              key={index}
              className="shrink-0"
              style={{
                width: itemWidth === 'auto' ? 'auto' : typeof itemWidth === 'string' ? itemWidth : `${itemWidth}px`,
                scrollSnapAlign: 'start',
              }}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* Pagination dots */}
      {showDots && children.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {children.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToIndex(index)}
              className={`h-[6px] rounded-full transition-all duration-300 ${
                index === activeIndex
                  ? 'bg-tea-gold w-3'
                  : 'bg-tea-text-sec/30 w-[6px] hover:bg-tea-text-sec/50'
              }`}
              aria-label={`Go to item ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
