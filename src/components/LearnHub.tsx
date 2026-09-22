import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Story } from '../types';
import { LearnCurriculum } from './LearnCurriculum';
import CraftIndex from '../pages/craft/CraftIndex';
import { PageHeader } from './shared/PageHeader';
import type { LibrarySubView } from '../types/library';
import { Glossary } from './library/Glossary';
import { LearnReadingLists } from './LearnReadingLists';
import { JourneysView } from './learn/JourneysView';
import { CommunityWisdomView } from './learn/CommunityWisdomView';
import { TeaSpacesView } from './learn/TeaSpacesView';
import { useSubViewNavigation } from '../hooks/useSubViewNavigation';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import { Breadcrumb } from './shared/Breadcrumb';

// Playlists, Videos and Visual Guides were retired with the Craft redesign
// (no destination in the new index); 'overview' is kept as the sub-view
// navigation's default key even though the landing is CraftIndex now, since
// useSubViewNavigation treats it as "no ?v= param" and nothing reads the
// string past that.
type LearnView = 'overview' | 'course' | 'glossary' | 'reading' | 'journeys' | 'wisdom' | 'spaces';

const VIEW_LABELS: Record<LearnView, string> = {
  overview: 'Overview',
  course: 'Six Foundations',
  glossary: 'Glossary',
  reading: 'Reading and Listening',
  journeys: 'Journeys',
  wisdom: 'Shared Wisdom',
  spaces: 'Tea Spaces',
};

// A route saved or bookmarked with one of the retired ?v= values (playlists,
// videos, visual-guides) falls back to the overview rather than rendering
// nothing: useSubViewNavigation only knows the string was in the URL, not
// whether this build still has a view for it.
const KNOWN_VIEWS = new Set<string>(Object.keys(VIEW_LABELS));

interface LearnHubProps {
  onStoryClick: (story: Story) => void;
  watchedStories: Record<string, boolean>;
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
  onNavigateToAdvise?: () => void;
}

export const LearnHub: React.FC<LearnHubProps> = ({
  onStoryClick,
  watchedStories,
  onCartClick,
  onAccountClick,
  cartItemCount = 0,
  onNavigateToAdvise,
}) => {
  // URL-synced sub-view navigation, browser back works properly
  const { currentView, navigateTo, navigateBack, isSubView } = useSubViewNavigation<LearnView>('v', 'overview');

  // Restore scroll position when returning to the overview
  useScrollRestoration('scroll-learn', { useWindow: true });

  // Transition animation state (visual only, doesn't affect navigation)
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevView = useRef<LearnView>(currentView);

  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Crossfade transition when view changes, no blank flash
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

  // A ?v= value this build no longer has a view for (playlists, videos,
  // visual-guides, from an old link or bookmark) falls back to the landing
  // rather than rendering nothing.
  const isKnownSubView = isSubView && KNOWN_VIEWS.has(currentView);

  const breadcrumbSegments = isKnownSubView
    ? [
        { label: 'Craft', onClick: navigateBack },
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
      case 'reading':
        return <LearnReadingLists onBack={navigateBack} />;
      case 'journeys':
        return <JourneysView onBack={navigateBack} />;
      case 'wisdom':
        return <CommunityWisdomView onBack={navigateBack} />;
      case 'spaces':
        return <TeaSpacesView onBack={navigateBack} onNavigateToAdvise={onNavigateToAdvise} />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full animate-[fadeIn_0.5s_ease-out]">
      {/* CraftIndex carries its own <Helmet>, title/description included, so
          the landing never renders two competing head blocks. */}
      {isKnownSubView && (
        <PageHeader title="Craft" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount} />
      )}

      {/* Always reserve breadcrumb height to prevent layout shift */}
      <div className={`${isKnownSubView ? 'mt-8' : 'mt-0'} min-h-[32px]`}>
        {isKnownSubView && <Breadcrumb segments={breadcrumbSegments} />}
      </div>
      <div
        className={`${isKnownSubView ? 'max-w-[1400px] mx-auto' : ''} transition-opacity ${reducedMotion ? '' : 'duration-300'} ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
      >
        {isKnownSubView ? (
          <>
            {renderSubView()}
          </>
        ) : (
          <CraftIndex />
        )}
      </div>
    </div>
  );
};
