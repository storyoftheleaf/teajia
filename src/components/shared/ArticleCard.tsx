import React, { useState } from 'react';
import { FileText, Play, Headphones, Camera } from 'lucide-react';
import { Icons } from '../Icons';
import { CardContainer } from './CardContainer';
import { ContentType } from '../../types';

interface ArticleCardProps {
  title: string;
  description?: string;
  imageUrl?: string;
  aspectRatio?: 'portrait' | 'square';
  onClick?: () => void;
  className?: string;
  contentType?: ContentType;
  duration?: string;
  wordCount?: number;
}

const contentTypeConfig: Record<ContentType, { icon: React.ElementType; suffix: string }> = {
  [ContentType.Article]: { icon: FileText, suffix: 'read' },
  [ContentType.Reel]: { icon: Play, suffix: 'watch' },
  [ContentType.Film]: { icon: Play, suffix: 'watch' },
  [ContentType.Audio]: { icon: Headphones, suffix: 'listen' },
  [ContentType.PhotoEssay]: { icon: Camera, suffix: '' },
};

/** Estimate reading time from word count at 200 words/min */
function estimateReadingTime(wordCount: number): string {
  const minutes = Math.max(1, Math.round(wordCount / 200));
  return `${minutes} min`;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
  title,
  description,
  imageUrl,
  aspectRatio = 'portrait',
  onClick,
  className = '',
  contentType,
  duration,
  wordCount,
}) => {
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const aspect = aspectRatio === 'portrait' ? 'aspect-[3/4]' : 'aspect-square';
  const hasImage = imageUrl && !imageError;

  React.useEffect(() => {
    if (imageUrl) setImageLoading(true);
  }, [imageUrl]);

  return (
    <div
      className={`cursor-pointer group transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98] ${className}`}
      onClick={onClick}
    >
      <CardContainer className="p-0 overflow-hidden">
        <div className={`relative w-full ${aspect} bg-tea-elevated`}>
          {hasImage ? (
            <>
              {imageLoading && (
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
                className={`w-full h-full object-cover sepia-[0.15] brightness-[0.9] contrast-[1.05] saturate-[0.8] group-hover:sepia-0 group-hover:brightness-100 group-hover:contrast-100 group-hover:saturate-100 transition-all duration-700 ease-out ${imageLoading ? 'blur-sm scale-105' : 'blur-0 scale-100'}`}
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageLoading(false);
                  setImageError(true);
                }}
              />

              {/* Paper texture overlay */}
              <div
                className="absolute inset-0 opacity-[0.07] mix-blend-overlay pointer-events-none z-10"
                style={{
                  backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
                }}
              />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500" />
            </>
          ) : (
            <>
              {/* No-image fallback */}
              <div className="absolute inset-0 bg-tea-elevated flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border border-tea-gold/10 flex items-center justify-center">
                  <Icons.BookOpen className="w-5 h-5 text-tea-text/30" />
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
            </>
          )}

          {/* Content-type badge — icon only, no reading time */}
          {contentType && (() => {
            const config = contentTypeConfig[contentType];
            const Icon = config.icon;
            return (
              <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-tea-bg/80 backdrop-blur-sm rounded-full px-2.5 py-1 border border-tea-border">
                <Icon className="w-3 h-3 text-tea-gold" strokeWidth={2} />
              </div>
            );
          })()}

          {/* Bottom text overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <h3 className="font-serif text-[19px] text-tea-text leading-[1.2] tracking-[0.01em] line-clamp-2 mb-1 group-hover:text-tea-gold transition-colors duration-500">
              {title}
            </h3>
            {description && (
              <p className="text-[10px] text-tea-text-sec uppercase tracking-[0.2em] font-sans line-clamp-1">
                {description}
              </p>
            )}
          </div>
        </div>
      </CardContainer>
    </div>
  );
};
