import React, { useState, useMemo } from 'react';
import { useStories } from '../context/StoryContext';
import { useInventory } from '../context/InventoryContext';
import { Story } from '../types';
import { Icons } from './Icons';
import { LEARN_CURRICULUM } from '../constants';

import { CardContainer } from './shared/CardContainer';
import { ArticleCard } from './shared/ArticleCard';
import { PageHeader } from './shared/PageHeader';
import { EmailCapture } from './EmailCapture';

import { useSectionReveal } from '../hooks/useSectionReveal';
import { useAdminOverlay } from '../hooks/useAdminOverlay';
import { SECTION_GAP } from './shared/spacing';
import { fmtPricePerGram } from '../utils/formatNumber';

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
  const { isAdmin, productMap, updateProduct } = useAdminOverlay();
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
          <div className="w-8 h-[1px] bg-tea-gold/30" />
          <p className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-tea-gold/70 font-sans">
            {currentInsight.label}
          </p>
        </div>

        <h2 className="font-serif text-2xl md:text-4xl lg:text-4xl font-light text-tea-text mb-3 md:mb-5 leading-[1.2] max-w-3xl">
          {currentInsight.insight}
        </h2>

        <p className="text-sm md:text-base text-tea-text/60 leading-relaxed max-w-2xl mb-5">
          {currentInsight.detail}
        </p>

        <div className="w-8 h-[1px] bg-tea-gold/30 mb-3" />
        <div className="flex flex-wrap items-center gap-2 text-xs text-tea-text/35 font-sans">
          <span>Magazine</span>
          <span className="w-1 h-1 rounded-full bg-tea-text/20/20" />
          <span>Courses</span>
          <span className="w-1 h-1 rounded-full bg-tea-text/20/20" />
          <span>Shop</span>
          <span className="w-1 h-1 rounded-full bg-tea-text/20/20" />
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
              <h2 className="font-serif text-xl md:text-2xl font-normal text-tea-text">
                Latest
              </h2>
              <p className="text-[9px] font-mono text-tea-text/30 uppercase tracking-wider mt-0.5">
                Updated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
            <button
              onClick={() => onNavigateToSection('MAGAZINE')}
              className="text-tea-gold-dark hover:text-tea-gold text-xs uppercase tracking-[0.15em] font-medium flex items-center gap-1 transition-colors duration-300"
            >
              All
              <Icons.ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Unified grid — same ArticleCard format as Magazine */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {latestStories.slice(0, 4).map((story) => (
              <ArticleCard
                key={story.id}
                title={story.title}
                description={story.subtitle}
                imageUrl={story.thumbnailUrl}
                aspectRatio="portrait"
                onClick={() => handleCardClick(story)}
                contentType={story.type}
                duration={story.durationOrTime}
              />
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
          className={`${SECTION_GAP} border-l-2 border-tea-gold/60 pl-6 md:pl-8 py-6 md:py-8 bg-tea-gold/[0.03] ${quoteReveal.className}`}
          style={quoteReveal.style}
        >
          <p className="font-serif text-lg md:text-xl text-tea-text/80 leading-relaxed italic mb-3" style={{ fontFamily: "var(--font-display)" }}>
            &ldquo;{pullQuote.description}&rdquo;
          </p>
          <p className="text-xs uppercase tracking-[0.15em] text-tea-text/40 font-sans">
            &mdash; From &ldquo;{pullQuote.title}&rdquo;
          </p>
        </section>
      )}

      {/* ============================================
          Section 3: Learn — curiosity hook, compact
          ============================================ */}
      <section
        ref={learnReveal.ref}
        className={`${SECTION_GAP} inset-panel p-6 md:p-10 ${learnReveal.className}`}
        style={learnReveal.style}
      >
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-tea-gold-dark font-sans">
              From the curriculum
            </p>
            <p className="text-[9px] font-mono text-tea-text/30 uppercase tracking-wider mt-0.5">
              {LEARN_CURRICULUM.length} modules available
            </p>
          </div>
          <button
            onClick={() => onNavigateToSection('LEARN')}
            className="text-tea-gold-dark hover:text-tea-gold text-xs uppercase tracking-[0.15em] font-medium flex items-center gap-1 transition-colors duration-300"
          >
            All courses
            <Icons.ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <h2 className="font-serif text-xl md:text-2xl font-normal text-tea-text mb-3 max-w-lg leading-snug">
          Why does the same tea taste different in porcelain and clay?
        </h2>
        <p className="text-sm text-tea-text/60 max-w-md">
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
              <p className="text-xs uppercase tracking-[0.2em] text-tea-gold-dark font-sans">
                {season} pick
              </p>
              <p className="text-[9px] font-mono text-tea-text/30 uppercase tracking-wider mt-0.5">
                {season} {new Date().getFullYear()}
              </p>
            </div>
            <button
              onClick={() => onNavigateToSection('SHOP')}
              className="text-tea-gold-dark hover:text-tea-gold text-xs uppercase tracking-[0.15em] font-medium flex items-center gap-1 transition-colors duration-300"
            >
              Shop
              <Icons.ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-5 md:gap-8 items-start relative inset-panel p-4 md:p-6">
            <CardContainer variant="dark" className="w-32 md:w-48 lg:w-56 flex-shrink-0 overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(200,170,120,0.06)' }}>
              <div className="aspect-square overflow-hidden">
                <img
                  src={curatedTea.image}
                  alt={curatedTea.name}
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  loading="lazy"
                />
              </div>
            </CardContainer>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="text-xl md:text-2xl text-tea-text mb-1" style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}>
                {curatedTea.name}
              </h3>
              <p className="text-xs text-tea-text/40 uppercase tracking-wider mb-3">
                {curatedTea.type} · {curatedTea.origin}
              </p>
              <p className="text-sm text-tea-text/70 leading-relaxed line-clamp-3 mb-2">
                {curatedTea.description}
              </p>
              <p className="text-xs text-tea-gold/70 italic font-serif mb-2">
                {SEASONAL_REASONS[season]}
              </p>
              {curatedTea.price_per_gram && (
                <p className="text-xs text-tea-text/50 font-sans">
                  {fmtPricePerGram(parseFloat(curatedTea.price_per_gram))}
                </p>
              )}

              {/* Admin: featured & visibility toggles */}
              {isAdmin && productMap.has(curatedTea.id) && (() => {
                const ap = productMap.get(curatedTea.id)!;
                return (
                  <div className="flex items-center gap-3 mt-3 pt-3" style={{ boxShadow: 'inset 0 1px 0 rgba(184,146,78,0.06)' }}>
                    <button
                      onClick={() => updateProduct(curatedTea.id, { is_featured: !ap.isFeatured })}
                      className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest transition-colors ${ap.isFeatured ? 'text-tea-gold' : 'text-tea-text/30 hover:text-tea-text/60'}`}
                      title={ap.isFeatured ? 'Remove from featured' : 'Mark as featured'}
                    >
                      <Icons.Star className="w-3 h-3" />
                      Featured
                    </button>
                    <button
                      onClick={() => updateProduct(curatedTea.id, { is_public: !ap.isPublic })}
                      className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest transition-colors ${ap.isPublic ? 'text-tea-gold' : 'text-tea-text/30 hover:text-tea-text/60'}`}
                      title={ap.isPublic ? 'Hide from public' : 'Make public'}
                    >
                      {ap.isPublic ? <Icons.Eye className="w-3 h-3" /> : <Icons.EyeSlash className="w-3 h-3" />}
                      {ap.isPublic ? 'Public' : 'Hidden'}
                    </button>
                    <span className="text-[10px] font-mono text-tea-text/25 ml-auto">
                      {ap.stockGrams}g
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        </section>
      )}

      {/* ============================================
          Section 5: Space Design — single line, not cinematic
          ============================================ */}
      <section
        ref={consultReveal.ref}
        className={`${SECTION_GAP} py-6 md:py-10 ${consultReveal.className}`}
        style={consultReveal.style}
      >
        <div className="divider-warm mb-6 md:mb-10" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-tea-gold-dark font-sans mb-2">
              Design &amp; Curation
            </p>
            <p className="text-lg md:text-xl text-tea-text" style={{ fontFamily: "var(--font-display)", fontWeight: 300 }}>
              We design tea spaces — from a quiet corner to a full room
            </p>
          </div>
          <button
            onClick={() => onNavigateToSection('OFFERINGS')}
            className="text-tea-gold-dark hover:text-tea-gold text-xs uppercase tracking-[0.15em] font-medium flex items-center gap-1 transition-colors duration-300 flex-shrink-0"
          >
            Learn more
            <Icons.ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="divider-warm mt-6 md:mt-10" />
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
