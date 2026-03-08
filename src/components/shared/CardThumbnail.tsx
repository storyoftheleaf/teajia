import React, { useState } from 'react';
import { THUMBNAIL_SIZE_CLASS } from '../../utils/cardSize';

interface CardThumbnailProps {
  src?: string;
  alt: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Standardized thumbnail component with single point of configuration
 * Used by all list modes: Teaware, Tea, Education
 * Change size in cardSize.ts and it updates everywhere
 */
export const CardThumbnail: React.FC<CardThumbnailProps> = ({
  src,
  alt,
  className = '',
  onClick
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={`${THUMBNAIL_SIZE_CLASS} relative shrink-0 rounded-[2px] overflow-hidden bg-tea-elevated border border-tea-border cursor-pointer group/thumb transition-all ${className}`}
      onClick={onClick}
    >
      {src && !hasError ? (
        <>
          {isLoading && <div className="absolute inset-0 bg-tea-elevated/90 animate-pulse" />}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            className={`w-full h-full object-cover transition-all duration-300 opacity-80 group-hover/thumb:opacity-100 group-hover/thumb:scale-105 ${
              isLoading ? 'opacity-0' : ''
            }`}
          />
          {/* View affordance overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/thumb:bg-black/30 transition-all duration-200">
            <svg
              width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className="text-white opacity-0 group-hover/thumb:opacity-90 transition-opacity duration-200 drop-shadow-lg"
            >
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </div>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-tea-text">
          <span className="text-white/20 text-[8px]">—</span>
        </div>
      )}
    </div>
  );
};
