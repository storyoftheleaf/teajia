import React, { useState, useMemo } from 'react';
import { useSubViewNavigation } from '../hooks/useSubViewNavigation';
import { LibrarySubView } from '../types/library';
import { Icons } from './Icons';
import Footer from './Footer';
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
import { searchLibrary, SearchResult } from '../utils/librarySearch';

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
    accentBg: 'bg-teal-500/10 dark:bg-teal-500/20',
    accentText: 'text-teal-600 dark:text-teal-400',
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
    accentBg: 'bg-purple-500/10 dark:bg-purple-500/20',
    accentText: 'text-purple-600 dark:text-purple-400',
  },
  {
    id: 'videos',
    title: 'Videos',
    description: 'Curated watching',
    icon: <Icons.Play className="w-7 h-7" />,
    accentBg: 'bg-red-500/10 dark:bg-red-500/20',
    accentText: 'text-red-600',
  },
  {
    id: 'visual-guides',
    title: 'Visual Guides',
    description: 'Infographics and printables',
    icon: <Icons.Image className="w-7 h-7" />,
    accentBg: 'bg-orange-500/10 dark:bg-orange-500/20',
    accentText: 'text-orange-600 dark:text-orange-400',
  },
  {
    id: 'reading',
    title: 'Reading',
    description: 'Articles from around the web',
    icon: <Icons.BookOpen className="w-7 h-7" />,
    accentBg: 'bg-blue-500/10 dark:bg-blue-500/20',
    accentText: 'text-blue-600 dark:text-blue-400',
  },
];

const RESULT_TYPE_LABELS: Record<SearchResult['type'], string> = {
  glossary: 'Glossary',
  'tea-map': 'Tea Map',
  playlist: 'Playlists',
  video: 'Videos',
  'visual-guide': 'Visual Guides',
  reading: 'Reading',
};

const RESULT_TYPE_TO_VIEW: Record<SearchResult['type'], LibrarySubView> = {
  glossary: 'glossary',
  'tea-map': 'tea-map',
  playlist: 'playlists',
  video: 'videos',
  'visual-guide': 'visual-guides',
  reading: 'reading',
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
          <p className="font-serif italic text-sm leading-relaxed">Tools and treasures for your tea journey</p>
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
                    No results found. Try a different search term.
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-tea-gold/[0.06]">
                    {searchResults.map(result => (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => navigateTo(RESULT_TYPE_TO_VIEW[result.type])}
                        className="flex items-start gap-3 py-3 px-1 text-left hover:bg-tea-elevated/50 transition-colors group"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-serif text-sm text-tea-text group-hover:text-tea-gold transition-colors">
                              {result.title}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-tea-text/5 text-tea-text/40">
                              {RESULT_TYPE_LABELS[result.type]}
                            </span>
                          </div>
                          <p className="text-xs text-tea-text/50">
                            {result.snippet}
                          </p>
                        </div>
                        <Icons.Next className="w-4 h-4 text-tea-text/20 group-hover:text-tea-gold transition-colors shrink-0 mt-1" />
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
                    <CardContainer variant="dark" className="hover:-translate-y-0.5 hover:shadow-lg transition-all h-full">
                      <div className="p-5 flex flex-col items-center text-center gap-3">
                        <div className={`w-12 h-12 rounded-lg ${card.accentBg} flex items-center justify-center`}>
                          <span className={card.accentText}>{card.icon}</span>
                        </div>
                        <div>
                          <h3 className="font-serif text-base text-tea-text mb-0.5">
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

      <Footer />
    </div>
  );
};

export default LibraryPage;
