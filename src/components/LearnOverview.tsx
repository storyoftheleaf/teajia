import React, { useMemo, useState, useCallback } from 'react';
import { Story } from '../types';
import { Icons } from './Icons';
import { CardContainer } from './shared/CardContainer';
import { SearchInput } from './shared/SearchInput';
import { SwipeCarousel } from './shared/SwipeCarousel';
import { useSectionReveal } from '../hooks/useSectionReveal';
import { LEARN_CURRICULUM, LEARN_PATHS } from '../constants';
import { GLOSSARY_TERMS, GLOSSARY_CATEGORIES } from '../data/glossary';
import { teaMapPins } from '../data/teaMapPins';
import { COMMUNITY_WISDOM } from '../data/communityWisdom';
import { CURATED_COLLECTIONS, DIFFICULTY_COLORS } from '../data/curatedCollections';
import { TEA_SPACES, SPACE_TYPE_LABELS } from '../data/teaSpaces';

// Extended view type matching LearnHub's navigation
type LearnView = 'overview' | 'course' | 'glossary' | 'playlists' | 'videos' | 'visual-guides' | 'reading' | 'journeys' | 'wisdom' | 'spaces';

const CTA_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 focus-visible:ring-offset-2 rounded-sm';

// Atlas card type mapping from teaMapPin types
const PIN_TYPE_LABELS: Record<string, string> = {
  farm: 'Terroir',
  'tea-house': 'Culture',
  shop: 'Technique',
  space: 'Studio',
};

// Path icon mapping
const PATH_ICONS: Record<string, React.ReactNode> = {
  'Leaf': <Icons.Leaf className="w-6 h-6" />,
  'Teapot': <Icons.Teapot className="w-6 h-6" />,
  'Location': <Icons.Location className="w-6 h-6" />,
  'Box': <Icons.Box className="w-6 h-6" />,
};

// Wisdom type -> left border color
const WISDOM_BORDER_COLORS: Record<string, string> = {
  reflection: 'border-l-blue-400/40',
  tip: 'border-l-emerald-400/40',
  ritual: 'border-l-purple-400/40',
  photo: 'border-l-amber-400/40',
};

// Discovery category tiles
const DISCOVERY_TILES: { id: string; label: string; icon: React.ReactNode; count: number | null; view: LearnView }[] = [
  { id: 'course', label: 'Courses', icon: <Icons.BookOpen className="w-5 h-5" />, count: LEARN_CURRICULUM.length, view: 'course' },
  { id: 'glossary', label: 'Glossary', icon: <Icons.Book className="w-5 h-5" />, count: GLOSSARY_TERMS.length, view: 'glossary' },
  { id: 'journeys', label: 'Journeys', icon: <Icons.Location className="w-5 h-5" />, count: CURATED_COLLECTIONS.length, view: 'journeys' },
  { id: 'playlists', label: 'Playlists', icon: <Icons.Music className="w-5 h-5" />, count: null, view: 'playlists' },
  { id: 'videos', label: 'Videos', icon: <Icons.Film className="w-5 h-5" />, count: null, view: 'videos' },
  { id: 'visual-guides', label: 'Guides', icon: <Icons.Download className="w-5 h-5" />, count: null, view: 'visual-guides' },
  { id: 'reading', label: 'Reading', icon: <Icons.Book className="w-5 h-5" />, count: null, view: 'reading' },
  { id: 'wisdom', label: 'Wisdom', icon: <Icons.Users className="w-5 h-5" />, count: COMMUNITY_WISDOM.length, view: 'wisdom' },
  { id: 'spaces', label: 'Spaces', icon: <Icons.Home className="w-5 h-5" />, count: TEA_SPACES.length, view: 'spaces' },
];

// Resource grid tiles — prominent, always visible
const RESOURCE_TILES: { id: string; label: string; subtitle: string; icon: React.ReactNode; view: LearnView }[] = [
  { id: 'playlists', label: 'Playlists', subtitle: 'Music for tea', icon: <Icons.Music className="w-5 h-5" />, view: 'playlists' },
  { id: 'videos', label: 'Videos', subtitle: 'Watch & learn', icon: <Icons.Film className="w-5 h-5" />, view: 'videos' },
  { id: 'visual-guides', label: 'Guides', subtitle: 'Charts & refs', icon: <Icons.Download className="w-5 h-5" />, view: 'visual-guides' },
  { id: 'reading', label: 'Reading', subtitle: 'Books & articles', icon: <Icons.Book className="w-5 h-5" />, view: 'reading' },
  { id: 'spaces', label: 'Spaces', subtitle: 'Design inspo', icon: <Icons.Home className="w-5 h-5" />, view: 'spaces' },
  { id: 'glossary', label: 'Glossary', subtitle: `${GLOSSARY_TERMS.length}+ terms`, icon: <Icons.BookOpen className="w-5 h-5" />, view: 'glossary' },
];

interface LearnOverviewProps {
  onStoryClick: (story: Story) => void;
  watchedStories: Record<string, boolean>;
  onNavigateTo: (view: LearnView) => void;
  onNavigateToConsult?: () => void;
}

export const LearnOverview: React.FC<LearnOverviewProps> = ({
  onStoryClick,
  watchedStories,
  onNavigateTo,
  onNavigateToConsult,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Section reveals
  const heroReveal = useSectionReveal();
  const discoveryReveal = useSectionReveal();
  const glossaryReveal = useSectionReveal();
  const pathsReveal = useSectionReveal();
  const coursesReveal = useSectionReveal();
  const voicesReveal = useSectionReveal();
  const journeysReveal = useSectionReveal();
  const atlasReveal = useSectionReveal();
  const resourcesReveal = useSectionReveal();
  const spacesReveal = useSectionReveal();
  const closingReveal = useSectionReveal();

  // Module completion tracking
  const moduleCompletion = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const mod of LEARN_CURRICULUM) {
      map[mod.id] = mod.lessons.every(l => watchedStories[l.id]);
    }
    return map;
  }, [watchedStories]);

  // First incomplete lesson in a module
  const getModuleTarget = useCallback((mod: typeof LEARN_CURRICULUM[0]) => {
    return mod.lessons.find(l => !watchedStories[l.id]) || mod.lessons[0];
  }, [watchedStories]);

  // Geography lesson for atlas cards
  const geographyLesson = useMemo(() => {
    const m3 = LEARN_CURRICULUM.find(m => m.id === 'm3');
    return m3?.lessons.find(l => l.id === 'l3-1') || LEARN_CURRICULUM[0].lessons[0];
  }, []);

  // Daily rotating glossary spotlight term
  const spotlightTerm = useMemo(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const termsWithChinese = GLOSSARY_TERMS.filter(t => t.chineseCharacters);
    return termsWithChinese[dayOfYear % termsWithChinese.length];
  }, []);

  // Path progress calculation
  const getPathProgress = useCallback((path: { modules: string[] }) => {
    const pathModules = LEARN_CURRICULUM.filter(m => path.modules.includes(m.id));
    const completed = pathModules.filter(m => m.lessons.every(l => watchedStories[l.id])).length;
    return pathModules.length > 0 ? completed / pathModules.length : 0;
  }, [watchedStories]);

  // Stat ribbon counts
  const statLine = useMemo(() => {
    const parts = [
      `${GLOSSARY_TERMS.length} terms`,
      `${LEARN_CURRICULUM.length} courses`,
      `${CURATED_COLLECTIONS.length} journeys`,
      `${COMMUNITY_WISDOM.length} voices`,
      `${TEA_SPACES.length} spaces`,
    ];
    return parts.join(' · ');
  }, []);

  // Tea space teaser (first entry)
  const featuredSpace = TEA_SPACES[0];

  // Cross-section search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();

    const courses = LEARN_CURRICULUM.filter(
      m => m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
    ).slice(0, 3);

    const terms = GLOSSARY_TERMS.filter(
      t => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)
    ).slice(0, 5);

    const resources = RESOURCE_TILES.filter(
      r => r.label.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q)
    );

    if (courses.length === 0 && terms.length === 0 && resources.length === 0) return 'empty';
    return { courses, terms, resources };
  }, [searchQuery]);

  return (
    <div className="pb-32">
      {/* ═══════════════════════════════════════════════════════════
          Section 1: Hero Header with Editorial Voice
          ═══════════════════════════════════════════════════════════ */}
      <section
        ref={heroReveal.ref}
        className={`mb-8 ${heroReveal.className}`}
        style={heroReveal.style}
      >
        <h2 className="font-serif italic text-3xl md:text-4xl font-light text-tea-ink dark:text-tea-paper mb-3 leading-tight">
          The Archive
        </h2>

        {/* Adrian's editorial voice */}
        <div className="border-l-2 border-tea-seal/30 pl-3 mb-4">
          <p className="font-serif italic text-sm text-tea-ink/60 dark:text-tea-paper/60 leading-relaxed">
            Everything I wish someone had given me when I started. Take what you need.
          </p>
        </div>

        {/* Stat ribbon */}
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-tea-seal mb-5">
          {statLine}
        </p>

        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search the archive..."
          className="mb-2"
        />

        {/* Search results dropdown */}
        {searchResults && searchResults !== 'empty' && (
          <div className="mt-3 bg-tea-paper dark:bg-tea-ink border border-tea-ink/10 dark:border-white/10 rounded-[1px] p-4 space-y-4">
            {searchResults.courses.length > 0 && (
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.3em] text-tea-seal-dark dark:text-tea-seal font-sans mb-2">Courses</h4>
                {searchResults.courses.map(mod => (
                  <button
                    key={mod.id}
                    onClick={() => { onStoryClick(getModuleTarget(mod)); setSearchQuery(''); }}
                    className="block w-full text-left py-1.5 text-sm text-tea-ink dark:text-tea-paper hover:text-tea-seal transition-colors"
                  >
                    {mod.title}
                  </button>
                ))}
              </div>
            )}
            {searchResults.terms.length > 0 && (
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.3em] text-tea-seal-dark dark:text-tea-seal font-sans mb-2">Terms</h4>
                {searchResults.terms.map(term => (
                  <button
                    key={term.id}
                    onClick={() => { onNavigateTo('glossary'); setSearchQuery(''); }}
                    className="block w-full text-left py-1.5 text-sm text-tea-ink dark:text-tea-paper hover:text-tea-seal transition-colors"
                  >
                    <span className="font-serif">{term.term}</span>
                    <span className="text-tea-ink/40 dark:text-tea-paper/40 ml-2 text-xs">{term.definition.slice(0, 60)}...</span>
                  </button>
                ))}
              </div>
            )}
            {searchResults.resources.length > 0 && (
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.3em] text-tea-seal-dark dark:text-tea-seal font-sans mb-2">Resources</h4>
                {searchResults.resources.map(r => (
                  <button
                    key={r.id}
                    onClick={() => { onNavigateTo(r.view); setSearchQuery(''); }}
                    className="block w-full text-left py-1.5 text-sm text-tea-ink dark:text-tea-paper hover:text-tea-seal transition-colors"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {searchResults === 'empty' && (
          <p className="mt-3 text-sm text-tea-ink/40 dark:text-tea-paper/40 italic">
            No results for &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════
          Section 2: Discovery Map — Horizontal Category Carousel
          ═══════════════════════════════════════════════════════════ */}
      <section
        ref={discoveryReveal.ref}
        className={`mb-10 ${discoveryReveal.className}`}
        style={discoveryReveal.style}
      >
        <SwipeCarousel
          itemWidth={100}
          gap={10}
          showArrows={false}
          showDots={false}
          peek={2}
        >
          {DISCOVERY_TILES.map(tile => (
            <button
              key={tile.id}
              onClick={() => onNavigateTo(tile.view)}
              className={`text-center ${CTA_FOCUS}`}
            >
              <CardContainer variant="light" className="hover:-translate-y-0.5 transition-all">
                <div className="p-3 flex flex-col items-center gap-1.5 min-h-[80px] justify-center">
                  <span className="text-tea-seal">{tile.icon}</span>
                  <span className="font-serif text-xs text-tea-ink dark:text-tea-paper leading-tight">{tile.label}</span>
                  {tile.count !== null && (
                    <span className="font-mono text-[10px] text-tea-ink/40 dark:text-tea-paper/40">{tile.count}</span>
                  )}
                </div>
              </CardContainer>
            </button>
          ))}
        </SwipeCarousel>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          Section 3: Glossary Spotlight — "Term of the Day"
          ═══════════════════════════════════════════════════════════ */}
      {spotlightTerm && (
        <section
          ref={glossaryReveal.ref}
          className={`mb-10 ${glossaryReveal.className}`}
          style={glossaryReveal.style}
        >
          <button
            onClick={() => onNavigateTo('glossary')}
            className={`w-full text-left ${CTA_FOCUS}`}
          >
            <CardContainer variant="dark">
              <div className="relative p-6 md:p-8 min-h-[280px] flex flex-col justify-between overflow-hidden">
                {/* Chinese characters decorative */}
                {spotlightTerm.chineseCharacters && (
                  <span className="absolute top-4 right-4 text-4xl md:text-5xl text-tea-seal/15 font-serif select-none pointer-events-none">
                    {spotlightTerm.chineseCharacters}
                  </span>
                )}

                <div>
                  {/* Category badge */}
                  <span className="inline-block text-[10px] uppercase tracking-wider text-tea-seal border border-white/15 px-2 py-0.5 rounded-sm mb-4">
                    {GLOSSARY_CATEGORIES[spotlightTerm.category].label}
                  </span>

                  {/* Term name */}
                  <h3 className="font-serif text-2xl text-tea-paper mb-1">{spotlightTerm.term}</h3>

                  {/* Pronunciation */}
                  {spotlightTerm.pronunciation && (
                    <p className="font-mono italic text-xs text-tea-paper/50 mb-4">{spotlightTerm.pronunciation}</p>
                  )}

                  {/* Definition */}
                  <p className="text-sm text-tea-paper/60 leading-relaxed line-clamp-3 max-w-md">
                    {spotlightTerm.definition}
                  </p>

                  {/* Try This callout */}
                  {spotlightTerm.deepDive?.tryThis && spotlightTerm.deepDive.tryThis.length > 0 && (
                    <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-sm">
                      <Icons.Lightbulb className="w-3 h-3 text-emerald-400/70" />
                      <span className="text-[11px] text-emerald-300/80">{spotlightTerm.deepDive.tryThis[0].title}</span>
                    </div>
                  )}
                </div>

                {/* Divider + CTAs */}
                <div className="border-t border-tea-seal/20 pt-4 mt-5 flex items-center justify-between">
                  <span className="text-xs text-tea-paper/50 flex items-center gap-1">
                    Explore term <Icons.ChevronRight className="w-3 h-3" />
                  </span>
                  <span className="text-[10px] font-mono text-tea-paper/30">
                    {GLOSSARY_TERMS.length} terms in glossary
                  </span>
                </div>
              </div>
            </CardContainer>
          </button>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          Section 4: Learning Paths — Horizontal Swipe Carousel
          ═══════════════════════════════════════════════════════════ */}
      <section
        ref={pathsReveal.ref}
        className={`mb-10 ${pathsReveal.className}`}
        style={pathsReveal.style}
      >
        <h3 className="font-serif text-lg md:text-xl font-normal text-tea-ink dark:text-tea-paper mb-4">
          Learning Paths
        </h3>
        <SwipeCarousel
          itemWidth={280}
          gap={14}
          showArrows={false}
          showDots={false}
          peek={3}
        >
          {LEARN_PATHS.map(path => {
            const progress = getPathProgress(path);
            return (
              <button
                key={path.id}
                onClick={() => onNavigateTo('course')}
                className={`text-left w-full ${CTA_FOCUS}`}
              >
                <CardContainer variant="light" className="hover:-translate-y-0.5 transition-all">
                  <div className="p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-tea-seal/70">
                        {PATH_ICONS[path.icon] || <Icons.Leaf className="w-6 h-6" />}
                      </span>
                      <div>
                        <h4 className="font-serif text-base text-tea-ink dark:text-tea-paper leading-tight">{path.title}</h4>
                        <p className="font-serif italic text-xs text-tea-ink/50 dark:text-tea-paper/50 mt-0.5">{path.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-tea-ink/40 dark:text-tea-paper/40">
                        {path.modules.length} modules
                      </span>
                      <span className="font-mono text-[10px] text-tea-seal">
                        {Math.round(progress * 100)}%
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 bg-tea-ink/5 dark:bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-tea-seal rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(progress * 100, 2)}%` }}
                      />
                    </div>
                  </div>
                </CardContainer>
              </button>
            );
          })}
        </SwipeCarousel>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          Section 5: Course Index — Compact Numbered List
          ═══════════════════════════════════════════════════════════ */}
      <section
        ref={coursesReveal.ref}
        className={`mb-10 ${coursesReveal.className}`}
        style={coursesReveal.style}
      >
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="font-serif text-lg md:text-xl font-normal text-tea-ink dark:text-tea-paper">
            Curriculum
          </h3>
          <button
            onClick={() => onNavigateTo('course')}
            className={`text-tea-seal-dark dark:text-tea-seal hover:opacity-80 text-xs tracking-widest font-medium flex items-center gap-1 transition-colors duration-300 ${CTA_FOCUS}`}
          >
            View all <Icons.ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-tea-ink/[0.03] dark:bg-white/[0.03] border border-tea-ink/10 dark:border-white/10 rounded-[1px]">
          <div className="divide-y divide-tea-ink/8 dark:divide-white/8">
            {LEARN_CURRICULUM.map((mod, index) => {
              const isComplete = moduleCompletion[mod.id];
              const firstLesson = mod.lessons[0];
              return (
                <button
                  key={mod.id}
                  onClick={() => onStoryClick(getModuleTarget(mod))}
                  className={`w-full flex items-center justify-between py-4 md:py-5 px-4 md:px-6 group text-left hover:bg-tea-ink/[0.03] dark:hover:bg-white/[0.03] transition-colors ${CTA_FOCUS}`}
                >
                  <div className="flex items-center gap-4 pr-4">
                    <span className="text-xs font-mono text-tea-ink/20 dark:text-tea-paper/20 w-6 flex-shrink-0 tabular-nums">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <span className="font-serif text-sm md:text-base text-tea-ink dark:text-tea-paper group-hover:text-tea-seal transition-colors block leading-snug">
                        {mod.title}
                      </span>
                      {/* First lesson preview */}
                      {firstLesson && (
                        <span className="text-[11px] italic text-tea-ink/35 dark:text-tea-paper/35 mt-0.5 block">
                          {firstLesson.title}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 md:gap-5 flex-shrink-0">
                    <span className="text-[10px] font-mono text-tea-ink/30 dark:text-tea-paper/30 whitespace-nowrap hidden sm:inline tabular-nums">
                      {mod.lessons.length} {mod.lessons.length === 1 ? 'lesson' : 'lessons'}
                    </span>
                    <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full border flex items-center justify-center transition-colors ${
                      isComplete
                        ? 'border-tea-seal/40 bg-tea-seal/8'
                        : 'border-tea-ink/10 dark:border-white/10 group-hover:border-tea-seal/25 group-hover:bg-tea-seal/5'
                    }`}>
                      {isComplete ? (
                        <Icons.Check className="w-3.5 h-3.5 text-tea-seal" />
                      ) : (
                        <Icons.Play className="w-3 h-3 text-tea-seal/60 ml-0.5" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          Section 6: Community Voices — Pull-Quote Carousel
          ═══════════════════════════════════════════════════════════ */}
      <section
        ref={voicesReveal.ref}
        className={`mb-10 ${voicesReveal.className}`}
        style={voicesReveal.style}
      >
        <div className="mb-4">
          <h3 className="font-serif text-lg md:text-xl font-normal text-tea-ink dark:text-tea-paper">
            Community Voices
          </h3>
          <p className="font-serif italic text-xs text-tea-ink/50 dark:text-tea-paper/50 mt-0.5">
            Reflections from tea practitioners
          </p>
        </div>
        <SwipeCarousel
          itemWidth={300}
          gap={14}
          showArrows={false}
          showDots={true}
          peek={3}
        >
          {COMMUNITY_WISDOM.slice(0, 6).map(entry => (
            <button
              key={entry.id}
              onClick={() => onNavigateTo('wisdom')}
              className={`text-left w-full ${CTA_FOCUS}`}
            >
              <CardContainer variant="light" className={`border-l-[3px] ${WISDOM_BORDER_COLORS[entry.type] || 'border-l-tea-seal/30'}`}>
                <div className="relative p-5 min-h-[180px] flex flex-col justify-between">
                  {/* Decorative quote mark */}
                  <span className="absolute top-2 right-4 text-5xl text-tea-seal/10 font-serif select-none pointer-events-none leading-none">
                    &ldquo;
                  </span>
                  <div>
                    <p className="font-serif italic text-sm text-tea-ink/80 dark:text-tea-paper/80 leading-relaxed line-clamp-4 pr-6">
                      {entry.body.slice(0, 140)}{entry.body.length > 140 ? '...' : ''}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs font-sans tracking-wide text-tea-ink/60 dark:text-tea-paper/60">
                      {entry.authorName}
                    </span>
                    {entry.teaReferenced && (
                      <span className="font-mono text-[10px] text-tea-seal/60">
                        {entry.teaReferenced}
                      </span>
                    )}
                  </div>
                </div>
              </CardContainer>
            </button>
          ))}
        </SwipeCarousel>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          Section 7: Guided Journeys — Vertical Card Stack
          ═══════════════════════════════════════════════════════════ */}
      <section
        ref={journeysReveal.ref}
        className={`mb-10 ${journeysReveal.className}`}
        style={journeysReveal.style}
      >
        <div className="mb-4">
          <h3 className="font-serif text-lg md:text-xl font-normal text-tea-ink dark:text-tea-paper">
            Guided Journeys
          </h3>
          <p className="font-serif italic text-xs text-tea-ink/50 dark:text-tea-paper/50 mt-0.5">
            Step-by-step tasting experiences
          </p>
        </div>
        <div className="space-y-3">
          {CURATED_COLLECTIONS.map((journey, index) => (
            <button
              key={journey.id}
              onClick={() => onNavigateTo('journeys')}
              className={`w-full text-left ${CTA_FOCUS}`}
            >
              <CardContainer variant="dark" className="hover:-translate-y-0.5 transition-all">
                <div className="relative p-5 md:p-6 min-h-[120px] flex flex-col justify-between overflow-hidden">
                  {/* Radial gradient texture */}
                  <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                      backgroundImage: `radial-gradient(circle at 30% 40%, rgba(201,148,58,0.4) 0%, transparent 50%),
                        radial-gradient(circle at 70% 60%, rgba(201,148,58,0.2) 0%, transparent 40%)`,
                    }}
                  />
                  {/* Journey number watermark */}
                  <span className="absolute top-3 left-4 text-5xl text-white/5 font-serif select-none pointer-events-none">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-serif text-lg text-tea-paper">{journey.title}</h4>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-sm ${DIFFICULTY_COLORS[journey.difficulty]}`}>
                        {journey.difficulty}
                      </span>
                      <span className="font-mono text-[11px] text-tea-paper/40">{journey.estimatedDuration}</span>
                    </div>
                    {journey.guideSteps[0] && (
                      <p className="font-mono text-[11px] text-tea-paper/50">
                        Start with: {journey.guideSteps[0].teaName}
                      </p>
                    )}
                  </div>
                  <div className="relative mt-3 flex items-center justify-between">
                    <span className="text-[10px] text-tea-paper/30">{journey.guideSteps.length} steps</span>
                  </div>
                </div>
              </CardContainer>
            </button>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          Section 8: Atlas & Places — Horizontal Carousel
          ═══════════════════════════════════════════════════════════ */}
      <section
        ref={atlasReveal.ref}
        className={`mb-10 ${atlasReveal.className}`}
        style={atlasReveal.style}
      >
        <div className="mb-4">
          <h3 className="font-serif text-lg md:text-xl font-normal text-tea-ink dark:text-tea-paper">
            Places
          </h3>
          <p className="font-serif italic text-xs text-tea-ink/50 dark:text-tea-paper/50 mt-0.5">
            Tea locations around the world
          </p>
        </div>
        <SwipeCarousel
          itemWidth={200}
          gap={12}
          showArrows={false}
          showDots={false}
          peek={3}
        >
          {teaMapPins.map(pin => (
            <button
              key={pin.id}
              onClick={() => onStoryClick(geographyLesson)}
              className={`text-left w-full ${CTA_FOCUS}`}
            >
              <CardContainer variant="dark" className="hover:-translate-y-0.5 transition-all">
                <div className="relative p-4 min-h-[110px] flex flex-col justify-between overflow-hidden">
                  {/* Topographic texture */}
                  <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                      backgroundImage: `radial-gradient(circle at 30% 40%, rgba(201,148,58,0.4) 0%, transparent 50%),
                        radial-gradient(circle at 70% 60%, rgba(201,148,58,0.2) 0%, transparent 40%)`,
                    }}
                  />
                  <span className="relative inline-block self-start text-[10px] tracking-wider text-tea-seal font-sans border border-white/15 px-2 py-0.5 rounded-sm mb-3">
                    {PIN_TYPE_LABELS[pin.type] || pin.type}
                  </span>
                  <div className="relative">
                    <h4 className="font-serif text-sm text-tea-paper leading-tight mb-0.5">{pin.name}</h4>
                    <p className="text-[11px] text-tea-paper/40 font-sans">{pin.location}</p>
                  </div>
                </div>
              </CardContainer>
            </button>
          ))}
        </SwipeCarousel>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          Section 9: Resource Library — Prominent Icon Grid
          Always visible, easy to find, not hidden
          ═══════════════════════════════════════════════════════════ */}
      <section
        ref={resourcesReveal.ref}
        className={`mb-10 ${resourcesReveal.className}`}
        style={resourcesReveal.style}
      >
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h3 className="font-serif text-lg md:text-xl font-normal text-tea-ink dark:text-tea-paper">
              Resources & Tools
            </h3>
            <p className="font-serif italic text-xs text-tea-ink/50 dark:text-tea-paper/50 mt-0.5">
              Deepen your practice
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-3 gap-3">
          {RESOURCE_TILES.map(tile => (
            <button
              key={tile.id}
              onClick={() => onNavigateTo(tile.view)}
              className={`text-left group ${CTA_FOCUS}`}
            >
              <div className="h-full bg-tea-ink dark:bg-white/[0.04] rounded-[1px] border border-tea-ink/80 dark:border-white/8 p-3 md:p-4 hover:border-tea-seal/30 hover:-translate-y-0.5 transition-all duration-300">
                <span className="text-tea-paper/40 dark:text-tea-paper/40 mb-2 block">
                  {tile.icon}
                </span>
                <h4 className="font-serif text-sm text-tea-paper leading-snug mb-0.5 group-hover:text-tea-seal transition-colors">
                  {tile.label}
                </h4>
                <p className="text-[10px] text-tea-paper/40 font-sans">
                  {tile.subtitle}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          Section 10: Tea Space Teaser
          ═══════════════════════════════════════════════════════════ */}
      <section
        ref={spacesReveal.ref}
        className={`mb-10 ${spacesReveal.className}`}
        style={spacesReveal.style}
      >
        <button
          onClick={() => onNavigateTo('spaces')}
          className={`w-full text-left ${CTA_FOCUS}`}
        >
          <CardContainer variant="light" className="bg-tea-beige/10 dark:bg-tea-beige/5">
            <div className="p-5 md:p-6">
              <span className="inline-block text-[10px] uppercase tracking-wider text-tea-ink/40 dark:text-tea-paper/40 font-sans mb-2">
                {SPACE_TYPE_LABELS[featuredSpace.spaceType]}
              </span>
              <h4 className="font-serif text-base text-tea-ink dark:text-tea-paper mb-1.5">
                {featuredSpace.title}
              </h4>
              <p className="font-serif italic text-sm text-tea-ink/60 dark:text-tea-paper/60 leading-relaxed line-clamp-2 mb-3">
                {featuredSpace.description}
              </p>
              <span className="text-tea-seal-dark dark:text-tea-seal text-xs font-sans flex items-center gap-1">
                See all {TEA_SPACES.length} spaces <Icons.ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </CardContainer>
        </button>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          Section 11: Closing Editorial Note
          ═══════════════════════════════════════════════════════════ */}
      <section
        ref={closingReveal.ref}
        className={`${closingReveal.className}`}
        style={closingReveal.style}
      >
        <div className="border-t border-tea-ink/10 dark:border-white/10 pt-6">
          <p className="font-serif italic text-sm text-tea-ink/40 dark:text-tea-paper/40 leading-relaxed max-w-md">
            This archive grows with every session. If you have a term, a ritual, or a place that should be here
            {onNavigateToConsult ? (
              <>
                {' — '}
                <button
                  onClick={onNavigateToConsult}
                  className="text-tea-seal/60 hover:text-tea-seal underline underline-offset-2 transition-colors"
                >
                  reach out
                </button>
                .
              </>
            ) : (
              ' — reach out.'
            )}
          </p>
        </div>
      </section>
    </div>
  );
};
