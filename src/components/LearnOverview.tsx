import React, { useMemo, useState, useRef, useCallback } from 'react';
import { Story } from '../types';
import { Icons } from './Icons';
import { CardContainer } from './shared/CardContainer';
import { SearchInput } from './shared/SearchInput';
import { CategoryPills } from './shared/CategoryPills';
import { FeaturedCard } from './shared/FeaturedCard';
import { TermPreviewList } from './shared/TermPreviewList';
import { useSectionReveal } from '../hooks/useSectionReveal';
import { LEARN_CURRICULUM } from '../constants';
import { GLOSSARY_TERMS, GLOSSARY_CATEGORIES } from '../data/glossary';
import { teaMapPins } from '../data/teaMapPins';

// Extended view type matching LearnHub's navigation
type LearnView = 'overview' | 'course' | 'glossary' | 'playlists' | 'videos' | 'visual-guides' | 'reading' | 'journeys' | 'wisdom' | 'spaces';

const CTA_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 focus-visible:ring-offset-2 rounded-sm';

// Category pills for in-page navigation
const ARCHIVE_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'courses', label: 'Courses' },
  { id: 'journeys', label: 'Journeys' },
  { id: 'glossary', label: 'Glossary' },
  { id: 'resources', label: 'Resources' },
];

// Curated glossary terms matching the Stitch design
const FEATURED_TERM_IDS = ['gongfu', 'gaiwan', 'cha-qi', 'huigan', 'yixing'];

// Resource grid card definitions — archival styling
const RESOURCE_CARDS: { id: string; label: string; subtitle: string; icon: React.ReactNode; view: LearnView }[] = [
  { id: 'glossary', label: 'Glossary', subtitle: 'Tea terminology', icon: <Icons.BookOpen className="w-5 h-5" />, view: 'glossary' },
  { id: 'playlists', label: 'Playlists', subtitle: 'Music for tea time', icon: <Icons.Music className="w-5 h-5" />, view: 'playlists' },
  { id: 'videos', label: 'Videos', subtitle: 'Watch & learn', icon: <Icons.Film className="w-5 h-5" />, view: 'videos' },
  { id: 'visual-guides', label: 'Visual Guides', subtitle: 'Charts & references', icon: <Icons.Download className="w-5 h-5" />, view: 'visual-guides' },
  { id: 'reading', label: 'Reading', subtitle: 'Books & articles', icon: <Icons.Book className="w-5 h-5" />, view: 'reading' },
  { id: 'spaces', label: 'Tea Spaces', subtitle: 'Design inspiration', icon: <Icons.Home className="w-5 h-5" />, view: 'spaces' },
];

// Atlas card type mapping from teaMapPin types
const PIN_TYPE_LABELS: Record<string, string> = {
  farm: 'Terroir',
  'tea-house': 'Culture',
  shop: 'Technique',
  space: 'Studio',
};

// Selected pins for atlas cards
const ATLAS_PINS = [
  teaMapPins.find(p => p.id === 'pin-3')!, // Wuyi Origin — farm
  teaMapPins.find(p => p.id === 'pin-4')!, // Sueyoshi Ceramics — shop
];

/** Molecular/polyphenol structure diagram — inline SVG */
const MolecularDiagram: React.FC = () => (
  <div className="flex flex-col items-center w-full">
    <span className="text-[9px] font-mono tracking-[0.2em] text-tea-paper/30 mb-3">
      Fig 1.2 — Polyphenol Structure
    </span>
    <svg viewBox="0 0 180 140" className="w-full max-w-[200px]" aria-hidden="true">
      {/* Connecting lines */}
      <line x1="90" y1="20" x2="50" y2="50" stroke="rgba(201,148,58,0.25)" strokeWidth="1" />
      <line x1="90" y1="20" x2="130" y2="50" stroke="rgba(201,148,58,0.25)" strokeWidth="1" />
      <line x1="50" y1="50" x2="30" y2="90" stroke="rgba(201,148,58,0.25)" strokeWidth="1" />
      <line x1="50" y1="50" x2="90" y2="80" stroke="rgba(201,148,58,0.25)" strokeWidth="1" />
      <line x1="130" y1="50" x2="90" y2="80" stroke="rgba(201,148,58,0.25)" strokeWidth="1" />
      <line x1="130" y1="50" x2="155" y2="85" stroke="rgba(201,148,58,0.25)" strokeWidth="1" />
      <line x1="90" y1="80" x2="70" y2="120" stroke="rgba(201,148,58,0.25)" strokeWidth="1" />
      <line x1="90" y1="80" x2="120" y2="115" stroke="rgba(201,148,58,0.25)" strokeWidth="1" />
      {/* Nodes */}
      <circle cx="90" cy="20" r="6" fill="#c9943a" />
      <circle cx="50" cy="50" r="5" fill="#c9943a" opacity="0.8" />
      <circle cx="130" cy="50" r="5" fill="#c9943a" opacity="0.8" />
      <circle cx="30" cy="90" r="4" fill="#c9943a" opacity="0.6" />
      <circle cx="90" cy="80" r="7" fill="#c9943a" />
      <circle cx="155" cy="85" r="3.5" fill="#c9943a" opacity="0.5" />
      <circle cx="70" cy="120" r="4" fill="#c9943a" opacity="0.6" />
      <circle cx="120" cy="115" r="4.5" fill="#c9943a" opacity="0.7" />
    </svg>
    {/* Comparison bar */}
    <div className="mt-4 w-full max-w-[200px]">
      <span className="text-[8px] font-mono tracking-[0.3em] text-tea-paper/25 block mb-1.5">
        Comparing
      </span>
      <div className="flex items-center gap-2 text-[10px] text-tea-paper/50 font-mono">
        <span className="whitespace-nowrap">Theaflavin-3</span>
        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full w-3/5 bg-gradient-to-r from-tea-seal/60 to-tea-seal/20 rounded-full" />
        </div>
        <span className="whitespace-nowrap">Oxidized</span>
      </div>
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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Section refs for pill navigation
  const coursesRef = useRef<HTMLDivElement>(null);
  const journeysRef = useRef<HTMLDivElement>(null);
  const glossaryRef = useRef<HTMLDivElement>(null);
  const resourcesRef = useRef<HTMLDivElement>(null);

  const headerReveal = useSectionReveal();
  const featuredReveal = useSectionReveal();
  const twoColReveal = useSectionReveal();
  const coursesReveal = useSectionReveal();
  const resourcesReveal = useSectionReveal();

  // Module completion tracking
  const moduleCompletion = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const mod of LEARN_CURRICULUM) {
      map[mod.id] = mod.lessons.every(l => watchedStories[l.id]);
    }
    return map;
  }, [watchedStories]);

  // First incomplete module for featured card
  const featuredModule = useMemo(() => {
    return LEARN_CURRICULUM.find(mod => !moduleCompletion[mod.id]) || LEARN_CURRICULUM[0];
  }, [moduleCompletion]);

  // Find first incomplete lesson in a module
  const getModuleTarget = (mod: typeof LEARN_CURRICULUM[0]) => {
    return mod.lessons.find(l => !watchedStories[l.id]) || mod.lessons[0];
  };

  // Lesson l3-1 for atlas card navigation
  const geographyLesson = useMemo(() => {
    const m3 = LEARN_CURRICULUM.find(m => m.id === 'm3');
    return m3?.lessons.find(l => l.id === 'l3-1') || LEARN_CURRICULUM[0].lessons[0];
  }, []);

  // Glossary terms for preview
  const previewTerms = useMemo(() => {
    return FEATURED_TERM_IDS
      .map(id => GLOSSARY_TERMS.find(t => t.id === id))
      .filter(Boolean)
      .map(t => ({
        id: t!.id,
        term: t!.term,
        definition: t!.definition,
        categoryLabel: GLOSSARY_CATEGORIES[t!.category].label,
      }));
  }, []);

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

    const resources = RESOURCE_CARDS.filter(
      r => r.label.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q)
    );

    if (courses.length === 0 && terms.length === 0 && resources.length === 0) return 'empty';
    return { courses, terms, resources };
  }, [searchQuery]);

  // Pill navigation
  const handleCategorySelect = useCallback((id: string) => {
    setActiveCategory(id);
    const refMap: Record<string, React.RefObject<HTMLDivElement | null>> = {
      courses: coursesRef,
      journeys: journeysRef,
      glossary: glossaryRef,
      resources: resourcesRef,
    };
    const ref = refMap[id];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <div className="pb-32">
      {/* ════════════════════════════════════════════════════════════════
          Archive Header — title, search, category pills
          ════════════════════════════════════════════════════════════════ */}
      <section
        ref={headerReveal.ref}
        className={`mb-8 md:mb-12 ${headerReveal.className}`}
        style={headerReveal.style}
      >
        <h2 className="font-serif italic text-3xl md:text-4xl font-light text-tea-ink dark:text-tea-paper mb-2 leading-tight">
          The Archive
        </h2>
        <p className="text-sm text-tea-ink/50 dark:text-tea-paper/50 mb-6 max-w-xl leading-relaxed">
          Explore the ancient art and science of tea. From foundational knowledge
          to the diverse profiles that grace cups worldwide.
        </p>

        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search index..."
          className="mb-4"
        />

        <CategoryPills
          categories={ARCHIVE_CATEGORIES}
          activeId={activeCategory}
          onSelect={handleCategorySelect}
        />

        {/* Search results dropdown */}
        {searchResults && searchResults !== 'empty' && (
          <div className="mt-4 bg-tea-paper dark:bg-tea-ink border border-tea-ink/10 dark:border-white/10 rounded-[1px] p-4 space-y-4">
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
          <p className="mt-4 text-sm text-tea-ink/40 dark:text-tea-paper/40 italic">
            No results for &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════
          Featured Study — large dark card with molecular diagram
          ════════════════════════════════════════════════════════════════ */}
      <section
        ref={featuredReveal.ref}
        className={`mb-12 md:mb-16 ${featuredReveal.className}`}
        style={featuredReveal.style}
      >
        <FeaturedCard
          badge="Featured Study"
          title={featuredModule.title}
          description={featuredModule.description}
          ctaLabel="Access Study"
          onCtaClick={() => onStoryClick(getModuleTarget(featuredModule))}
          decorativeElement={<MolecularDiagram />}
          metadata={[
            { label: 'Module', value: featuredModule.subtitle.replace('Module ', '') },
            { label: 'Lessons', value: `${featuredModule.lessons.length}` },
          ]}
        />
      </section>

      {/* ════════════════════════════════════════════════════════════════
          Two-column: Recently Indexed (atlas cards) + Glossary of Terms
          ════════════════════════════════════════════════════════════════ */}
      <section
        ref={(el) => {
          glossaryRef.current = el;
          journeysRef.current = el;
          (twoColReveal.ref as React.MutableRefObject<HTMLElement | null>).current = el;
        }}
        className={`mb-12 md:mb-20 lg:mb-24 grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-8 md:gap-10 ${twoColReveal.className}`}
        style={twoColReveal.style}
      >
        {/* LEFT — Recently Indexed */}
        <div>
          <h3 className="font-serif text-lg md:text-xl font-normal text-tea-ink dark:text-tea-paper mb-5">
            Recently Indexed
          </h3>
          <div className="space-y-3">
            {ATLAS_PINS.map(pin => (
              <button
                key={pin.id}
                onClick={() => onStoryClick(geographyLesson)}
                className={`w-full text-left group ${CTA_FOCUS}`}
              >
                <CardContainer variant="dark" className="hover:-translate-y-0.5 transition-all">
                  <div
                    className="relative p-5 min-h-[120px] flex flex-col justify-between overflow-hidden"
                  >
                    {/* Subtle topographic texture */}
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
                      <h4 className="font-serif text-base text-tea-paper leading-tight mb-1 group-hover:text-tea-seal transition-colors">
                        {pin.name}
                      </h4>
                      <p className="text-xs text-tea-paper/40 font-sans">
                        {pin.location}
                      </p>
                    </div>
                  </div>
                </CardContainer>
              </button>
            ))}
          </div>
          <button
            onClick={() => onNavigateTo('journeys')}
            className={`mt-4 text-tea-seal-dark dark:text-tea-seal text-sm font-sans flex items-center gap-1 hover:opacity-80 transition-opacity ${CTA_FOCUS}`}
          >
            View all journeys
            <Icons.ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* RIGHT — Glossary of Terms */}
        <div>
          <h3 className="font-serif text-lg md:text-xl font-normal text-tea-ink dark:text-tea-paper mb-5">
            Glossary of Terms
          </h3>
          <TermPreviewList
            terms={previewTerms}
            onViewAll={() => onNavigateTo('glossary')}
          />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          Course Index — archival catalog style
          ════════════════════════════════════════════════════════════════ */}
      <section
        ref={(el) => {
          coursesRef.current = el;
          (coursesReveal.ref as React.MutableRefObject<HTMLElement | null>).current = el;
        }}
        className={`mb-12 md:mb-20 lg:mb-24 ${coursesReveal.className}`}
        style={coursesReveal.style}
      >
        <div className="flex items-baseline justify-between mb-5">
          <h3 className="font-serif text-lg md:text-xl font-normal text-tea-ink dark:text-tea-paper">
            Course Index
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
                      <span className="text-[11px] text-tea-ink/35 dark:text-tea-paper/35 font-sans mt-0.5 block">
                        {mod.description.slice(0, 60)}...
                      </span>
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

      {/* ════════════════════════════════════════════════════════════════
          Resources & Tools — dark archival index cards
          ════════════════════════════════════════════════════════════════ */}
      <section
        ref={(el) => {
          resourcesRef.current = el;
          (resourcesReveal.ref as React.MutableRefObject<HTMLElement | null>).current = el;
        }}
        className={`mb-16 ${resourcesReveal.className}`}
        style={resourcesReveal.style}
      >
        <h3 className="font-serif text-lg md:text-xl font-normal text-tea-ink dark:text-tea-paper mb-5">
          Resources & Tools
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {RESOURCE_CARDS.map(card => (
            <button
              key={card.id}
              onClick={() => onNavigateTo(card.view)}
              className={`text-left group ${CTA_FOCUS}`}
            >
              <div className="h-full bg-tea-ink dark:bg-white/[0.04] rounded-[1px] border border-tea-ink/80 dark:border-white/8 p-4 md:p-5 hover:border-tea-seal/30 hover:-translate-y-0.5 transition-all duration-300">
                <span className="text-tea-paper/30 dark:text-tea-paper/30 mb-3 block">
                  {card.icon}
                </span>
                <h4 className="font-serif text-sm text-tea-paper leading-snug mb-0.5 group-hover:text-tea-seal transition-colors">
                  {card.label}
                </h4>
                <p className="text-[10px] text-tea-paper/35 font-sans">
                  {card.subtitle}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
