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

type LearnView = 'overview' | 'course' | 'glossary' | 'playlists' | 'videos' | 'visual-guides' | 'journeys' | 'wisdom' | 'spaces';

const CTA_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-2 rounded-md';

const PIN_TYPE_LABELS: Record<string, string> = {
  farm: 'Terroir',
  'tea-house': 'Culture',
  shop: 'Technique',
  space: 'Studio',
};


// ═══════════════════════════════════════════════════════════════
// Curated Unsplash tea photography
// ═══════════════════════════════════════════════════════════════

/** Ink-wash style placeholder, organic, painterly */
const InkWashPlaceholder: React.FC<{ label?: string; aspectRatio?: string; className?: string; mood?: 'warm' | 'cool' | 'neutral' | 'dark' }> = ({
  label,
  aspectRatio = '4/3',
  className = '',
  mood = 'neutral',
}) => {
  const gradients: Record<string, string> = {
    warm: `radial-gradient(ellipse at 20% 50%, rgb(var(--tea-gold-rgb) / 0.12) 0%, transparent 60%),
           radial-gradient(ellipse at 80% 30%, rgb(var(--tea-gold-rgb) / 0.08) 0%, transparent 50%),
           radial-gradient(ellipse at 50% 80%, rgb(var(--tea-gold-rgb) / 0.06) 0%, transparent 40%),
           linear-gradient(160deg, rgb(var(--tea-surface-rgb) / 1) 0%, rgb(var(--tea-surface-rgb) / 0.9) 100%)`,
    cool: `radial-gradient(ellipse at 70% 20%, rgb(var(--tea-gold-rgb) / 0.06) 0%, transparent 50%),
           radial-gradient(ellipse at 30% 70%, rgb(var(--tea-gold-rgb) / 0.04) 0%, transparent 50%),
           linear-gradient(160deg, rgb(var(--tea-surface-rgb) / 1) 0%, rgb(var(--tea-surface-rgb) / 0.92) 100%)`,
    neutral: `radial-gradient(ellipse at 40% 40%, rgb(var(--tea-gold-rgb) / 0.08) 0%, transparent 50%),
              radial-gradient(ellipse at 70% 70%, rgb(var(--tea-gold-rgb) / 0.06) 0%, transparent 50%),
              linear-gradient(160deg, rgb(var(--tea-surface-rgb) / 1) 0%, rgb(var(--tea-surface-rgb) / 0.92) 100%)`,
    dark: `radial-gradient(ellipse at 30% 30%, rgb(var(--tea-gold-rgb) / 0.08) 0%, transparent 50%),
           radial-gradient(ellipse at 70% 60%, rgb(var(--tea-gold-rgb) / 0.05) 0%, transparent 40%),
           linear-gradient(160deg, rgb(var(--tea-bg-rgb) / 1) 0%, rgb(var(--tea-bg-rgb) / 0.95) 100%)`,
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
        <div className="absolute bottom-0 left-0 right-0 p-3 text-tea-text-dim">
          <span className="text-ui-8 font-mono tracking-[0.25em] uppercase">{label}</span>
        </div>
      )}
    </div>
  );
};

/** Section label, serif, editorial, warm gold accent */
const SectionLabel: React.FC<{ children: React.ReactNode; subtitle?: string }> = ({ children, subtitle }) => (
  <div style={{ marginBottom: 'clamp(28px, 3vw, 40px)' }}>
    <h3 className="text-tea-text tracking-[0.01em] leading-[1.2]" style={{ fontSize: 'clamp(20px, 2.5vw + 8px, 28px)', fontFamily: 'var(--font-display)' }}>
      {children}
    </h3>
    {subtitle && (
      <p className="mt-2 font-normal italic text-tea-text-sec leading-[1.6]" style={{ fontSize: 'clamp(13px, 1vw + 8px, 15px)', fontFamily: 'var(--font-body)' }}>
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
  onNavigateToAdvise?: () => void;
}

export const LearnOverview: React.FC<LearnOverviewProps> = ({
  onStoryClick,
  watchedStories,
  onNavigateTo,
  onNavigateToAdvise,
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
    <div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: HERO + EXPLORE (integrated)
          Image, quote, and navigation flow as one opening gesture.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={heroReveal.ref}
        className={`mb-[clamp(5rem,8vw,7rem)] ${heroReveal.className}`}
        style={heroReveal.style}
      >
        {/* Hero image, wide, cinematic */}
        <div className="relative overflow-hidden rounded-[1px]" style={{ marginBottom: 'clamp(20px, 2.5vw, 32px)' }}>
          <InkWashPlaceholder label="tea ceremony" aspectRatio="2.35/1" mood="warm" />
          {/* Quote overlaid at the bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-tea-bg/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0" style={{ padding: 'clamp(16px, 3vw, 32px)' }}>
            <p className="font-normal italic text-tea-gold leading-[1.4] max-w-md" style={{ fontSize: 'clamp(14px, 1.5vw + 6px, 18px)', fontFamily: 'var(--font-body)' }}>
              "Everything I wish someone had given me when I started. Take what you need."
            </p>
            <span className="block mt-2 text-ui-10 font-sans uppercase tracking-[0.15em] text-tea-text-sec">
              Adrian
            </span>
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 'clamp(20px, 2.5vw, 32px)' }}>
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="search terms, courses, resources"
          />
        </div>

        {/* Start Here, new user callout */}
        <div className="mb-5 px-4 py-3.5 rounded-md bg-tea-surface/60 border border-tea-border flex items-start gap-3">
          <span className="text-tea-gold/60 mt-0.5 shrink-0" aria-hidden="true">
            <Icons.Leaf className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-ui-10 uppercase tracking-[0.18em] text-tea-gold/70 mb-1">New here?</p>
            <p className="text-xs text-tea-text-sec leading-relaxed">
              Start with{' '}
              <button onClick={() => onNavigateTo('course')} className="text-tea-text underline underline-offset-2 hover:text-tea-gold transition-colors">Go Deeper</button>
              {' '}for structured lessons, or visit the{' '}
              <button onClick={() => onNavigateTo('glossary')} className="text-tea-text underline underline-offset-2 hover:text-tea-gold transition-colors">Glossary</button>
              {' '}to learn the language of tea.
            </p>
          </div>
        </div>

        {/* Explore, flows directly from the hero, no separator */}
        <div>
          {[
            { id: 'course' as LearnView, label: 'Go Deeper', sub: 'Structured lessons from leaf to cup', icon: <Icons.BookOpen className="w-5 h-5" />, iconColor: 'text-tea-gold/50' },
            { id: 'glossary' as LearnView, label: 'Glossary', sub: 'The language of tea, demystified', icon: <Icons.Book className="w-5 h-5" />, iconColor: 'text-tea-gold/40' },
            { id: 'journeys' as LearnView, label: 'Journeys', sub: 'Guided tastings to shape your palate', icon: <Icons.MapPin className="w-5 h-5" />, iconColor: 'text-tea-gold/40' },
            { id: 'playlists' as LearnView, label: 'Playlists', sub: 'Music for tea time', icon: <Icons.Music className="w-5 h-5" />, iconColor: 'text-tea-gold/35' },
            { id: 'videos' as LearnView, label: 'Videos', sub: 'Watch & learn', icon: <Icons.Film className="w-5 h-5" />, iconColor: 'text-tea-gold/40' },
            { id: 'visual-guides' as LearnView, label: 'Guides', sub: 'Charts & references', icon: <Icons.Download className="w-5 h-5" />, iconColor: 'text-tea-gold/35' },
            { id: 'spaces' as LearnView, label: 'Spaces', sub: 'Inspiration for your tea room', icon: <Icons.Home className="w-5 h-5" />, iconColor: 'text-tea-gold/40' },
          ].map(tile => (
            <button
              key={tile.id}
              onClick={() => onNavigateTo(tile.id)}
              className={`w-full flex items-center py-3.5 px-1 last:shadow-none hover:bg-tea-text/[0.02] transition-colors group text-left ${CTA_FOCUS}`}
              style={{ gap: 'clamp(8px, 1.5vw, 16px)', boxShadow: '0 1px 0 var(--tea-accent-sub)' }}
            >
              <span className={`${tile.iconColor || 'text-tea-gold/40'} group-hover:text-tea-gold/70 transition-colors flex-shrink-0`}>
                {tile.icon}
              </span>
              <span className="flex-1 text-tea-text leading-[1.4] group-hover:text-tea-gold transition-colors" style={{ fontSize: 'clamp(13px, 1.2vw + 8px, 15px)', fontFamily: 'var(--font-display)' }}>
                {tile.label}
              </span>
              <span className="text-tea-text-sec font-sans text-right shrink-0 max-w-[45%] leading-[1.5]" style={{ fontSize: 'clamp(9px, 0.8vw + 5px, 11px)', letterSpacing: 'clamp(0.08em, 0.5vw, 0.15em)' }}>
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
                <span className="text-ui-10 uppercase tracking-[0.15em] text-tea-gold font-sans block mb-2">Courses</span>
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
                <span className="text-ui-10 uppercase tracking-[0.15em] text-tea-gold font-sans block mb-2">Terms</span>
                {searchResults.terms.map(term => (
                  <button
                    key={term.id}
                    onClick={() => { onNavigateTo('glossary'); setSearchQuery(''); }}
                    className={`block w-full text-left py-2 text-sm text-tea-text hover:text-tea-gold transition-colors ${CTA_FOCUS}`}
                  >
                    <span style={{ fontFamily: 'var(--font-display)' }}>{term.term}</span>
                    {term.chineseCharacters && <span className="text-tea-gold/30 ml-2">{term.chineseCharacters}</span>}
                    <span className="text-tea-text/60 ml-2 text-xs">{term.definition.slice(0, 50)}...</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {searchResults === 'empty' && (
          <p className="mt-4 text-sm text-tea-text/60 italic" style={{ fontFamily: 'var(--font-body)' }}>
            Nothing found for &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </section>


      {/* warm divider */}
      <div className="divider-warm mb-[clamp(5rem,8vw,7rem)]" />

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3: GLOSSARY SPOTLIGHT
          The Chinese characters are the hero at massive scale.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={glossaryReveal.ref}
        className={`mb-[clamp(5rem,8vw,7rem)] ${glossaryReveal.className}`}
        style={glossaryReveal.style}
      >
        <SectionLabel subtitle="A new word, each morning">Term of the Day</SectionLabel>

        <button
          onClick={() => onNavigateTo('glossary')}
          className={`w-full text-left group ${CTA_FOCUS}`}
        >
          <CardContainer>
            <div className="relative overflow-hidden">
              {/* Atmospheric gradient, subtle warmth from bottom-left */}
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: `radial-gradient(ellipse at 0% 100%, var(--tea-accent-sub) 0%, transparent 60%)`
              }} />

              <div className="relative" style={{ padding: 'clamp(24px, 4vw, 48px)' }}>
                {/* Category + badge */}
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-ui-10 uppercase tracking-[0.15em] text-tea-gold font-sans border border-tea-border px-2.5 py-1 rounded-md">
                    {GLOSSARY_CATEGORIES[spotlightTerm.category].label}
                  </span>
                </div>

                {/* Term name */}
                <h3 className="text-[clamp(32px,4.8vw,48px)] text-tea-text leading-[1.12] mb-2 tracking-[0.01em]" style={{ fontFamily: 'var(--font-display)' }}>
                  {spotlightTerm.term}
                </h3>

                {spotlightTerm.pronunciation && (
                  <p className="font-mono tabular-nums text-ui-9 text-tea-text-sec mb-6 md:mb-8">
                    /{spotlightTerm.pronunciation}/
                  </p>
                )}

                {/* Definition: Body role */}
                <p className="text-tea-text-sec leading-[1.85] mb-8 max-w-lg" style={{ fontSize: 'clamp(14px, 1.2vw + 8px, 17px)', fontFamily: 'var(--font-body)' }}>
                  {spotlightTerm.definition}
                </p>

                {/* Try This */}
                {spotlightTerm.deepDive?.tryThis?.[0] && (
                  <div className="border-l-2 border-tea-border pl-4 mb-8 max-w-md">
                    <span className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec font-sans block mb-1.5">
                      Try this
                    </span>
                    <p className="text-ui-15 text-tea-text-sec leading-[1.8] font-normal italic" style={{ fontFamily: 'var(--font-body)' }}>
                      {spotlightTerm.deepDive.tryThis[0].description}
                    </p>
                  </div>
                )}

                {/* CTA */}
                <div className="flex items-center gap-6">
                  <span className="text-tea-gold hover:text-tea-gold/80 text-xs uppercase tracking-[0.15em] font-sans flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                    Explore full glossary
                    <Icons.ChevronRight className="w-4 h-4" />
                  </span>
                  <span className="text-tea-text-sec text-ui-9 font-mono tabular-nums">
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
                  <span className="text-sm text-tea-gold/30">{secondTerm.chineseCharacters}</span>
                )}
                <div>
                  <span className="text-sm text-tea-text group-hover:text-tea-gold transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                    {secondTerm.term}
                  </span>
                  <span className="text-xs text-tea-text/60 ml-2">
                    {secondTerm.definition.slice(0, 50)}...
                  </span>
                </div>
              </div>
            </button>
          </div>
        )}
      </section>


      {/* warm divider */}
      <div className="divider-warm mb-[clamp(5rem,8vw,7rem)]" />

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4: CURRICULUM ENTRY
          A doorway, not the room. Shows progress summary, the next module
          to tackle, and a clear CTA into the full curriculum.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={coursesReveal.ref}
        className={`mb-[clamp(5rem,8vw,7rem)] ${coursesReveal.className}`}
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
                className={`w-full text-left group border-b border-tea-border last:border-0 ${CTA_FOCUS}`}
              >
                <div style={{ padding: 'clamp(16px, 2vw, 24px) 0' }}>
                  <div className="flex items-baseline justify-between gap-4 mb-2">
                    <h4 className={`leading-[1.2] tracking-[0.01em] transition-colors ${
                      isNext ? 'text-tea-text group-hover:text-tea-gold' :
                      isDone ? 'text-tea-text/60' :
                      'text-tea-text/70 group-hover:text-tea-gold/80'
                    }`} style={{ fontSize: 'clamp(15px, 1.5vw + 8px, 19px)', fontFamily: 'var(--font-display)' }}>
                      {mod.title}
                    </h4>
                    <Icons.ChevronRight className={`w-4 h-4 flex-shrink-0 transition-all ${
                      isNext ? 'text-tea-gold/40 group-hover:text-tea-gold group-hover:translate-x-0.5' :
                      'text-tea-text/30 group-hover:text-tea-gold/40'
                    }`} />
                  </div>
                  <p className={`font-normal italic leading-[1.8] ${
                    isDone ? 'text-tea-text-sec/80' : 'text-tea-text-sec'
                  }`} style={{ fontSize: 'clamp(13px, 1vw + 7px, 15px)', fontFamily: 'var(--font-body)' }}>
                    {mod.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>


      {/* warm divider */}
      <div className="divider-warm mb-[clamp(5rem,8vw,7rem)]" />

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5: RESOURCES & TOOLS (moved up from original position)
          Refined grid. The cards are dark, the layout is tight.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={resourcesReveal.ref}
        className={`mb-[clamp(5rem,8vw,7rem)] ${resourcesReveal.className}`}
        style={resourcesReveal.style}
      >
        <SectionLabel subtitle="References, music, and visual guides">Resources & Tools</SectionLabel>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(clamp(120px, 18vw, 160px), 100%), 1fr))', gap: 'clamp(10px, 1.5vw, 16px)' }}>
          {[
            { id: 'playlists' as LearnView, label: 'Playlists', subtitle: 'Music for tea time', icon: <Icons.Music className="w-5 h-5" /> },
            { id: 'videos' as LearnView, label: 'Videos', subtitle: 'Watch & learn', icon: <Icons.Film className="w-5 h-5" /> },
            { id: 'visual-guides' as LearnView, label: 'Visual Guides', subtitle: 'Charts & references', icon: <Icons.Download className="w-5 h-5" /> },
            { id: 'spaces' as LearnView, label: 'Tea Spaces', subtitle: 'Design inspiration', icon: <Icons.Home className="w-5 h-5" /> },
            { id: 'glossary' as LearnView, label: 'Glossary', subtitle: `${counts.glossary} terms`, icon: <Icons.BookOpen className="w-5 h-5" /> },
          ].map(tile => (
            <button
              key={tile.id}
              onClick={() => onNavigateTo(tile.id)}
              className={`text-left group ${CTA_FOCUS}`}
            >
              <div className="h-full bg-tea-surface rounded-md border border-tea-border hover:border-tea-gold/30 transition-colors duration-200" style={{ padding: 'clamp(14px, 2vw, 24px)' }}>
                <span className="text-tea-gold/30 mb-4 block group-hover:text-tea-gold/50 transition-colors">
                  {tile.icon}
                </span>
                <h4 className="text-tea-text leading-[1.2] mb-1 group-hover:text-tea-gold transition-colors" style={{ fontSize: 'clamp(13px, 1vw + 7px, 15px)', fontFamily: 'var(--font-display)' }}>
                  {tile.label}
                </h4>
                <p className="text-tea-text-sec font-sans uppercase leading-[1.4]" style={{ fontSize: 'clamp(8px, 0.6vw + 4px, 10px)', letterSpacing: 'clamp(0.12em, 0.5vw, 0.2em)' }}>
                  {tile.subtitle}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>


      {/* warm divider */}
      <div className="divider-warm mb-[clamp(5rem,8vw,7rem)]" />

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 6: ATLAS & PLACES
          Location cards with real photography.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={atlasReveal.ref}
        className={`mb-[clamp(5rem,8vw,7rem)] ${atlasReveal.className}`}
        style={atlasReveal.style}
      >
        <SectionLabel subtitle="Tea locations, farms, and cultural landmarks across Asia">Places</SectionLabel>

        <SwipeCarousel
          itemWidth="clamp(160px, 28vw, 220px)"
          gap="clamp(8px, 1.5vw, 14px)"
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
              <div className="relative overflow-hidden rounded-[1px] border border-tea-border hover:border-tea-gold/30 transition-colors duration-200">
                {/* Location placeholder */}
                <InkWashPlaceholder label={pin.name} aspectRatio="4/3" mood={i % 2 === 0 ? 'warm' : 'cool'} />

                <div className="p-4 bg-tea-bg">
                  <span className="inline-block text-ui-9 uppercase tracking-[0.15em] text-tea-gold/70 font-sans mb-2">
                    {PIN_TYPE_LABELS[pin.type] || pin.type}
                  </span>
                  <h4 className="text-sm text-tea-text leading-tight mb-0.5 group-hover:text-tea-gold transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                    {pin.name}
                  </h4>
                  <p className="text-ui-11 text-tea-text/60 font-sans">
                    {pin.location}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </SwipeCarousel>
      </section>


      {/* warm divider */}
      <div className="divider-warm mb-[clamp(5rem,8vw,7rem)]" />

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 7: TEA SPACE TEASER
          Warm, aspirational. Real photo.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={spacesReveal.ref}
        className={`mb-[clamp(5rem,8vw,7rem)] ${spacesReveal.className}`}
        style={spacesReveal.style}
      >
        <button
          onClick={() => onNavigateTo('spaces')}
          className={`w-full text-left group ${CTA_FOCUS}`}
        >
          <div className="overflow-hidden rounded-[1px] border border-transparent">
            {/* Atmospheric placeholder */}
            <InkWashPlaceholder label="tea space" aspectRatio="21/9" mood="warm" />

            {/* Content below image */}
            <div className="bg-tea-bg" style={{ padding: 'clamp(16px, 2.5vw, 28px)' }}>
              <span className="inline-block text-ui-9 uppercase tracking-[0.15em] text-tea-gold/70 font-sans mb-3">
                {SPACE_TYPE_LABELS[featuredSpace.spaceType]}
              </span>
              <h4 className="text-tea-text mb-2 group-hover:text-tea-gold transition-colors tracking-tight" style={{ fontSize: 'clamp(16px, 1.5vw + 8px, 20px)', fontFamily: 'var(--font-display)' }}>
                {featuredSpace.title}
              </h4>
              <p className="italic text-sm text-tea-text/70 leading-relaxed mb-4 max-w-md" style={{ fontFamily: 'var(--font-body)' }}>
                {featuredSpace.description}
              </p>
              <span className="text-tea-gold hover:text-tea-gold/80 text-xs uppercase tracking-[0.15em] font-sans flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                See all {counts.spaces} spaces
                <Icons.ChevronRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        </button>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 8: CLOSING
          A colophon. Adrian's signature. Generous final breath.
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={closingReveal.ref}
        className={`${closingReveal.className}`}
        style={closingReveal.style}
      >
        <div className="divider-warm mb-10" />

        <div
          className="inset-panel"
          style={{
            padding: 'clamp(28px, 4vw, 48px)',
            // Darker than the default warm text-overlay so the panel reads as a
            // recessed well, not a muddy lighter box against the page.
            background: 'rgb(0 0 0 / 0.22)',
          }}
        >
          <div className="text-center max-w-sm mx-auto">
            <p className="text-ui-15 md:text-ui-17 text-tea-text/70 leading-[1.85] mb-5" style={{ fontFamily: 'var(--font-body)' }}>
              This archive grows with every session, every conversation, every cup.
            </p>
            {onNavigateToAdvise ? (
              <button
                onClick={onNavigateToAdvise}
                className={`inline-flex items-center gap-1.5 text-tea-gold hover:text-tea-gold/80 text-xs uppercase tracking-[0.15em] font-sans hover:gap-2.5 transition-all ${CTA_FOCUS}`}
              >
                Share something <Icons.ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="text-tea-gold/50 text-ui-13 font-sans">reach out</span>
            )}

            <div className="mt-8 flex items-center justify-center gap-2.5">
              <div className="w-6 h-px bg-tea-gold/15" />
              <span className="text-ui-9 font-sans uppercase tracking-[0.25em] text-tea-text/40">
                Teajia
              </span>
              <div className="w-6 h-px bg-tea-gold/15" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
