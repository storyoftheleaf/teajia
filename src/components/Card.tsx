
import React from 'react';
import { Story, ContentType, StoryCategory } from '../types';
import { Icons } from './Icons';
import { CardContainer } from './shared/CardContainer';
import { useParallax } from '../hooks/useParallax';
import { useLongPress } from '../hooks/useLongPress';
import { QuickActionMenu } from './shared/QuickActionMenu';

// Category badge configuration
const CATEGORY_BADGES: Record<StoryCategory, { label: string; color: string }> = {
  'tea-feature': { label: 'Tea Feature', color: 'bg-tea-gold' },
  'interview': { label: 'Interview', color: 'bg-emerald-700' },
  'science': { label: 'Science', color: 'bg-blue-700' },
  'curated': { label: 'Curated', color: 'bg-purple-700' },
  'pairing': { label: 'Pairing', color: 'bg-amber-700' },
};

interface CardProps {
  story: Story;
  onClick: (story: Story) => void;
  isSaved?: boolean;
  isWatched?: boolean;
  onToggleSave?: (id: string) => void;
  onShare?: (story: Story) => void;
}

export const Card: React.FC<CardProps> = ({ story, onClick, isSaved, isWatched, onToggleSave, onShare }) => {
  const { ref: parallaxRef, offset } = useParallax(0.02);
  const [quickAction, setQuickAction] = React.useState<{ x: number; y: number } | null>(null);

  const longPressHandlers = useLongPress({
    delay: 500,
    onLongPress: (e) => {
      const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
      setQuickAction({ x: clientX, y: clientY });
    },
    onClick: () => onClick(story),
  });

  const isPhotoEssay = story.type === ContentType.PhotoEssay;
  const isTextOnly = !isPhotoEssay && (story.drawings || !story.thumbnailUrl);
  const isAudio = story.type === ContentType.Audio;
  const isVideo = story.type === ContentType.Reel || story.type === ContentType.Film;
  const [imageLoading, setImageLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isTextOnly && story.thumbnailUrl) {
      setImageLoading(true);
    }
  }, [story.thumbnailUrl, isTextOnly]);

  let aspectRatioClass = 'aspect-[3/4]';

  if (isAudio) {
    aspectRatioClass = 'aspect-square';
  } else if (story.type === ContentType.Film) {
    aspectRatioClass = 'aspect-square';
  } else if (story.type === ContentType.Reel) {
    aspectRatioClass = 'aspect-[9/16]';
  }

  const watchedStyle = isWatched ? 'opacity-80 grayscale-[0.1]' : 'opacity-100';

  return (
    <div
      ref={parallaxRef}
      className={`cursor-pointer group relative transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98] md:hover:shadow-xl md:hover:shadow-black/10 dark:md:hover:shadow-black/30 ${watchedStyle}`}
      style={{ transform: `translateY(${offset}px)` }}
      {...longPressHandlers}
    >
      <CardContainer className="p-2 md:p-3">
        <div className={`relative w-full overflow-hidden ${aspectRatioClass} bg-tea-elevated/90`}>

            {isTextOnly ? (
              <div className="absolute inset-0 flex flex-col bg-tea-elevated/90">

                {isAudio ? (
                   <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-6 text-center">
                       <div className="w-16 h-16 rounded-full border border-tea-gold/15 flex items-center justify-center mb-5 relative group-hover:scale-105 transition-transform duration-700">
                            <div className="absolute inset-0 rounded-full border border-tea-gold/8 scale-110"></div>
                            <Icons.Audio className="w-5 h-5 text-tea-text/60 group-hover:text-tea-gold transition-colors" />
                       </div>

                       <h3 className="font-serif text-[clamp(24px,3.5vw,32px)] text-tea-text mb-2 leading-[1.2] tracking-[0.01em] group-hover:text-tea-gold transition-colors duration-500">
                           {story.title}
                       </h3>
                       <p className="text-[10px] text-tea-text-sec font-sans uppercase tracking-[0.2em] mb-4">
                           {story.subtitle}
                       </p>

                       <div className="w-6 h-[1px] bg-tea-gold/10 mb-4"></div>

                       <span className="text-[9px] font-mono text-tea-text-sec">{story.durationOrTime}</span>
                   </div>
                ) : (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center">
                        <h3 className="font-serif text-[clamp(24px,3.5vw,32px)] text-tea-text leading-[1.2] tracking-[0.01em] mb-3 group-hover:text-tea-gold transition-colors duration-500 line-clamp-2">
                           {story.title}
                        </h3>
                        <div className="flex flex-col gap-1.5 items-center">
                             <p className="text-[10px] text-tea-text-sec font-sans uppercase tracking-[0.2em]">
                                {story.subtitle}
                             </p>
                             <div className="flex items-start gap-3 mt-2 w-full justify-center">
                                <div className="w-6 h-[0.5px] bg-tea-gold/15 mt-2 shrink-0"></div>
                                <p className="font-serif font-light italic text-[18px] text-tea-gold leading-[1.4] line-clamp-2 text-center max-w-[80%]">
                                    {story.description}
                                </p>
                                <div className="w-6 h-[0.5px] bg-tea-gold/15 mt-2 shrink-0"></div>
                             </div>
                        </div>
                    </div>
                )}
              </div>
            ) : (
              <>
               <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay pointer-events-none z-10"
                 style={{
                   backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
                 }}
               />

               {imageLoading && (
                 <div className="absolute inset-0 z-20 overflow-hidden bg-tea-text/40">
                   <div
                     className="absolute inset-0 animate-shimmer"
                     style={{
                       background: 'linear-gradient(90deg, transparent, var(--tea-border), transparent)'
                     }}
                   />
                 </div>
               )}

               <img
                 src={story.thumbnailUrl}
                 alt={story.title}
                 loading="lazy"
                 className={`w-full h-full object-cover sepia-[0.15] brightness-[0.9] contrast-[1.05] saturate-[0.8] group-hover:sepia-0 group-hover:brightness-100 group-hover:contrast-100 group-hover:saturate-100 transition-all duration-700 ease-out ${imageLoading ? 'blur-sm scale-105' : 'blur-0 scale-100'}`}
                 onLoad={() => setImageLoading(false)}
                 onError={() => setImageLoading(false)}
               />

               <div className="absolute inset-0 bg-gradient-to-t from-tea-bg/95 via-tea-bg/30 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500"></div>

               {/* Desktop hover excerpt overlay */}
               {story.description && (
                 <div className="hidden md:flex absolute bottom-0 left-0 right-0 z-20 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
                   <p className="text-xs text-tea-text/80 line-clamp-2 leading-relaxed">
                     {story.description}
                   </p>
                 </div>
               )}

               {/* Category Badge */}
               {story.category && CATEGORY_BADGES[story.category] && (
                 <div className={`absolute top-3 left-3 z-30 px-2 py-1 ${CATEGORY_BADGES[story.category].color} text-tea-text text-[10px] uppercase tracking-[0.15em] font-sans rounded-sm shadow-md`}>
                   {CATEGORY_BADGES[story.category].label}
                 </div>
               )}

               {isAudio && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                    <div className="w-12 h-12 rounded-full bg-tea-gold/10 backdrop-blur-md border border-tea-gold/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 shadow-xl">
                        <Icons.Play className="w-4 h-4 text-tea-text fill-tea-text ml-0.5" />
                    </div>

                    <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-tea-bg/90 to-transparent">
                        <div className="flex justify-between items-end text-tea-text">
                           <div className="flex items-center gap-2">
                              <Icons.Audio className="w-3 h-3 opacity-90" />
                              <span className="text-xs uppercase tracking-[0.15em] opacity-90">Listen</span>
                           </div>
                           <span className="text-xs font-mono opacity-80">{story.durationOrTime}</span>
                        </div>
                    </div>
                 </div>
               )}

               {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-10 h-10 rounded-full border-[0.5px] border-tea-gold/20 flex items-center justify-center backdrop-blur-[0px] group-hover:backdrop-blur-[1px] group-hover:bg-tea-gold/5 group-hover:scale-105 transition-all duration-700">
                        <Icons.Play className="w-3 h-3 text-tea-text/90 fill-tea-text/80 ml-0.5 opacity-80 group-hover:opacity-100" />
                    </div>
                </div>
               )}
              </>
            )}
        </div>

        {!isTextOnly && (
            <div className="pt-3 pb-1 px-0.5 flex justify-between items-start gap-3">
                <div className="text-left min-w-0 flex-1">
                    <h3 className="text-[17px] font-serif text-tea-text leading-[1.2] mb-1.5 group-hover:text-tea-gold transition-colors duration-500 truncate">
                        {story.title}
                    </h3>
                    <div className="flex items-center gap-2">
                        <p className="text-[10px] text-tea-text-sec uppercase tracking-[0.2em] font-sans truncate">
                            {story.subtitle}
                        </p>
                    </div>
                </div>
            </div>
        )}
      </CardContainer>

      {/* Long-press quick action menu */}
      {quickAction && (
        <QuickActionMenu
          x={quickAction.x}
          y={quickAction.y}
          isSaved={isSaved}
          onSave={onToggleSave ? () => onToggleSave(story.id) : undefined}
          onShare={onShare ? () => onShare(story) : undefined}
          onClose={() => setQuickAction(null)}
        />
      )}
    </div>
  );
};
