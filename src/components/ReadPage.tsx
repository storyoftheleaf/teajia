import React, { useMemo, useRef } from 'react';
import { Story, ContentType } from '../types';
import { getArticleTags } from '../data/tags';
import { ReadArticle, toReadArticle } from '../types/read';
import { Card } from './Card';
import { PageHeader } from './shared/PageHeader';
import { EmailCapture } from './EmailCapture';
import Footer from './shared/Footer';

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
  const essaysRef = useRef<HTMLDivElement>(null);

  // Build ReadArticle list: published articles + photo essays
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

  // Featured article (hero)
  const featuredArticle = useMemo(
    () => allArticles.find(a => a.featured),
    [allArticles]
  );

  // Start Here: foundational articles
  const startHereArticles = useMemo(
    () => allArticles.filter(a => a.startHere),
    [allArticles]
  );

  // Feature articles: not featured hero, not start-here, articles only
  const featureArticles = useMemo(
    () => allArticles.filter(a =>
      a.type === ContentType.Article &&
      !a.featured &&
      !a.startHere &&
      a.id !== featuredArticle?.id
    ),
    [allArticles, featuredArticle]
  );

  // Photo essays
  const photoEssays = useMemo(
    () => allArticles.filter(a => a.type === ContentType.PhotoEssay),
    [allArticles]
  );

  // Scroll handlers for photo essays
  const handleScrollLeft = () => {
    if (essaysRef.current) {
      essaysRef.current.scrollBy({ left: -340, behavior: 'smooth' });
    }
  };
  const handleScrollRight = () => {
    if (essaysRef.current) {
      essaysRef.current.scrollBy({ left: 340, behavior: 'smooth' });
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

      <div className="mt-4 mb-24">

        {/* ===== HERO: Featured Story ===== */}
        {featuredArticle && (
          <section className="px-4 md:px-6 mb-16 md:mb-20">
            <button
              onClick={() => onCardClick(featuredArticle)}
              className="w-full group relative overflow-hidden bg-tea-elevated rounded-sm"
              style={{ aspectRatio: '16/9' }}
            >
              {featuredArticle.thumbnailUrl && (
                <img
                  src={featuredArticle.thumbnailUrl}
                  alt={featuredArticle.title}
                  className="absolute inset-0 w-full h-full object-cover sepia-[0.08] brightness-[0.5] group-hover:brightness-[0.6] group-hover:scale-[1.03] transition-all duration-1000 ease-out"
                />
              )}

              {/* Layered gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-tea-bg via-tea-bg/40 to-transparent opacity-90" />
              <div className="absolute inset-0 bg-gradient-to-r from-tea-bg/30 to-transparent" />

              {/* Content — editorial layout */}
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 lg:p-16 text-left">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-[1px] bg-tea-gold/40" />
                  <p className="text-[10px] uppercase tracking-[0.3em] text-tea-gold/70 font-sans">
                    Featured
                  </p>
                </div>
                <h2
                  className="text-4xl md:text-6xl lg:text-7xl text-tea-text font-light leading-[1.05] mb-4 group-hover:text-tea-gold transition-colors duration-700"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {featuredArticle.title}
                </h2>
                {featuredArticle.subtitle && (
                  <p
                    className="text-lg md:text-xl text-tea-text/50 font-light italic mb-5 max-w-md"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {featuredArticle.subtitle}
                  </p>
                )}
                <p className="font-sans text-sm text-tea-text/60 max-w-lg leading-relaxed mb-6 hidden md:block">
                  {featuredArticle.description}
                </p>
                <span className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-tea-text/50 font-sans group-hover:text-tea-gold/80 transition-colors duration-500">
                  Read the story
                  <svg className="w-4 h-4 group-hover:translate-x-2 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </div>
            </button>
          </section>
        )}

        {/* ===== SECTION DIVIDER ===== */}
        <div className="flex items-center justify-center gap-4 mb-16 md:mb-20 px-4">
          <div className="flex-1 h-[1px] bg-tea-border/30" />
          <div className="w-1.5 h-1.5 rotate-45 border border-tea-gold/30" />
          <div className="flex-1 h-[1px] bg-tea-border/30" />
        </div>

        {/* ===== START HERE ===== */}
        {startHereArticles.length > 0 && (
          <section className="px-4 md:px-6 mb-16 md:mb-20">
            <div className="text-center mb-8">
              <p className="text-[10px] uppercase tracking-[0.3em] text-tea-gold/60 font-sans mb-2">
                New to tea?
              </p>
              <h3
                className="text-2xl md:text-3xl text-tea-text font-light"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Begin Your Journey
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4 md:gap-6 max-w-2xl mx-auto">
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

        {/* ===== SECTION DIVIDER ===== */}
        <div className="flex items-center justify-center gap-4 mb-16 md:mb-20 px-4">
          <div className="flex-1 h-[1px] bg-tea-border/30" />
          <div className="w-1.5 h-1.5 rotate-45 border border-tea-gold/30" />
          <div className="flex-1 h-[1px] bg-tea-border/30" />
        </div>

        {/* ===== FEATURES: Editorial Grid ===== */}
        {featureArticles.length > 0 && (
          <section className="px-4 md:px-6 mb-16 md:mb-20">
            <div className="text-center mb-8">
              <p className="text-[10px] uppercase tracking-[0.3em] text-tea-gold/60 font-sans mb-2">
                From the editors
              </p>
              <h3
                className="text-2xl md:text-3xl text-tea-text font-light"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Features
              </h3>
            </div>

            {/* Asymmetric editorial grid */}
            <div className="max-w-5xl mx-auto">
              {/* Row 1: One large card + one small card */}
              {featureArticles.length >= 2 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
                  <div className="col-span-2">
                    <Card
                      story={featureArticles[0]}
                      onClick={onCardClick}
                      isSaved={savedStoryIds[featureArticles[0].id]}
                      isWatched={watchedStoryIds[featureArticles[0].id]}
                      onToggleSave={onToggleSave}
                      onShare={onShare}
                    />
                  </div>
                  <div className="hidden md:block">
                    <Card
                      story={featureArticles[1]}
                      onClick={onCardClick}
                      isSaved={savedStoryIds[featureArticles[1].id]}
                      isWatched={watchedStoryIds[featureArticles[1].id]}
                      onToggleSave={onToggleSave}
                      onShare={onShare}
                    />
                  </div>
                  {/* Mobile: show second card in row */}
                  <div className="md:hidden col-span-2">
                    <Card
                      story={featureArticles[1]}
                      onClick={onCardClick}
                      isSaved={savedStoryIds[featureArticles[1].id]}
                      isWatched={watchedStoryIds[featureArticles[1].id]}
                      onToggleSave={onToggleSave}
                      onShare={onShare}
                    />
                  </div>
                </div>
              )}

              {/* Row 2+: Remaining articles in clean grid */}
              {featureArticles.length > 2 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  {featureArticles.slice(2).map(article => (
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
              )}
            </div>
          </section>
        )}

        {/* ===== PHOTO ESSAYS: Cinematic Strip ===== */}
        {photoEssays.length > 0 && (
          <section className="mb-16 md:mb-20">
            {/* Section divider */}
            <div className="flex items-center justify-center gap-4 mb-16 md:mb-20 px-4">
              <div className="flex-1 h-[1px] bg-tea-border/30" />
              <div className="w-1.5 h-1.5 rotate-45 border border-tea-gold/30" />
              <div className="flex-1 h-[1px] bg-tea-border/30" />
            </div>

            <div className="px-4 md:px-6 mb-8">
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-tea-gold/60 font-sans mb-2">
                    Through the lens
                  </p>
                  <h3
                    className="text-2xl md:text-3xl text-tea-text font-light"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Visual Stories
                  </h3>
                </div>
                {/* Desktop scroll arrows */}
                <div className="hidden md:flex items-center gap-1 absolute right-6">
                  <button
                    onClick={handleScrollLeft}
                    className="p-2 text-tea-text/30 hover:text-tea-gold transition-colors"
                    aria-label="Scroll left"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleScrollRight}
                    className="p-2 text-tea-text/30 hover:text-tea-gold transition-colors"
                    aria-label="Scroll right"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Horizontal scroll of photo essays */}
            <div
              ref={essaysRef}
              className="flex gap-4 md:gap-6 overflow-x-auto px-4 md:px-6 pb-4 scrollbar-hide"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {photoEssays.map(essay => (
                <button
                  key={essay.id}
                  onClick={() => onCardClick(essay)}
                  className="flex-shrink-0 w-[280px] md:w-[340px] group relative overflow-hidden rounded-sm bg-tea-elevated"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <div className="relative aspect-[4/5] overflow-hidden">
                    {essay.thumbnailUrl && (
                      <img
                        src={essay.thumbnailUrl}
                        alt={essay.title}
                        loading="lazy"
                        className="w-full h-full object-cover sepia-[0.1] brightness-[0.75] group-hover:brightness-[0.85] group-hover:scale-[1.04] transition-all duration-700 ease-out"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-tea-bg/90 via-transparent to-transparent" />

                    {/* Photo essay badge */}
                    <div className="absolute top-4 left-4">
                      <span className="text-[9px] uppercase tracking-[0.2em] text-tea-text/50 font-sans bg-tea-bg/40 backdrop-blur-sm px-2 py-1 rounded-sm">
                        Photo Essay
                      </span>
                    </div>

                    {/* Content overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <h4
                        className="text-xl text-tea-text font-light leading-tight mb-1 group-hover:text-tea-gold transition-colors duration-500"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {essay.title}
                      </h4>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-tea-text/40 font-sans">
                        {essay.subtitle} &middot; {essay.durationOrTime}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ===== EMAIL CAPTURE ===== */}
        <section className="px-4 md:px-6 mb-8">
          <EmailCapture heading="Want more?" subtitle="Get notified when new stories drop" />
        </section>
      </div>

      <Footer />
    </div>
  );
};

export default ReadPage;
