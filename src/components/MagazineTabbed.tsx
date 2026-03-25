import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { Story, ContentType } from '../types';
import { ArticleCard } from './shared/ArticleCard';
import { PageHeader } from './shared/PageHeader';
import { PageHeaderTabs } from './shared/PageHeaderTabs';
import { LoadingSpinner } from './shared/LoadingSpinner';

interface MagazineTabbedProps {
  stories: Story[];
  savedStoryIds: Record<string, boolean>;
  watchedStoryIds: Record<string, boolean>;
  onCardClick: (story: Story) => void;
  onToggleSave: (id: string) => void;
  onShare: (story: Story) => void;
  defaultTab?: MagazineTab;
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
}

type MagazineTab = 'articles' | 'visual';

export const MagazineTabbed: React.FC<MagazineTabbedProps> = ({
  stories,
  savedStoryIds,
  watchedStoryIds,
  onCardClick,
  onToggleSave,
  onShare,
  defaultTab = 'articles',
  onCartClick,
  onAccountClick,
  cartItemCount = 0,
}) => {
  // Read initial tab from URL hash or use defaultTab
  const [activeTab, setActiveTab] = useState<MagazineTab>(() => {
    if (typeof window === 'undefined') return defaultTab;
    const hash = window.location.hash.replace('#', '') as MagazineTab;
    return ['articles', 'visual'].includes(hash) ? hash : defaultTab;
  });

  // Handle tab change with URL persistence
  const handleTabChange = (tab: MagazineTab) => {
    setActiveTab(tab);
    window.history.replaceState(null, '', `#${tab}`);
  };

  // Infinite scroll state
  const [displayCount, setDisplayCount] = useState(12);
  const [isLoading, setIsLoading] = useState(false);

  // Sync activeTab with defaultTab prop changes (when navigating from other sections)
  useEffect(() => {
    // Only sync if URL hash is not set (meaning user navigated here fresh)
    const hash = window.location.hash.replace('#', '') as MagazineTab;
    if (!['articles', 'visual'].includes(hash)) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  // Reset display count when tab changes
  useEffect(() => {
    setDisplayCount(12);
  }, [activeTab]);

  // Filter and sort stories by type
  const articles = useMemo(() => {
    const filtered = stories.filter(s => s.type === ContentType.Article && s.status === 'published');
    // Sort by publishedDate (newest first), fall back to array order if no date
    return filtered.sort((a, b) => {
      if (a.publishedDate && b.publishedDate) {
        return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
      }
      if (a.publishedDate) return -1;
      if (b.publishedDate) return 1;
      return 0; // Keep original order if neither has date
    });
  }, [stories]);

  const photoEssays = useMemo(() => {
    const filtered = stories.filter(s => s.type === ContentType.PhotoEssay && s.status === 'published');
    return filtered.sort((a, b) => {
      if (a.publishedDate && b.publishedDate) {
        return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
      }
      if (a.publishedDate) return -1;
      if (b.publishedDate) return 1;
      return 0;
    });
  }, [stories]);

  // Get displayed items based on current count
  const displayedArticles = articles.slice(0, displayCount);
  const displayedPhotoEssays = photoEssays.slice(0, displayCount);
  const hasMoreArticles = displayCount < articles.length;
  const hasMorePhotoEssays = displayCount < photoEssays.length;

  // Infinite scroll handler
  useEffect(() => {
    const handleScroll = () => {
      // Don't trigger if already loading or no more items
      const hasMore = activeTab === 'articles' ? hasMoreArticles : hasMorePhotoEssays;
      if (isLoading || !hasMore) return;

      // Check if scrolled near bottom (200px threshold)
      const scrolledToBottom = window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 200;

      if (scrolledToBottom) {
        setIsLoading(true);
        setDisplayCount(prev => prev + 12);
        setIsLoading(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoading, hasMoreArticles, hasMorePhotoEssays, activeTab]);

  const tabs = [
    { id: 'articles' as MagazineTab, label: 'Articles' },
    { id: 'visual' as MagazineTab, label: 'Visual' },
  ];

  /** Estimate word count from story content paragraphs */
  const getWordCount = (story: Story): number | undefined => {
    if (!story.content || story.content.length === 0) return undefined;
    return story.content.join(' ').split(/\s+/).filter(Boolean).length;
  };

  const renderArticleCards = (storiesList: Story[]) => (
    <div className="grid grid-cols-2 2xl:grid-cols-3 gap-3 md:gap-4 max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-3 md:px-0 stagger-grid">
      {storiesList.map((story) => (
          <ArticleCard
            key={story.id}
            title={story.title}
            description={story.subtitle}
            imageUrl={story.thumbnailUrl}
            aspectRatio="portrait"
            onClick={() => onCardClick(story)}
            contentType={story.type}
            duration={story.durationOrTime}
            wordCount={getWordCount(story)}
          />
      ))}
    </div>
  );

  const renderVisualCards = (storiesList: Story[]) => (
    <div className="grid grid-cols-2 2xl:grid-cols-3 gap-3 md:gap-4 max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-3 md:px-0 stagger-grid">
      {storiesList.map((story) => (
        <ArticleCard
          key={story.id}
          title={story.title}
          description={story.subtitle}
          imageUrl={story.thumbnailUrl}
          aspectRatio="square"
          onClick={() => onCardClick(story)}
          contentType={story.type}
          duration={story.durationOrTime}
          wordCount={getWordCount(story)}
        />
      ))}
    </div>
  );

  const renderContent = () => {
    if (activeTab === 'articles') {
      return (
        <>
          {renderArticleCards(displayedArticles)}
          {isLoading && (
            <div className="pt-6">
              <div className="grid grid-cols-2 2xl:grid-cols-3 gap-4 md:gap-6 max-w-[1400px] 2xl:max-w-[1600px] mx-auto">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2 animate-pulse">
                    <div className="relative overflow-hidden bg-tea-text/5 rounded-md aspect-[3/4] w-full">
                      <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent, var(--tea-accent-sub), transparent)' }} />
                    </div>
                    <div className="relative overflow-hidden bg-tea-text/5 rounded-sm h-4 w-4/5">
                      <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent, var(--tea-accent-sub), transparent)' }} />
                    </div>
                    <div className="relative overflow-hidden bg-tea-text/5 rounded-sm h-3 w-3/5">
                      <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent, var(--tea-accent-sub), transparent)' }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-tea-text-dim text-xs uppercase tracking-[0.12em] mt-4 pb-4">Loading more...</p>
            </div>
          )}
        </>
      );
    }

    if (activeTab === 'visual') {
      return (
        <>
          {renderVisualCards(displayedPhotoEssays)}
          {isLoading && (
            <div className="pt-6">
              <div className="grid grid-cols-2 2xl:grid-cols-3 gap-4 md:gap-6 max-w-[1400px] 2xl:max-w-[1600px] mx-auto">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2 animate-pulse">
                    <div className="relative overflow-hidden bg-tea-text/5 rounded-md aspect-square w-full">
                      <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent, var(--tea-accent-sub), transparent)' }} />
                    </div>
                    <div className="relative overflow-hidden bg-tea-text/5 rounded-sm h-4 w-4/5">
                      <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent, var(--tea-accent-sub), transparent)' }} />
                    </div>
                    <div className="relative overflow-hidden bg-tea-text/5 rounded-sm h-3 w-3/5">
                      <div className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent, var(--tea-accent-sub), transparent)' }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-tea-text-dim text-xs uppercase tracking-[0.12em] mt-4 pb-4">Loading more...</p>
            </div>
          )}
        </>
      );
    }

  };

  const renderEmptyState = (type: string) => {
    const emptyStateContent = {
      articles: {
        icon: <Icons.Book className="w-8 h-8 text-tea-text/40" />,
        title: 'No Articles Yet',
        message: 'Long-form stories about tea culture, origins, and brewing traditions are coming soon.',
        suggestion: 'Try exploring Visual while you wait.'
      },
      'visual': {
        icon: <Icons.Grid className="w-8 h-8 text-tea-text/40" />,
        title: 'No Visual Yet',
        message: 'Visual stories celebrating the artistry and beauty of tea are in the works.',
        suggestion: 'Check out Articles in the meantime.'
      }
    };

    const content = emptyStateContent[type as keyof typeof emptyStateContent];

    return (
      <div className="flex flex-col items-center justify-center py-32 px-4">
        <div className="w-20 h-20 bg-tea-gold/5 border border-tea-text/10  rounded-full flex items-center justify-center mb-6">
          {content.icon}
        </div>
        <p className="text-xl text-tea-text mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          {content.title}
        </p>
        <p className="text-tea-text/60 text-sm max-w-md text-center mb-4">
          {content.message}
        </p>
        <p className="text-tea-gold text-xs uppercase tracking-wider">
          {content.suggestion}
        </p>
      </div>
    );
  };

  return (
    <div className="w-full animate-[fadeIn_0.6s_ease-out]">
      <Helmet>
        <title>Magazine — Teajia</title>
        <meta name="description" content="Long-form stories, photo essays, and deep dives into tea culture, craft, and the people behind the leaf." />
      </Helmet>
      <PageHeader
        title="Magazine"
        onCartClick={onCartClick}
        onAccountClick={onAccountClick}
        cartItemCount={cartItemCount}
      >
        <PageHeaderTabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
      </PageHeader>

      {/* Tab Content */}
      <div className="mt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {activeTab === 'articles' ? (
              displayedArticles.length > 0 ? renderContent() : renderEmptyState('articles')
            ) : activeTab === 'visual' ? (
              displayedPhotoEssays.length > 0 ? renderContent() : renderEmptyState('visual')
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
