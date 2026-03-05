import React, { useState, useMemo } from 'react';
import { useStories } from '../context/StoryContext';
import { useInventory } from '../context/InventoryContext';
import { Story } from '../types';
import { Icons } from './Icons';
import { Card } from './Card';
import { LEARN_CURRICULUM } from '../constants';

import { CardContainer } from './shared/CardContainer';
import { PageHeader } from './shared/PageHeader';
import { EmailCapture } from './EmailCapture';

import { useSectionReveal } from '../hooks/useSectionReveal';
import { SECTION_GAP } from './shared/spacing';

const TEA_INSIGHTS = [
  {
    label: 'Brewing',
    insight: 'Water temperature is the difference between bitter and transcendent.',
    detail: 'Green teas at 80\u00B0C whisper. The same leaf at 95\u00B0C roars.',
  },
  {
    label: 'Material Science',
    insight: 'The same tea tastes different in porcelain and clay.',
    detail: 'Porosity, heat retention, and surface \u2014 your vessel shapes the leaf.',
  },
  {
    label: 'Terroir',
    insight: 'Tea is agriculture, not commodity.',
    detail: 'Every harvest is shaped by rainfall, soil, and the farmer\u2019s decision to pick early or wait.',
  },
  {
    label: 'Processing',
    insight: 'Oxidation is controlled decay \u2014 and it\u2019s beautiful.',
    detail: 'Green to black isn\u2019t a product line \u2014 it\u2019s a time spectrum.',
  },
  {
    label: 'Culture',
    insight: 'A gaiwan is not a teapot. It\u2019s a conversation.',
    detail: 'The lidded bowl invites you to observe every stage: leaf expansion, color shift, steam rise.',
  },
];

const SEASONAL_REASONS: Record<string, string> = {
  Spring: 'Chosen for its bright, fresh character that mirrors the season\u2019s first growth.',
  Summer: 'Chosen for its cooling clarity \u2014 light-bodied and refreshing in the heat.',
  Autumn: 'Chosen for its layered warmth \u2014 roasted notes that match shorter days.',
  Winter: 'Chosen for its deep, warming body \u2014 rich and grounding when the cold sets in.',
};

interface HomePageProps {
  onNavigateToSection: (section: 'MAGAZINE' | 'LEARN' | 'SHOP', magazineTab?: 'articles' | 'visual' | 'tea-inspire') => void;
  savedStoryIds?: Record<string, boolean>;
  watchedStoryIds?: Record<string, boolean>;
  onCardClick?: (story: Story) => void;
  onToggleSave?: (id: string) => void;
  onShare?: (story: Story) => void;
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
}

function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Autumn';
  return 'Winter';
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToSection,
  savedStoryIds = {},
  watchedStoryIds = {},
  onCardClick,
  onToggleSave,
  onShare,
  onCartClick,
  onAccountClick,
  cartItemCount = 0,
}) => {
  const { stories } = useStories();
  const { inventory } = useInventory();
  const season = getCurrentSeason();

  // Random tea insight on mount
  const [currentInsight] = useState(() =>
    TEA_INSIGHTS[Math.floor(Math.random() * TEA_INSIGHTS.length)]
  );

  // Latest published stories — 2 for mobile, 3 for desktop
  const latestStories = useMemo(() => {
    return stories
      .filter(s => s.status === 'published')
      .sort((a, b) => {
        if (a.publishedDate && b.publishedDate) {
          return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
        }
        return 0;
      })
      .slice(0, 6);
  }, [stories]);

  // Pull quote — random story with a description
  const pullQuote = useMemo(() => {
    const withDesc = stories.filter(s => s.status === 'published' && s.description);
    if (!withDesc.length) return null;
    return withDesc[Math.floor(Math.random() * withDesc.length)];
  }, [stories]);

  // Single curated tea pick
  const curatedTea = useMemo(() => {
    return inventory.filter(i => i.category === 'tea')[0] || null;
  }, [inventory]);

  const handleCardClick = (story: Story) => {
    if (onCardClick) onCardClick(story);
  };

  const identityReveal = useSectionReveal();
  const storiesReveal = useSectionReveal();
  const quoteReveal = useSectionReveal();
  const learnReveal = useSectionReveal();
  const pickReveal = useSectionReveal();
  const consultReveal = useSectionReveal();
  const connectReveal = useSectionReveal();

  return (
    <div className="animate-[fadeIn_0.6s_ease-out] pb-24 md:pb-24 max-w-[1400px] mx-auto">

      {/* Mobile PageHeader — matches other sections */}
      <div className="lg:hidden">
        <PageHeader
          title="Home"
          onCartClick={onCartClick}
          onAccountClick={onAccountClick}
          cartItemCount={cartItemCount}
        />
      </div>

      {/* ============================================
          Section 1: Identity — educational tea insight
          Rotating on each visit. Teaches, then describes.
          ============================================ */}
      <section
        ref={identityReveal.ref}
        className={`${SECTION_GAP} pt-4 md:pt-8 lg:pt-0 ${identityReveal.className}`}
        style={identityReveal.style}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-[1px] bg-tea-seal/30" />
          <p className="text-[10px] md:text-xs uppercase tracking-[0.35em] text-tea-seal/70 font-sans">
            {currentInsight.label}
          </p>
        </div>

        <h2 className="font-serif text-2xl md:text-4xl lg:text-5xl font-light text-tea-ink dark:text-tea-paper mb-3 md:mb-5 leading-[1.2] max-w-3xl">
          {currentInsight.insight}
        </h2>

        <p className="text-sm md:text-base text-tea-ink/60 dark:text-tea-paper/60 leading-relaxed max-w-2xl mb-5">
          {currentInsight.detail}
        </p>

        <div className="w-8 h-[1px] bg-tea-seal/30 mb-3" />
        <div className="flex flex-wrap items-center gap-2 text-xs text-tea-ink/35 dark:text-tea-paper/35 font-sans">
          <span>Magazine</span>
          <span className="w-1 h-1 rounded-full bg-tea-ink/20 dark:bg-tea-paper/20" />
          <span>Courses</span>
          <span className="w-1 h-1 rounded-full bg-tea-ink/20 dark:bg-tea-paper/20" />
          <span>Shop</span>
          <span className="w-1 h-1 rounded-full bg-tea-ink/20 dark:bg-tea-paper/20" />
          <span>Space Design</span>
        </div>
      </section>

      {/* ============================================
          Section 2: Latest Stories
          2 on mobile (clean 2-col), 3 on desktop
          ============================================ */}
      {latestStories.length > 0 && (
        <section
          ref={storiesReveal.ref}
          className={`${SECTION_GAP} ${storiesReveal.className}`}
          style={storiesReveal.style}
        >
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h2 className="font-serif text-xl md:text-2xl font-normal text-tea-ink dark:text-tea-paper">
                Latest
              </h2>
              <p className="text-[9px] font-mono text-tea-ink/30 dark:text-tea-paper/30 uppercase tracking-wider mt-0.5">
                Updated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
            <button
              onClick={() => onNavigateToSection('MAGAZINE')}
              className="text-tea-seal-dark dark:text-tea-seal hover:opacity-80 text-xs uppercase tracking-widest font-medium flex items-center gap-1 transition-colors duration-300"
            >
              All
              <Icons.ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile: 2-col, exactly 2 stories — staggered entrance */}
          <div className="md:hidden grid grid-cols-2 gap-3">
            {latestStories.slice(0, 2).map((story, index) => (
              <button
                key={story.id}
                onClick={() => handleCardClick(story)}
                className="text-left group animate-[fadeIn_0.4s_ease-out]"
                style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}
              >
                <CardContainer variant="dark" className="overflow-hidden p-1.5">
                  <div className="aspect-[3/4] overflow-hidden relative">
                    <img
                      src={story.thumbnailUrl}
                      alt={story.title}
                      className="w-full h-full object-cover sepia-[0.15] brightness-[0.9] group-hover:sepia-0 group-hover:brightness-100 transition-all duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  </div>
                </CardContainer>
                <div className="pt-2 px-0.5">
                  <h3 className="font-serif text-sm text-tea-ink dark:text-tea-paper leading-snug mb-0.5 group-hover:text-tea-seal transition-colors duration-300 line-clamp-2">
                    {story.title}
                  </h3>
                  <p className="text-[10px] text-tea-ink/50 dark:text-tea-paper/50 uppercase tracking-wider font-sans truncate">
                    {story.subtitle}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Desktop: 3-column grid */}
          <div className="hidden md:grid md:grid-cols-3 gap-5">
            {latestStories.slice(0, 3).map((story) => (
              <div key={story.id}>
                <Card
                  story={story}
                  onClick={handleCardClick}
                  isSaved={savedStoryIds[story.id]}
                  isWatched={watchedStoryIds[story.id]}
                  onToggleSave={onToggleSave}
                  onShare={onShare}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============================================
          Pull Quote — rotating editorial excerpt
          ============================================ */}
      {pullQuote && (
        <section
          ref={quoteReveal.ref}
          className={`${SECTION_GAP} border-l-2 border-tea-seal pl-6 md:pl-8 ${quoteReveal.className}`}
          style={quoteReveal.style}
        >
          <p className="font-serif text-lg md:text-xl text-tea-ink/80 dark:text-tea-paper/80 leading-relaxed italic mb-3">
            &ldquo;{pullQuote.description}&rdquo;
          </p>
          <p className="text-xs uppercase tracking-widest text-tea-ink/40 dark:text-tea-paper/40 font-sans">
            &mdash; From &ldquo;{pullQuote.title}&rdquo;
          </p>
        </section>
      )}

      {/* ============================================
          Section 3: Learn — curiosity hook, compact
          ============================================ */}
      <section
        ref={learnReveal.ref}
        className={`${SECTION_GAP} bg-white/50 dark:bg-white/5 p-6 md:p-10 rounded-lg ${learnReveal.className}`}
        style={learnReveal.style}
      >
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-tea-seal-dark dark:text-tea-seal font-sans">
              From the curriculum
            </p>
            <p className="text-[9px] font-mono text-tea-ink/30 dark:text-tea-paper/30 uppercase tracking-wider mt-0.5">
              {LEARN_CURRICULUM.length} modules available
            </p>
          </div>
          <button
            onClick={() => onNavigateToSection('LEARN')}
            className="text-tea-seal-dark dark:text-tea-seal hover:opacity-80 text-xs uppercase tracking-widest font-medium flex items-center gap-1 transition-colors duration-300"
          >
            All courses
            <Icons.ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <h2 className="font-serif text-xl md:text-2xl font-normal text-tea-ink dark:text-tea-paper mb-3 max-w-lg leading-snug">
          Why does the same tea taste different in porcelain and clay?
        </h2>
        <p className="text-sm text-tea-ink/60 dark:text-tea-paper/60 max-w-md">
          Material, heat, and surface — the science behind what your vessel does to the leaf.
        </p>
      </section>

      {/* ============================================
          Section 4: Seasonal Pick — compact, editorial
          ============================================ */}
      {curatedTea && (
        <section
          ref={pickReveal.ref}
          className={`${SECTION_GAP} ${pickReveal.className}`}
          style={pickReveal.style}
        >
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-tea-seal-dark dark:text-tea-seal font-sans">
                {season} pick
              </p>
              <p className="text-[9px] font-mono text-tea-ink/30 dark:text-tea-paper/30 uppercase tracking-wider mt-0.5">
                {season} {new Date().getFullYear()}
              </p>
            </div>
            <button
              onClick={() => onNavigateToSection('SHOP')}
              className="text-tea-seal-dark dark:text-tea-seal hover:opacity-80 text-xs uppercase tracking-widest font-medium flex items-center gap-1 transition-colors duration-300"
            >
              Shop
              <Icons.ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-5 md:gap-8 items-start">
            <CardContainer variant="dark" className="w-32 md:w-48 flex-shrink-0 overflow-hidden">
              <div className="aspect-square overflow-hidden">
                <img
                  src={curatedTea.image}
                  alt={curatedTea.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </CardContainer>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="font-serif text-xl md:text-2xl text-tea-ink dark:text-tea-paper mb-1">
                {curatedTea.name}
              </h3>
              <p className="text-xs text-tea-ink/40 dark:text-tea-paper/40 uppercase tracking-wider mb-3">
                {curatedTea.type} · {curatedTea.origin}
              </p>
              <p className="text-sm text-tea-ink/70 dark:text-tea-paper/70 leading-relaxed line-clamp-3 mb-2">
                {curatedTea.description}
              </p>
              <p className="text-xs text-tea-seal/70 italic font-serif mb-2">
                {SEASONAL_REASONS[season]}
              </p>
              {curatedTea.price_per_gram && (
                <p className="text-xs text-tea-ink/50 dark:text-tea-paper/50 font-sans">
                  ${parseFloat(curatedTea.price_per_gram).toFixed(2)}/g
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ============================================
          Section 5: Space Design — single line, not cinematic
          ============================================ */}
      <section
        ref={consultReveal.ref}
        className={`${SECTION_GAP} border-t border-b border-tea-ink/10 dark:border-white/10 py-6 md:py-10 ${consultReveal.className}`}
        style={consultReveal.style}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-tea-seal-dark dark:text-tea-seal font-sans mb-2">
              Design &amp; Curation
            </p>
            <p className="font-serif text-lg md:text-xl text-tea-ink dark:text-tea-paper">
              We design tea spaces — from a quiet corner to a full room
            </p>
          </div>
          <button
            onClick={() => onNavigateToSection('OFFERINGS')}
            className="text-tea-seal-dark dark:text-tea-seal hover:opacity-80 text-xs uppercase tracking-widest font-medium flex items-center gap-1 transition-colors duration-300 flex-shrink-0"
          >
            Learn more
            <Icons.ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* ============================================
          Section 6: Email — earned by now, compact
          ============================================ */}
      <section
        ref={connectReveal.ref}
        className={`${SECTION_GAP} ${connectReveal.className}`}
        style={connectReveal.style}
      >
        <EmailCapture
          heading="Get the next story first"
          subtitle="New writing, seasonal teas, and course updates — delivered when there's something worth sharing."
        />
      </section>

    </div>
  );
};
