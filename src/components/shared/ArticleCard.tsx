import React, { useState } from 'react';
import { Icons } from '../Icons';

interface ArticleCardProps {
  title: string;
  description?: string;
  imageUrl?: string;
  onClick?: () => void;
  className?: string;
  isFeatured?: boolean;
  cardIndex?: number;
  contentType?: string;
  isSaved?: boolean;
  authorName?: string;
  onAuthorClick?: (e: React.MouseEvent) => void;
  aspectRatio?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  // StoryCategory values
  'tea-feature': 'Tea',
  'interview':   'Interview',
  'science':     'Science',
  'curated':     'Curated',
  'pairing':     'Pairing',
  // ContentType fallbacks (non-article types only)
  'PhotoEssay':  'Visual',
  'Reel':        'Film',
  'Audio':       'Audio',
};

export const ArticleCard: React.FC<ArticleCardProps> = ({
  title,
  description,
  imageUrl,
  onClick,
  className = '',
  contentType,
  isSaved,
  authorName,
  onAuthorClick,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const hasImage = imageUrl && !imageError;
  const categoryLabel = contentType ? (CATEGORY_LABELS[contentType] ?? undefined) : undefined;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-stretch border-b border-tea-text/15 active:bg-tea-elevated/40 transition-colors duration-150 text-left ${className}`}
    >
      {/* Text block */}
      <div className="flex-1 flex flex-col justify-center py-4 pl-5 pr-4 min-w-0">
        {categoryLabel && (
          <p className="text-[9px] uppercase tracking-[0.24em] text-tea-gold font-sans mb-1.5">
            {categoryLabel}
          </p>
        )}
        <div className="flex items-start gap-2">
          <h3
            className="flex-1 text-[16px] font-normal text-tea-text leading-[1.25] line-clamp-2 mb-1"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {title}
          </h3>
          {isSaved && (
            <Icons.Leaf filled className="w-3.5 h-3.5 text-tea-gold shrink-0 mt-1" />
          )}
        </div>
        {description && (
          <p className="text-[11px] text-tea-text-sec font-sans leading-[1.4] line-clamp-1">
            {description}
          </p>
        )}
        {authorName && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAuthorClick?.(e);
            }}
            className="mt-1 text-[10px] uppercase tracking-[0.15em] text-tea-text-dim hover:text-tea-gold transition-colors font-sans text-left"
          >
            {authorName}
          </button>
        )}
      </div>

      {/* Thumbnail */}
      <div className="shrink-0 w-[88px] self-stretch">
        {hasImage ? (
          <div className="w-full h-full relative overflow-hidden">
            {!imageLoaded && (
              <div className="absolute inset-0 bg-tea-elevated/60 animate-pulse" />
            )}
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
              style={{
                filter: imageLoaded ? 'brightness(1.05) contrast(1.02)' : 'saturate(0)',
                transition: 'filter 0.4s ease',
              }}
              onLoad={() => setImageLoaded(true)}
              onError={() => { setImageLoaded(true); setImageError(true); }}
            />
          </div>
        ) : (
          <div className="w-full h-full bg-tea-elevated/40 flex items-center justify-center">
            <p className="text-[8px] uppercase tracking-[0.2em] text-tea-text-dim font-sans rotate-90 whitespace-nowrap">
              {categoryLabel ?? 'Article'}
            </p>
          </div>
        )}
      </div>
    </button>
  );
};
