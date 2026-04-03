import React, { useState, useMemo } from 'react';
import { Icons } from './Icons';
import { CardContainer } from './shared/CardContainer';
import { LearnReadingLists } from './LearnReadingLists';
import { COMMUNITY_WISDOM, WISDOM_TYPE_LABELS, type WisdomType, type CommunityWisdomEntry } from '../data/communityWisdom';
import { CURATED_COLLECTIONS, DIFFICULTY_COLORS } from '../data/curatedCollections';
import { TEA_SPACES, SPACE_TYPE_LABELS } from '../data/teaSpaces';
import { TeaGlossary } from './TeaGlossary';

// ─── Types ───────────────────────────────────────────────────────────────────

type ExploreView = 'grid' | 'journeys' | 'wisdom' | 'glossary' | 'media' | 'guides' | 'reference' | 'spaces';

interface LibraryItem {
  id: string;
  title: string;
  description: string;
  type: 'guide' | 'reference';
}

interface LearnExploreProps {
  watchedStories: Record<string, boolean>;
  onNavigateToConsult?: () => void;
}

// ─── Static Data ─────────────────────────────────────────────────────────────

const GUIDES: LibraryItem[] = [
  { id: 'br1', title: 'Gongfu Brewing Essentials', description: 'Complete guide to traditional gongfu brewing', type: 'guide' },
  { id: 'br2', title: 'Water Temperature Chart', description: 'Downloadable PDF with optimal temperatures by tea type', type: 'guide' },
  { id: 'br3', title: 'Leaf-to-Water Ratios', description: 'Quick reference for proportions and timing', type: 'guide' },
  { id: 'br4', title: 'Teaware Care & Maintenance', description: 'How to properly care for your brewing vessels', type: 'guide' },
  { id: 'br5', title: 'Flavor Development Guide', description: 'How brewing parameters affect taste', type: 'guide' },
];

const REFERENCE: LibraryItem[] = [
  { id: 'r1', title: 'Tasting Notes Worksheet', description: 'Printable template for recording observations', type: 'reference' },
  { id: 'r2', title: 'Tea Region Map', description: 'Major tea-producing regions worldwide', type: 'reference' },
  { id: 'r3', title: 'Collection Organization', description: 'Spreadsheet for tracking your collection', type: 'reference' },
  { id: 'r4', title: 'Brewing Experiment Journal', description: 'Guided journal for brewing experiments', type: 'reference' },
];

const REFERENCE_ICONS: Record<string, React.ReactNode> = {
  'r1': <Icons.Book className="w-6 h-6" />,
  'r2': <Icons.Location className="w-6 h-6" />,
  'r3': <Icons.Grid className="w-6 h-6" />,
  'r4': <Icons.Book className="w-6 h-6" />,
};

const TYPE_COLORS: Record<string, string> = {
  guide: 'bg-tea-green/10 dark:bg-green-500/20 text-tea-green dark:text-green-300 border border-tea-green/30 dark:border-green-400/40',
  reference: 'bg-orange-500/10 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-400/30 dark:border-orange-400/40',
};

const WISDOM_TYPE_COLORS: Record<string, string> = {
  reflection: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-400/30',
  tip: 'bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300 border border-green-400/30',
  ritual: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-400/30',
  photo: 'bg-orange-500/10 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-400/30',
};

// Grid tile definitions
const GRID_TILES: { id: ExploreView; title: string; subtitle: string; icon: React.ReactNode; accentBg: string; accentText: string }[] = [
  { id: 'journeys', title: 'Tea Journeys', subtitle: `${CURATED_COLLECTIONS.length} guided paths`, icon: <Icons.Leaf className="w-8 h-8" />, accentBg: 'bg-tea-gold/10', accentText: 'text-tea-gold' },
  { id: 'wisdom', title: 'Community Wisdom', subtitle: `${COMMUNITY_WISDOM.length} reflections`, icon: <Icons.Users className="w-8 h-8" />, accentBg: 'bg-blue-500/10 dark:bg-blue-500/20', accentText: 'text-blue-500 dark:text-blue-400' },
  { id: 'glossary', title: 'Tea Glossary', subtitle: '58 essential terms', icon: <Icons.Book className="w-8 h-8" />, accentBg: 'bg-teal-500/10 dark:bg-teal-500/20', accentText: 'text-teal-500 dark:text-teal-400' },
  { id: 'media', title: 'Media & Playlists', subtitle: '5 curated lists', icon: <Icons.Music className="w-8 h-8" />, accentBg: 'bg-purple-500/10 dark:bg-purple-500/20', accentText: 'text-purple-500 dark:text-purple-400' },
  { id: 'guides', title: 'Brewing Guides', subtitle: `${GUIDES.length} references`, icon: <Icons.Download className="w-8 h-8" />, accentBg: 'bg-tea-green/10', accentText: 'text-tea-green' },
  { id: 'reference', title: 'Reference Tools', subtitle: `${REFERENCE.length} templates`, icon: <Icons.Grid className="w-8 h-8" />, accentBg: 'bg-orange-500/10 dark:bg-orange-500/20', accentText: 'text-orange-500 dark:text-orange-400' },
  { id: 'spaces', title: 'Tea Spaces', subtitle: `${TEA_SPACES.length} inspirations`, icon: <Icons.Palette className="w-8 h-8" />, accentBg: 'bg-tea-gold/10', accentText: 'text-tea-gold' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export const LearnExplore: React.FC<LearnExploreProps> = ({ watchedStories, onNavigateToConsult }) => {
  const [activeView, setActiveView] = useState<ExploreView>('grid');

  // Tea Journeys state
  const [expandedJourneys, setExpandedJourneys] = useState<Record<string, boolean>>({
    [CURATED_COLLECTIONS[0]?.id || '']: true,
  });

  // Community Wisdom state
  const [wisdomFilter, setWisdomFilter] = useState<WisdomType | 'all'>('all');
  const [expandedWisdom, setExpandedWisdom] = useState<Record<string, boolean>>({});
  const [showAllWisdom, setShowAllWisdom] = useState(false);

  // Tea Spaces state
  const [expandedSpace, setExpandedSpace] = useState<string | null>(null);

  const getTypeColor = (type: string) => TYPE_COLORS[type] || 'bg-tea-gold/10 text-tea-text/50';

  // Community Wisdom filtering
  const filteredWisdom = useMemo(() => {
    if (wisdomFilter === 'all') return COMMUNITY_WISDOM;
    return COMMUNITY_WISDOM.filter(e => e.type === wisdomFilter);
  }, [wisdomFilter]);

  const visibleWisdom = showAllWisdom ? filteredWisdom : filteredWisdom.slice(0, 3);
  const hiddenWisdomCount = filteredWisdom.length - 3;

  // Handlers
  const toggleJourney = (id: string) => {
    setExpandedJourneys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleWisdomCard = (id: string) => {
    setExpandedWisdom(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSpace = (id: string) => {
    setExpandedSpace(prev => prev === id ? null : id);
  };

  const navigateTo = (view: ExploreView) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const backToGrid = () => {
    setActiveView('grid');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getWisdomCardStyle = (entry: CommunityWisdomEntry) => {
    switch (entry.type) {
      case 'tip': return 'border-l-2 border-l-green-400/40';
      case 'ritual': return 'bg-purple-500/[0.02] dark:bg-purple-500/[0.04]';
      case 'photo': return 'border-l-2 border-l-orange-400/40';
      default: return '';
    }
  };

  // ─── Sub-Page Header with sticky back bar ────────────────────────────────
  const SubPageHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
    <>
      {/* Back breadcrumb bar */}
      <div className="mb-4 -mx-2 md:mx-0">
        <button
          onClick={backToGrid}
          className="flex items-center gap-2 w-full px-3 py-3 rounded-none md:rounded-lg bg-tea-text/[0.03]  hover:bg-tea-text/[0.06] transition-colors active:bg-tea-text/[0.08]"
        >
          <div className="w-8 h-8 rounded-full bg-tea-gold/10 flex items-center justify-center shrink-0">
            <Icons.Back className="w-4 h-4 text-tea-gold" />
          </div>
          <span className="text-sm font-medium text-tea-gold">Explore</span>
          <span className="text-tea-text/20">/</span>
          <span className="text-sm text-tea-text/50 truncate">{title}</span>
        </button>
      </div>
      <div className="mb-6">
        <h2 className="font-serif text-xl text-tea-text mb-1">{title}</h2>
        <p className="text-sm text-tea-text/50 font-serif italic">{subtitle}</p>
      </div>
    </>
  );

  return (
    <div className="max-w-4xl mx-auto px-2 md:px-0 animate-[fadeIn_0.3s_ease-out]">

      {/* ═══════════════════════════════════════════════════════════════════════
          GRID VIEW
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeView === 'grid' && (
        <div className="grid grid-cols-2 gap-4 animate-[fadeIn_0.3s_ease-out]">
          {GRID_TILES.map(tile => (
            <button
              key={tile.id}
              onClick={() => navigateTo(tile.id)}
              className="text-left"
            >
              <CardContainer variant="dark" className="hover:-translate-y-0.5 hover:shadow-lg transition-all h-full">
                <div className="p-5 flex flex-col items-center text-center gap-3">
                  <div className={`w-12 h-12 rounded-lg ${tile.accentBg} flex items-center justify-center`}>
                    <span className={tile.accentText}>{tile.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-serif text-base text-tea-text mb-0.5">
                      {tile.title}
                    </h3>
                    <p className="text-xs text-tea-text/50">
                      {tile.subtitle}
                    </p>
                  </div>
                </div>
              </CardContainer>
            </button>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TEA JOURNEYS
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeView === 'journeys' && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <SubPageHeader title="Tea Journeys" subtitle="Guided tasting experiences to deepen your practice" />

          <div className="flex flex-col gap-4">
            {CURATED_COLLECTIONS.map((collection, index) => {
              const isExpanded = expandedJourneys[collection.id] || false;

              return (
                <div key={collection.id}>
                  <CardContainer
                    variant="dark"
                    className={`cursor-pointer overflow-hidden transition-all duration-500 ease-out ${isExpanded ? 'shadow-lg' : 'shadow-sm hover:shadow-md'}`}
                    onClick={() => toggleJourney(collection.id)}
                  >
                    <div className="p-5 flex items-start gap-5">
                      <div className="font-serif text-5xl text-white/5 leading-none shrink-0 select-none">
                        0{index + 1}
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-serif text-xl text-tea-text leading-tight">
                            {collection.title}
                          </h3>
                          <div
                            className="text-tea-text/30 transition-transform duration-500 shrink-0 ml-2"
                            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                          >
                            <Icons.ChevronDown className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm ${DIFFICULTY_COLORS[collection.difficulty]}`}>
                            {collection.difficulty}
                          </span>
                          <span className="text-[11px] text-tea-text/40">
                            {collection.estimatedDuration}
                          </span>
                          <span className="text-[11px] text-tea-text/40">
                            {collection.guideSteps.length} steps
                          </span>
                        </div>
                        <p className="text-xs text-tea-text/50 leading-relaxed">
                          {collection.subtitle}
                        </p>
                      </div>
                    </div>
                  </CardContainer>

                  <div className={`transition-all duration-700 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[2000px] opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'}`}>
                    <div className="pl-6 md:pl-20 pr-2 md:pr-4">
                      <p className="font-serif italic text-sm text-tea-text/60 /70 leading-relaxed mb-5 max-w-lg">
                        {collection.description}
                      </p>
                      <div className="space-y-0">
                        {collection.guideSteps.map((step, stepIndex) => (
                          <div key={step.order} className="relative pl-8 pb-5 last:pb-0">
                            {stepIndex < collection.guideSteps.length - 1 && (
                              <div className="absolute left-[11px] top-6 bottom-0 w-px bg-tea-gold/20" />
                            )}
                            <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-tea-gold/10 flex items-center justify-center">
                              <span className="text-[10px] font-medium text-tea-gold">{step.order}</span>
                            </div>
                            <div>
                              <h4 className="font-serif text-base text-tea-text mb-1">
                                {step.teaName}
                              </h4>
                              <p className="text-sm text-tea-text/60 leading-relaxed">
                                {step.instruction}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {collection.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-tea-border">
                          {collection.tags.map(tag => (
                            <span key={tag} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-tea-text/5 text-tea-text/50">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          COMMUNITY WISDOM
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeView === 'wisdom' && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <SubPageHeader title="Community Wisdom" subtitle="Reflections, tips, and rituals from tea lovers" />

          {/* Filter pills */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-5">
            {(['all', 'reflection', 'tip', 'ritual'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => { setWisdomFilter(filter); setShowAllWisdom(false); }}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
                  wisdomFilter === filter
                    ? 'bg-tea-gold text-white'
                    : 'bg-tea-text/5 text-tea-text/60 hover:bg-tea-text/10'
                }`}
              >
                {filter === 'all' ? 'All' : WISDOM_TYPE_LABELS[filter]}
              </button>
            ))}
          </div>

          {/* Stacked cards */}
          <div className="flex flex-col gap-3">
            {visibleWisdom.map(entry => {
              const isExpanded = expandedWisdom[entry.id] || false;
              return (
                <button
                  key={entry.id}
                  onClick={() => toggleWisdomCard(entry.id)}
                  className={`text-left w-full transition-all duration-300 rounded-lg ${getWisdomCardStyle(entry)}`}
                >
                  <CardContainer variant="dark" className="transition-all h-full">
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm ${WISDOM_TYPE_COLORS[entry.type] || ''}`}>
                            {WISDOM_TYPE_LABELS[entry.type]}
                          </span>
                          {entry.teaReferenced && (
                            <span className="text-[10px] text-tea-text/40 italic">
                              {entry.teaReferenced}
                            </span>
                          )}
                        </div>
                        <div
                          className="text-tea-text/30 transition-transform duration-300 shrink-0"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                          <Icons.ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                      <h4 className={`font-serif text-lg text-tea-text mb-2 leading-snug ${entry.type === 'reflection' ? 'italic' : ''}`}>
                        {entry.title}
                      </h4>
                      <p className={`text-sm text-tea-text/70 leading-relaxed whitespace-pre-line transition-all duration-300 ${isExpanded ? '' : 'line-clamp-3'}`}>
                        {entry.body}
                      </p>
                      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[500px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}`}>
                        {entry.teaReferenced && (
                          <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg bg-tea-gold/5 mb-3">
                            <Icons.Leaf className="w-3.5 h-3.5 text-tea-gold" />
                            <span className="text-xs text-tea-text/70">
                              Tea: <span className="font-medium text-tea-text">{entry.teaReferenced}</span>
                            </span>
                          </div>
                        )}
                        {entry.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {entry.tags.map(tag => (
                              <span key={tag} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-tea-text/5 text-tea-text/50">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-tea-border">
                        <div className="w-5 h-5 rounded-full bg-tea-gold/20 flex items-center justify-center">
                          <Icons.User className="w-3 h-3 text-tea-gold" />
                        </div>
                        <span className="text-[11px] text-tea-text/50">
                          {entry.authorName}
                        </span>
                      </div>
                    </div>
                  </CardContainer>
                </button>
              );
            })}
          </div>

          {!showAllWisdom && hiddenWisdomCount > 0 && (
            <button
              onClick={() => setShowAllWisdom(true)}
              className="w-full mt-4 py-3 text-center text-sm text-tea-gold hover:text-tea-text transition-colors"
            >
              Show {hiddenWisdomCount} more
            </button>
          )}
          {showAllWisdom && filteredWisdom.length > 3 && (
            <button
              onClick={() => setShowAllWisdom(false)}
              className="w-full mt-4 py-3 text-center text-sm text-tea-text/40 hover:text-tea-text transition-colors"
            >
              Show less
            </button>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MEDIA & PLAYLISTS
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeView === 'media' && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <SubPageHeader title="Reading & Listening" subtitle="Books, podcasts, films, and playlists for going deeper" />
          <LearnReadingLists />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TEA GLOSSARY
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeView === 'glossary' && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <SubPageHeader title="Tea Glossary" subtitle="Essential terminology for understanding tea" />
          <TeaGlossary isFullView={true} />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          BREWING GUIDES
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeView === 'guides' && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <SubPageHeader title="Brewing Guides" subtitle="Quick reference PDFs and charts" />

          <div className="flex flex-col divide-y divide-tea-gold/[0.06]">
            {GUIDES.map(item => (
              <button
                key={item.id}
                className="flex items-center gap-4 py-3.5 px-1 group cursor-pointer hover:bg-tea-elevated/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-sm bg-tea-green/10 flex items-center justify-center shrink-0">
                  <Icons.Download className="w-4 h-4 text-tea-green" />
                </div>
                <span className="font-serif text-sm text-tea-text flex-1">{item.title}</span>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm hidden sm:inline ${getTypeColor(item.type)}`}>{item.type}</span>
                <Icons.Next className="w-4 h-4 text-tea-text/30 group-hover:text-tea-gold transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          REFERENCE TOOLS
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeView === 'reference' && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <SubPageHeader title="Reference Tools" subtitle="Worksheets, maps, and templates" />

          <div className="grid grid-cols-2 gap-4">
            {REFERENCE.map(item => (
              <div key={item.id} className="cursor-pointer">
                <CardContainer variant="dark" className="hover:-translate-y-0.5 transition-all h-full">
                  <div className="p-5 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-sm bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center mb-3">
                      <span className="text-orange-600 dark:text-orange-400">
                        {REFERENCE_ICONS[item.id] || <Icons.Grid className="w-6 h-6" />}
                      </span>
                    </div>
                    <h4 className="font-serif text-sm text-tea-text mb-1">{item.title}</h4>
                    <p className="text-[11px] text-tea-text/50 line-clamp-2">{item.description}</p>
                  </div>
                </CardContainer>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TEA SPACES
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeView === 'spaces' && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <SubPageHeader title="Tea Space Inspiration" subtitle="Ideas for creating your own ceremony environment" />

          <div className="grid grid-cols-2 gap-3 mb-4">
            {TEA_SPACES.map(space => (
              <div key={space.id}>
                <button
                  onClick={() => toggleSpace(space.id)}
                  className="text-left w-full"
                >
                  <CardContainer variant="dark" className={`transition-all h-full ${expandedSpace === space.id ? 'shadow-md' : 'hover:-translate-y-0.5'}`}>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-tea-gold/10 text-tea-gold border border-tea-border">
                          {SPACE_TYPE_LABELS[space.spaceType]}
                        </span>
                        <div
                          className="text-tea-text/30 transition-transform duration-300"
                          style={{ transform: expandedSpace === space.id ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                          <Icons.ChevronDown className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <h4 className="font-serif text-sm text-tea-text mb-1 leading-snug">
                        {space.title}
                      </h4>
                      <p className="text-[11px] text-tea-text/50 line-clamp-2">
                        {space.description}
                      </p>
                    </div>
                  </CardContainer>
                </button>

                <div className={`transition-all duration-500 ease-in-out overflow-hidden ${expandedSpace === space.id ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
                  <div className="px-3 pb-2">
                    <p className="text-xs text-tea-text/60 leading-relaxed mb-3">
                      {space.description}
                    </p>
                    <div className="space-y-2">
                      {space.tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-4 h-4 rounded-full bg-tea-gold/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Icons.Check className="w-2.5 h-2.5 text-tea-gold" />
                          </div>
                          <p className="text-xs text-tea-text/60 leading-relaxed">
                            {tip}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {onNavigateToConsult && (
            <button
              onClick={onNavigateToConsult}
              className="flex items-center justify-between w-full py-3 px-4 rounded-lg bg-tea-gold/5 hover:bg-tea-gold/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Icons.Sparkles className="w-4 h-4 text-tea-gold" />
                <div className="text-left">
                  <span className="text-sm font-medium text-tea-text">
                    Want a Custom Tea Space?
                  </span>
                  <p className="text-[11px] text-tea-text/50">
                    Explore our design consultation services
                  </p>
                </div>
              </div>
              <Icons.Next className="w-4 h-4 text-tea-gold group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      )}

    </div>
  );
};
