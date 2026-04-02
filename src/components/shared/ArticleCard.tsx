import React, { useState, useRef } from 'react';
import { Icons } from '../Icons';

// ─── ArticleCard props & component ───────────────────────────────────────────
interface ArticleCardProps {
  title: string;
  description?: string;
  imageUrl?: string;
  aspectRatio?: 'portrait' | 'square';
  slug?: string;
  onClick?: () => void;
  className?: string;
  duration?: string;
  wordCount?: number;
  isFeatured?: boolean;
  pageCount?: number;
  cardIndex?: number;
  contentType?: string;
}

const ROTATIONS = [-1.2, 0.8, -0.6, 1.0];

export const ArticleCard: React.FC<ArticleCardProps> = ({
  title,
  description,
  imageUrl,
  aspectRatio = 'portrait',
  slug,
  onClick,
  className = '',
  duration,
  wordCount,
  isFeatured,
  pageCount,
  cardIndex,
  contentType,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const hasImage = imageUrl && !imageError;

  const rotation = isFeatured ? 0 : ROTATIONS[(cardIndex || 0) % 4];
  const currentRotation = isHovered ? 0 : rotation;
  const currentLift = isHovered ? -4 : 0;

  return (
    <div
      ref={cardRef}
      className={`cursor-pointer group relative ${isFeatured ? 'magazine-card-hero' : ''} ${className}`}
      style={{
        transform: `rotate(${currentRotation}deg) translateY(${currentLift}px)`,
        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Stack hint — faint page behind */}
      {!isFeatured && (
        <div
          className="absolute inset-0 bg-tea-surface rounded-sm"
          style={{
            transform: 'rotate(1.5deg) translate(3px, 2px)',
            opacity: 0.3,
            zIndex: -1,
          }}
        />
      )}

      {/* Main card */}
      <div className="relative overflow-hidden rounded-sm aspect-[4/5] magazine-card-shadow">
        {hasImage ? (
          <>
            {/* Skeleton shimmer — shown until image fully loaded */}
            {!imageLoaded && (
              <div className="absolute inset-0 z-20 overflow-hidden bg-tea-elevated/40">
                <div
                  className="absolute inset-0 animate-shimmer"
                  style={{
                    background: 'linear-gradient(90deg, transparent, var(--tea-border), transparent)',
                  }}
                />
              </div>
            )}

            <img
              src={imageUrl}
              alt={title}
              loading="lazy"
              className="w-full h-full object-cover"
              style={{
                filter: imageLoaded
                  ? 'saturate(0.88) contrast(1.03)'
                  : 'saturate(0) blur(12px)',
                transition: 'filter 0.6s ease',
              }}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageLoaded(true);
                setImageError(true);
              }}
            />
          </>
        ) : (
          <div className="w-full h-full bg-tea-elevated flex items-center justify-center">
            <Icons.BookOpen className="w-8 h-8 text-tea-text/20" />
          </div>
        )}

        {/* Bottom gradient scrim */}
        <div className="absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Text overlay */}
        <div className={`absolute bottom-0 left-0 right-0 z-10 ${isFeatured ? 'p-5 md:p-6' : 'p-4 md:p-5'}`}>
          <h3
            className={`font-display text-white leading-[1.15] tracking-[0.01em] line-clamp-2 mb-1 ${
              isFeatured ? 'text-[22px] md:text-[28px]' : 'text-[15px] md:text-[17px]'
            }`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {title}
          </h3>
          {description && (
            <p className={`text-white/50 uppercase tracking-[0.18em] font-sans line-clamp-1 mt-1 ${
              isFeatured ? 'text-[10px] md:text-[11px]' : 'text-[9px] md:text-[10px]'
            }`}>
              {description}
            </p>
          )}
          {pageCount != null && pageCount > 0 && (
            <p className={`text-white/35 uppercase tracking-[0.15em] font-sans mt-2 ${
              isFeatured ? 'text-[10px]' : 'text-[9px]'
            }`}>
              {pageCount} {pageCount === 1 ? 'page' : 'pages'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
