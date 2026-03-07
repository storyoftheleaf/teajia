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

const PIN_TYPE_LABELS: Record<string, string> = {
  farm: 'Terroir',
  'tea-house': 'Culture',
  shop: 'Technique',
  space: 'Studio',
};

const WISDOM_BORDER_COLORS: Record<string, string> = {
  reflection: 'border-l-blue-400/30',
  tip: 'border-l-emerald-400/30',
  ritual: 'border-l-purple-400/30',
  photo: 'border-l-amber-400/30',
};

const PATH_ICON_MAP: Record<string, React.ReactNode> = {
  Leaf: <Icons.Leaf className="w-5 h-5" />,
  Teapot: <Icons.Coffee className="w-5 h-5" />,
  Location: <Icons.MapPin className="w-5 h-5" />,
  Box: <Icons.Box className="w-5 h-5" />,
};

// ═══════════════════════════════════════════════════════════════
// Textured image placeholders — each evokes a different mood
// ═══════════════════════════════════════════════════════════════

/** Ink-wash style placeholder — organic, painterly */
const InkWashPlaceholder: React.FC<{ label?: string; aspectRatio?: string; className?: string; mood?: 'warm' | 'cool' | 'neutral' | 'dark' }> = ({
  label,
  aspectRatio = '4/3',
  className = '',
  mood = 'neutral',
}) => {
  const gradients: Record<string, string> = {
    warm: `radial-gradient(ellipse at 20% 50%, rgba(201,148,58,0.12) 0%, transparent 60%),
           radial-gradient(ellipse at 80% 30%, rgba(139,90,43,0.08) 0%, transparent 50%),
           radial-gradient(ellipse at 50% 80%, rgba(201,148,58,0.06) 0%, transparent 40%),
           linear-gradient(160deg, rgba(245,240,230,1) 0%, rgba(235,225,210,1) 100%)`,
    cool: `radial-gradient(ellipse at 70% 20%, rgba(120,140,120,0.10) 0%, transparent 50%),
           radial-gradient(ellipse at 30% 70%, rgba(100,120,100,0.08) 0%, transparent 50%),
           linear-gradient(160deg, rgba(240,242,238,1) 0%, rgba(230,235,225,1) 100%)`,
    neutral: `radial-gradient(ellipse at 40% 40%, rgba(201,148,58,0.08) 0%, transparent 50%),
              radial-gradient(ellipse at 70% 70%, rgba(180,160,140,0.06) 0%, transparent 50%),
              linear-gradient(160deg, rgba(245,242,235,1) 0%, rgba(238,232,222,1) 100%)`,
    dark: `radial-gradient(ellipse at 30% 30%, rgba(201,148,58,0.08) 0%, transparent 50%),
           radial-gradient(ellipse at 70% 60%, rgba(201,148,58,0.05) 0%, transparent 40%),
           linear-gradient(160deg, rgba(35,32,28,1) 0%, rgba(28,25,22,1) 100%)`,
  };

  return (
    <div
      className={`relative overflow-hidden rounded-[1px] ${className}`}
      style={{ aspectRatio, backgroundImage: gradients[mood] }}
    >
      {/* Paper grain texture overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />
      {/* Organic brush stroke element */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-20,150 Q100,80 200,140 T420,120" stroke={mood === 'dark' ? '#c9943a' : '#2d2a24'} strokeWidth="40" fill="none" strokeLinecap="round" opacity="0.5" />
        <path d="M-20,200 Q150,160 250,190 T420,170" stroke={mood === 'dark' ? '#c9943a' : '#2d2a24'} strokeWidth="20" fill="none" strokeLinecap="round" opacity="0.3" />
      </svg>
      {label && (
        <div className={`absolute bottom-0 left-0 right-0 p-3 ${mood === 'dark' ? 'text-tea-paper/20' : 'text-tea-ink/15'}`}>
          <span className="text-[8px] font-mono tracking-[0.25em] uppercase">{label}</span>
        </div>
      )}
    </div>
  );
};

/** Section label — tiny, uppercase, tracked, with optional line */
const SectionLabel: React.FC<{ children: React.ReactNode; withLine?: boolean }> = ({ children, withLine = false }) => (
  <div className={`flex items-center gap-4 mb-4 ${withLine ? '' : ''}`}>
    <span className="text-[10px] font-sans uppercase tracking-[0.35em] text-tea-seal-dark dark:text-tea-seal/80">
      {children}
    </span>
    {withLine && (
      <div className="flex-1 h-[0.5px] bg-tea-ink/8 dark:bg-white/8" />
    )}
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

  // Pick a second term for the two-up glossary layout
  const secondTerm = useMemo(() => {
    const termsWithChinese = GLOSSARY_TERMS.filter(t => t.chineseCharacters && t.id !== spotlightTerm.id);
    return termsWithChinese[1] || GLOSSARY_TERMS[1];
  }, [spotlightTerm]);

  const counts = useMemo(() => ({
    courses: LEARN_CURRICULUM.length,
    glossary: GLOSSARY_TERMS.length,
    journeys: CURATED_COLLECTIONS.length,
    wisdom: COMMUNITY_WISDOM.length,
    spaces: TEA_SPACES.length,
    playlists: 6,
  }), []);

  const getPathProgress = useCallback((path: typeof LEARN_PATHS[0]) => {
    const pathModules = LEARN_CURRICULUM.filter(m => path.modules.includes(m.id));
    const completed = pathModules.filter(m => m.lessons.every(l => watchedStories[l.id])).length;
    return pathModules.length > 0 ? completed / pathModules.length : 0;
  }, [watchedStories]);

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

  // Featured community voice — the longest, richest quote
  const featuredVoice = useMemo(() => {
    return [...COMMUNITY_WISDOM].sort((a, b) => b.body.length - a.body.length)[0];
  }, []);
  const supportingVoices = useMemo(() => {
    return COMMUNITY_WISDOM.filter(w => w.id !== featuredVoice.id).slice(0, 4);
  }, [featuredVoice]);

  const featuredSpace = TEA_SPACES[0];

  return (
    <div className="pb-32">

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 — HERO
          Oversized typography, editorial quote, atmospheric image.
          The first impression. Luxury breathes.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={heroReveal.ref}
        className={`mb-16 md:mb-24 ${heroReveal.className}`}
        style={heroReveal.style}
      >
        {/* Title — oversized, the anchor of the page */}
        <h2 className="font-serif italic text-5xl md:text-7xl lg:text-8xl font-light text-tea-ink dark:text-tea-paper leading-[0.9] tracking-tight mb-8 md:mb-12">
          The<br />Archive
        </h2>

        {/* Hero image — wide, cinematic */}
        <InkWashPlaceholder
          label="Gaiwan on stone, morning light through steam"
          aspectRatio="2.35/1"
          mood="warm"
          className="mb-8 md:mb-12"
        />

        {/* Editorial voice — offset, breathing, hand-placed feel */}
        <div className="md:ml-[15%] max-w-md mb-8 md:mb-10">
          <p className="font-serif italic text-base md:text-lg text-tea-ink/55 dark:text-tea-paper/55 leading-relaxed">
            "Everything I wish someone had given me when I started.
            <br className="hidden md:block" />
            Take what you need."
          </p>
          <span className="block mt-3 text-[10px] font-sans uppercase tracking-[0.4em] text-tea-seal/60">
            Adrian
          </span>
        </div>

        {/* Stat ribbon — wraps naturally on small screens */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 md:gap-x-10 mb-10">
          {[
            { n: counts.glossary, label: 'Terms' },
            { n: counts.courses, label: 'Courses' },
            { n: counts.journeys, label: 'Journeys' },
            { n: counts.wisdom, label: 'Voices' },
            { n: counts.playlists, label: 'Playlists' },
          ].map((stat, i) => (
            <div key={i} className="flex flex-col items-center">
              <span className="font-serif text-2xl md:text-3xl text-tea-ink dark:text-tea-paper tabular-nums">{stat.n}</span>
              <span className="text-[9px] font-sans uppercase tracking-[0.35em] text-tea-ink/30 dark:text-tea-paper/30 mt-0.5">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Search — clean, minimal */}
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search terms, courses, resources..."
        />

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
          SECTION 2 — DISCOVERY
          Large, tactile category tiles. Not tiny icons in boxes.
          Each tile has its own character.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={discoveryReveal.ref}
        className={`mb-20 md:mb-28 ${discoveryReveal.className}`}
        style={discoveryReveal.style}
      >
        <SectionLabel withLine>Explore</SectionLabel>

        <SwipeCarousel
          itemWidth={140}
          gap={12}
          showArrows={false}
          showDots={false}
          peek={2}
        >
          {[
            { id: 'course' as LearnView, label: 'Courses', sub: `${counts.courses} modules`, icon: <Icons.BookOpen className="w-6 h-6" />, mood: 'warm' as const },
            { id: 'glossary' as LearnView, label: 'Glossary', sub: `${counts.glossary} terms`, icon: <Icons.Book className="w-6 h-6" />, mood: 'neutral' as const },
            { id: 'journeys' as LearnView, label: 'Journeys', sub: `${counts.journeys} paths`, icon: <Icons.MapPin className="w-6 h-6" />, mood: 'cool' as const },
            { id: 'wisdom' as LearnView, label: 'Voices', sub: `${counts.wisdom} stories`, icon: <Icons.Users className="w-6 h-6" />, mood: 'warm' as const },
            { id: 'playlists' as LearnView, label: 'Playlists', sub: 'Listen', icon: <Icons.Music className="w-6 h-6" />, mood: 'cool' as const },
            { id: 'videos' as LearnView, label: 'Videos', sub: 'Watch', icon: <Icons.Film className="w-6 h-6" />, mood: 'neutral' as const },
            { id: 'reading' as LearnView, label: 'Reading', sub: 'Books & more', icon: <Icons.Book className="w-6 h-6" />, mood: 'warm' as const },
            { id: 'visual-guides' as LearnView, label: 'Guides', sub: 'Visual refs', icon: <Icons.Download className="w-6 h-6" />, mood: 'neutral' as const },
            { id: 'spaces' as LearnView, label: 'Spaces', sub: `${counts.spaces} designs`, icon: <Icons.Home className="w-6 h-6" />, mood: 'cool' as const },
          ].map(tile => (
            <button
              key={tile.id}
              onClick={() => onNavigateTo(tile.id)}
              className={`text-left group w-full ${CTA_FOCUS}`}
            >
              <div className="relative overflow-hidden rounded-[1px] border border-tea-ink/8 dark:border-white/8 hover:border-tea-seal/20 transition-colors duration-300">
                <InkWashPlaceholder aspectRatio="3/4" mood={tile.mood} />
                {/* Gradient scrim for text legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-tea-paper/90 via-tea-paper/30 to-transparent dark:from-tea-ink/90 dark:via-tea-ink/30" />
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  <span className="text-tea-seal/60 mb-1.5 group-hover:text-tea-seal transition-colors">{tile.icon}</span>
                  <span className="font-serif text-sm text-tea-ink dark:text-tea-paper group-hover:text-tea-seal transition-colors leading-tight">
                    {tile.label}
                  </span>
                  <span className="text-[10px] font-sans text-tea-ink/40 dark:text-tea-paper/40 mt-0.5">
                    {tile.sub}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </SwipeCarousel>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3 — GLOSSARY SPOTLIGHT
          The Chinese characters are the hero at massive scale.
          This should feel like discovering a beautiful artifact.
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

                {/* Term name — large, commanding */}
                <h3 className="font-serif text-3xl md:text-4xl lg:text-5xl text-tea-paper leading-[1.1] mb-2 tracking-tight">
                  {spotlightTerm.term}
                </h3>

                {spotlightTerm.pronunciation && (
                  <p className="font-mono italic text-sm text-tea-paper/40 mb-6 md:mb-8">
                    /{spotlightTerm.pronunciation}/
                  </p>
                )}

                {/* Definition — generous measure, readable */}
                <p className="text-sm md:text-base text-tea-paper/55 leading-relaxed mb-8 max-w-lg">
                  {spotlightTerm.definition}
                </p>

                {/* Try This — warm callout */}
                {spotlightTerm.deepDive?.tryThis?.[0] && (
                  <div className="border-l-2 border-tea-seal/25 pl-4 mb-8 max-w-md">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-tea-seal/70 font-sans block mb-1.5">
                      Try this
                    </span>
                    <p className="text-sm text-tea-paper/60 leading-relaxed font-serif italic">
                      {spotlightTerm.deepDive.tryThis[0].description.length > 120
                        ? spotlightTerm.deepDive.tryThis[0].description.slice(0, 120) + '...'
                        : spotlightTerm.deepDive.tryThis[0].description}
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

        {/* Second term preview — asymmetric companion */}
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
          SECTION 4 — LEARNING PATHS
          Generous cards with atmospheric image placeholders.
          Each path feels like a distinct world to enter.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={pathsReveal.ref}
        className={`mb-20 md:mb-28 ${pathsReveal.className}`}
        style={pathsReveal.style}
      >
        <SectionLabel withLine>Learning Paths</SectionLabel>

        <SwipeCarousel
          itemWidth={300}
          gap={20}
          showArrows={true}
          showDots={true}
          peek={3}
          arrowTheme="light"
        >
          {LEARN_PATHS.map((path, i) => {
            const progress = getPathProgress(path);
            const pathIcon = PATH_ICON_MAP[path.icon] || <Icons.BookOpen className="w-5 h-5" />;
            const moods: Array<'warm' | 'cool' | 'neutral'> = ['warm', 'cool', 'neutral'];
            return (
              <button
                key={path.id}
                onClick={() => onNavigateTo('course')}
                className={`text-left w-full group ${CTA_FOCUS}`}
              >
                <div className="relative overflow-hidden rounded-[1px] border border-tea-ink/8 dark:border-white/8 hover:border-tea-seal/20 transition-colors duration-300">
                  {/* Atmospheric top image */}
                  <InkWashPlaceholder
                    aspectRatio="16/10"
                    mood={moods[i % moods.length]}
                    label={path.title.toLowerCase()}
                  />

                  <div className="p-5 bg-tea-paper dark:bg-tea-ink">
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="text-tea-seal/50">{pathIcon}</span>
                      <h4 className="font-serif text-lg text-tea-ink dark:text-tea-paper group-hover:text-tea-seal transition-colors leading-tight tracking-tight">
                        {path.title}
                      </h4>
                    </div>

                    <p className="font-serif italic text-xs text-tea-ink/45 dark:text-tea-paper/45 mb-4 leading-relaxed">
                      {path.description}
                    </p>

                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-[10px] text-tea-ink/35 dark:text-tea-paper/35">
                        {path.modules.length} modules
                      </span>
                      {progress > 0 && (
                        <span className="font-mono text-[10px] text-tea-seal/70">
                          {Math.round(progress * 100)}%
                        </span>
                      )}
                    </div>

                    {/* Progress — thin, elegant */}
                    <div className="h-[2px] bg-tea-ink/5 dark:bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-tea-seal/70 rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${Math.max(progress * 100, 0)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </SwipeCarousel>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5 — CURRICULUM
          Clean numbered index. The numbers are the design element.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={coursesReveal.ref}
        className={`mb-20 md:mb-28 ${coursesReveal.className}`}
        style={coursesReveal.style}
      >
        <div className="flex items-baseline justify-between mb-6">
          <SectionLabel>Curriculum</SectionLabel>
          <button
            onClick={() => onNavigateTo('course')}
            className={`text-tea-seal hover:text-tea-seal/70 text-xs font-sans flex items-center gap-1 transition-colors ${CTA_FOCUS}`}
          >
            All courses <Icons.ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-0">
          {LEARN_CURRICULUM.map((mod, index) => {
            const isComplete = moduleCompletion[mod.id];
            const firstLesson = mod.lessons[0];
            return (
              <button
                key={mod.id}
                onClick={() => onStoryClick(getModuleTarget(mod))}
                className={`w-full flex items-start gap-5 md:gap-8 py-6 md:py-7 group text-left border-b border-tea-ink/6 dark:border-white/6 first:border-t hover:bg-tea-ink/[0.015] dark:hover:bg-white/[0.015] transition-colors px-1 ${CTA_FOCUS}`}
              >
                {/* Large number — the design element */}
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
                    {mod.description.slice(0, 80)}...
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
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 6 — COMMUNITY VOICES
          One hero quote, then supporting voices below.
          This is editorial design, not a carousel of truncated snippets.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={voicesReveal.ref}
        className={`mb-20 md:mb-28 ${voicesReveal.className}`}
        style={voicesReveal.style}
      >
        <SectionLabel withLine>Community Voices</SectionLabel>

        {/* Hero quote — full width, breathing, editorial */}
        <button
          onClick={() => onNavigateTo('wisdom')}
          className={`w-full text-left group mb-8 ${CTA_FOCUS}`}
        >
          <div className="md:flex gap-8 items-start">
            {/* Portrait placeholder */}
            <div className="hidden md:block w-32 lg:w-40 flex-shrink-0">
              <InkWashPlaceholder
                aspectRatio="3/4"
                mood="warm"
                label={featuredVoice.authorName.split(' ')[0].toLowerCase()}
              />
            </div>

            <div className="flex-1">
              {/* Large decorative quote mark */}
              <span className="text-7xl md:text-8xl text-tea-seal/[0.08] font-serif leading-none select-none block -mb-8 md:-mb-10" aria-hidden="true">
                &ldquo;
              </span>

              <p className="font-serif italic text-lg md:text-xl lg:text-2xl text-tea-ink/75 dark:text-tea-paper/75 leading-relaxed mb-5">
                {featuredVoice.body.length > 200 ? featuredVoice.body.slice(0, 200) + '...' : featuredVoice.body}
              </p>

              <div className="flex items-center gap-3">
                <span className="text-xs font-sans tracking-wide text-tea-ink/50 dark:text-tea-paper/50">
                  {featuredVoice.authorName}
                </span>
                {featuredVoice.teaReferenced && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-tea-seal/30" />
                    <span className="font-mono text-[10px] text-tea-seal/50">
                      {featuredVoice.teaReferenced}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </button>

        {/* Supporting voices — horizontal scroll of compact cards */}
        <SwipeCarousel
          itemWidth={260}
          gap={14}
          showArrows={false}
          showDots={false}
          peek={3}
        >
          {supportingVoices.map(entry => (
            <button
              key={entry.id}
              onClick={() => onNavigateTo('wisdom')}
              className={`text-left w-full group ${CTA_FOCUS}`}
            >
              <div className={`border-l-2 ${WISDOM_BORDER_COLORS[entry.type] || 'border-l-tea-seal/20'} pl-4 py-1`}>
                <p className="font-serif italic text-sm text-tea-ink/60 dark:text-tea-paper/60 leading-relaxed mb-2">
                  &ldquo;{entry.body.length > 90 ? entry.body.slice(0, 90) + '...' : entry.body}&rdquo;
                </p>
                <span className="text-[10px] font-sans text-tea-ink/35 dark:text-tea-paper/35 tracking-wide">
                  {entry.authorName}
                </span>
              </div>
            </button>
          ))}
        </SwipeCarousel>

        <div className="mt-6 md:ml-[15%]">
          <button
            onClick={() => onNavigateTo('wisdom')}
            className={`text-tea-seal text-xs font-sans flex items-center gap-1 hover:gap-2 transition-all ${CTA_FOCUS}`}
          >
            Read all {counts.wisdom} voices <Icons.ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 7 — GUIDED JOURNEYS
          Full-bleed dark section. Each journey is an invitation.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={journeysReveal.ref}
        className={`mb-20 md:mb-28 rounded-[1px] bg-tea-ink dark:bg-black/30 py-10 md:py-14 px-5 md:px-8 ${journeysReveal.className}`}
        style={journeysReveal.style}
      >
        <div>
          <div className="flex items-center gap-4 mb-2">
            <span className="text-[10px] font-sans uppercase tracking-[0.35em] text-tea-seal/60">
              Guided Journeys
            </span>
            <div className="flex-1 h-[0.5px] bg-white/8" />
          </div>
          <p className="font-serif italic text-sm text-tea-paper/35 mb-10">
            Step-by-step tasting experiences, designed to be brewed
          </p>

          <div className="space-y-5">
            {CURATED_COLLECTIONS.map((collection, index) => (
              <button
                key={collection.id}
                onClick={() => onNavigateTo('journeys')}
                className={`w-full text-left group ${CTA_FOCUS}`}
              >
                <div className="relative overflow-hidden rounded-[1px] border border-white/[0.06] hover:border-tea-seal/15 transition-all duration-300">
                  <div className="flex flex-col md:flex-row">
                    {/* Journey image — hidden on mobile for cleaner layout, shown on md+ */}
                    <div className="hidden md:block md:w-1/3 lg:w-2/5 flex-shrink-0 overflow-hidden">
                      <InkWashPlaceholder
                        aspectRatio="16/10"
                        mood="dark"
                        label={`${collection.guideSteps[0]?.teaName?.toLowerCase()}`}
                      />
                    </div>

                    <div className="flex-1 p-6 md:p-8 relative">
                      {/* Journey number — watermark */}
                      <span className="absolute top-4 right-6 text-6xl md:text-7xl text-white/[0.03] font-serif leading-none select-none pointer-events-none" aria-hidden="true">
                        {String(index + 1).padStart(2, '0')}
                      </span>

                      <div className="flex items-center gap-3 mb-4">
                        <span className={`text-[10px] px-2.5 py-1 rounded-sm font-sans ${DIFFICULTY_COLORS[collection.difficulty]}`}>
                          {collection.difficulty}
                        </span>
                        <span className="font-mono text-[11px] text-tea-paper/30">
                          {collection.estimatedDuration}
                        </span>
                      </div>

                      <h4 className="font-serif text-xl md:text-2xl text-tea-paper leading-tight mb-3 group-hover:text-tea-seal transition-colors tracking-tight">
                        {collection.title}
                      </h4>

                      <p className="text-sm text-tea-paper/40 leading-relaxed mb-5 max-w-md">
                        {collection.description.slice(0, 100)}...
                      </p>

                      <div className="flex items-center gap-4">
                        <span className="text-[11px] text-tea-paper/50 font-serif italic">
                          Start with: {collection.guideSteps[0]?.teaName}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-tea-paper/15" />
                        <span className="text-[10px] text-tea-paper/25 font-mono">
                          {collection.guideSteps.length} steps
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 8 — ATLAS & PLACES
          Location cards that feel like postcards from origin.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={atlasReveal.ref}
        className={`mb-20 md:mb-28 ${atlasReveal.className}`}
        style={atlasReveal.style}
      >
        <SectionLabel withLine>Places</SectionLabel>
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
          {teaMapPins.map((pin, i) => {
            const moods: Array<'warm' | 'cool' | 'neutral'> = ['warm', 'cool', 'neutral'];
            return (
              <button
                key={pin.id}
                onClick={() => onStoryClick(geographyLesson)}
                className={`text-left w-full group ${CTA_FOCUS}`}
              >
                <div className="relative overflow-hidden rounded-[1px] border border-tea-ink/8 dark:border-white/8 hover:border-tea-seal/15 transition-colors duration-300">
                  {/* Location postcard image */}
                  <InkWashPlaceholder
                    aspectRatio="4/3"
                    mood={moods[i % moods.length]}
                    label={pin.location.toLowerCase()}
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
            );
          })}
        </SwipeCarousel>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 9 — RESOURCES
          Refined grid. The cards are dark, the layout is tight.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={resourcesReveal.ref}
        className={`mb-20 md:mb-28 ${resourcesReveal.className}`}
        style={resourcesReveal.style}
      >
        <SectionLabel withLine>Resources & Tools</SectionLabel>

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
          SECTION 10 — TEA SPACE TEASER
          Warm, aspirational. The image is everything here.
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
            <InkWashPlaceholder
              aspectRatio="21/9"
              mood="warm"
              label="Morning light on a minimalist tea corner"
            />

            {/* Content below image — clean, no overlay legibility issues */}
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
          SECTION 11 — CLOSING
          A colophon. Adrian's signature. Generous final breath.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={closingReveal.ref}
        className={`mb-16 ${closingReveal.className}`}
        style={closingReveal.style}
      >
        <div className="border-t border-tea-ink/8 dark:border-white/8 pt-12 md:pt-16">
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
