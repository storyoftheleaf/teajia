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

  const featuredArticle = useMemo(
    () => allArticles.find(a => a.featured),
    [allArticles]
  );

  const startHereArticles = useMemo(
    () => allArticles.filter(a => a.startHere),
    [allArticles]
  );

  const featureArticles = useMemo(
    () => allArticles.filter(a =>
      a.type === ContentType.Article &&
      !a.featured &&
      !a.startHere &&
      a.id !== featuredArticle?.id
    ),
    [allArticles, featuredArticle]
  );

  const photoEssays = useMemo(
    () => allArticles.filter(a => a.type === ContentType.PhotoEssay),
    [allArticles]
  );

  return (
    <div className="w-full animate-[fadeIn_0.6s_ease-out]">
      <PageHeader
        title="Read"
        onCartClick={onCartClick}
        onAccountClick={onAccountClick}
        cartItemCount={cartItemCount}
      />

      <div className="mt-4 mb-24">

        {/* ===== HERO ===== */}
        {featuredArticle && (
          <section className="px-4 md:px-6 mb-10 md:mb-14">
            <button
              onClick={() => onCardClick(featuredArticle)}
              className="w-full group relative overflow-hidden bg-tea-elevated rounded-sm"
              style={{ aspectRatio: '3/2' }}
            >
              {featuredArticle.thumbnailUrl && (
                <img
                  src={featuredArticle.thumbnailUrl}
                  alt={featuredArticle.title}
                  className="absolute inset-0 w-full h-full object-cover sepia-[0.08] brightness-[0.5] group-hover:brightness-[0.6] group-hover:scale-[1.03] transition-all duration-1000 ease-out"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-tea-bg/90 via-tea-bg/20 to-transparent" />

              <div className="absolute bottom-0 left-0 right-0 p-5 md:p-10 text-left">
                <h2
                  className="text-2xl md:text-5xl text-tea-text font-light leading-[1.1] mb-2 group-hover:text-tea-gold transition-colors duration-700"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {featuredArticle.title}
                </h2>
                <p className="text-xs md:text-sm text-tea-text/40 font-sans italic">
                  {featuredArticle.subtitle}
                </p>
              </div>
            </button>
          </section>
        )}

        {/* ===== START HERE ===== */}
        {startHereArticles.length > 0 && (
          <section className="px-4 md:px-6 mb-10 md:mb-14">
            <p className="text-ui-10 uppercase tracking-[0.25em] text-tea-text/30 font-sans mb-4">
              Start here
            </p>
            <div className="grid grid-cols-2 gap-3 md:gap-5 max-w-2xl">
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

        {/* ===== FEATURES ===== */}
        {featureArticles.length > 0 && (
          <section className="px-4 md:px-6 mb-10 md:mb-14">
            <p className="text-ui-10 uppercase tracking-[0.25em] text-tea-text/30 font-sans mb-4">
              Features
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
              {featureArticles.map(article => (
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

        {/* ===== PHOTO ESSAYS ===== */}
        {photoEssays.length > 0 && (
          <section className="mb-10 md:mb-14">
            <p className="text-ui-10 uppercase tracking-[0.25em] text-tea-text/30 font-sans mb-4 px-4 md:px-6">
              Visual stories
            </p>
            <div
              ref={essaysRef}
              className="flex gap-3 overflow-x-auto px-4 md:px-6 pb-2 scrollbar-hide"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {photoEssays.map(essay => (
                <div
                  key={essay.id}
                  className="flex-shrink-0 w-[200px] md:w-[240px]"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <Card
                    story={essay}
                    onClick={onCardClick}
                    isSaved={savedStoryIds[essay.id]}
                    isWatched={watchedStoryIds[essay.id]}
                    onToggleSave={onToggleSave}
                    onShare={onShare}
                  />
                </div>
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
