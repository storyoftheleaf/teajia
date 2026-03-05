import React, { useState, useRef } from 'react';
import { Story, Person } from '../../types';
import { Icons } from '../Icons';
import { OverviewGrid } from './OverviewGrid';
import { SequentialMode } from './SequentialMode';

interface GridZoomViewerProps {
  story: Story;
  onBack: () => void;
  onPersonClick: (person: Person) => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
  onShare?: (story: Story) => void;
}

export const GridZoomViewer: React.FC<GridZoomViewerProps> = ({
  story,
  onBack,
  onPersonClick,
  isSaved = false,
  onToggleSave,
  onShare,
}) => {
  const [mode, setMode] = useState<'grid' | 'sequential'>('grid');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [contextExpanded, setContextExpanded] = useState(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollPosition = useRef(0);

  const enterSequentialMode = (index: number) => {
    // Save scroll position
    if (gridContainerRef.current) {
      savedScrollPosition.current = gridContainerRef.current.scrollTop;
    }
    setSelectedIndex(index);
    setMode('sequential');
  };

  const exitSequentialMode = () => {
    setMode('grid');
    setSelectedIndex(null);

    // Restore scroll position after a brief delay to allow DOM update
    setTimeout(() => {
      if (gridContainerRef.current) {
        gridContainerRef.current.scrollTop = savedScrollPosition.current;
      }
    }, 50);
  };

  if (!story.gallery || story.gallery.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-tea-paper dark:bg-tea-ink">
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <Icons.Image className="w-12 h-12 text-tea-ink/30 dark:text-tea-paper/30 mb-4 mx-auto" />
            <p className="text-tea-ink/50 dark:text-tea-paper/50">No images available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Grid Mode */}
      {mode === 'grid' && (
        <div
          ref={gridContainerRef}
          className="fixed inset-0 z-50 bg-tea-paper dark:bg-tea-ink overflow-y-auto animate-[fadeIn_0.3s_ease-out]"
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-tea-paper dark:bg-tea-ink border-b border-tea-ink/10 dark:border-tea-paper/10">
            <div className="flex items-center justify-between px-4 py-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-tea-ink/5 dark:hover:bg-white/5 rounded transition-colors"
                aria-label="Close photo album"
              >
                <Icons.ChevronLeft className="w-6 h-6 text-tea-ink dark:text-tea-paper" />
              </button>
              <div className="flex gap-2">
                {onToggleSave && (
                  <button
                    onClick={onToggleSave}
                    className="p-2 hover:bg-tea-ink/5 dark:hover:bg-white/5 rounded transition-colors"
                    aria-label={isSaved ? 'Remove save' : 'Save'}
                  >
                    <Icons.Heart
                      className={`w-6 h-6 ${
                        isSaved
                          ? 'fill-tea-seal text-tea-seal'
                          : 'text-tea-ink dark:text-tea-paper'
                      }`}
                    />
                  </button>
                )}
                {onShare && (
                  <button
                    onClick={() => onShare(story)}
                    className="p-2 hover:bg-tea-ink/5 dark:hover:bg-white/5 rounded transition-colors"
                    aria-label="Share"
                  >
                    <Icons.Share className="w-6 h-6 text-tea-ink dark:text-tea-paper" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 md:px-8 lg:px-12 py-8">
            {/* Album Title Section */}
            <div className="mb-12 md:mb-16">
              <h1 className="font-serif text-5xl md:text-6xl text-tea-ink dark:text-tea-paper mb-3 tracking-tight leading-tight">
                {story.title}
              </h1>
              <p className="font-serif text-xl md:text-2xl text-tea-ink/70 dark:text-tea-paper/70 mb-4">
                {story.subtitle}
              </p>
              {/* Photo count indicator */}
              <p className="text-sm uppercase tracking-wider text-tea-ink/40 dark:text-tea-paper/40 mt-3">
                {story.gallery.length} {story.gallery.length === 1 ? 'Photograph' : 'Photographs'}
              </p>
            </div>

            {/* Album Description (always visible) */}
            {story.description && (
              <p className="text-tea-ink/70 dark:text-tea-paper/70 leading-relaxed mb-8 md:mb-12 max-w-3xl text-base md:text-lg">
                {story.description}
              </p>
            )}

            {/* Extended Album Context (optional, expandable) */}
            {(story as any).context && (
              <div className="mb-8 md:mb-12 max-w-3xl">
                <button
                  onClick={() => setContextExpanded(!contextExpanded)}
                  className="flex items-center gap-2 text-sm text-tea-seal hover:text-tea-ink dark:hover:text-tea-paper transition-colors mb-4"
                >
                  <span className="font-medium uppercase tracking-wider">About this album</span>
                  <Icons.ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      contextExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {contextExpanded && (
                  <div className="text-sm md:text-base text-tea-ink/70 dark:text-tea-paper/70 leading-relaxed space-y-4 animate-[fadeIn_0.3s_ease-out]">
                    {((story as any).context as string).split('\n\n').map((paragraph: string, i: number) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Author/Photographer Info */}
            {story.author && (
              <div className="border-t border-b border-tea-ink/10 dark:border-tea-paper/10 py-6 md:py-8 mb-12 md:mb-16">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden bg-tea-ink/10 dark:bg-white/10 flex-shrink-0">
                    {story.author.avatarUrl ? (
                      <img
                        src={story.author.avatarUrl}
                        alt={story.author.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icons.User className="w-7 h-7 text-tea-ink/40 dark:text-white/40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onPersonClick(story.author!)}
                      className="text-left w-full group"
                    >
                      <h3 className="font-serif text-lg md:text-xl text-tea-ink dark:text-tea-paper group-hover:text-tea-seal dark:group-hover:text-tea-seal transition-colors">
                        {(story as any).photographerLinks?.name || story.author.name}
                      </h3>
                      <p className="text-sm text-tea-ink/60 dark:text-tea-paper/60 uppercase tracking-wider">
                        {story.author.role}
                      </p>
                    </button>
                  </div>

                  {/* External links */}
                  {((story as any).photographerLinks?.instagram || (story as any).photographerLinks?.website) && (
                    <div className="flex gap-4 ml-auto">
                      {(story as any).photographerLinks?.instagram && (
                        <a
                          href={(story as any).photographerLinks.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-tea-seal hover:text-tea-ink dark:hover:text-tea-paper transition-colors"
                          title="Instagram"
                        >
                          <Icons.Instagram className="w-5 h-5" />
                        </a>
                      )}
                      {(story as any).photographerLinks?.website && (
                        <a
                          href={(story as any).photographerLinks.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-tea-seal hover:text-tea-ink dark:hover:text-tea-paper transition-colors"
                          title="Website"
                        >
                          <Icons.ExternalLink className="w-5 h-5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Grid */}
            <OverviewGrid images={story.gallery} onImageClick={enterSequentialMode} />
          </div>
        </div>
      )}

      {/* Sequential Mode */}
      {mode === 'sequential' && selectedIndex !== null && (
        <SequentialMode
          images={story.gallery}
          currentIndex={selectedIndex}
          onIndexChange={setSelectedIndex}
          onExit={exitSequentialMode}
        />
      )}
    </>
  );
};
