import React, { useMemo, useState, useCallback } from 'react';
import { Story } from '../types';
import { Icons } from './Icons';
import { CardContainer } from './shared/CardContainer';
import { SearchInput } from './shared/SearchInput';
import { SwipeCarousel } from './shared/SwipeCarousel';
import { useSectionReveal } from '../hooks/useSectionReveal';
import { LEARN_CURRICULUM, LEARN_PATHS } from '../constants';
import { GLOSSARY_TERMS, GLOSSARY_CATEGORIES } from '../data/glossary';
import { CURATED_COLLECTIONS } from '../data/curatedCollections';
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


// ═══════════════════════════════════════════════════════════════
// Curated Unsplash tea photography
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
        <path d="M-20,150 Q100,80 200,140 T420,120" stroke={mood === 'dark' ? 'var(--tea-gold)' : 'var(--tea-text)'} strokeWidth="40" fill="none" strokeLinecap="round" opacity="0.5" />
        <path d="M-20,200 Q150,160 250,190 T420,170" stroke={mood === 'dark' ? 'var(--tea-gold)' : 'var(--tea-text)'} strokeWidth="20" fill="none" strokeLinecap="round" opacity="0.3" />
      </svg>
      {label && (
        <div className={`absolute bottom-0 left-0 right-0 p-3 ${mood === 'dark' ? 'text-tea-paper/20' : 'text-tea-ink/15'}`}>
          <span className="text-[8px] font-mono tracking-[0.25em] uppercase">{label}</span>
        </div>
      )}
    </div>
  );
};

/** Section label — serif, editorial, warm gold accent */
const SectionLabel: React.FC<{ children: React.ReactNode; subtitle?: string }> = ({ children, subtitle }) => (
  <div className="mb-8 md:mb-10">
    <h3 className="font-serif text-[clamp(22px,3vw,28px)] text-tea-text tracking-[0.01em] leading-[1.2]">
      {children}
    </h3>
    {subtitle && (
      <p className="mt-2 font-serif font-light italic text-[15px] text-tea-text-dim leading-[1.6]">
        {subtitle}
      </p>
    )}
    <div className="mt-4 w-12 h-px bg-tea-gold/30" />
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
            <p className="font-serif font-light italic text-[18px] text-tea-gold leading-[1.4] max-w-md">
              "Everything I wish someone had given me when I started. Take what you need."
            </p>
            <span className="block mt-2 text-[10px] font-sans uppercase tracking-[0.2em] text-tea-text-dim">
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
            { id: 'course' as LearnView, label: 'Go Deeper', sub: 'Structured lessons from leaf to cup', icon: <Icons.BookOpen className="w-5 h-5" />, iconColor: 'text-tea-gold/50' },
            { id: 'glossary' as LearnView, label: 'Glossary', sub: 'The language of tea, demystified', icon: <Icons.Book className="w-5 h-5" />, iconColor: 'text-amber-600/40' },
            { id: 'journeys' as LearnView, label: 'Journeys', sub: 'Guided tastings to shape your palate', icon: <Icons.MapPin className="w-5 h-5" />, iconColor: 'text-tea-gold/40' },
            { id: 'playlists' as LearnView, label: 'Playlists', sub: 'Music for tea time', icon: <Icons.Music className="w-5 h-5" />, iconColor: 'text-amber-500/35' },
            { id: 'videos' as LearnView, label: 'Videos', sub: 'Watch & learn', icon: <Icons.Film className="w-5 h-5" />, iconColor: 'text-amber-700/40' },
            { id: 'reading' as LearnView, label: 'Reading', sub: 'Books & articles', icon: <Icons.Book className="w-5 h-5" />, iconColor: 'text-tea-gold/35' },
            { id: 'visual-guides' as LearnView, label: 'Guides', sub: 'Charts & references', icon: <Icons.Download className="w-5 h-5" />, iconColor: 'text-amber-600/35' },
            { id: 'spaces' as LearnView, label: 'Spaces', sub: 'Inspiration for your tea room', icon: <Icons.Home className="w-5 h-5" />, iconColor: 'text-amber-500/40' },
          ].map(tile => (
            <button
              key={tile.id}
              onClick={() => onNavigateTo(tile.id)}
              className={`w-full flex items-center gap-4 py-3.5 px-1 border-b border-tea-border last:border-b-0 hover:bg-tea-text/[0.02] transition-colors group text-left ${CTA_FOCUS}`}
            >
              <span className={`${tile.iconColor || 'text-tea-gold/40'} group-hover:text-tea-gold/70 transition-colors flex-shrink-0`}>
                {tile.icon}
              </span>
              <span className="flex-1 font-serif text-[15px] text-tea-text leading-[1.4] group-hover:text-tea-gold transition-colors">
                {tile.label}
              </span>
              <span className="text-[11px] text-tea-text-sec font-sans tracking-[0.15em]">
                {tile.sub}
              </span>
            </button>
          ))}
        </div>

        {/* Search results */}
        {searchResults && searchResults !== 'empty' && (
          <div className="mt-4 bg-tea-surface border border-transparent rounded-[1px] p-5 space-y-4">
            {searchResults.courses.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-tea-gold font-sans block mb-2">Courses</span>
                {searchResults.courses.map(mod => (
                  <button
                    key={mod.id}
                    onClick={() => { onStoryClick(getModuleTarget(mod)); setSearchQuery(''); }}
                    className={`block w-full text-left py-2 text-sm text-tea-text hover:text-tea-gold transition-colors ${CTA_FOCUS}`}
                  >
                    {mod.title}
                  </button>
                ))}
              </div>
            )}
            {searchResults.terms.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-tea-gold font-sans block mb-2">Terms</span>
                {searchResults.terms.map(term => (
                  <button
                    key={term.id}
                    onClick={() => { onNavigateTo('glossary'); setSearchQuery(''); }}
                    className={`block w-full text-left py-2 text-sm text-tea-text hover:text-tea-gold transition-colors ${CTA_FOCUS}`}
                  >
                    <span className="font-serif">{term.term}</span>
                    {term.chineseCharacters && <span className="text-tea-gold/30 ml-2">{term.chineseCharacters}</span>}
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
        <SectionLabel subtitle="A new word, each morning">Term of the Day</SectionLabel>

        <button
          onClick={() => onNavigateTo('glossary')}
          className={`w-full text-left group ${CTA_FOCUS}`}
        >
          <CardContainer variant="dark">
            <div className="relative overflow-hidden">
              {/* Atmospheric gradient — subtle warmth from bottom-left */}
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: `radial-gradient(ellipse at 0% 100%, rgba(201,148,58,0.06) 0%, transparent 60%)`
              }} />

              <div className="relative p-7 md:p-10 lg:p-12">
                {/* Category + badge */}
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-tea-gold font-sans border border-tea-gold/20 px-2.5 py-1 rounded-sm">
                    {GLOSSARY_CATEGORIES[spotlightTerm.category].label}
                  </span>
                </div>

                {/* Term name */}
                <h3 className="font-serif text-[clamp(32px,4.8vw,48px)] text-tea-text leading-[1.12] mb-2 tracking-[0.01em]">
                  {spotlightTerm.term}
                </h3>

                {spotlightTerm.pronunciation && (
                  <p className="font-mono text-[9px] text-tea-text-dim mb-6 md:mb-8">
                    /{spotlightTerm.pronunciation}/
                  </p>
                )}

                {/* Definition — Body role */}
                <p className="font-serif text-[17px] text-tea-text-sec leading-[1.85] mb-8 max-w-lg">
                  {spotlightTerm.definition}
                </p>

                {/* Try This */}
                {spotlightTerm.deepDive?.tryThis?.[0] && (
                  <div className="border-l-2 border-tea-gold/25 pl-4 mb-8 max-w-md">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim font-sans block mb-1.5">
                      Try this
                    </span>
                    <p className="text-[15px] text-tea-text-dim leading-[1.8] font-serif font-light italic">
                      {spotlightTerm.deepDive.tryThis[0].description}
                    </p>
                  </div>
                )}

                {/* CTA */}
                <div className="flex items-center gap-6">
                  <span className="text-tea-gold text-[13px] font-sans flex items-center gap-1.5 group-hover:gap-2.5 transition-all border-b border-tea-gold pb-0.5">
                    Explore full glossary
                    <Icons.ChevronRight className="w-4 h-4" />
                  </span>
                  <span className="text-tea-text-dim text-[9px] font-mono">
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
              <div className="flex items-baseline gap-2">
                {secondTerm.chineseCharacters && (
                  <span className="text-sm text-tea-gold/30 font-serif">{secondTerm.chineseCharacters}</span>
                )}
                <div>
                  <span className="font-serif text-sm text-tea-text group-hover:text-tea-gold transition-colors">
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
          SECTION 4 — CURRICULUM ENTRY
          A doorway, not the room. Shows progress summary, the next module
          to tackle, and a clear CTA into the full curriculum.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={coursesReveal.ref}
        className={`mb-20 md:mb-28 ${coursesReveal.className}`}
        style={coursesReveal.style}
      >
        <SectionLabel subtitle="Courses on leaf, water, and practice">Go Deeper</SectionLabel>

        {/* Module list */}
        <div>
          {LEARN_CURRICULUM.map((mod, i) => {
            const isNext = mod.id === (LEARN_CURRICULUM.find(m => !moduleCompletion[m.id]) || LEARN_CURRICULUM[0]).id;
            const isDone = moduleCompletion[mod.id];
            return (
              <button
                key={mod.id}
                onClick={() => onNavigateTo('course')}
                className={`w-full text-left group border-b border-tea-gold/[0.06] last:border-0 ${CTA_FOCUS}`}
              >
                <div className="py-5 md:py-6">
                  <div className="flex items-baseline justify-between gap-4 mb-2">
                    <h4 className={`font-serif text-[19px] leading-[1.2] tracking-[0.01em] transition-colors ${
                      isNext ? 'text-tea-text group-hover:text-tea-gold' :
                      isDone ? 'text-tea-text/30' :
                      'text-tea-text/55 group-hover:text-tea-gold/80'
                    }`}>
                      {mod.title}
                    </h4>
                    <Icons.ChevronRight className={`w-4 h-4 flex-shrink-0 transition-all ${
                      isNext ? 'text-tea-gold/40 group-hover:text-tea-gold group-hover:translate-x-0.5' :
                      'text-tea-text/10 group-hover:text-tea-gold/40'
                    }`} />
                  </div>
                  <p className={`font-serif font-light italic text-[15px] leading-[1.8] ${
                    isDone ? 'text-tea-text-dim/50' : 'text-tea-text-dim'
                  }`}>
                    {mod.description}
                  </p>
                </div>
              </button>
            );
          })}
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
        <SectionLabel subtitle="References, music, and visual guides">Resources & Tools</SectionLabel>

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
              <div className="h-full bg-tea-surface rounded-[1px] border border-transparent p-5 md:p-6 hover:border-tea-gold/20 transition-colors duration-300">
                <span className="text-tea-gold/30 mb-4 block group-hover:text-tea-gold/50 transition-colors">
                  {tile.icon}
                </span>
                <h4 className="font-serif text-[15px] text-tea-text leading-[1.2] mb-1 group-hover:text-tea-gold transition-colors">
                  {tile.label}
                </h4>
                <p className="text-[10px] text-tea-text-dim font-sans uppercase tracking-[0.2em] leading-[1.4]">
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
        <SectionLabel subtitle="Tea locations, farms, and cultural landmarks across Asia">Places</SectionLabel>

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
              <div className="relative overflow-hidden rounded-[1px] border border-transparent hover:border-tea-gold/15 transition-colors duration-300">
                {/* Location photo */}
                <img
                  src={TEA_IMAGES.places[i % TEA_IMAGES.places.length]}
                  alt={`${pin.name} — ${pin.location}`}
                  className="w-full object-cover"
                  style={{ aspectRatio: '4/3' }}
                  loading="lazy"
                />

                <div className="p-4 bg-tea-paper dark:bg-tea-ink">
                  <span className="inline-block text-[9px] uppercase tracking-[0.3em] text-tea-gold/70 font-sans mb-2">
                    {PIN_TYPE_LABELS[pin.type] || pin.type}
                  </span>
                  <h4 className="font-serif text-sm text-tea-text leading-tight mb-0.5 group-hover:text-tea-gold transition-colors">
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
          <div className="overflow-hidden rounded-[1px] border border-transparent">
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
              <span className="inline-block text-[9px] uppercase tracking-[0.3em] text-tea-gold/70 font-sans mb-3">
                {SPACE_TYPE_LABELS[featuredSpace.spaceType]}
              </span>
              <h4 className="font-serif text-lg md:text-xl text-tea-text mb-2 group-hover:text-tea-gold transition-colors tracking-tight">
                {featuredSpace.title}
              </h4>
              <p className="font-serif italic text-sm text-tea-ink/50 dark:text-tea-paper/50 leading-relaxed mb-4 max-w-md">
                {featuredSpace.description}
              </p>
              <span className="text-tea-gold text-sm font-sans flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
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
        className={`${closingReveal.className}`}
        style={closingReveal.style}
      >
        {/* Thin gold rule to close the content */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-tea-gold/20 to-transparent mb-10" />

        <div className="text-center max-w-sm mx-auto pb-10">
          <p className="font-serif text-[17px] text-tea-text/40 leading-[1.85] mb-5">
            This archive grows with every session, every conversation, every cup.
          </p>
          {onNavigateToConsult ? (
            <button
              onClick={onNavigateToConsult}
              className={`inline-flex items-center gap-1.5 text-tea-gold text-[13px] font-sans tracking-[0.08em] hover:gap-2.5 transition-all ${CTA_FOCUS}`}
            >
              Share something <Icons.ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="text-tea-gold/50 text-[13px] font-sans">reach out</span>
          )}

          <div className="mt-8 flex items-center justify-center gap-2.5">
            <div className="w-6 h-px bg-tea-gold/15" />
            <span className="text-[9px] font-sans uppercase tracking-[0.25em] text-tea-text/15">
              Teajia
            </span>
            <div className="w-6 h-px bg-tea-gold/15" />
          </div>
        </div>
      </section>
    </div>
  );
};
