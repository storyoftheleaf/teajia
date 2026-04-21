import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { Story } from '../types';
import { LearnCurriculum } from './LearnCurriculum';
import { LearnOverview } from './LearnOverview';
import { PageHeader } from './shared/PageHeader';
import type { LibrarySubView } from '../types/library';
import { Glossary } from './library/Glossary';
import { Playlists } from './library/Playlists';
import { Videos } from './library/Videos';
import { VisualGuides } from './library/VisualGuides';
import { ReadingList } from './library/ReadingList';
import { JourneysView } from './learn/JourneysView';
import { CommunityWisdomView } from './learn/CommunityWisdomView';
import { TeaSpacesView } from './learn/TeaSpacesView';
import { useSubViewNavigation } from '../hooks/useSubViewNavigation';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import { Breadcrumb } from './shared/Breadcrumb';

type LearnView = 'overview' | 'course' | 'glossary' | 'playlists' | 'videos' | 'visual-guides' | 'reading' | 'journeys' | 'wisdom' | 'spaces';

const VIEW_LABELS: Record<LearnView, string> = {
  overview: 'Overview',
  course: 'Go Deeper',
  glossary: 'Glossary',
  playlists: 'Playlists',
  videos: 'Videos',
  'visual-guides': 'Visual Guides',
  reading: 'Reading',
  journeys: 'Journeys',
  wisdom: 'Community Wisdom',
  spaces: 'Tea Spaces',
};

interface LearnHubProps {
  onStoryClick: (story: Story) => void;
  watchedStories: Record<string, boolean>;
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
  onNavigateToConsult?: () => void;
}

export const LearnHub: React.FC<LearnHubProps> = ({
  onStoryClick,
  watchedStories,
  onCartClick,
  onAccountClick,
  cartItemCount = 0,
  onNavigateToConsult,
}) => {
  // URL-synced sub-view navigation — browser back works properly
  const { currentView, navigateTo, navigateBack, isSubView } = useSubViewNavigation<LearnView>('v', 'overview');

  // Restore scroll position when returning to the overview
  useScrollRestoration('scroll-learn', { useWindow: true });

  // Transition animation state (visual only, doesn't affect navigation)
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevView = useRef<LearnView>(currentView);

  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Crossfade transition when view changes — no blank flash
  useEffect(() => {
    if (prevView.current !== currentView) {
      if (!reducedMotion) {
        setIsTransitioning(true);
        // Use requestAnimationFrame to ensure new content is rendered before fading in
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsTransitioning(false);
          });
        });
      }
      prevView.current = currentView;
    }
  }, [currentView, reducedMotion]);

  const handleNavigate = useCallback((section: LearnView | LibrarySubView) => {
    navigateTo(section as LearnView);
  }, [navigateTo]);

  const breadcrumbSegments = isSubView
    ? [
        { label: 'Learn', onClick: navigateBack },
        { label: VIEW_LABELS[currentView] || currentView },
      ]
    : [];

  const renderSubView = () => {
    switch (currentView) {
      case 'course':
        return (
          <div className="w-full">
            <LearnCurriculum onStoryClick={onStoryClick} watchedStories={watchedStories} />
          </div>
        );
      case 'glossary':
        return <Glossary onBack={navigateBack} />;
      case 'playlists':
        return <Playlists onBack={navigateBack} />;
      case 'videos':
        return <Videos onBack={navigateBack} />;
      case 'visual-guides':
        return <VisualGuides onBack={navigateBack} />;
      case 'reading':
        return <ReadingList onBack={navigateBack} />;
      case 'journeys':
        return <JourneysView onBack={navigateBack} />;
      case 'wisdom':
        return <CommunityWisdomView onBack={navigateBack} />;
      case 'spaces':
        return <TeaSpacesView onBack={navigateBack} onNavigateToConsult={onNavigateToConsult} />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full animate-[fadeIn_0.5s_ease-out]">
      <Helmet>
        <title>Learn — Teajia</title>
        <meta name="description" content="A structured curriculum for understanding tea — from leaf to cup. Courses, glossary, visual guides, and community wisdom." />
      </Helmet>
      {!isSubView && (
        <PageHeader title="Learn" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount} />
      )}

      {/* Always reserve breadcrumb height to prevent layout shift */}
      <div className={`${isSubView ? 'mt-8' : 'mt-0'} min-h-[32px]`}>
        {isSubView && <Breadcrumb segments={breadcrumbSegments} />}
      </div>
      <div
        className={`max-w-[1400px] mx-auto transition-opacity ${reducedMotion ? '' : 'duration-300'} ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
      >
        {isSubView ? (
          <>
            {renderSubView()}
          </>
        ) : (
          <LearnOverview
            onStoryClick={onStoryClick}
            watchedStories={watchedStories}
            onNavigateTo={handleNavigate}
            onNavigateToConsult={onNavigateToConsult}
          />
        )}
      </div>
    </div>
  );
};
