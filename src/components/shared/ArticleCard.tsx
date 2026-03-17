import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icons } from '../Icons';
import { CardContainer } from './CardContainer';
import { useLongPress } from '../../hooks/useLongPress';

interface ArticleCardProps {
  title: string;
  description?: string;
  imageUrl?: string;
  aspectRatio?: 'portrait' | 'square';
  onClick?: () => void;
  className?: string;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
  title,
  description,
  imageUrl,
  aspectRatio = 'portrait',
  onClick,
  className = '',
}) => {
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const aspect = aspectRatio === 'portrait' ? 'aspect-[3/4]' : 'aspect-square';
  const hasImage = imageUrl && !imageError;

  React.useEffect(() => {
    if (imageUrl) setImageLoading(true);
  }, [imageUrl]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside as unknown as EventListener);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as unknown as EventListener);
    };
  }, [contextMenu]);

  const handleLongPress = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      setContextMenu({
        x: Math.min(clientX - rect.left, rect.width - 120),
        y: Math.min(clientY - rect.top, rect.height - 80),
      });
    }
  }, []);

  const handleContextAction = useCallback((action: string) => {
    setContextMenu(null);
    if (action === 'share' && navigator.share) {
      navigator.share({ title, text: description || title }).catch(() => {});
    }
    // "Save" is a no-op placeholder — parent can wire this up later
  }, [title, description]);

  const longPressHandlers = useLongPress({
    delay: 500,
    onLongPress: handleLongPress,
    onClick,
  });

  return (
    <div
      ref={cardRef}
      className={`cursor-pointer group transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98] relative ${className}`}
      {...longPressHandlers}
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


          {/* Bottom text overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <h3 className="font-serif text-[19px] text-tea-text leading-[1.2] tracking-[0.01em] line-clamp-2 mb-1 group-hover:text-tea-gold transition-colors duration-500">
              {title}
            </h3>
            {description && (
              <p className="text-[10px] text-tea-text-sec uppercase tracking-[0.2em] font-sans line-clamp-1 lg:line-clamp-none">
                {description}
              </p>
            )}
            {/* Desktop hover: expanded description overlay */}
            {description && (
              <div className="hidden lg:block max-h-0 overflow-hidden opacity-0 group-hover:max-h-24 group-hover:opacity-100 transition-all duration-500 ease-out mt-1">
                <p className="text-xs text-tea-text-sec/80 font-sans leading-relaxed line-clamp-3 line-clamp-fade">
                  {description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Long-press context menu */}
        {contextMenu && (
          <div
            className="absolute z-30 bg-tea-elevated shadow-2xl rounded-sm overflow-hidden animate-[scaleIn_0.15s_ease-out] origin-top-left"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); handleContextAction('save'); }}
              className="flex items-center gap-2 px-4 py-2.5 text-xs text-tea-text hover:bg-tea-gold/10 transition-colors w-full text-left"
            >
              <Icons.Leaf className="w-3.5 h-3.5 text-tea-gold" />
              Save
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleContextAction('share'); }}
              className="flex items-center gap-2 px-4 py-2.5 text-xs text-tea-text hover:bg-tea-gold/10 transition-colors w-full text-left"
            >
              <Icons.Share className="w-3.5 h-3.5 text-tea-gold" />
              Share
            </button>
          </div>
        )}
      </CardContainer>
    </div>
  );
};
