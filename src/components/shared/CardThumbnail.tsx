import React, { useState } from 'react';
import { THUMBNAIL_SIZE_CLASS } from '../../utils/cardSize';

interface CardThumbnailProps {
  src?: string;
  alt: string;
  className?: string;
  onClick?: () => void;
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
      className={`${THUMBNAIL_SIZE_CLASS} shrink-0 rounded-[1px] overflow-hidden bg-tea-ink dark:bg-tea-ink border border-white/10 cursor-pointer group/thumb transition-all ${className}`}
      onClick={onClick}
    >
      {src && !hasError ? (
        <>
          {isLoading && <div className="absolute inset-0 bg-tea-ink/90 dark:bg-tea-ink animate-pulse" />}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            className={`w-full h-full object-cover transition-all duration-300 opacity-70 group-hover/thumb:opacity-100 group-hover/thumb:scale-105 ${
              isLoading ? 'opacity-0' : ''
            }`}
          />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-tea-ink dark:bg-tea-ink">
          <span className="text-tea-paper/20 text-[8px]">—</span>
        </div>
      )}
    </div>
  );
};
