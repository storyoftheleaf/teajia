import React, { useState, useRef } from 'react';
import { Story, Person, GalleryItem } from '../../types';
import { Icons } from '../Icons';

interface VisualFeatureViewerProps {
  story: Story;
  onBack: () => void;
  onPersonClick: (person: Person) => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
  onShare?: (story: Story) => void;
}

export const VisualFeatureViewer: React.FC<VisualFeatureViewerProps> = ({
  story,
  onBack,
  onPersonClick,
  isSaved = false,
  onToggleSave,
  onShare,
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [imageLoadingStates, setImageLoadingStates] = useState<Record<number, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Swipe handling for image overlay
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  // Web Share API for sharing
  const handleShareFeature = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: story.title,
          text: `${story.title} - A Visual Feature from Teajia`,
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled or share failed - silently handle
      }
    } else if (onShare) {
      onShare(story);
    }
  };

  const handleShareImage = async (imageUrl: string, caption?: string) => {
    if (navigator.share) {
      try {
        // Try to share with the image if supported
        const shareData: ShareData = {
          title: story.title,
          text: caption || `From "${story.title}" - Teajia`,
          url: imageUrl,
        };
        await navigator.share(shareData);
      } catch (err) {
        // Fallback - just share the URL
      }
    }
  };

  const handleImageLoad = (index: number) => {
    setImageLoadingStates(prev => ({ ...prev, [index]: false }));
  };

  const handleImageClick = (index: number) => {
    setSelectedImageIndex(index);
  };

  const closeImageOverlay = () => {
    setSelectedImageIndex(null);
  };

  // Navigate to next/previous image in overlay
  const goToNextImage = () => {
    if (selectedImageIndex !== null && story.gallery && selectedImageIndex < story.gallery.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  };

  const goToPrevImage = () => {
    if (selectedImageIndex !== null && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const swipeDistance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(swipeDistance) > minSwipeDistance) {
      if (swipeDistance > 0) {
        // Swiped left - go to next
        goToNextImage();
      } else {
        // Swiped right - go to previous
        goToPrevImage();
      }
    }
    // Reset
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  // Keyboard navigation for image overlay
  React.useEffect(() => {
    if (selectedImageIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextImage();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevImage();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeImageOverlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageIndex, story.gallery?.length]);

  if (!story.gallery || story.gallery.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-tea-surface">
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <Icons.Image className="w-12 h-12 text-tea-text/30 mb-4 mx-auto" />
            <p className="text-tea-text/50">No images available</p>
          </div>
        </div>
      </div>
    );
  }

  // Create layout groups: alternate between full-width and pairs
  const createLayoutGroups = (images: GalleryItem[]): Array<{ type: 'full' | 'pair'; items: { image: GalleryItem; index: number }[] }> => {
    const groups: Array<{ type: 'full' | 'pair'; items: { image: GalleryItem; index: number }[] }> = [];
    let i = 0;
    let groupIndex = 0;

    while (i < images.length) {
      const image = images[i];

      // Use explicit layout hint if provided
      if (image.layout === 'full' || groupIndex % 3 === 0) {
        // Full-width image
        groups.push({ type: 'full', items: [{ image, index: i }] });
        i++;
      } else if (i + 1 < images.length && images[i].layout !== 'full' && images[i + 1].layout !== 'full') {
        // Pair of images
        groups.push({
          type: 'pair',
          items: [
            { image: images[i], index: i },
            { image: images[i + 1], index: i + 1 }
          ]
        });
        i += 2;
      } else {
        // Single image (remaining)
        groups.push({ type: 'full', items: [{ image, index: i }] });
        i++;
      }
      groupIndex++;
    }
    return groups;
  };

  const layoutGroups = createLayoutGroups(story.gallery);

  return (
    <>
      {/* Main Scroll Container */}
      <div
        ref={containerRef}
        className="fixed inset-0 z-50 bg-tea-surface overflow-y-auto animate-[fadeIn_0.3s_ease-out]"
      >
        {/* Sticky Header - Elevated with touch targets */}
        <div className="sticky top-0 z-20 bg-tea-bg/95/95 backdrop-blur-md border-b border-tea-text/5 ">
          <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4">
            <button
              onClick={onBack}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-tea-text/5 active:bg-tea-text/10 dark:active:bg-tea-gold/10 active:scale-95 transition-all"
              aria-label="Close"
            >
              <Icons.ChevronLeft className="w-5 h-5 text-tea-text" />
            </button>

            <div className="flex gap-2">
              {onToggleSave && (
                <button
                  onClick={onToggleSave}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full active:bg-tea-text/10 dark:active:bg-tea-gold/10 active:scale-95 transition-all"
                  aria-label={isSaved ? 'Remove save' : 'Save'}
                >
                  <Icons.Heart
                    className={`w-5 h-5 ${
                      isSaved
                        ? 'fill-tea-gold text-tea-gold'
                        : 'text-tea-text'
                    }`}
                  />
                </button>
              )}
              <button
                onClick={handleShareFeature}
                className="flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-full bg-tea-text/5 active:bg-tea-text/10 dark:active:bg-tea-gold/10 active:scale-95 transition-all"
                aria-label="Share"
              >
                <Icons.Share className="w-4 h-4 text-tea-text" />
                <span className="text-xs font-medium uppercase tracking-wider text-tea-text hidden sm:inline">Share</span>
              </button>
            </div>
          </div>
        </div>

        {/* Hero Section - Premium Typography */}
        <div className="px-5 md:px-8 lg:px-12 pt-10 md:pt-14 pb-8">
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-tea-text leading-[1.1] tracking-tight mb-4">
            {story.title}
          </h1>

          {/* Accent line */}
          <div className="w-12 h-[1px] bg-tea-gold/40 mb-5" />

          <p className="font-serif text-xl md:text-2xl text-tea-text/50 mb-6">
            {story.subtitle}
          </p>

          {/* Author pill */}
          {story.author && (
            <button
              onClick={() => onPersonClick(story.author!)}
              className="flex items-center gap-3 active:opacity-70 transition-opacity py-2"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden bg-tea-text/10 ring-1 ring-tea-border">
                {story.author.avatarUrl ? (
                  <img
                    src={story.author.avatarUrl}
                    alt={story.author.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icons.User className="w-4 h-4 text-tea-text-dim" />
                  </div>
                )}
              </div>
              <span className="text-sm text-tea-text/60">
                {story.author.name}
              </span>
            </button>
          )}
        </div>

        {/* Description */}
        {story.description && (
          <div className="px-5 md:px-8 lg:px-12 pb-8 md:pb-10">
            <p className="text-tea-text/60 leading-relaxed text-base md:text-lg max-w-2xl">
              {story.description}
            </p>
          </div>
        )}

        {/* Images with varying layouts - Premium Treatment */}
        <div className="pb-12 md:pb-16">
          {layoutGroups.map((group, groupIndex) => (
            <div
              key={groupIndex}
              className="mb-6 md:mb-8 animate-reveal-up"
              style={{ animationDelay: `${groupIndex * 100}ms` }}
            >
              {group.type === 'full' ? (
                // Full-width image with premium styling
                <div className="relative px-0">
                  <div
                    className="relative w-full overflow-hidden shadow-lg ring-1 ring-tea-border active:scale-[0.99] transition-transform cursor-pointer"
                    onClick={() => handleImageClick(group.items[0].index)}
                  >
                    {/* Subtle texture overlay */}
                    <div
                      className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none z-10"
                      style={{
                        backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")'
                      }}
                    />
                    {/* Shimmer loading */}
                    {imageLoadingStates[group.items[0].index] !== false && (
                      <div className="absolute inset-0 z-20 overflow-hidden bg-tea-text/20/40">
                        <div
                          className="absolute inset-0 animate-shimmer"
                          style={{
                            background: 'linear-gradient(90deg, transparent, var(--tea-border), transparent)'
                          }}
                        />
                      </div>
                    )}
                    <img
                      src={group.items[0].image.url}
                      alt={group.items[0].image.caption || story.title}
                      className={`w-full h-auto transition-all duration-700 ${imageLoadingStates[group.items[0].index] !== false ? 'blur-sm scale-105 sepia-[0.2]' : 'blur-0 scale-100 sepia-0'}`}
                      onLoad={() => handleImageLoad(group.items[0].index)}
                    />
                  </div>
                  {/* Caption with left accent */}
                  {group.items[0].image.caption && (
                    <div className="px-5 md:px-8 lg:px-12 mt-4 mb-2">
                      <p className="border-l-2 border-tea-gold/30 pl-4 text-[13px] md:text-sm text-tea-text/50 italic leading-relaxed">
                        {group.items[0].image.caption}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                // Paired images with refined gap
                <div className="flex gap-2 md:gap-4 px-2 md:px-4">
                  {group.items.map(({ image, index }) => (
                    <div key={index} className="flex-1 relative">
                      <div
                        className="relative overflow-hidden shadow-md ring-1 ring-tea-border active:scale-[0.98] transition-transform cursor-pointer"
                        onClick={() => handleImageClick(index)}
                      >
                        {/* Subtle texture overlay */}
                        <div
                          className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none z-10"
                          style={{
                            backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")'
                          }}
                        />
                        {imageLoadingStates[index] !== false && (
                          <div className="absolute inset-0 z-20 overflow-hidden bg-tea-text/20/40">
                            <div
                              className="absolute inset-0 animate-shimmer"
                              style={{
                                background: 'linear-gradient(90deg, transparent, var(--tea-border), transparent)'
                              }}
                            />
                          </div>
                        )}
                        <img
                          src={image.url}
                          alt={image.caption || story.title}
                          className={`w-full h-auto transition-all duration-700 ${imageLoadingStates[index] !== false ? 'blur-sm scale-105 sepia-[0.2]' : 'blur-0 scale-100 sepia-0'}`}
                          onLoad={() => handleImageLoad(index)}
                        />
                      </div>
                      {image.caption && (
                        <p className="px-1 mt-3 text-[11px] md:text-xs text-tea-text/45 italic">
                          {image.caption}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Creator Card - Elevated "About the Artist" */}
        {story.author && (
          <>
            {/* Divider */}
            <div className="px-5 md:px-8 lg:px-12">
              <div className="w-full h-[1px] bg-tea-text/10/10" />
            </div>

            <div className="px-5 md:px-8 lg:px-12 py-10 md:py-14 bg-tea-text/[0.02] ">
              <div className="flex items-start gap-5">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden bg-tea-text/10 flex-shrink-0 ring-2 ring-tea-gold/20">
                  {story.author.avatarUrl ? (
                    <img
                      src={story.author.avatarUrl}
                      alt={story.author.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icons.User className="w-8 h-8 text-tea-text-dim" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => onPersonClick(story.author!)}
                    className="text-left w-full active:opacity-70 transition-opacity"
                  >
                    <h3 className="font-serif text-xl md:text-2xl text-tea-text mb-1">
                      {story.author.name}
                    </h3>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-tea-text/50 mb-3">
                      {story.author.role}
                    </p>
                  </button>
                  {story.author.bio && (
                    <p className="text-sm md:text-base text-tea-text/60 leading-relaxed mb-5">
                      {story.author.bio}
                    </p>
                  )}

                  {/* Social Links - Touch-friendly pills */}
                  {((story as any).photographerLinks?.instagram || (story as any).photographerLinks?.website) && (
                    <div className="flex flex-wrap gap-3">
                      {(story as any).photographerLinks?.instagram && (
                        <a
                          href={(story as any).photographerLinks.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 min-h-[44px] bg-tea-text/5 rounded-full text-sm text-tea-gold active:bg-tea-text/10 dark:active:bg-tea-gold/10 transition-colors"
                        >
                          <Icons.Instagram className="w-4 h-4" />
                          <span>Instagram</span>
                        </a>
                      )}
                      {(story as any).photographerLinks?.website && (
                        <a
                          href={(story as any).photographerLinks.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 min-h-[44px] bg-tea-text/5 rounded-full text-sm text-tea-gold active:bg-tea-text/10 dark:active:bg-tea-gold/10 transition-colors"
                        >
                          <Icons.ExternalLink className="w-4 h-4" />
                          <span>Website</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Share CTA at bottom - Premium pill button */}
        <div className="px-5 md:px-8 lg:px-12 pb-16">
          <button
            onClick={handleShareFeature}
            className="w-full max-w-sm mx-auto py-4 min-h-[56px] bg-tea-elevated text-tea-text font-medium text-sm uppercase tracking-[0.15em] rounded-full shadow-md active:scale-[0.98] active:shadow-sm transition-all flex items-center justify-center gap-3"
          >
            <Icons.Share className="w-4 h-4" />
            Share this Feature
          </button>
        </div>
      </div>

      {/* Image Overlay - Premium mobile-first with swipe navigation */}
      {selectedImageIndex !== null && story.gallery[selectedImageIndex] && (
        <div
          className="fixed inset-0 z-modal bg-tea-text/90 backdrop-blur-xl flex flex-col animate-[fadeIn_0.2s_ease-out]"
          onClick={closeImageOverlay}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top bar - Close button and counter */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
            {/* Image counter */}
            <div className="text-white/50 text-sm font-mono">
              {selectedImageIndex + 1} / {story.gallery.length}
            </div>
            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeImageOverlay();
              }}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-tea-gold/10 backdrop-blur-sm text-white/80 active:bg-tea-gold/15 active:text-white transition-all"
              aria-label="Close"
            >
              <Icons.Close className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation arrows - Desktop & tablet */}
          {selectedImageIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrevImage();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-tea-gold/10 backdrop-blur-sm text-white/80 active:bg-tea-gold/15 active:text-white transition-all"
              aria-label="Previous image"
            >
              <Icons.ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {selectedImageIndex < story.gallery.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNextImage();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-tea-gold/10 backdrop-blur-sm text-white/80 active:bg-tea-gold/15 active:text-white transition-all"
              aria-label="Next image"
            >
              <Icons.ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Image with premium styling */}
          <div
            className="flex-1 flex items-center justify-center p-4 md:p-8 pt-16"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={story.gallery[selectedImageIndex].url}
              alt={story.gallery[selectedImageIndex].caption || story.title}
              className="max-w-full max-h-full object-contain shadow-2xl ring-1 ring-tea-text-dim/10"
            />
          </div>

          {/* Page Indicators */}
          {story.gallery.length > 1 && (
            <div className="absolute bottom-32 left-0 right-0 flex justify-center gap-2 z-10" onClick={(e) => e.stopPropagation()}>
              {story.gallery.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex(idx);
                  }}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    idx === selectedImageIndex
                      ? 'bg-tea-text scale-125'
                      : 'bg-tea-gold/25 hover:bg-tea-text-sec/60'
                  }`}
                  aria-label={`Go to image ${idx + 1}`}
                />
              ))}
            </div>
          )}

          {/* Caption & Share - Refined styling */}
          <div className="p-5 pb-10 md:pb-12" onClick={(e) => e.stopPropagation()}>
            {story.gallery[selectedImageIndex].caption && (
              <p className="text-white/60 text-sm text-center mb-5 italic max-w-lg mx-auto leading-relaxed">
                {story.gallery[selectedImageIndex].caption}
              </p>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleShareImage(
                  story.gallery![selectedImageIndex!].url,
                  story.gallery![selectedImageIndex!].caption
                );
              }}
              className="mx-auto flex items-center gap-2 px-6 py-3 min-h-[48px] bg-tea-gold/10 backdrop-blur-md text-white text-sm rounded-full active:bg-tea-gold/15 active:scale-95 transition-all"
            >
              <Icons.Share className="w-4 h-4" />
              Share Image
            </button>
          </div>
        </div>
      )}
    </>
  );
};
