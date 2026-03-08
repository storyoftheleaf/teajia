import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Story, ContentType } from '../types';
import { Tag, getArticleTags } from '../data/tags';
import { ReadArticle, toReadArticle } from '../types/read';
import { Card } from './Card';
import { PageHeader } from './shared/PageHeader';
import { TagFilter } from './read/TagFilter';
import { ReadableCard } from './read/ReadableCard';
import EmailCapture from './EmailCapture';
import Footer from './Footer';

interface ReadPageProps {
  stories: Story[];
  savedStoryIds: Record<string, boolean>;
  watchedStoryIds: Record<string, boolean>;
  onCardClick: (story: Story) => void;
  onToggleSave: (id: string) => void;
  onShare: (story: Story) => void;
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
}

const ReadPage: React.FC<ReadPageProps> = ({
  stories,
  savedStoryIds,
  watchedStoryIds,
  onCardClick,
  onToggleSave,
  onShare,
  onCartClick,
  onAccountClick,
  cartItemCount = 0,
}) => {
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const newToYouRef = useRef<HTMLDivElement>(null);

  // Build ReadArticle list: published articles + photo essays merged with tag metadata
  const allArticles: ReadArticle[] = useMemo(() => {
    return stories
      .filter(s =>
        (s.type === ContentType.Article || s.type === ContentType.PhotoEssay) &&
        s.status === 'published'
      )
      .map(s => toReadArticle(s, getArticleTags(s.id)))
      .sort((a, b) => {
        if (a.publishedDate && b.publishedDate) {
          return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
        }
        if (a.publishedDate) return -1;
        if (b.publishedDate) return 1;
        return 0;
      });
  }, [stories]);

  // Featured article
  const featuredArticle = useMemo(
    () => allArticles.find(a => a.featured),
    [allArticles]
  );

  // New To You: unread articles (not watched), limited to 10
  const newToYouArticles = useMemo(
    () => allArticles
      .filter(a => !watchedStoryIds[a.id] && !a.startHere)
      .slice(0, 10),
    [allArticles, watchedStoryIds]
  );

  // Start Here: foundational articles
  const startHereArticles = useMemo(
    () => allArticles.filter(a => a.startHere),
    [allArticles]
  );

  // The Collection: all articles, filtered by selected tags
  const collectionArticles = useMemo(() => {
    if (selectedTags.length === 0) return allArticles;
    return allArticles.filter(a =>
      a.tags.some(t => selectedTags.includes(t))
    );
  }, [allArticles, selectedTags]);

  const handleTagToggle = useCallback((tag: Tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  }, []);

  const handleClearTags = useCallback(() => {
    setSelectedTags([]);
  }, []);

  // Horizontal scroll for New To You
  const handleScrollLeft = () => {
    if (newToYouRef.current) {
      newToYouRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };
  const handleScrollRight = () => {
    if (newToYouRef.current) {
      newToYouRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full animate-[fadeIn_0.6s_ease-out]">
      <PageHeader
        title="Read"
        onCartClick={onCartClick}
        onAccountClick={onAccountClick}
        cartItemCount={cartItemCount}
      />

      <div className="mt-4 mb-24 space-y-12">
        {/* ===== Section 1: Featured Story ===== */}
        {featuredArticle && (
          <section className="px-4 md:px-6">
            <button
              onClick={() => onCardClick(featuredArticle)}
              className="w-full group relative overflow-hidden bg-tea-elevated rounded-sm"
              style={{ aspectRatio: '16/7' }}
            >
              {/* Background Image */}
              {featuredArticle.thumbnailUrl && (
                <img
                  src={featuredArticle.thumbnailUrl}
                  alt={featuredArticle.title}
                  className="absolute inset-0 w-full h-full object-cover sepia-[0.1] brightness-[0.6] group-hover:brightness-[0.7] group-hover:scale-[1.02] transition-all duration-700"
                />
              )}

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 text-left">
                <p className="text-[10px] uppercase tracking-[0.25em] text-tea-paper/50 font-sans mb-3">
                  Featured
                </p>
                <h2 className="font-serif text-3xl md:text-5xl lg:text-6xl text-tea-paper font-light leading-[1.1] mb-3 group-hover:text-tea-gold transition-colors duration-500">
                  {featuredArticle.title}
                </h2>
                <p className="font-sans text-sm md:text-base text-tea-paper/70 max-w-lg leading-relaxed mb-4">
                  {featuredArticle.description}
                </p>
                <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-tea-paper/60 font-sans group-hover:text-tea-gold transition-colors">
                  Read
                  <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </button>
          </section>
        )}

        {/* ===== Section 2: New To You ===== */}
        {newToYouArticles.length > 0 ? (
          <section>
            <div className="flex items-center justify-between px-4 md:px-6 mb-4">
              <h3 className="font-serif text-xl md:text-2xl text-tea-text font-normal">
                New To You
              </h3>
              {/* Scroll arrows for desktop */}
              <div className="hidden md:flex items-center gap-1">
                <button
                  onClick={handleScrollLeft}
                  className="p-1.5 text-tea-text/40 hover:text-tea-text transition-colors"
                  aria-label="Scroll left"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={handleScrollRight}
                  className="p-1.5 text-tea-text/40 hover:text-tea-text transition-colors"
                  aria-label="Scroll right"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div
              ref={newToYouRef}
              className="flex gap-4 overflow-x-auto px-4 md:px-6 pb-2 scrollbar-hide"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {newToYouArticles.map(article => (
                <div
                  key={article.id}
                  className="flex-shrink-0 w-[160px] md:w-[200px]"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <Card
                    story={article}
                    onClick={onCardClick}
                    isSaved={savedStoryIds[article.id]}
                    isWatched={false}
                    onToggleSave={onToggleSave}
                    onShare={onShare}
                  />
                </div>
              ))}
            </div>
          </section>
        ) : (
          /* All caught up state */
          <section className="px-4 md:px-6">
            <div className="flex items-center gap-3 py-6 border-y border-tea-text/5 ">
              <div className="w-8 h-8 rounded-full bg-tea-green/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-tea-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-sans text-tea-text/50">
                You're all caught up
              </p>
            </div>
          </section>
        )}

        {/* ===== Section 3: Start Here ===== */}
        {startHereArticles.length > 0 && (
          <section className="px-4 md:px-6">
            <h3 className="font-serif text-xl md:text-2xl text-tea-text font-normal mb-4">
              Start Here
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {startHereArticles.map(article => (
                <Card
                  key={article.id}
                  story={article}
                  onClick={onCardClick}
                  isSaved={savedStoryIds[article.id]}
                  isWatched={watchedStoryIds[article.id]}
                  onToggleSave={onToggleSave}
                  onShare={onShare}
                />
              ))}
            </div>
          </section>
        )}

        {/* ===== Section 4: The Collection ===== */}
        <section className="px-4 md:px-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="font-serif text-xl md:text-2xl text-tea-text font-normal">
              The Collection
            </h3>
            <TagFilter
              selectedTags={selectedTags}
              onTagToggle={handleTagToggle}
              onClear={handleClearTags}
            />
          </div>

          {/* Selected tags pills */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {selectedTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider font-sans bg-tea-gold/10 text-tea-gold border border-tea-gold/20 hover:bg-tea-gold/20 transition-colors"
                >
                  {tag}
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
              <button
                onClick={handleClearTags}
                className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-sans text-tea-text/40 hover:text-tea-gold transition-colors"
              >
                Clear
              </button>
            </div>
          )}

          {collectionArticles.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
              {collectionArticles.map(article => (
                <ReadableCard
                  key={article.id}
                  article={article}
                  isRead={!!watchedStoryIds[article.id]}
                  isSaved={savedStoryIds[article.id]}
                  onClick={onCardClick}
                  onToggleSave={onToggleSave}
                  onShare={onShare}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="font-serif text-lg text-tea-text/40 mb-2">
                No articles match these tags
              </p>
              <button
                onClick={handleClearTags}
                className="text-xs uppercase tracking-widest font-sans text-tea-gold hover:text-tea-gold/80 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        {/* Email capture */}
        <section className="px-4 md:px-6">
          <EmailCapture heading="Want more?" subtitle="Get notified when new stories drop" />
        </section>
      </div>

      <Footer />
    </div>
  );
};

export default ReadPage;
