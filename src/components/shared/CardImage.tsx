import React, { useState } from 'react';
import { TeaPlaceholder } from '../shop/TeaPlaceholder';
import { cldUrl, type CldPreset } from '../../lib/cloudinary';

interface CardImageProps {
  src?: string;
  alt: string;
  aspect?: 'square' | '3/4' | 'video';
  className?: string;
  onClick?: () => void;
  priority?: boolean;
  teaType?: string;
  /** Cloudinary transform preset, only applied to Cloudinary-hosted images */
  cldPreset?: CldPreset;
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
  teaType,
  cldPreset = 'card'
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Apply Cloudinary transforms if the image is hosted there
  const optimizedSrc = src ? cldUrl(src, cldPreset) : undefined;

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
      {optimizedSrc && !hasError ? (
        <>
          {isLoading && <div className={`absolute inset-0 ${placeholderBg} animate-pulse`} />}
          <img
            src={optimizedSrc}
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
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
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
