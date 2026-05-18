import React, { useEffect, useRef } from 'react';
import { GalleryItem } from '../../types';

interface MiniMapProps {
  images: GalleryItem[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

export const MiniMap: React.FC<MiniMapProps> = ({
  images,
  currentIndex,
  onIndexChange,
}) => {
  const thumbnailRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to keep current thumbnail visible
  useEffect(() => {
    if (thumbnailRef.current) {
      const activeThumb = thumbnailRef.current.querySelector(
        `[data-index="${currentIndex}"]`
      );
      if (activeThumb) {
        activeThumb.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [currentIndex]);

  return (
    <div className="border-t border-tea-border bg-tea-text/50 backdrop-blur-sm">
      <div ref={thumbnailRef} className="overflow-x-auto hide-scrollbar">
        <div className="flex gap-3 md:gap-4 p-5 md:p-6 justify-start">
          {images.map((img, idx) => (
            <button
              key={idx}
              data-index={idx}
              onClick={() => onIndexChange(idx)}
              className={`relative flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden transition-all duration-300 ${
                idx === currentIndex
                  ? 'ring-2 ring-tea-text-sec/50 scale-105 opacity-100'
                  : 'opacity-40 hover:opacity-100 '
              }`}
            >
              <img
                src={(img as any).thumbnailUrl || img.url}
                alt=""
                className="w-full h-full object-cover"
              />
              {/* Number overlay - only show on non-active */}
              {idx !== currentIndex && (
                <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-tea-text/70 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-tea-text text-ui-10 font-serif">
                    {idx + 1}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
