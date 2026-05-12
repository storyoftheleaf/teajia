import React, { useState, useMemo } from 'react';
import { useSubViewNavigation } from '../hooks/useSubViewNavigation';
import { LibrarySubView } from '../types/library';
import { Icons } from './Icons';
import { PageHeader } from './shared/PageHeader';
import { PageHeaderSubtitle } from './shared/PageHeaderSubtitle';
import { CardContainer } from './shared/CardContainer';
import { LibrarySearch } from './library/LibrarySearch';
import { Glossary } from './library/Glossary';
import { TeaMap } from './library/TeaMap';
import { Playlists } from './library/Playlists';
import { Videos } from './library/Videos';
import { VisualGuides } from './library/VisualGuides';
import { ReadingList } from './library/ReadingList';
import { searchLibrary } from '../utils/librarySearch';
import type { LibrarySearchResult } from '../types/library';

interface LibraryPageProps {
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
}

const SECTION_CARDS: {
  id: LibrarySubView;
  title: string;
  description: string;
  icon: React.ReactNode;
  accentBg: string;
  accentText: string;
}[] = [
  {
    id: 'glossary',
    title: 'Glossary',
    description: 'Terms, characters, meanings',
    icon: <Icons.Book className="w-7 h-7" />,
    accentBg: 'bg-tea-leaf/10 dark:bg-tea-leaf/20',
    accentText: 'text-tea-leaf dark:text-tea-leaf',
  },
  {
    id: 'tea-map',
    title: 'Tea Map',
    description: 'Tea houses, shops, and spaces worth visiting',
    icon: <Icons.Location className="w-7 h-7" />,
    accentBg: 'bg-tea-gold/10',
    accentText: 'text-tea-gold',
  },
  {
    id: 'playlists',
    title: 'Playlists',
    description: 'Music for tea moments',
    icon: <Icons.Music className="w-7 h-7" />,
    accentBg: 'bg-tea-readgold/10 dark:bg-tea-readgold/20',
    accentText: 'text-tea-readgold dark:text-tea-readgold',
  },
  {
    id: 'videos',
    title: 'Videos',
    description: 'Curated watching',
    icon: <Icons.Play className="w-7 h-7" />,
    accentBg: 'bg-tea-error/10 dark:bg-tea-error/20',
    accentText: 'text-tea-error',
  },
  {
    id: 'visual-guides',
    title: 'Visual Guides',
    description: 'Infographics and printables',
    icon: <Icons.Image className="w-7 h-7" />,
    accentBg: 'bg-tea-gold/10 dark:bg-tea-gold/20',
    accentText: 'text-tea-gold dark:text-tea-gold',
  },
  {
    id: 'reading',
    title: 'Reading',
    description: 'Articles from around the web',
    icon: <Icons.BookOpen className="w-7 h-7" />,
    accentBg: 'bg-tea-elevated/10 dark:bg-tea-elevated/20',
    accentText: 'text-tea-text-sec dark:text-tea-text-sec',
  },
];

const RESULT_SECTION_LABELS: Record<string, string> = {
  glossary: 'Glossary',
  'tea-map': 'Tea Map',
  playlists: 'Playlists',
  videos: 'Videos',
  'visual-guides': 'Visual Guides',
  reading: 'Reading',
};

export const LibraryPage: React.FC<LibraryPageProps> = ({
  onCartClick,
  onAccountClick,
  cartItemCount = 0,
}) => {
  const { currentView: subView, navigateTo: navTo, navigateBack } = useSubViewNavigation<LibrarySubView>('v', 'overview');
  const [searchQuery, setSearchQuery] = useState('');

  const searchResults = useMemo(() => searchLibrary(searchQuery), [searchQuery]);
  const hasSearchResults = searchQuery.trim().length > 0;

  const goToOverview = () => {
    navigateBack();
  };

  const navigateTo = (view: LibrarySubView) => {
    navTo(view);
    setSearchQuery('');
  };

  return (
    <div className="w-full pb-32 animate-[fadeIn_0.5s_ease-out]">
      <PageHeader
        title="Library"
        onCartClick={onCartClick}
        onAccountClick={onAccountClick}
        cartItemCount={cartItemCount}
      >
        <PageHeaderSubtitle>
          <p className="italic text-sm leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>Tools and treasures for your tea journey</p>
        </PageHeaderSubtitle>
      </PageHeader>

      <div className="mt-8 max-w-4xl mx-auto px-2 md:px-0">

        {/* Overview */}
        {subView === 'overview' && (
          <div className="animate-[fadeIn_0.3s_ease-out]">
            {/* Search */}
            <div className="mb-8">
              <LibrarySearch onSearch={setSearchQuery} value={searchQuery} />
            </div>

            {/* Search results */}
            {hasSearchResults ? (
              <div>
                <p className="text-xs text-tea-text/40 mb-4">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
                </p>
                {searchResults.length === 0 ? (
                  <p className="text-sm text-tea-text/50 text-center py-8">
                    Nothing matched — try different words.
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-tea-gold/[0.06]">
                    {(searchResults as LibrarySearchResult[]).map(result => (
                      <button
                        key={`${result.section}-${result.id}`}
                        onClick={() => navigateTo(result.section)}
                        className="flex items-start gap-3 py-3 px-1 text-left hover:bg-tea-elevated/50 transition-colors group"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm text-tea-text group-hover:text-tea-gold transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                              {result.title}
                            </span>
                            <span className="text-ui-10 uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-tea-text/5 text-tea-text/40">
                              {RESULT_SECTION_LABELS[result.section] || result.sectionLabel}
                            </span>
                          </div>
                          <p className="text-xs text-tea-text/50">
                            {result.description}
                          </p>
                        </div>
                        <Icons.Next className="w-4 h-4 text-tea-text-sec group-hover:text-tea-gold transition-colors shrink-0 mt-1" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Section cards grid */
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {SECTION_CARDS.map(card => (
                  <button
                    key={card.id}
                    onClick={() => navigateTo(card.id)}
                    className="text-left"
                  >
                    <CardContainer className="transition-all h-full">
                      <div className="p-5 flex flex-col items-center text-center gap-3">
                        <div className={`w-12 h-12 rounded-lg ${card.accentBg} flex items-center justify-center`}>
                          <span className={card.accentText}>{card.icon}</span>
                        </div>
                        <div>
                          <h3 className="text-base text-tea-text mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>
                            {card.title}
                          </h3>
                          <p className="text-xs text-tea-text/50">
                            {card.description}
                          </p>
                        </div>
                      </div>
                    </CardContainer>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sub-views */}
        {subView === 'glossary' && <Glossary onBack={goToOverview} />}
        {subView === 'tea-map' && <TeaMap onBack={goToOverview} />}
        {subView === 'playlists' && <Playlists onBack={goToOverview} />}
        {subView === 'videos' && <Videos onBack={goToOverview} />}
        {subView === 'visual-guides' && <VisualGuides onBack={goToOverview} />}
        {subView === 'reading' && <ReadingList onBack={goToOverview} />}
      </div>

    </div>
  );
};

export default LibraryPage;
