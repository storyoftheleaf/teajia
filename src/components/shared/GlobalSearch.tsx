import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icons } from '../Icons';
import { useStories } from '../../context/StoryContext';
import { useInventory } from '../../context/InventoryContext';
import { ContentType } from '../../types';
import { api } from '../../lib/api';

// ── Result types ──────────────────────────────────────────────

interface SearchResult {
  id: string;
  type: 'product' | 'article' | 'story' | 'dbarticle' | 'event';
  title: string;
  subtitle: string;
  category?: string;
  image?: string;
  action: () => void;
}

interface DbArticleLite {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  excerpt?: string;
  hero_image?: string;
  published_at?: string;
}

interface PublicEventLite {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  starts_at?: string;
  hero_image?: string;
  venue_name?: string;
}

// ── Component ─────────────────────────────────────────────────

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { stories } = useStories();
  const { inventory } = useInventory();

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      // Delay focus slightly for animation
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Cmd/Ctrl+K to open, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  // Published stories only (legacy localStorage source)
  const publishedStories = useMemo(
    () => stories.filter(s => s.status === 'published'),
    [stories]
  );

  // Pull live data sources from React Query — these reuse the cache populated
  // by Magazine + Events pages, so opening search doesn't trigger duplicate
  // network requests on warm caches.
  const { data: dbArticlesRaw } = useQuery({
    queryKey: ['articles', 'published', 'search'],
    queryFn: () => api.articles.listPublished(50, 0),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen,
  });
  const dbArticles: DbArticleLite[] = useMemo(() => {
    const d: any = dbArticlesRaw;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    return (d.articles || []) as DbArticleLite[];
  }, [dbArticlesRaw]);

  const { data: publicEventsRaw } = useQuery({
    queryKey: ['events', 'public', 'search'],
    queryFn: () => api.events.listPublic(),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen,
  });
  const publicEvents: PublicEventLite[] = useMemo(() => {
    const d: any = publicEventsRaw;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    return (d.events || []) as PublicEventLite[];
  }, [publicEventsRaw]);

  // Build fuse indexes
  const productFuse = useMemo(
    () =>
      new Fuse(inventory, {
        keys: [
          { name: 'name', weight: 2 },
          { name: 'variant', weight: 1.5 },
          { name: 'type', weight: 1 },
          { name: 'description', weight: 0.5 },
          { name: 'tags', weight: 0.8 },
        ],
        threshold: 0.35,
        includeScore: true,
        ignoreLocation: true,
      }),
    [inventory]
  );

  const storyFuse = useMemo(
    () =>
      new Fuse(publishedStories, {
        keys: [
          { name: 'title', weight: 2 },
          { name: 'subtitle', weight: 1 },
          { name: 'description', weight: 0.5 },
        ],
        threshold: 0.35,
        includeScore: true,
        ignoreLocation: true,
      }),
    [publishedStories]
  );

  const dbArticleFuse = useMemo(
    () =>
      new Fuse(dbArticles, {
        keys: [
          { name: 'title', weight: 2 },
          { name: 'subtitle', weight: 1 },
          { name: 'excerpt', weight: 0.5 },
        ],
        threshold: 0.35,
        includeScore: true,
        ignoreLocation: true,
      }),
    [dbArticles]
  );

  const eventFuse = useMemo(
    () =>
      new Fuse(publicEvents, {
        keys: [
          { name: 'title', weight: 2 },
          { name: 'subtitle', weight: 1 },
          { name: 'description', weight: 0.5 },
          { name: 'venue_name', weight: 0.8 },
        ],
        threshold: 0.35,
        includeScore: true,
        ignoreLocation: true,
      }),
    [publicEvents]
  );

  const navigateAndClose = useCallback(
    (path: string) => {
      navigate(path);
      onClose();
    },
    [navigate, onClose]
  );

  // Search results
  const results: SearchResult[] = useMemo(() => {
    if (!query.trim()) return [];

    const productHits = productFuse.search(query, { limit: 5 }).map(r => {
      const item = r.item;
      return {
        id: `product-${item.id}`,
        type: 'product' as const,
        title: item.name,
        subtitle: [item.variant, item.type, item.origin].filter(Boolean).join(' · '),
        category: item.category === 'ware' ? 'Teaware' : item.type,
        image: item.image,
        // Open the specific product via Shop's ?product=<id> modal flow
        // (handled by useProductUrl in TeaInventory/TeawareCatalog/CollectionTab).
        action: () => navigateAndClose(`/shop?product=${encodeURIComponent(item.id)}`),
      };
    });

    const storyHits = storyFuse.search(query, { limit: 5 }).map(r => {
      const story = r.item;
      const storyType =
        story.type === ContentType.Article
          ? 'article'
          : 'story';
      return {
        id: `story-${story.id}`,
        type: storyType as 'article' | 'story',
        title: story.title,
        subtitle: story.subtitle || story.description?.slice(0, 80) || '',
        category: story.type === ContentType.Article ? 'Article' : story.type === ContentType.PhotoEssay ? 'Photo Essay' : story.type,
        image: story.thumbnailUrl,
        // Navigate to /magazine to set section context, then dispatch the
        // existing openArticle CustomEvent that App.tsx listens for — same
        // contract used by AlcoveCard's "From the journal" links.
        action: () => {
          navigate('/magazine');
          window.dispatchEvent(new CustomEvent('openArticle', { detail: { story } }));
          onClose();
        },
      };
    });

    const dbArticleHits = dbArticleFuse.search(query, { limit: 5 }).map(r => {
      const a = r.item;
      return {
        id: `dbarticle-${a.id}`,
        type: 'dbarticle' as const,
        title: a.title,
        subtitle: a.subtitle || a.excerpt?.slice(0, 80) || '',
        category: 'Article',
        image: a.hero_image,
        action: () => navigateAndClose(`/magazine/${encodeURIComponent(a.slug)}`),
      };
    });

    const eventHits = eventFuse.search(query, { limit: 5 }).map(r => {
      const ev = r.item;
      return {
        id: `event-${ev.id}`,
        type: 'event' as const,
        title: ev.title,
        subtitle: [ev.subtitle, ev.venue_name].filter(Boolean).join(' . ') || ev.description?.slice(0, 80) || '',
        category: 'Session',
        image: ev.hero_image,
        action: () => navigateAndClose(`/events/${encodeURIComponent(ev.slug)}`),
      };
    });

    return [...productHits, ...dbArticleHits, ...storyHits, ...eventHits];
  }, [query, productFuse, storyFuse, dbArticleFuse, eventFuse, navigateAndClose, navigate, onClose]);

  // Group results by type. Legacy localStorage Stories are surfaced under their
  // own heading so it is clear they aren't synced with the server.
  const groupedResults = useMemo(() => {
    const groups: { label: string; items: SearchResult[] }[] = [];
    const products = results.filter(r => r.type === 'product');
    const dbArticles = results.filter(r => r.type === 'dbarticle');
    const stories = results.filter(r => r.type === 'story' || r.type === 'article');
    const events = results.filter(r => r.type === 'event');

    if (products.length > 0) groups.push({ label: 'Products', items: products });
    if (dbArticles.length > 0) groups.push({ label: 'Articles', items: dbArticles });
    if (events.length > 0) groups.push({ label: 'Sessions', items: events });
    if (stories.length > 0) groups.push({ label: 'Journal (saved on this device)', items: stories });
    return groups;
  }, [results]);

  // Keyboard navigation
  const [activeIndex, setActiveIndex] = useState(-1);
  useEffect(() => { setActiveIndex(-1); }, [query]);

  const flatResults = useMemo(() => groupedResults.flatMap(g => g.items), [groupedResults]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && flatResults[activeIndex]) {
      e.preventDefault();
      flatResults[activeIndex].action();
    }
  };

  const typeBadgeColor = (type: string) => {
    switch (type) {
      case 'product': return 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40';
      case 'event': return 'bg-tea-gold/10 text-tea-text-sec';
      default: return 'bg-tea-accent-sub text-tea-text-sec';
    }
  };

  let flatIndex = -1;

  return (
    <AnimatePresence>
    {isOpen && (
    <div
      className="fixed inset-0 z-modal flex items-start justify-center pt-[15vh] px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-tea-bg/80 backdrop-blur-sm" />

      {/* Modal */}
      <motion.div
        className="relative w-full max-w-lg bg-tea-elevated border border-tea-border rounded-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: -24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.98, transition: { duration: 0.15, ease: 'easeOut' } }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-tea-gold/30 ring-1 ring-tea-gold/20">
          <Icons.Search className="w-5 h-5 text-tea-gold/60 shrink-0 transition-colors duration-300" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search teas, articles, and more..."
            className="flex-1 bg-transparent text-tea-text placeholder:text-tea-text-sec text-sm outline-none font-sans transition-all duration-300"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-ui-10 text-tea-text-sec border border-tea-border rounded font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto pb-[calc(52px+env(safe-area-inset-bottom,0px))] lg:pb-4">
          {query.trim() === '' && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-tea-text-sec">Start typing to search teas, articles, and more</p>
            </div>
          )}

          {query.trim() !== '' && results.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-tea-text-sec">
                Nothing matched — try different words.
              </p>
            </div>
          )}

          {groupedResults.map(group => (
            <div key={group.label}>
              <div className="px-4 pt-3 pb-1">
                <span className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec font-sans font-medium">
                  {group.label}
                </span>
              </div>
              {group.items.map(item => {
                flatIndex++;
                const isActive = flatIndex === activeIndex;
                const idx = flatIndex; // capture for hover
                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 ${
                      isActive ? 'bg-tea-gold/10' : 'hover:bg-tea-gold/10'
                    }`}
                  >
                    {/* Thumbnail */}
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        className="w-9 h-9 rounded object-cover shrink-0 border border-tea-border"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded bg-tea-surface border border-tea-border flex items-center justify-center shrink-0">
                        {item.type === 'product' ? (
                          <Icons.Bag className="w-4 h-4 text-tea-text-sec" />
                        ) : (
                          <Icons.Book className="w-4 h-4 text-tea-text-sec" />
                        )}
                      </div>
                    )}

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-tea-text truncate">{item.title}</p>
                      <p className="text-xs text-tea-text-sec truncate">{item.subtitle}</p>
                    </div>

                    {/* Category badge */}
                    {item.category && (
                      <span className={`text-ui-11 uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${typeBadgeColor(item.type)}`}>
                        {item.category}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-tea-border flex items-center gap-4 text-ui-11 text-tea-text-sec font-sans">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 border border-tea-border rounded font-mono">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 border border-tea-border rounded font-mono">↵</kbd> select
            </span>
          </div>
        )}
      </motion.div>
    </div>
    )}
    </AnimatePresence>
  );
};
