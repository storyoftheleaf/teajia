import React, { useState, useEffect } from 'react';
import { GalleryItem } from '../../types';
import { Icons } from '../Icons';
import { MiniMap } from './MiniMap';

interface SequentialModeProps {
  images: GalleryItem[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onExit: () => void;
}

export const SequentialMode: React.FC<SequentialModeProps> = ({
  images,
  currentIndex,
  onIndexChange,
  onExit,
}) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [verticalSwipeOffset, setVerticalSwipeOffset] = useState(0);
  const [imagesPreloaded, setImagesPreloaded] = useState<Record<number, boolean>>({});

  // Preload adjacent images
  useEffect(() => {
    const indicesToPreload = [
      currentIndex - 1,
      currentIndex,
      currentIndex + 1,
      currentIndex + 2,
    ].filter((idx) => idx >= 0 && idx < images.length);

    indicesToPreload.forEach((idx) => {
      if (!imagesPreloaded[idx]) {
        const img = new Image();
        img.src = images[idx].url;
        img.onload = () =>
          setImagesPreloaded((prev) => ({ ...prev, [idx]: true }));
      }
    });
  }, [currentIndex, images, imagesPreloaded]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigate(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigate(1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, images.length, onExit]);

  const navigate = (direction: number) => {
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < images.length) {
      onIndexChange(newIndex);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
    setTouchStartTime(Date.now());
    setSwipeOffset(0);
    setVerticalSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null || touchStartY === null) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = touchStart - currentX;
    const diffY = touchStartY - currentY;

    // Allow horizontal swipe
    setSwipeOffset(-diffX);

    // Track vertical swipe for exit gesture
    setVerticalSwipeOffset(-diffY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null || touchStartY === null || touchStartTime === null) return;

    const touchEnd = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const horizontalDistance = Math.abs(touchStart - touchEnd);
    const verticalDistance = Math.abs(touchStartY - touchEndY);
    const duration = Date.now() - touchStartTime;
    const horizontalVelocity = horizontalDistance / duration;
    const verticalVelocity = verticalDistance / duration;

    const VELOCITY_THRESHOLD = 0.3;
    const BASE_THRESHOLD = 50;

    // Check for vertical swipe down to exit
    if (
      verticalVelocity > VELOCITY_THRESHOLD &&
      verticalDistance > 100 &&
      touchStartY < touchEndY
    ) {
      onExit();
    }
    // Check for horizontal swipe to navigate
    else if (
      horizontalVelocity > VELOCITY_THRESHOLD &&
      horizontalDistance > BASE_THRESHOLD
    ) {
      const direction = touchStart > touchEnd ? 1 : -1;
      navigate(direction);
    }

    // Reset
    setTouchStart(null);
    setTouchStartY(null);
    setTouchStartTime(null);
    setSwipeOffset(0);
    setVerticalSwipeOffset(0);
  };

  return (
    <div
      className="fixed inset-0 sidebar-inset z-modal bg-black/85 flex flex-col animate-[fadeIn_0.2s_ease-out]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 md:px-8 py-5 md:py-6 bg-gradient-to-b from-tea-bg/50 to-transparent">
        <button
          onClick={onExit}
          className="px-4 py-2 rounded-lg bg-tea-gold/10 hover:bg-tea-gold/15 backdrop-blur-sm text-white text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Icons.Grid className="w-4 h-4" />
          <span className="hidden sm:inline">Grid View</span>
        </button>

        <div className="text-white text-sm font-serif tracking-wider">
          {currentIndex + 1} <span className="text-white/50">of</span> {images.length}
        </div>
      </div>

      {/* Main image */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        {/* Navigation arrows */}
        <button
          onClick={() => navigate(-1)}
          disabled={currentIndex === 0}
          className="absolute left-4 p-3 rounded-full bg-tea-gold/10 hover:bg-tea-gold/15 text-white disabled:opacity-0 disabled:pointer-events-none transition-all z-10"
          aria-label="Previous image"
        >
          <Icons.ChevronLeft className="w-6 h-6" />
        </button>

        <div className="relative max-w-6xl max-h-full">
          {!imagesPreloaded[currentIndex] && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-tea-text-sec/30 border-t-tea-text-sec rounded-full animate-spin" />
            </div>
          )}

          <img
            src={images[currentIndex].url}
            alt={images[currentIndex].caption || `Photo ${currentIndex + 1}`}
            className="max-w-full max-h-[calc(100vh-200px)] object-contain rounded-lg shadow-2xl transition-transform duration-100"
            style={{
              transform: `translateX(${swipeOffset * 0.5}px) translateY(${
                verticalSwipeOffset * 0.3
              }px)`,
            }}
          />
        </div>

        <button
          onClick={() => navigate(1)}
          disabled={currentIndex === images.length - 1}
          className="absolute right-4 p-3 rounded-full bg-tea-gold/10 hover:bg-tea-gold/15 text-white disabled:opacity-0 disabled:pointer-events-none transition-all z-10"
          aria-label="Next image"
        >
          <Icons.ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Caption */}
      {images[currentIndex].caption && (
        <div className="px-6 md:px-8 py-6 text-center bg-gradient-to-t from-tea-bg/30 to-transparent">
          <p className="text-white/90 text-base md:text-lg font-serif leading-relaxed max-w-3xl mx-auto">
            {images[currentIndex].caption}
          </p>
        </div>
      )}

      {/* Mini-map */}
      <MiniMap
        images={images}
        currentIndex={currentIndex}
        onIndexChange={onIndexChange}
      />
    </div>
  );
};
