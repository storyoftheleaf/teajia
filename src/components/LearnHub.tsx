import React, { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Story } from '../types';
import { Icons } from './Icons';
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

type LearnView = 'overview' | 'course' | 'glossary' | 'playlists' | 'videos' | 'visual-guides' | 'reading' | 'journeys' | 'wisdom' | 'spaces';

const VALID_VIEWS = new Set<string>(['course', 'glossary', 'playlists', 'videos', 'visual-guides', 'reading', 'journeys', 'wisdom', 'spaces']);

const BACK_BTN = 'flex items-center gap-1.5 mb-8 group min-h-[44px] rounded-md hover:bg-tea-ink/5 dark:hover:bg-white/5 px-2 -ml-2';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const currentView: LearnView = useMemo(() => {
    const viewParam = searchParams.get('view');
    if (viewParam && VALID_VIEWS.has(viewParam)) {
      return viewParam as LearnView;
    }
    return 'overview';
  }, [searchParams]);

  const navigateTo = useCallback((view: LearnView) => {
    if (view === 'overview') {
      setSearchParams({}, { replace: false });
    } else {
      setSearchParams({ view }, { replace: false });
    }
    window.scrollTo(0, 0);
  }, [setSearchParams]);

  const navigateBack = useCallback(() => {
    navigateTo('overview');
  }, [navigateTo]);

  const handleNavigate = useCallback((section: LearnView | LibrarySubView) => {
    if (section === 'overview') {
      navigateTo('overview');
    } else {
      navigateTo(section as LearnView);
    }
  }, [navigateTo]);

  const isSubView = currentView !== 'overview';

  const renderSubView = () => {
    switch (currentView) {
      case 'course':
        return (
          <div className="w-full pb-32">
            <button onClick={navigateBack} className={BACK_BTN}>
              <Icons.Back className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform text-tea-ink/70 dark:text-tea-paper/70" />
              <span className="font-serif text-sm text-tea-ink/70 dark:text-tea-paper/70">Learn</span>
            </button>
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
      {!isSubView && (
        <PageHeader title="Learn" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount} />
      )}

      <div
        className={`${isSubView ? 'mt-8' : 'mt-0'} max-w-[1400px] mx-auto`}
      >
        {isSubView ? (
          renderSubView()
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
