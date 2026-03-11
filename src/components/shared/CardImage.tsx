import React, { useState } from 'react';
import { TeaPlaceholder } from '../shop/TeaPlaceholder';

interface CardImageProps {
  src?: string;
  alt: string;
  aspect?: 'square' | '3/4' | 'video';
  className?: string;
  onClick?: () => void;
  priority?: boolean;
  teaType?: string;
}

/**
 * Standardized image display with consistent filters and styling
 * Used by Magazine, Teaware grid, Tea grid
 */
export const CardImage: React.FC<CardImageProps> = ({
  src,
  alt,
  aspect = 'square',
  className = '',
  onClick,
  priority = false,
  teaType
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const aspectClasses = {
    square: 'aspect-square',
    '3/4': 'aspect-[3/4]',
    video: 'aspect-video'
  };

  const placeholderBg = 'bg-tea-elevated/90';

  return (
    <div
      className={`relative w-full ${aspectClasses[aspect]} overflow-hidden bg-tea-elevated/90 cursor-pointer group/img ${className}`}
      onClick={onClick}
    >
      {src && !hasError ? (
        <>
          {isLoading && <div className={`absolute inset-0 ${placeholderBg} animate-pulse`} />}
          <img
            src={src}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            className={`w-full h-full object-cover transition-all duration-700 sepia-[0.15] brightness-[0.9] contrast-[1.05] saturate-[0.8] group-hover/img:sepia-0 group-hover/img:brightness-100 group-hover/img:contrast-100 group-hover/img:saturate-100 ${
              isLoading ? 'opacity-0' : 'opacity-90 group-hover/img:opacity-100'
            }`}
          />
          {/* Texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.07] md:opacity-[0.1] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")'
            }}
          />
        </>
      ) : (
        <div className={`w-full h-full ${placeholderBg} flex items-center justify-center`}>
          {teaType ? (
            <TeaPlaceholder type={teaType} style={{ width: '100%', height: '100%' }} />
          ) : (
            <span className="text-tea-text/30 text-xs">No image</span>
          )}
        </div>
      )}
    </div>
  );
};
