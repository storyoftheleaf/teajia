import React, { useState, useMemo } from 'react';
import { Icons } from './Icons';
import { CardContainer } from './shared/CardContainer';
import { ArticleCard } from './shared/ArticleCard';
import { SwipeCarousel } from './shared/SwipeCarousel';
import { TeaGlossary } from './TeaGlossary';
import { LEARN_CURRICULUM } from '../constants';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LibraryItem {
  id: string;
  title: string;
  description: string;
  type: 'glossary' | 'guide' | 'playlist' | 'reference' | 'article';
  imageUrl?: string;
}

interface LearnLibraryProps {
  watchedStories: Record<string, boolean>;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const GUIDES: LibraryItem[] = [
  { id: 'br1', title: 'Gongfu Brewing Essentials', description: 'Complete guide to traditional gongfu brewing', type: 'guide' },
  { id: 'br2', title: 'Water Temperature Chart', description: 'Downloadable PDF with optimal temperatures by tea type', type: 'guide' },
  { id: 'br3', title: 'Leaf-to-Water Ratios', description: 'Quick reference for proportions and timing', type: 'guide' },
  { id: 'br4', title: 'Teaware Care & Maintenance', description: 'How to properly care for your brewing vessels', type: 'guide' },
  { id: 'br5', title: 'Flavor Development Guide', description: 'How brewing parameters affect taste', type: 'guide' },
];

const MUSIC: LibraryItem[] = [
  { id: 'p1', title: 'Ambient Tea Hour', description: 'Gentle instrumental music for relaxed tea tasting', type: 'playlist' },
  { id: 'p2', title: 'Traditional Instruments', description: 'Chinese classical and traditional music', type: 'playlist' },
  { id: 'p3', title: 'Meditation & Mindfulness', description: 'Music for focused tea ceremony practice', type: 'playlist' },
  { id: 'p4', title: 'Nature & Water Sounds', description: 'Flowing water and forest sounds for serene moments', type: 'playlist' },
];

const VIDEOS: LibraryItem[] = [
  { id: 'v1', title: 'Tea Processing in the Field', description: 'Visual journey through harvest and initial processing', type: 'playlist' },
  { id: 'v2', title: 'Master Tea Makers at Work', description: 'Artisans demonstrating traditional techniques', type: 'playlist' },
  { id: 'v3', title: 'Tasting Explorations', description: 'Guided tastings with flavor analysis', type: 'playlist' },
  { id: 'v4', title: 'Tea House Architecture & Design', description: 'Beautiful tea spaces from around the world', type: 'playlist' },
];

const ARTICLES: LibraryItem[] = [
  { id: 'a1', title: 'Getting Started with Tea', description: 'A beginner\'s guide to entering the tea world', type: 'article', imageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=530&fit=crop' },
  { id: 'a2', title: 'Building Your First Collection', description: 'How to start curating a meaningful tea collection', type: 'article', imageUrl: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&h=530&fit=crop' },
  { id: 'a3', title: 'The Philosophy of Slow Tea', description: 'Understanding tea as a mindfulness practice', type: 'article', imageUrl: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400&h=530&fit=crop' },
  { id: 'a4', title: 'Tea and Community', description: 'Exploring tea as a social and cultural practice', type: 'article', imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=530&fit=crop' },
];

const REFERENCE: LibraryItem[] = [
  { id: 'r1', title: 'Tasting Notes Worksheet', description: 'Printable template for recording observations', type: 'reference' },
  { id: 'r2', title: 'Tea Region Map', description: 'Major tea-producing regions worldwide', type: 'reference' },
  { id: 'r3', title: 'Collection Organization', description: 'Spreadsheet for tracking your collection', type: 'reference' },
  { id: 'r4', title: 'Brewing Experiment Journal', description: 'Guided journal for brewing experiments', type: 'reference' },
];

// Flat lookup for "Picked for You" resolution
const ALL_ITEMS: Record<string, LibraryItem> = {};
[...GUIDES, ...MUSIC, ...VIDEOS, ...ARTICLES, ...REFERENCE].forEach(item => {
  ALL_ITEMS[item.id] = item;
});

// Module ID → suggested library item IDs
const MODULE_TO_LIBRARY: Record<string, string[]> = {
  'm1': ['a1', 'br1', 'p1'],
  'm2': ['br2', 'br3', 'br5'],
  'm3': ['r2', 'v1', 'a4'],
  'm4': ['p3', 'a3', 'r4'],
  'm5': ['br4', 'r1', 'v4'],
  'm6': ['a4', 'v3', 'p4'],
};

const GETTING_STARTED = ['a1', 'br1', 'p1'];

const TYPE_COLORS: Record<string, string> = {
  glossary: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-400/30 dark:border-blue-400/40',
  playlist: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-400/30 dark:border-purple-400/40',
  guide: 'bg-tea-green/10 dark:bg-green-500/20 text-tea-green dark:text-green-300 border border-tea-green/30 dark:border-green-400/40',
  reference: 'bg-orange-500/10 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-400/30 dark:border-orange-400/40',
  article: 'bg-pink-500/10 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 border border-pink-400/30 dark:border-pink-400/40',
};

// Reference icons for each item in the 2x2 grid
const REFERENCE_ICONS: Record<string, React.ReactNode> = {
  'r1': <Icons.Book className="w-6 h-6" />,
  'r2': <Icons.Location className="w-6 h-6" />,
  'r3': <Icons.Grid className="w-6 h-6" />,
  'r4': <Icons.Book className="w-6 h-6" />,
};

// ─── Section Header ──────────────────────────────────────────────────────────

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}> = ({ icon, title, subtitle, action }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-3">
      <div className="text-tea-gold">{icon}</div>
      <div>
        <h3 className="text-xs uppercase tracking-[0.2em] text-tea-text/70 font-sans font-medium">
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm text-tea-text/50 font-serif italic mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
    {action && (
      <button onClick={action.onClick} className="flex items-center gap-1.5 text-tea-gold text-xs uppercase tracking-wider hover:gap-2.5 transition-all">
        <span>{action.label}</span>
        <Icons.Next className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

// ─── Component ───────────────────────────────────────────────────────────────

export const LearnLibrary: React.FC<LearnLibraryProps> = ({ watchedStories }) => {
  const [glossaryExpanded, setGlossaryExpanded] = useState(false);

  const getTypeColor = (type: string) => TYPE_COLORS[type] || 'bg-white/10 text-tea-paper/50';

  // Resolve "Picked for You" items based on course progress
  const pickedForYou = useMemo(() => {
    // Check for the most advanced completed module
    for (let i = LEARN_CURRICULUM.length - 1; i >= 0; i--) {
      const module = LEARN_CURRICULUM[i];
      const allComplete = module.lessons.every(l => watchedStories[l.id]);
      if (allComplete && MODULE_TO_LIBRARY[module.id]) {
        return MODULE_TO_LIBRARY[module.id].map(id => ALL_ITEMS[id]).filter(Boolean).slice(0, 3);
      }
    }
    // Fallback: any module with progress
    for (const module of LEARN_CURRICULUM) {
      const hasProgress = module.lessons.some(l => watchedStories[l.id]);
      if (hasProgress && MODULE_TO_LIBRARY[module.id]) {
        return MODULE_TO_LIBRARY[module.id].map(id => ALL_ITEMS[id]).filter(Boolean).slice(0, 3);
      }
    }
    // No progress: getting started defaults
    return GETTING_STARTED.map(id => ALL_ITEMS[id]).filter(Boolean);
  }, [watchedStories]);

  const hasProgress = Object.values(watchedStories).some(Boolean);

  return (
    <div className="max-w-4xl mx-auto px-2 md:px-0 animate-[fadeIn_0.3s_ease-out]">

      {/* ═══ PICKED FOR YOU ═══ */}
      <section className="mb-10">
        <SectionHeader
          icon={<Icons.Star className="w-4 h-4" />}
          title="Picked for You"
          subtitle={hasProgress ? 'Based on your learning progress' : 'Great starting points for your journey'}
        />
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          {pickedForYou.map(item => (
            <div key={item.id} className="min-w-[200px] max-w-[240px] shrink-0 cursor-pointer">
              <CardContainer variant="dark" className="hover:-translate-y-0.5 transition-all h-full">
                <div className="p-4">
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm ${getTypeColor(item.type)}`}>
                    {item.type}
                  </span>
                  <h4 className="font-serif text-base text-tea-text mt-2 mb-1">{item.title}</h4>
                  <p className="text-xs text-tea-text/60 line-clamp-2">{item.description}</p>
                </div>
              </CardContainer>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ GLOSSARY ═══ */}
      <section className="mb-10">
        <SectionHeader
          icon={<Icons.Book className="w-4 h-4" />}
          title="Tea Glossary"
          subtitle="Essential terms and definitions"
          action={glossaryExpanded ? { label: 'Collapse', onClick: () => setGlossaryExpanded(false) } : undefined}
        />
        <TeaGlossary
          initialTermCount={glossaryExpanded ? undefined : 3}
          isFullView={glossaryExpanded}
          onExpandClick={() => setGlossaryExpanded(true)}
        />
      </section>

      {/* ═══ BREWING GUIDES ═══ */}
      <section className="mb-10">
        <SectionHeader
          icon={<Icons.Download className="w-4 h-4" />}
          title="Brewing Guides"
          subtitle="Quick reference PDFs and charts"
        />
        <div className="flex flex-col divide-y divide-tea-border">
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
      </section>

      {/* ═══ MUSIC PLAYLISTS ═══ */}
      <section className="mb-10">
        <SectionHeader
          icon={<Icons.Music className="w-4 h-4" />}
          title="Music Playlists"
          subtitle="Curated audio for your tea experience"
        />
        <SwipeCarousel itemWidth={220} gap={12} showArrows={true} showDots={false} peek={2}>
          {MUSIC.map(item => (
            <CardContainer key={item.id} variant="dark" className="w-[220px] cursor-pointer hover:-translate-y-0.5 transition-all">
              <div className="p-4">
                <div className="w-10 h-10 rounded-sm bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center mb-3">
                  <Icons.Music className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h4 className="font-serif text-sm text-tea-text mb-1">{item.title}</h4>
                <p className="text-xs text-tea-text/50 line-clamp-2 mb-3">{item.description}</p>
                <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-300 text-xs font-medium">
                  <Icons.Play className="w-3.5 h-3.5" />
                  <span>Listen</span>
                </div>
              </div>
            </CardContainer>
          ))}
        </SwipeCarousel>
      </section>

      {/* ═══ VIDEO COLLECTIONS ═══ */}
      <section className="mb-10">
        <SectionHeader
          icon={<Icons.Play className="w-4 h-4" />}
          title="Video Collections"
          subtitle="Educational and inspirational tea content"
        />
        <SwipeCarousel itemWidth={220} gap={12} showArrows={true} showDots={false} peek={2}>
          {VIDEOS.map(item => (
            <CardContainer key={item.id} variant="dark" className="w-[220px] cursor-pointer hover:-translate-y-0.5 transition-all">
              <div className="p-4">
                <div className="w-10 h-10 rounded-sm bg-tea-text/10 flex items-center justify-center mb-3">
                  <Icons.Play className="w-5 h-5 text-tea-text/60" />
                </div>
                <h4 className="font-serif text-sm text-tea-text mb-1">{item.title}</h4>
                <p className="text-xs text-tea-text/50 line-clamp-2 mb-3">{item.description}</p>
                <div className="flex items-center gap-1.5 text-tea-gold text-xs font-medium">
                  <Icons.Play className="w-3.5 h-3.5" />
                  <span>Watch</span>
                </div>
              </div>
            </CardContainer>
          ))}
        </SwipeCarousel>
      </section>

      {/* ═══ ARTICLES ═══ */}
      <section className="mb-10">
        <SectionHeader
          icon={<Icons.BookOpen className="w-4 h-4" />}
          title="Useful Articles"
          subtitle="Essays and guides for tea newcomers"
        />
        <div className="grid grid-cols-2 gap-4">
          {ARTICLES.map(item => (
            <ArticleCard
              key={item.id}
              title={item.title}
              description={item.description}
              imageUrl={item.imageUrl}
              aspectRatio="portrait"
            />
          ))}
        </div>
      </section>

      {/* ═══ REFERENCE TOOLS ═══ */}
      <section className="mb-10">
        <SectionHeader
          icon={<Icons.Grid className="w-4 h-4" />}
          title="Reference Tools"
          subtitle="Worksheets, maps, and templates"
        />
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
      </section>

    </div>
  );
};
