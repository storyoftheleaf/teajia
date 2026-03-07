import React, { useMemo, useState, useCallback } from 'react';
import { Story } from '../types';
import { Icons } from './Icons';
import { CardContainer } from './shared/CardContainer';
import { SearchInput } from './shared/SearchInput';
import { SwipeCarousel } from './shared/SwipeCarousel';
import { useSectionReveal } from '../hooks/useSectionReveal';
import { LEARN_CURRICULUM, LEARN_PATHS } from '../constants';
import { GLOSSARY_TERMS, GLOSSARY_CATEGORIES } from '../data/glossary';
import { COMMUNITY_WISDOM } from '../data/communityWisdom';
import { CURATED_COLLECTIONS, DIFFICULTY_COLORS } from '../data/curatedCollections';
import { TEA_SPACES, SPACE_TYPE_LABELS } from '../data/teaSpaces';
import { teaMapPins } from '../data/teaMapPins';

type LearnView = 'overview' | 'course' | 'glossary' | 'playlists' | 'videos' | 'visual-guides' | 'reading' | 'journeys' | 'wisdom' | 'spaces';

const CTA_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 focus-visible:ring-offset-2 rounded-sm';

// Atlas card type mapping
const PIN_TYPE_LABELS: Record<string, string> = {
  farm: 'Terroir',
  'tea-house': 'Culture',
  shop: 'Technique',
  space: 'Studio',
};

// Discovery map tiles
const DISCOVERY_TILES: { id: string; label: string; icon: React.ReactNode; countSource?: string; view: LearnView }[] = [
  { id: 'course', label: 'Courses', icon: <Icons.BookOpen className="w-5 h-5" />, countSource: 'courses', view: 'course' },
  { id: 'glossary', label: 'Glossary', icon: <Icons.Book className="w-5 h-5" />, countSource: 'glossary', view: 'glossary' },
  { id: 'journeys', label: 'Journeys', icon: <Icons.MapPin className="w-5 h-5" />, countSource: 'journeys', view: 'journeys' },
  { id: 'playlists', label: 'Playlists', icon: <Icons.Music className="w-5 h-5" />, view: 'playlists' },
  { id: 'videos', label: 'Videos', icon: <Icons.Film className="w-5 h-5" />, view: 'videos' },
  { id: 'visual-guides', label: 'Guides', icon: <Icons.Download className="w-5 h-5" />, view: 'visual-guides' },
  { id: 'reading', label: 'Reading', icon: <Icons.Book className="w-5 h-5" />, view: 'reading' },
  { id: 'wisdom', label: 'Wisdom', icon: <Icons.Users className="w-5 h-5" />, countSource: 'wisdom', view: 'wisdom' },
  { id: 'spaces', label: 'Spaces', icon: <Icons.Home className="w-5 h-5" />, countSource: 'spaces', view: 'spaces' },
];

// Resource grid tiles
const RESOURCE_TILES = [
  { id: 'playlists', label: 'Playlists', subtitle: 'Music for tea', icon: <Icons.Music className="w-5 h-5" />, view: 'playlists' as LearnView },
  { id: 'videos', label: 'Videos', subtitle: 'Watch & learn', icon: <Icons.Film className="w-5 h-5" />, view: 'videos' as LearnView },
  { id: 'visual-guides', label: 'Guides', subtitle: 'Charts & refs', icon: <Icons.Download className="w-5 h-5" />, view: 'visual-guides' as LearnView },
  { id: 'reading', label: 'Reading', subtitle: 'Books & articles', icon: <Icons.Book className="w-5 h-5" />, view: 'reading' as LearnView },
  { id: 'spaces', label: 'Spaces', subtitle: 'Design inspo', icon: <Icons.Home className="w-5 h-5" />, view: 'spaces' as LearnView },
  { id: 'glossary', label: 'Glossary', subtitle: `${GLOSSARY_TERMS.length}+ terms`, icon: <Icons.BookOpen className="w-5 h-5" />, view: 'glossary' as LearnView },
];

// Wisdom type to border color
const WISDOM_BORDER_COLORS: Record<string, string> = {
  reflection: 'border-l-blue-400/40',
  tip: 'border-l-emerald-400/40',
  ritual: 'border-l-purple-400/40',
  photo: 'border-l-amber-400/40',
};

// Path icon mapping
const PATH_ICON_MAP: Record<string, React.ReactNode> = {
  Leaf: <Icons.Leaf className="w-6 h-6" />,
  Teapot: <Icons.Coffee className="w-6 h-6" />,
  Location: <Icons.MapPin className="w-6 h-6" />,
  Box: <Icons.Box className="w-6 h-6" />,
};

/** Image placeholder — warm, branded feel */
const ImagePlaceholder: React.FC<{ label?: string; aspectRatio?: string; className?: string }> = ({
  label = 'Image',
  aspectRatio = '4/3',
  className = '',
}) => (
  <div
    className={`relative bg-gradient-to-br from-tea-beige/30 via-tea-paper to-tea-beige/20 dark:from-tea-ink dark:via-tea-ink/90 dark:to-tea-ink/80 border border-tea-ink/8 dark:border-white/8 rounded-[1px] overflow-hidden flex items-center justify-center ${className}`}
    style={{ aspectRatio }}
  >
    <div className="absolute inset-0 opacity-[0.06]" style={{
      backgroundImage: `radial-gradient(circle at 30% 40%, rgba(201,148,58,0.5) 0%, transparent 50%),
        radial-gradient(circle at 70% 60%, rgba(201,148,58,0.3) 0%, transparent 40%)`
    }} />
    <div className="text-center z-10">
      <Icons.Image className="w-6 h-6 text-tea-seal/25 mx-auto mb-1" />
      <span className="text-[9px] font-mono tracking-[0.2em] text-tea-ink/25 dark:text-tea-paper/25 uppercase">{label}</span>
    </div>
  </div>
);


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

  // Find first incomplete lesson in a module
  const getModuleTarget = useCallback((mod: typeof LEARN_CURRICULUM[0]) => {
    return mod.lessons.find(l => !watchedStories[l.id]) || mod.lessons[0];
  }, [watchedStories]);

  // Geography lesson for atlas navigation
  const geographyLesson = useMemo(() => {
    const m3 = LEARN_CURRICULUM.find(m => m.id === 'm3');
    return m3?.lessons.find(l => l.id === 'l3-1') || LEARN_CURRICULUM[0].lessons[0];
  }, []);

  // Glossary spotlight — "Term of the Day" with daily rotation
  const spotlightTerm = useMemo(() => {
    const termsWithChinese = GLOSSARY_TERMS.filter(t => t.chineseCharacters);
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return termsWithChinese[dayOfYear % termsWithChinese.length];
  }, []);

  // Dynamic counts for stat ribbon and discovery tiles
  const counts = useMemo(() => ({
    courses: LEARN_CURRICULUM.length,
    glossary: GLOSSARY_TERMS.length,
    journeys: CURATED_COLLECTIONS.length,
    wisdom: COMMUNITY_WISDOM.length,
    spaces: TEA_SPACES.length,
  }), []);

  // Path progress calculation
  const getPathProgress = useCallback((path: typeof LEARN_PATHS[0]) => {
    const pathModules = LEARN_CURRICULUM.filter(m => path.modules.includes(m.id));
    const completed = pathModules.filter(m => m.lessons.every(l => watchedStories[l.id])).length;
    return pathModules.length > 0 ? completed / pathModules.length : 0;
  }, [watchedStories]);

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

  // Featured tea space
  const featuredSpace = TEA_SPACES[0];

  return (
    <div className="pb-32">

      {/* ═══════════════════════════════════════════════════════════════════
          Section 1: Hero Header with Editorial Voice
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={heroReveal.ref}
        className={`mb-10 md:mb-14 ${heroReveal.className}`}
        style={heroReveal.style}
      >
        <h2 className="font-serif italic text-3xl md:text-4xl font-light text-tea-ink dark:text-tea-paper mb-4 leading-tight">
          The Archive
        </h2>

        {/* Adrian's editorial voice */}
        <div className="border-l-2 border-tea-seal/30 pl-3 mb-5">
          <p className="font-serif italic text-sm text-tea-ink/60 dark:text-tea-paper/60 leading-relaxed">
            "Everything I wish someone had given me when I started. Take what you need."
          </p>
        </div>

        {/* Stat ribbon */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-6">
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-tea-seal">{counts.glossary} terms</span>
          <span className="text-tea-seal/30">&middot;</span>
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-tea-seal">{counts.courses} courses</span>
          <span className="text-tea-seal/30">&middot;</span>
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-tea-seal">{counts.journeys} journeys</span>
          <span className="text-tea-seal/30">&middot;</span>
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-tea-seal">{counts.wisdom} voices</span>
          <span className="text-tea-seal/30">&middot;</span>
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-tea-seal">{counts.spaces} spaces</span>
        </div>

        {/* Hero image placeholder */}
        <ImagePlaceholder label="Archive hero — tea table scene" aspectRatio="21/9" className="mb-6" />

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


      {/* ═══════════════════════════════════════════════════════════════════
          Section 2: Discovery Map — Horizontal Category Carousel
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={discoveryReveal.ref}
        className={`mb-12 md:mb-16 ${discoveryReveal.className}`}
        style={discoveryReveal.style}
      >
        <SwipeCarousel
          itemWidth={100}
          gap={12}
          showArrows={false}
          peek={2}
        >
          {DISCOVERY_TILES.map(tile => {
            const count = tile.countSource ? counts[tile.countSource as keyof typeof counts] : null;
            return (
              <button
                key={tile.id}
                onClick={() => onNavigateTo(tile.view)}
                className={`text-left group ${CTA_FOCUS}`}
              >
                <CardContainer variant="light" className="h-full">
                  <div className="p-3 flex flex-col items-center text-center min-h-[90px] justify-center gap-1.5">
                    <span className="text-tea-seal">{tile.icon}</span>
                    <span className="font-serif text-xs text-tea-ink dark:text-tea-paper group-hover:text-tea-seal transition-colors leading-tight">
                      {tile.label}
                    </span>
                    {count !== null && (
                      <span className="font-mono text-[10px] text-tea-ink/40 dark:text-tea-paper/40">
                        {count}
                      </span>
                    )}
                  </div>
                </CardContainer>
              </button>
            );
          })}
        </SwipeCarousel>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          Section 3: Glossary Spotlight — "Term of the Day"
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={glossaryReveal.ref}
        className={`mb-12 md:mb-16 ${glossaryReveal.className}`}
        style={glossaryReveal.style}
      >
        <CardContainer variant="dark">
          <div className="relative p-6 md:p-8">
            {/* Decorative Chinese characters */}
            {spotlightTerm.chineseCharacters && (
              <span className="absolute top-4 right-6 text-4xl md:text-5xl text-tea-seal/10 font-serif select-none pointer-events-none" aria-hidden="true">
                {spotlightTerm.chineseCharacters}
              </span>
            )}

            <div className="flex items-start gap-4 mb-4">
              {/* Image placeholder for term */}
              <div className="hidden md:block w-28 flex-shrink-0">
                <ImagePlaceholder label={spotlightTerm.term} aspectRatio="1/1" className="rounded-[1px]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] uppercase tracking-wider text-tea-seal font-sans border border-white/15 px-2 py-0.5 rounded-sm">
                    {GLOSSARY_CATEGORIES[spotlightTerm.category].label}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-tea-paper/30 font-sans">
                    Term of the day
                  </span>
                </div>

                <h3 className="font-serif text-2xl text-tea-paper leading-tight mb-1">
                  {spotlightTerm.term}
                </h3>

                {spotlightTerm.pronunciation && (
                  <p className="font-mono italic text-xs text-tea-paper/50 mb-3">
                    {spotlightTerm.pronunciation}
                  </p>
                )}

                <p className="text-sm text-tea-paper/60 leading-relaxed mb-4">
                  {spotlightTerm.definition.length > 180
                    ? spotlightTerm.definition.slice(0, 180) + '...'
                    : spotlightTerm.definition}
                </p>
              </div>
            </div>

            {/* "Try This" callout */}
            {spotlightTerm.deepDive?.tryThis?.[0] && (
              <div className="bg-tea-green/5 border border-tea-green/15 rounded-[1px] px-4 py-3 mb-4">
                <span className="text-[10px] uppercase tracking-wider text-tea-green/80 font-sans block mb-1">
                  Try this
                </span>
                <p className="text-xs text-tea-paper/70 leading-relaxed">
                  {spotlightTerm.deepDive.tryThis[0].title}
                </p>
              </div>
            )}

            {/* CTAs */}
            <div className="border-t border-white/8 pt-4 flex items-center gap-6">
              <button
                onClick={() => onNavigateTo('glossary')}
                className={`text-tea-seal text-sm font-sans flex items-center gap-1 hover:text-tea-seal/80 transition-colors ${CTA_FOCUS}`}
              >
                Explore term <Icons.ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigateTo('glossary')}
                className={`text-tea-paper/40 text-xs font-sans hover:text-tea-paper/60 transition-colors ${CTA_FOCUS}`}
              >
                See all {counts.glossary} terms
              </button>
            </div>
          </div>
        </CardContainer>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          Section 4: Learning Paths — Horizontal Swipe Carousel
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={pathsReveal.ref}
        className={`mb-12 md:mb-16 ${pathsReveal.className}`}
        style={pathsReveal.style}
      >
        <h3 className="font-serif text-lg md:text-xl font-normal text-tea-ink dark:text-tea-paper mb-5">
          Learning Paths
        </h3>

        <SwipeCarousel
          itemWidth={280}
          gap={16}
          showArrows={true}
          showDots={true}
          peek={3}
        >
          {LEARN_PATHS.map(path => {
            const progress = getPathProgress(path);
            const pathIcon = PATH_ICON_MAP[path.icon] || <Icons.BookOpen className="w-6 h-6" />;
            return (
              <button
                key={path.id}
                onClick={() => onNavigateTo('course')}
                className={`text-left w-full group ${CTA_FOCUS}`}
              >
                <CardContainer variant="light" className="h-full">
                  <div className="p-5">
                    {/* Path image placeholder */}
                    <ImagePlaceholder label={path.title} aspectRatio="16/9" className="mb-4" />

                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-tea-seal/60">{pathIcon}</span>
                      <h4 className="font-serif text-base text-tea-ink dark:text-tea-paper group-hover:text-tea-seal transition-colors leading-tight">
                        {path.title}
                      </h4>
                    </div>
                    <p className="font-serif italic text-xs text-tea-ink/50 dark:text-tea-paper/50 mb-3 leading-relaxed">
                      {path.description}
                    </p>
                    <span className="font-mono text-[10px] text-tea-ink/40 dark:text-tea-paper/40 block mb-3">
                      {path.modules.length} modules
                    </span>
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


      {/* ═══════════════════════════════════════════════════════════════════
          Section 5: Course Index — Compact Numbered List
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={coursesReveal.ref}
        className={`mb-12 md:mb-20 lg:mb-24 ${coursesReveal.className}`}
        style={coursesReveal.style}
      >
        <div className="flex items-baseline justify-between mb-5">
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
                  <div className="flex items-start gap-4 pr-4">
                    <span className="text-xs font-mono text-tea-ink/20 dark:text-tea-paper/20 w-6 flex-shrink-0 tabular-nums pt-0.5">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <span className="font-serif text-sm md:text-base text-tea-ink dark:text-tea-paper group-hover:text-tea-seal transition-colors block leading-snug">
                        {mod.title}
                      </span>
                      <span className="text-[11px] text-tea-ink/35 dark:text-tea-paper/35 font-sans mt-0.5 block">
                        {mod.description.slice(0, 60)}...
                      </span>
                      {firstLesson && (
                        <span className="text-[11px] italic text-tea-ink/25 dark:text-tea-paper/25 font-serif mt-1 block">
                          Start with: {firstLesson.title}
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


      {/* ═══════════════════════════════════════════════════════════════════
          Section 6: Community Voices — Pull-Quote Carousel
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={voicesReveal.ref}
        className={`mb-12 md:mb-16 ${voicesReveal.className}`}
        style={voicesReveal.style}
      >
        <h3 className="font-serif text-lg md:text-xl font-normal text-tea-ink dark:text-tea-paper mb-1">
          Community Voices
        </h3>
        <p className="font-serif italic text-xs text-tea-ink/50 dark:text-tea-paper/50 mb-5">
          Reflections from tea practitioners
        </p>

        <SwipeCarousel
          itemWidth={300}
          gap={16}
          showArrows={true}
          showDots={true}
          peek={3}
        >
          {COMMUNITY_WISDOM.slice(0, 6).map(entry => (
            <button
              key={entry.id}
              onClick={() => onNavigateTo('wisdom')}
              className={`text-left w-full group ${CTA_FOCUS}`}
            >
              <CardContainer variant="light" className={`h-full border-l-[3px] ${WISDOM_BORDER_COLORS[entry.type] || 'border-l-tea-seal/30'}`}>
                <div className="relative p-5 min-h-[200px] flex flex-col justify-between">
                  {/* Decorative quote mark */}
                  <span className="absolute top-2 right-4 text-5xl text-tea-seal/10 font-serif select-none pointer-events-none leading-none" aria-hidden="true">
                    &ldquo;
                  </span>

                  {/* Author image placeholder */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-tea-beige/30 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                      <Icons.User className="w-4 h-4 text-tea-seal/40" />
                    </div>
                    <div>
                      <span className="text-xs font-sans tracking-wide text-tea-ink/60 dark:text-tea-paper/60 block">
                        {entry.authorName}
                      </span>
                      {entry.teaReferenced && (
                        <span className="font-mono text-[10px] text-tea-seal/60 block">
                          {entry.teaReferenced}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="font-serif italic text-sm text-tea-ink/80 dark:text-tea-paper/80 leading-relaxed flex-1">
                    {entry.body.length > 120 ? entry.body.slice(0, 120) + '...' : entry.body}
                  </p>
                </div>
              </CardContainer>
            </button>
          ))}
        </SwipeCarousel>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          Section 7: Guided Journeys — Vertical Dark Card Stack
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={journeysReveal.ref}
        className={`mb-12 md:mb-16 ${journeysReveal.className}`}
        style={journeysReveal.style}
      >
        <h3 className="font-serif text-lg md:text-xl font-normal text-tea-ink dark:text-tea-paper mb-1">
          Guided Journeys
        </h3>
        <p className="font-serif italic text-xs text-tea-ink/50 dark:text-tea-paper/50 mb-5">
          Step-by-step tasting experiences
        </p>

        <div className="space-y-3">
          {CURATED_COLLECTIONS.map((collection, index) => (
            <button
              key={collection.id}
              onClick={() => onNavigateTo('journeys')}
              className={`w-full text-left group ${CTA_FOCUS}`}
            >
              <CardContainer variant="dark">
                <div className="relative p-5 md:p-6 overflow-hidden">
                  {/* Journey number watermark */}
                  <span className="absolute top-3 left-5 text-5xl text-white/[0.04] font-serif select-none pointer-events-none" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  {/* Subtle radial gradient texture */}
                  <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                      backgroundImage: `radial-gradient(circle at 30% 40%, rgba(201,148,58,0.4) 0%, transparent 50%),
                        radial-gradient(circle at 70% 60%, rgba(201,148,58,0.2) 0%, transparent 40%)`,
                    }}
                  />

                  <div className="relative flex flex-col md:flex-row md:items-center gap-4">
                    {/* Journey image placeholder */}
                    <div className="hidden md:block w-24 flex-shrink-0">
                      <ImagePlaceholder label={`Journey ${index + 1}`} aspectRatio="1/1" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-sm font-sans ${DIFFICULTY_COLORS[collection.difficulty]}`}>
                          {collection.difficulty}
                        </span>
                        <span className="font-mono text-[11px] text-tea-paper/40">
                          {collection.estimatedDuration}
                        </span>
                      </div>
                      <h4 className="font-serif text-lg text-tea-paper leading-tight mb-1 group-hover:text-tea-seal transition-colors">
                        {collection.title}
                      </h4>
                      <p className="font-mono text-[11px] text-tea-paper/50 mb-1">
                        Start with: {collection.guideSteps[0]?.teaName}
                      </p>
                      <span className="text-[10px] text-tea-paper/30 font-sans">
                        {collection.guideSteps.length} steps
                      </span>
                    </div>
                  </div>
                </div>
              </CardContainer>
            </button>
          ))}
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          Section 8: Atlas & Places — Horizontal Carousel
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={atlasReveal.ref}
        className={`mb-12 md:mb-16 ${atlasReveal.className}`}
        style={atlasReveal.style}
      >
        <h3 className="font-serif text-lg md:text-xl font-normal text-tea-ink dark:text-tea-paper mb-1">
          Places
        </h3>
        <p className="font-serif italic text-xs text-tea-ink/50 dark:text-tea-paper/50 mb-5">
          Tea locations around the world
        </p>

        <SwipeCarousel
          itemWidth={200}
          gap={12}
          showArrows={true}
          peek={3}
        >
          {teaMapPins.map(pin => (
            <button
              key={pin.id}
              onClick={() => onStoryClick(geographyLesson)}
              className={`text-left w-full group ${CTA_FOCUS}`}
            >
              <CardContainer variant="dark">
                <div className="relative overflow-hidden">
                  {/* Location image placeholder */}
                  <ImagePlaceholder label={pin.name} aspectRatio="4/3" />
                  <div className="p-4">
                    {/* Subtle topographic texture */}
                    <div
                      className="absolute inset-0 opacity-[0.04]"
                      style={{
                        backgroundImage: `radial-gradient(circle at 30% 40%, rgba(201,148,58,0.4) 0%, transparent 50%),
                          radial-gradient(circle at 70% 60%, rgba(201,148,58,0.2) 0%, transparent 40%)`,
                      }}
                    />
                    <span className="relative inline-block self-start text-[10px] tracking-wider text-tea-seal font-sans border border-white/15 px-2 py-0.5 rounded-sm mb-2">
                      {PIN_TYPE_LABELS[pin.type] || pin.type}
                    </span>
                    <h4 className="relative font-serif text-sm text-tea-paper leading-tight mb-0.5 group-hover:text-tea-seal transition-colors">
                      {pin.name}
                    </h4>
                    <p className="relative text-[11px] text-tea-paper/40 font-sans">
                      {pin.location}
                    </p>
                  </div>
                </div>
              </CardContainer>
            </button>
          ))}
        </SwipeCarousel>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          Section 9: Resource Library — Icon Grid
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={resourcesReveal.ref}
        className={`mb-12 md:mb-16 ${resourcesReveal.className}`}
        style={resourcesReveal.style}
      >
        <h3 className="font-serif text-lg md:text-xl font-normal text-tea-ink dark:text-tea-paper mb-1">
          Resources & Tools
        </h3>
        <p className="font-serif italic text-xs text-tea-ink/50 dark:text-tea-paper/50 mb-5">
          Deepen your practice
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {RESOURCE_TILES.map(tile => (
            <button
              key={tile.id}
              onClick={() => onNavigateTo(tile.view)}
              className={`text-left group ${CTA_FOCUS}`}
            >
              <div className="h-full bg-tea-ink dark:bg-white/[0.04] rounded-[1px] border border-tea-ink/80 dark:border-white/8 p-4 md:p-5 hover:border-tea-seal/30 hover:-translate-y-0.5 transition-all duration-300">
                <span className="text-tea-paper/30 mb-3 block">
                  {tile.icon}
                </span>
                <h4 className="font-serif text-sm text-tea-paper leading-snug mb-0.5 group-hover:text-tea-seal transition-colors">
                  {tile.label}
                </h4>
                <p className="text-[10px] text-tea-paper/35 font-sans">
                  {tile.subtitle}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          Section 10: Tea Space Teaser
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={spacesReveal.ref}
        className={`mb-12 md:mb-16 ${spacesReveal.className}`}
        style={spacesReveal.style}
      >
        <button
          onClick={() => onNavigateTo('spaces')}
          className={`w-full text-left group ${CTA_FOCUS}`}
        >
          <CardContainer variant="light" className="bg-tea-beige/10 dark:bg-tea-ink/90">
            <div className="p-5 md:p-6">
              {/* Space image placeholder */}
              <ImagePlaceholder label="Tea space — minimalist corner" aspectRatio="21/9" className="mb-4" />

              <span className="inline-block text-[10px] uppercase tracking-wider text-tea-seal font-sans border border-tea-seal/20 px-2 py-0.5 rounded-sm mb-3">
                {SPACE_TYPE_LABELS[featuredSpace.spaceType]}
              </span>
              <h4 className="font-serif text-base text-tea-ink dark:text-tea-paper mb-2 group-hover:text-tea-seal transition-colors">
                {featuredSpace.title}
              </h4>
              <p className="font-serif italic text-sm text-tea-ink/60 dark:text-tea-paper/60 leading-relaxed mb-4">
                {featuredSpace.description}
              </p>
              <span className="text-tea-seal text-sm font-sans flex items-center gap-1 group-hover:opacity-80 transition-opacity">
                See all {counts.spaces} spaces
                <Icons.ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </CardContainer>
        </button>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          Section 11: Closing Editorial Note
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={closingReveal.ref}
        className={`mb-16 ${closingReveal.className}`}
        style={closingReveal.style}
      >
        <div className="border-t border-tea-ink/10 dark:border-white/10 pt-8">
          <p className="font-serif italic text-sm text-tea-ink/40 dark:text-tea-paper/40 leading-relaxed max-w-lg">
            This archive grows with every session. If you have a term, a ritual, or a place that should be here&nbsp;&mdash;&nbsp;
            {onNavigateToConsult ? (
              <button
                onClick={onNavigateToConsult}
                className="text-tea-seal/60 hover:text-tea-seal transition-colors underline underline-offset-2"
              >
                reach out
              </button>
            ) : (
              <span>reach out</span>
            )}.
          </p>
        </div>
      </section>
    </div>
  );
};
