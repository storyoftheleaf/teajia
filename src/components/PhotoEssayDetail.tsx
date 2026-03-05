import React, { useState } from 'react';
import { Story, Person } from '../types';
import { Icons } from './Icons';

interface PhotoEssayDetailProps {
  story: Story;
  onBack: () => void;
  onPersonClick: (person: Person) => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
  onShare?: (story: Story) => void;
}

export const PhotoEssayDetail: React.FC<PhotoEssayDetailProps> = ({
  story,
  onBack,
  onPersonClick,
  isSaved = false,
  onToggleSave,
  onShare,
}) => {
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});

  const handleImageLoad = (id: string) => {
    setImageLoading(prev => ({ ...prev, [id]: false }));
  };

  const handleImageError = (id: string) => {
    setImageLoading(prev => ({ ...prev, [id]: false }));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-tea-paper dark:bg-tea-ink overflow-y-auto animate-[fadeIn_0.6s_ease-out]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-tea-paper dark:bg-tea-ink border-b border-tea-ink/10 dark:border-tea-paper/10">
        <div className="flex items-center justify-between px-4 py-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-tea-ink/5 dark:hover:bg-white/5 rounded transition-colors"
            aria-label="Close photo essay"
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
                <Icons.Share2 className="w-6 h-6 text-tea-ink dark:text-tea-paper" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 md:px-6 py-8 overflow-y-auto">
        {/* Title Section */}
        <div className="mb-8">
          <h1 className="font-serif text-4xl md:text-5xl text-tea-ink dark:text-tea-paper mb-2">
            {story.title}
          </h1>
          <p className="font-serif text-xl text-tea-ink/60 dark:text-tea-paper/60 mb-4">
            {story.subtitle}
          </p>
          {story.description && (
            <p className="text-tea-ink/70 dark:text-tea-paper/70 max-w-2xl leading-relaxed">
              {story.description}
            </p>
          )}
        </div>

        {/* Creator Card */}
        {story.author && (
          <button
            onClick={() => onPersonClick(story.author!)}
            className="mb-12 w-full max-w-sm group"
          >
            <div className="bg-white dark:bg-white/5 rounded-lg p-6 hover:shadow-md dark:hover:shadow-lg transition-all duration-300 border border-tea-ink/5 dark:border-white/10">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-tea-ink/10 dark:bg-white/10 flex-shrink-0">
                  {story.author.avatarUrl ? (
                    <img
                      src={story.author.avatarUrl}
                      alt={story.author.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icons.User className="w-8 h-8 text-tea-ink/40 dark:text-white/40" />
                    </div>
                  )}
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-tea-ink dark:text-tea-paper group-hover:text-tea-seal dark:group-hover:text-tea-seal transition-colors">
                    {story.author.name}
                  </h3>
                  <p className="text-sm text-tea-ink/60 dark:text-tea-paper/60">
                    {story.author.role}
                  </p>
                </div>
              </div>
              {story.author.bio && (
                <p className="text-sm text-tea-ink/70 dark:text-tea-paper/70 text-left line-clamp-2">
                  {story.author.bio}
                </p>
              )}
            </div>
          </button>
        )}

        {/* Image Grid */}
        {story.gallery && story.gallery.length > 0 && (
          <div className="mb-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {story.gallery.map((image, index) => (
                <div
                  key={`${story.id}-${index}`}
                  className="relative aspect-square rounded-lg overflow-hidden bg-tea-ink/5 dark:bg-white/5 group"
                >
                  {/* Loading skeleton */}
                  {imageLoading[`${index}`] === true && (
                    <div className="absolute inset-0 bg-tea-ink/10 dark:bg-white/10 animate-pulse" />
                  )}

                  {/* Image */}
                  <img
                    src={image.url}
                    alt={image.caption || `Photo ${index + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onLoad={() => handleImageLoad(`${index}`)}
                    onError={() => handleImageError(`${index}`)}
                  />

                  {/* Hover overlay with caption (optional) */}
                  {image.caption && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                      <p className="text-white text-sm font-medium">{image.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!story.gallery || story.gallery.length === 0) && (
          <div className="flex flex-col items-center justify-center py-24">
            <Icons.Image className="w-12 h-12 text-tea-ink/30 dark:text-tea-paper/30 mb-4" />
            <p className="text-tea-ink/50 dark:text-tea-paper/50">No images available</p>
          </div>
        )}
      </div>
    </div>
  );
};
