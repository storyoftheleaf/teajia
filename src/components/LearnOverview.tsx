import React, { useMemo, useState, useCallback } from 'react';
import { Story } from '../types';
import { Icons } from './Icons';
import { CardContainer } from './shared/CardContainer';
import { SearchInput } from './shared/SearchInput';
import { SwipeCarousel } from './shared/SwipeCarousel';
import { useSectionReveal } from '../hooks/useSectionReveal';
import { LEARN_CURRICULUM, LEARN_PATHS } from '../constants';
import { GLOSSARY_TERMS, GLOSSARY_CATEGORIES } from '../data/glossary';
import { CURATED_COLLECTIONS, DIFFICULTY_COLORS } from '../data/curatedCollections';
import { TEA_SPACES, SPACE_TYPE_LABELS } from '../data/teaSpaces';
import { teaMapPins } from '../data/teaMapPins';

type LearnView = 'overview' | 'course' | 'glossary' | 'playlists' | 'videos' | 'visual-guides' | 'reading' | 'journeys' | 'wisdom' | 'spaces';

const CTA_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 focus-visible:ring-offset-2 rounded-sm';

const PIN_TYPE_LABELS: Record<string, string> = {
  farm: 'Terroir',
  'tea-house': 'Culture',
  shop: 'Technique',
  space: 'Studio',
};

const PATH_ICON_MAP: Record<string, React.ReactNode> = {
  Leaf: <Icons.Leaf className="w-5 h-5" />,
  Teapot: <Icons.Coffee className="w-5 h-5" />,
  Location: <Icons.MapPin className="w-5 h-5" />,
  Box: <Icons.Box className="w-5 h-5" />,
};

// ═══════════════════════════════════════════════════════════════
// Curated Unsplash tea photography
// ═══════════════════════════════════════════════════════════════

const TEA_IMAGES = {
  hero: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=1200&h=510&fit=crop',
  places: [
    'https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=440&h=330&fit=crop', // Bali
    'https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=440&h=330&fit=crop', // Taiwan tea
    'https://images.unsplash.com/photo-1515696955266-4f67e13219e8?w=440&h=330&fit=crop', // Wuyi mountains
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=440&h=330&fit=crop', // Japan ceramics
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=440&h=330&fit=crop', // Yunnan tea field
  ],
  teaSpace: 'https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=1200&h=514&fit=crop',
};

/** Section label — tiny, uppercase, tracked */
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-4">
    <span className="text-[10px] font-sans uppercase tracking-[0.35em] text-tea-seal-dark dark:text-tea-seal/80">
      {children}
    </span>
  </div>
);

// ═══════════════════════════════════════════════════════════════

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

  const [activePath, setActivePath] = useState<string | null>(null);

  const heroReveal = useSectionReveal();
  const glossaryReveal = useSectionReveal();
  const coursesReveal = useSectionReveal();
  const atlasReveal = useSectionReveal();
  const resourcesReveal = useSectionReveal();
  const spacesReveal = useSectionReveal();
  const closingReveal = useSectionReveal();

  const moduleCompletion = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const mod of LEARN_CURRICULUM) {
      map[mod.id] = mod.lessons.every(l => watchedStories[l.id]);
    }
    return map;
  }, [watchedStories]);

  const getModuleTarget = useCallback((mod: typeof LEARN_CURRICULUM[0]) => {
    return mod.lessons.find(l => !watchedStories[l.id]) || mod.lessons[0];
  }, [watchedStories]);

  const geographyLesson = useMemo(() => {
    const m3 = LEARN_CURRICULUM.find(m => m.id === 'm3');
    return m3?.lessons.find(l => l.id === 'l3-1') || LEARN_CURRICULUM[0].lessons[0];
  }, []);

  const spotlightTerm = useMemo(() => {
    const termsWithChinese = GLOSSARY_TERMS.filter(t => t.chineseCharacters && t.deepDive);
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return termsWithChinese[dayOfYear % termsWithChinese.length] || GLOSSARY_TERMS[0];
  }, []);

  const secondTerm = useMemo(() => {
    const termsWithChinese = GLOSSARY_TERMS.filter(t => t.chineseCharacters && t.id !== spotlightTerm.id);
    return termsWithChinese[1] || GLOSSARY_TERMS[1];
  }, [spotlightTerm]);

  const counts = useMemo(() => ({
    courses: LEARN_CURRICULUM.length,
    glossary: GLOSSARY_TERMS.length,
    journeys: CURATED_COLLECTIONS.length,
    spaces: TEA_SPACES.length,
    playlists: 6,
  }), []);

  const getPathProgress = useCallback((path: typeof LEARN_PATHS[0]) => {
    const pathModules = LEARN_CURRICULUM.filter(m => path.modules.includes(m.id));
    const completed = pathModules.filter(m => m.lessons.every(l => watchedStories[l.id])).length;
    return pathModules.length > 0 ? completed / pathModules.length : 0;
  }, [watchedStories]);

  // Path-filtered modules for unified curriculum section
  const activePathData = useMemo(() => {
    return activePath ? LEARN_PATHS.find(p => p.id === activePath) || null : null;
  }, [activePath]);

  const displayModules = useMemo(() => {
    if (!activePathData) return LEARN_CURRICULUM;
    return activePathData.modules
      .map(id => LEARN_CURRICULUM.find(m => m.id === id))
      .filter(Boolean) as typeof LEARN_CURRICULUM;
  }, [activePathData]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const courses = LEARN_CURRICULUM.filter(
      m => m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
    ).slice(0, 3);
    const terms = GLOSSARY_TERMS.filter(
      t => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)
    ).slice(0, 5);
    if (courses.length === 0 && terms.length === 0) return 'empty';
    return { courses, terms };
  }, [searchQuery]);

  const featuredSpace = TEA_SPACES[0];

  return (
    <div className="pb-32">

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 — HERO + EXPLORE (integrated)
          Image, quote, and navigation flow as one opening gesture.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={heroReveal.ref}
        className={`mb-20 md:mb-28 ${heroReveal.className}`}
        style={heroReveal.style}
      >
        {/* Hero image — wide, cinematic */}
        <div className="relative overflow-hidden rounded-[1px] mb-6 md:mb-8">
          <img
            src={TEA_IMAGES.hero}
            alt="Tea ceremony with gaiwan and morning light"
            className="w-full object-cover"
            style={{ aspectRatio: '2.35/1' }}
            loading="eager"
          />
          {/* Quote overlaid at the bottom of the image */}
          <div className="absolute inset-0 bg-gradient-to-t from-tea-ink/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8">
            <p className="font-serif italic text-sm md:text-base text-tea-paper/80 leading-relaxed max-w-md">
              "Everything I wish someone had given me when I started. Take what you need."
            </p>
            <span className="block mt-2 text-[9px] font-sans uppercase tracking-[0.4em] text-tea-paper/40">
              Adrian
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 md:mb-8">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search terms, courses, resources..."
          />
        </div>

        {/* Explore — flows directly from the hero, no separator */}
        <div>
          {[
            { id: 'course' as LearnView, label: 'Courses', sub: `${counts.courses} modules`, icon: <Icons.BookOpen className="w-5 h-5" /> },
            { id: 'glossary' as LearnView, label: 'Glossary', sub: `${counts.glossary} terms`, icon: <Icons.Book className="w-5 h-5" /> },
            { id: 'journeys' as LearnView, label: 'Journeys', sub: `${counts.journeys} paths`, icon: <Icons.MapPin className="w-5 h-5" /> },
            { id: 'playlists' as LearnView, label: 'Playlists', sub: 'Listen', icon: <Icons.Music className="w-5 h-5" /> },
            { id: 'videos' as LearnView, label: 'Videos', sub: 'Watch', icon: <Icons.Film className="w-5 h-5" /> },
            { id: 'reading' as LearnView, label: 'Reading', sub: 'Books & more', icon: <Icons.Book className="w-5 h-5" /> },
            { id: 'visual-guides' as LearnView, label: 'Guides', sub: 'Visual refs', icon: <Icons.Download className="w-5 h-5" /> },
            { id: 'spaces' as LearnView, label: 'Spaces', sub: `${counts.spaces} designs`, icon: <Icons.Home className="w-5 h-5" /> },
          ].map(tile => (
            <button
              key={tile.id}
              onClick={() => onNavigateTo(tile.id)}
              className={`w-full flex items-center gap-4 py-3.5 px-1 hover:bg-tea-ink/[0.02] dark:hover:bg-white/[0.02] transition-colors group text-left ${CTA_FOCUS}`}
            >
              <span className="text-tea-seal/40 group-hover:text-tea-seal/70 transition-colors flex-shrink-0">
                {tile.icon}
              </span>
              <span className="flex-1 font-serif text-sm text-tea-ink dark:text-tea-paper group-hover:text-tea-seal transition-colors">
                {tile.label}
              </span>
              <span className="text-[11px] text-tea-ink/30 dark:text-tea-paper/30 font-sans">
                {tile.sub}
              </span>
              <Icons.ChevronRight className="w-4 h-4 text-tea-ink/15 dark:text-tea-paper/15 flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* Search results */}
        {searchResults && searchResults !== 'empty' && (
          <div className="mt-4 bg-tea-paper dark:bg-tea-ink border border-tea-ink/10 dark:border-white/10 rounded-[1px] p-5 space-y-4">
            {searchResults.courses.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-tea-seal font-sans block mb-2">Courses</span>
                {searchResults.courses.map(mod => (
                  <button
                    key={mod.id}
                    onClick={() => { onStoryClick(getModuleTarget(mod)); setSearchQuery(''); }}
                    className={`block w-full text-left py-2 text-sm text-tea-ink dark:text-tea-paper hover:text-tea-seal transition-colors ${CTA_FOCUS}`}
                  >
                    {mod.title}
                  </button>
                ))}
              </div>
            )}
            {searchResults.terms.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-tea-seal font-sans block mb-2">Terms</span>
                {searchResults.terms.map(term => (
                  <button
                    key={term.id}
                    onClick={() => { onNavigateTo('glossary'); setSearchQuery(''); }}
                    className={`block w-full text-left py-2 text-sm text-tea-ink dark:text-tea-paper hover:text-tea-seal transition-colors ${CTA_FOCUS}`}
                  >
                    <span className="font-serif">{term.term}</span>
                    {term.chineseCharacters && <span className="text-tea-seal/30 ml-2">{term.chineseCharacters}</span>}
                    <span className="text-tea-ink/30 dark:text-tea-paper/30 ml-2 text-xs">{term.definition.slice(0, 50)}...</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {searchResults === 'empty' && (
          <p className="mt-4 text-sm text-tea-ink/35 dark:text-tea-paper/35 font-serif italic">
            Nothing found for &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3 — GLOSSARY SPOTLIGHT
          The Chinese characters are the hero at massive scale.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={glossaryReveal.ref}
        className={`mb-20 md:mb-28 ${glossaryReveal.className}`}
        style={glossaryReveal.style}
      >
        <SectionLabel>Term of the Day</SectionLabel>

        <button
          onClick={() => onNavigateTo('glossary')}
          className={`w-full text-left group ${CTA_FOCUS}`}
        >
          <CardContainer variant="dark">
            <div className="relative overflow-hidden">
              {/* The character — massive, the visual anchor */}
              {spotlightTerm.chineseCharacters && (
                <div className="absolute top-0 right-0 w-1/2 h-full flex items-center justify-center pointer-events-none select-none" aria-hidden="true">
                  <span className="text-[120px] md:text-[180px] lg:text-[220px] text-tea-seal/[0.06] font-serif leading-none">
                    {spotlightTerm.chineseCharacters}
                  </span>
                </div>
              )}

              {/* Atmospheric gradient */}
              <div className="absolute inset-0" style={{
                backgroundImage: `radial-gradient(ellipse at 0% 100%, rgba(201,148,58,0.06) 0%, transparent 60%)`
              }} />

              <div className="relative p-7 md:p-10 lg:p-12">
                {/* Category + badge */}
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-tea-seal font-sans border border-tea-seal/20 px-2.5 py-1 rounded-sm">
                    {GLOSSARY_CATEGORIES[spotlightTerm.category].label}
                  </span>
                </div>

                {/* Term name */}
                <h3 className="font-serif text-3xl md:text-4xl lg:text-5xl text-tea-paper leading-[1.1] mb-2 tracking-tight">
                  {spotlightTerm.term}
                </h3>

                {spotlightTerm.pronunciation && (
                  <p className="font-mono italic text-sm text-tea-paper/40 mb-6 md:mb-8">
                    /{spotlightTerm.pronunciation}/
                  </p>
                )}

                {/* Definition */}
                <p className="text-sm md:text-base text-tea-paper/55 leading-relaxed mb-8 max-w-lg">
                  {spotlightTerm.definition}
                </p>

                {/* Try This */}
                {spotlightTerm.deepDive?.tryThis?.[0] && (
                  <div className="border-l-2 border-tea-seal/25 pl-4 mb-8 max-w-md">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-tea-seal/70 font-sans block mb-1.5">
                      Try this
                    </span>
                    <p className="text-sm text-tea-paper/60 leading-relaxed font-serif italic">
                      {spotlightTerm.deepDive.tryThis[0].description}
                    </p>
                  </div>
                )}

                {/* CTA */}
                <div className="flex items-center gap-6">
                  <span className="text-tea-seal text-sm font-sans flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                    Explore full glossary
                    <Icons.ChevronRight className="w-4 h-4" />
                  </span>
                  <span className="text-tea-paper/25 text-xs font-mono">
                    {counts.glossary} terms
                  </span>
                </div>
              </div>
            </div>
          </CardContainer>
        </button>

        {/* Second term preview */}
        {secondTerm && (
          <div className="mt-4 md:ml-[20%]">
            <button
              onClick={() => onNavigateTo('glossary')}
              className={`text-left group ${CTA_FOCUS}`}
            >
              <div className="flex items-baseline gap-3">
                {secondTerm.chineseCharacters && (
                  <span className="text-2xl text-tea-seal/15 font-serif">{secondTerm.chineseCharacters}</span>
                )}
                <div>
                  <span className="font-serif text-sm text-tea-ink dark:text-tea-paper group-hover:text-tea-seal transition-colors">
                    {secondTerm.term}
                  </span>
                  <span className="text-xs text-tea-ink/30 dark:text-tea-paper/30 ml-2">
                    {secondTerm.definition.slice(0, 50)}...
                  </span>
                </div>
              </div>
            </button>
          </div>
        )}
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4 — CURRICULUM (unified with Practice)
          Paths are entry points. Modules are the content.
          Practice journeys are integrated at the end of the module list.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={coursesReveal.ref}
        className={`mb-20 md:mb-28 ${coursesReveal.className}`}
        style={coursesReveal.style}
      >
        <SectionLabel>Curriculum</SectionLabel>

        {/* Path selector — horizontally scrollable on mobile, no wrapping */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-8 -mx-1 px-1">
          <button
            onClick={() => setActivePath(null)}
            className={`px-3 py-1.5 rounded-sm text-xs font-sans transition-colors min-h-[36px] flex-shrink-0 whitespace-nowrap ${
              activePath === null
                ? 'bg-tea-ink dark:bg-white/10 text-tea-paper dark:text-tea-paper'
                : 'bg-tea-ink/5 dark:bg-white/5 text-tea-ink/50 dark:text-tea-paper/50 hover:text-tea-ink dark:hover:text-tea-paper'
            } ${CTA_FOCUS}`}
          >
            All Modules
          </button>
          {LEARN_PATHS.map(path => {
            const pathIcon = PATH_ICON_MAP[path.icon] || <Icons.BookOpen className="w-3.5 h-3.5" />;
            const progress = getPathProgress(path);
            return (
              <button
                key={path.id}
                onClick={() => setActivePath(activePath === path.id ? null : path.id)}
                className={`px-3 py-1.5 rounded-sm text-xs font-sans flex items-center gap-1.5 transition-colors min-h-[36px] flex-shrink-0 whitespace-nowrap ${
                  activePath === path.id
                    ? 'bg-tea-ink dark:bg-white/10 text-tea-paper dark:text-tea-paper'
                    : 'bg-tea-ink/5 dark:bg-white/5 text-tea-ink/50 dark:text-tea-paper/50 hover:text-tea-ink dark:hover:text-tea-paper'
                } ${CTA_FOCUS}`}
              >
                <span className="text-tea-seal/60">{pathIcon}</span>
                {path.title}
                {progress > 0 && (
                  <span className="text-tea-seal/60 text-[10px] ml-0.5">{Math.round(progress * 100)}%</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Active path description */}
        {activePathData && (
          <div className="mb-6 border-l-2 border-tea-seal/20 pl-4">
            <p className="font-serif italic text-sm text-tea-ink/50 dark:text-tea-paper/50 leading-relaxed">
              {activePathData.description}
            </p>
            <span className="text-[10px] font-mono text-tea-ink/30 dark:text-tea-paper/30 mt-1 block">
              {activePathData.modules.length} modules in this path
            </span>
          </div>
        )}

        {/* Module list */}
        <div className="space-y-0 mb-6">
          {displayModules.map((mod, index) => {
            const isComplete = moduleCompletion[mod.id];
            const firstLesson = mod.lessons[0];
            return (
              <button
                key={mod.id}
                onClick={() => onStoryClick(getModuleTarget(mod))}
                className={`w-full flex items-start gap-5 md:gap-8 py-5 md:py-6 group text-left hover:bg-tea-ink/[0.015] dark:hover:bg-white/[0.015] transition-colors px-1 ${CTA_FOCUS}`}
              >
                <span className={`font-serif text-3xl md:text-4xl tabular-nums leading-none flex-shrink-0 w-12 transition-colors ${
                  isComplete ? 'text-tea-seal/40' : 'text-tea-ink/10 dark:text-tea-paper/10 group-hover:text-tea-seal/30'
                }`}>
                  {String(index + 1).padStart(2, '0')}
                </span>

                <div className="flex-1 pt-1">
                  <span className="font-serif text-base md:text-lg text-tea-ink dark:text-tea-paper group-hover:text-tea-seal transition-colors block leading-snug tracking-tight">
                    {mod.title}
                  </span>
                  <span className="text-xs text-tea-ink/35 dark:text-tea-paper/35 font-sans mt-1.5 block leading-relaxed">
                    {mod.description}
                  </span>
                  {firstLesson && (
                    <span className="text-[11px] italic text-tea-ink/25 dark:text-tea-paper/25 font-serif mt-2 block">
                      Begin: {firstLesson.title}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 pt-2">
                  <span className="text-[10px] font-mono text-tea-ink/25 dark:text-tea-paper/25 whitespace-nowrap hidden sm:inline">
                    {mod.lessons.length}
                  </span>
                  <div className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
                    isComplete
                      ? 'border-tea-seal/30 bg-tea-seal/8'
                      : 'border-tea-ink/8 dark:border-white/8 group-hover:border-tea-seal/20'
                  }`}>
                    {isComplete ? (
                      <Icons.Check className="w-3 h-3 text-tea-seal" />
                    ) : (
                      <Icons.Play className="w-2.5 h-2.5 text-tea-seal/40 ml-0.5" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Practice — Guided Journeys integrated as curriculum items */}
          {CURATED_COLLECTIONS.map((collection) => (
            <button
              key={collection.id}
              onClick={() => onNavigateTo('journeys')}
              className={`w-full flex items-start gap-5 md:gap-8 py-5 md:py-6 group text-left hover:bg-tea-ink/[0.015] dark:hover:bg-white/[0.015] transition-colors px-1 ${CTA_FOCUS}`}
            >
              <span className="flex-shrink-0 w-12 flex items-start justify-center">
                <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm font-sans ${DIFFICULTY_COLORS[collection.difficulty]}`}>
                  Practice
                </span>
              </span>

              <div className="flex-1 pt-1">
                <span className="font-serif text-base md:text-lg text-tea-ink dark:text-tea-paper group-hover:text-tea-seal transition-colors block leading-snug tracking-tight">
                  {collection.title}
                </span>
                <span className="text-xs text-tea-ink/35 dark:text-tea-paper/35 font-sans mt-1.5 block leading-relaxed">
                  {collection.description}
                </span>
                <span className="text-[11px] italic text-tea-ink/25 dark:text-tea-paper/25 font-serif mt-2 block">
                  {collection.estimatedDuration} &middot; {collection.difficulty}
                </span>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0 pt-2">
                <div className="w-7 h-7 rounded-full border border-tea-ink/8 dark:border-white/8 group-hover:border-tea-seal/20 flex items-center justify-center transition-colors">
                  <Icons.Play className="w-2.5 h-2.5 text-tea-seal/40 ml-0.5" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Full curriculum CTA */}
        <div className="mt-4 pt-6">
          <button
            onClick={() => onNavigateTo('course')}
            className={`text-tea-seal text-sm font-sans flex items-center gap-1.5 hover:gap-2.5 transition-all ${CTA_FOCUS}`}
          >
            View full curriculum <Icons.ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5 — RESOURCES & TOOLS (moved up from original position)
          Refined grid. The cards are dark, the layout is tight.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={resourcesReveal.ref}
        className={`mb-20 md:mb-28 ${resourcesReveal.className}`}
        style={resourcesReveal.style}
      >
        <SectionLabel>Resources & Tools</SectionLabel>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {[
            { id: 'playlists' as LearnView, label: 'Playlists', subtitle: 'Music for tea time', icon: <Icons.Music className="w-5 h-5" /> },
            { id: 'videos' as LearnView, label: 'Videos', subtitle: 'Watch & learn', icon: <Icons.Film className="w-5 h-5" /> },
            { id: 'visual-guides' as LearnView, label: 'Visual Guides', subtitle: 'Charts & references', icon: <Icons.Download className="w-5 h-5" /> },
            { id: 'reading' as LearnView, label: 'Reading', subtitle: 'Books & articles', icon: <Icons.Book className="w-5 h-5" /> },
            { id: 'spaces' as LearnView, label: 'Tea Spaces', subtitle: 'Design inspiration', icon: <Icons.Home className="w-5 h-5" /> },
            { id: 'glossary' as LearnView, label: 'Glossary', subtitle: `${counts.glossary} terms`, icon: <Icons.BookOpen className="w-5 h-5" /> },
          ].map(tile => (
            <button
              key={tile.id}
              onClick={() => onNavigateTo(tile.id)}
              className={`text-left group ${CTA_FOCUS}`}
            >
              <div className="h-full bg-tea-ink dark:bg-white/[0.03] rounded-[1px] border border-white/[0.06] p-5 md:p-6 hover:border-tea-seal/20 transition-colors duration-300">
                <span className="text-tea-seal/30 mb-4 block group-hover:text-tea-seal/50 transition-colors">
                  {tile.icon}
                </span>
                <h4 className="font-serif text-sm text-tea-paper leading-snug mb-1 group-hover:text-tea-seal transition-colors">
                  {tile.label}
                </h4>
                <p className="text-[10px] text-tea-paper/30 font-sans leading-relaxed">
                  {tile.subtitle}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 6 — ATLAS & PLACES
          Location cards with real photography.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={atlasReveal.ref}
        className={`mb-20 md:mb-28 ${atlasReveal.className}`}
        style={atlasReveal.style}
      >
        <SectionLabel>Places</SectionLabel>
        <p className="font-serif italic text-sm text-tea-ink/40 dark:text-tea-paper/40 mb-8 max-w-md">
          Tea locations, farms, and cultural landmarks across Asia
        </p>

        <SwipeCarousel
          itemWidth={220}
          gap={14}
          showArrows={true}
          peek={3}
          arrowTheme="light"
        >
          {teaMapPins.map((pin, i) => (
            <button
              key={pin.id}
              onClick={() => onStoryClick(geographyLesson)}
              className={`text-left w-full group ${CTA_FOCUS}`}
            >
              <div className="relative overflow-hidden rounded-[1px] border border-tea-ink/8 dark:border-white/8 hover:border-tea-seal/15 transition-colors duration-300">
                {/* Location photo */}
                <img
                  src={TEA_IMAGES.places[i % TEA_IMAGES.places.length]}
                  alt={`${pin.name} — ${pin.location}`}
                  className="w-full object-cover"
                  style={{ aspectRatio: '4/3' }}
                  loading="lazy"
                />

                <div className="p-4 bg-tea-paper dark:bg-tea-ink">
                  <span className="inline-block text-[9px] uppercase tracking-[0.3em] text-tea-seal/70 font-sans mb-2">
                    {PIN_TYPE_LABELS[pin.type] || pin.type}
                  </span>
                  <h4 className="font-serif text-sm text-tea-ink dark:text-tea-paper leading-tight mb-0.5 group-hover:text-tea-seal transition-colors">
                    {pin.name}
                  </h4>
                  <p className="text-[11px] text-tea-ink/35 dark:text-tea-paper/35 font-sans">
                    {pin.location}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </SwipeCarousel>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 7 — TEA SPACE TEASER
          Warm, aspirational. Real photo.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={spacesReveal.ref}
        className={`mb-20 md:mb-28 ${spacesReveal.className}`}
        style={spacesReveal.style}
      >
        <button
          onClick={() => onNavigateTo('spaces')}
          className={`w-full text-left group ${CTA_FOCUS}`}
        >
          <div className="overflow-hidden rounded-[1px] border border-tea-ink/8 dark:border-white/8">
            {/* Atmospheric image */}
            <img
              src={TEA_IMAGES.teaSpace}
              alt="Minimalist tea corner with morning light"
              className="w-full object-cover"
              style={{ aspectRatio: '21/9' }}
              loading="lazy"
            />

            {/* Content below image */}
            <div className="p-5 md:p-7 bg-tea-paper dark:bg-tea-ink">
              <span className="inline-block text-[9px] uppercase tracking-[0.3em] text-tea-seal/70 font-sans mb-3">
                {SPACE_TYPE_LABELS[featuredSpace.spaceType]}
              </span>
              <h4 className="font-serif text-lg md:text-xl text-tea-ink dark:text-tea-paper mb-2 group-hover:text-tea-seal transition-colors tracking-tight">
                {featuredSpace.title}
              </h4>
              <p className="font-serif italic text-sm text-tea-ink/50 dark:text-tea-paper/50 leading-relaxed mb-4 max-w-md">
                {featuredSpace.description}
              </p>
              <span className="text-tea-seal text-sm font-sans flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                See all {counts.spaces} spaces
                <Icons.ChevronRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        </button>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 8 — CLOSING
          A colophon. Adrian's signature. Generous final breath.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={closingReveal.ref}
        className={`mb-16 ${closingReveal.className}`}
        style={closingReveal.style}
      >
        <div className="pt-12 md:pt-16">
          <div className="max-w-md md:ml-[10%]">
            <p className="font-serif italic text-base md:text-lg text-tea-ink/35 dark:text-tea-paper/35 leading-relaxed mb-6">
              This archive grows with every session, every conversation, every cup.
              If you have a term, a ritual, or a place that should be here&nbsp;&mdash;
            </p>
            {onNavigateToConsult ? (
              <button
                onClick={onNavigateToConsult}
                className={`text-tea-seal text-sm font-sans flex items-center gap-1.5 hover:gap-2.5 transition-all ${CTA_FOCUS}`}
              >
                Let&rsquo;s talk <Icons.ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <span className="text-tea-seal/50 text-sm font-sans">reach out</span>
            )}

            <div className="mt-10 flex items-center gap-3">
              <div className="w-8 h-[0.5px] bg-tea-seal/20" />
              <span className="text-[9px] font-sans uppercase tracking-[0.4em] text-tea-ink/20 dark:text-tea-paper/20">
                Teajia
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
