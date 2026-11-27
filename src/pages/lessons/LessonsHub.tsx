import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { Story } from '../../types';
import { LearnCurriculum } from '../../components/LearnCurriculum';
import LessonsIndex from './LessonsIndex';
import { PageHeader } from '../../components/shared/PageHeader';
import type { LibrarySubView } from '../../types/library';
import { LearnReadingLists } from '../../components/LearnReadingLists';
import { JourneysView } from '../../components/learn/JourneysView';
import { CommunityWisdomView } from '../../components/learn/CommunityWisdomView';
import { TeaSpacesView } from '../../components/learn/TeaSpacesView';
import { useSubViewNavigation } from '../../hooks/useSubViewNavigation';
import { useScrollRestoration } from '../../hooks/useScrollRestoration';
import { Breadcrumb } from '../../components/shared/Breadcrumb';

/**
 * Read's Lessons shelf at /read/lessons: the index (LessonsIndex) and the
 * lessons themselves as ?v= sub-views. This was Craft's hub (LearnHub) until
 * Craft left the bar on 2026-11-27; the sub-views and their addresses moved
 * from /craft?v= to /read/lessons?v= unchanged.
 *
 * Tea Spaces (?v=spaces) and Shared Wisdom (?v=wisdom) are Room pieces bound
 * for Tea house and Tea table. They stay here, unlisted, until those pages
 * take them, so nothing is lost on the way. The glossary moved to the Wisdom
 * Base, so ?v=glossary forwards to /wisdom/glossary.
 */
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

export const LessonsHub: React.FC<LearnHubProps> = ({
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
        { label: 'Lessons', onClick: navigateBack },
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
        return <Navigate to="/wisdom/glossary" replace />;
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
      {/* LessonsIndex carries its own <Helmet>, title/description included, so
          the landing never renders two competing head blocks. */}
      {isKnownSubView && (
        <PageHeader title="Lessons" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount} />
      )}

      {/* Breadcrumb height is reserved on sub-views only. The index has no
          breadcrumb, and reserving 32px there left a strip of lighter ground
          above its header that Read and Advise do not have. */}
      {isKnownSubView && (
        <div className="mt-8 min-h-[32px]">
          <Breadcrumb segments={breadcrumbSegments} />
        </div>
      )}
      <div
        className={`${isKnownSubView ? 'max-w-[1400px] mx-auto' : ''} transition-opacity ${reducedMotion ? '' : 'duration-300'} ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
      >
        {isKnownSubView ? (
          <>
            {renderSubView()}
          </>
        ) : (
          <LessonsIndex />
        )}
      </div>
    </div>
  );
};

export default LessonsHub;
