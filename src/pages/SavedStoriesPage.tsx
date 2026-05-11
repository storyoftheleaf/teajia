import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icons } from '../components/Icons';
import { api } from '../lib/api';
import type { DbArticle } from '../types';

const STORAGE_KEY = 'teajia_saved_stories';

// Saved story IDs in localStorage correspond to DbArticle.id values. The
// public API exposes articles by slug, but `listPublished` returns the full
// catalogue cheaply, so we fetch once and look up by id locally. Articles
// whose ids are no longer present (deleted, archived) are filtered out
// silently as "no longer available" rows.
function readSavedIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.entries(parsed as Record<string, boolean>)
        .filter(([, v]) => v)
        .map(([k]) => k);
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Pull a 1-line excerpt out of a DbArticle. Prefer the subtitle (always short)
// then blocks_preview (server-side prepared snippet) if available.
function excerptFor(article: DbArticle): string {
  if (article.subtitle && article.subtitle.trim()) return article.subtitle.trim();
  if (article.blocks_preview && article.blocks_preview.trim()) {
    return article.blocks_preview.trim().slice(0, 120);
  }
  return '';
}

interface SavedRow {
  id: string;
  article: DbArticle | null;
}

export default function SavedStoriesPage() {
  const navigate = useNavigate();

  const savedIds = useMemo<string[]>(() => readSavedIds(), []);

  const { data: articles = [], isLoading } = useQuery<DbArticle[]>({
    queryKey: ['public-articles'],
    queryFn: () => api.articles.listPublished(50, 0),
    staleTime: 5 * 60 * 1000,
    enabled: savedIds.length > 0,
  });

  const rows = useMemo<SavedRow[]>(() => {
    if (savedIds.length === 0) return [];
    const byId = new Map(articles.map((a) => [a.id, a] as const));
    return savedIds.map((id) => ({ id, article: byId.get(id) ?? null }));
  }, [savedIds, articles]);

  // Filter out "no longer available" rows silently — they accumulate as
  // articles are unpublished/deleted and would otherwise clutter the list.
  const visibleRows = useMemo(
    () => rows.filter((r) => r.article !== null),
    [rows],
  );

  const showSkeleton = savedIds.length > 0 && isLoading;
  const showEmpty = savedIds.length === 0 || (!isLoading && visibleRows.length === 0);

  return (
    <div className="max-w-sm mx-auto pt-12 pb-nav-gap px-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors mb-8 tap-target"
      >
        <Icons.Back className="w-4 h-4" />
        <span className="text-ui-12 uppercase tracking-[0.15em]">Back</span>
      </button>

      <h1 className="font-display text-3xl text-tea-text mb-1">Saved Stories</h1>
      <p className="font-body italic text-ui-14 text-tea-text-dim mb-8">
        {visibleRows.length} {visibleRows.length === 1 ? 'story' : 'stories'} saved
      </p>

      {showSkeleton ? (
        <div className="border border-tea-border overflow-hidden rounded-md">
          {Array.from({ length: Math.min(savedIds.length, 4) }).map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-3 ${
                i < Math.min(savedIds.length, 4) - 1 ? 'border-b border-tea-border' : ''
              }`}
            >
              <div className="w-12 h-12 rounded bg-tea-surface animate-pulse shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-3 w-3/4 bg-tea-surface animate-pulse rounded" />
                <div className="h-2.5 w-1/2 bg-tea-surface animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : showEmpty ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
            <Icons.Leaf className="w-7 h-7 text-tea-gold/40" />
          </div>
          <h3 className="font-serif text-lg text-tea-text mb-2">No Saved Stories</h3>
          <p className="text-ui-14 text-tea-text-sec text-center max-w-[260px] leading-relaxed">
            Tap the leaf icon while reading to save stories for later.
          </p>
        </div>
      ) : (
        <div className="border border-tea-border overflow-hidden rounded-md">
          {visibleRows.map((row, i) => {
            const a = row.article!;
            const excerpt = excerptFor(a);
            return (
              <button
                key={row.id}
                onClick={() => navigate(`/article/${a.slug}`)}
                className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-tea-surface/50 transition-colors group text-left ${
                  i < visibleRows.length - 1 ? 'border-b border-tea-border' : ''
                }`}
              >
                {a.cover_image_url ? (
                  <img
                    src={a.cover_image_url}
                    alt=""
                    loading="lazy"
                    className="w-12 h-12 rounded object-cover shrink-0 bg-tea-surface"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-tea-surface flex items-center justify-center shrink-0">
                    <Icons.Leaf className="w-4 h-4 text-tea-gold" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-ui-14 text-tea-text group-hover:text-tea-gold transition-colors truncate">
                    {a.title}
                  </div>
                  {excerpt && (
                    <div className="font-body text-ui-12 text-tea-text-sec truncate mt-0.5">
                      {excerpt}
                    </div>
                  )}
                </div>
                <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text-sec shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
