import React, { useState } from 'react';
import { THUMBNAIL_SIZE_CLASS } from '../../utils/cardSize';
import { TeaPlaceholder } from '../shop/TeaPlaceholder';

interface CardThumbnailProps {
  src?: string;
  alt: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  teaType?: string;
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
  onClick,
  teaType
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={`${THUMBNAIL_SIZE_CLASS} relative shrink-0 rounded-[1px] overflow-hidden bg-tea-elevated cursor-pointer group/thumb transition-all ${className}`}
      style={{ boxShadow: 'inset 0 1px 3px rgba(24,19,14,0.25), inset 0 1px 0 var(--tea-accent-sub)' }}
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
          <div className="absolute inset-0 flex items-center justify-center bg-tea-text/0 group-hover/thumb:bg-tea-text/30 transition-all duration-200">
            <svg
              width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className="text-tea-text opacity-0 group-hover/thumb:opacity-90 transition-opacity duration-200 drop-shadow-lg"
            >
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </div>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-tea-elevated">
          {teaType ? (
            <TeaPlaceholder type={teaType} style={{ width: '100%', height: '100%' }} />
          ) : (
            <span className="text-tea-text-dim text-ui-8">—</span>
          )}
        </div>
      )}
    </div>
  );
};
