import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icons } from '../components/Icons';
import { api } from '../lib/api';
import type { DbArticle } from '../types';

interface ProgressEntry {
  storyId: string;
  page: number;
}

interface HistoryRow {
  entry: ProgressEntry;
  article: DbArticle | null;
}

// Reader.tsx (legacy magazine reader) saves progress under
// `teajia_progress_${story.id}` where story.id is the DbArticle.id. We pair
// each entry against the published article catalogue to render real metadata.
function readProgressEntries(): ProgressEntry[] {
  const entries: ProgressEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('teajia_progress_')) {
        const storyId = key.replace('teajia_progress_', '');
        const raw = localStorage.getItem(key);
        if (raw) {
          const page = parseInt(raw, 10);
          if (!isNaN(page)) entries.push({ storyId, page });
        }
      }
    }
  } catch {
    /* localStorage unavailable — return what we have */
  }
  return entries;
}

function excerptFor(article: DbArticle): string {
  if (article.subtitle && article.subtitle.trim()) return article.subtitle.trim();
  if (article.blocks_preview && article.blocks_preview.trim()) {
    return article.blocks_preview.trim().slice(0, 120);
  }
  return '';
}

export default function ReadingHistoryPage() {
  const navigate = useNavigate();

  const history = useMemo<ProgressEntry[]>(() => readProgressEntries(), []);

  const { data: articles = [], isLoading } = useQuery<DbArticle[]>({
    queryKey: ['public-articles'],
    queryFn: () => api.articles.listPublished(50, 0),
    staleTime: 5 * 60 * 1000,
    enabled: history.length > 0,
  });

  const rows = useMemo<HistoryRow[]>(() => {
    if (history.length === 0) return [];
    const byId = new Map(articles.map((a) => [a.id, a] as const));
    return history.map((entry) => ({ entry, article: byId.get(entry.storyId) ?? null }));
  }, [history, articles]);

  // Silently drop entries for articles that no longer exist.
  const visibleRows = useMemo(() => rows.filter((r) => r.article !== null), [rows]);

  const showSkeleton = history.length > 0 && isLoading;
  const showEmpty = history.length === 0 || (!isLoading && visibleRows.length === 0);

  return (
    <div className="max-w-sm mx-auto pt-12 pb-nav-gap px-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors mb-8 tap-target"
      >
        <Icons.Back className="w-4 h-4" />
        <span className="text-ui-12 uppercase tracking-[0.15em]">Back</span>
      </button>

      <h1 className="font-display text-3xl text-tea-text mb-1">Reading History</h1>
      <p className="font-body italic text-ui-14 text-tea-text-dim mb-8">
        {visibleRows.length} {visibleRows.length === 1 ? 'article' : 'articles'} in progress
      </p>

      {showSkeleton ? (
        <div className="border border-tea-border overflow-hidden rounded-md">
          {Array.from({ length: Math.min(history.length, 4) }).map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-3 ${
                i < Math.min(history.length, 4) - 1 ? 'border-b border-tea-border' : ''
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
            <Icons.BookOpen className="w-7 h-7 text-tea-gold/40" />
          </div>
          <h3 className="font-serif text-lg text-tea-text mb-2">No Reading History</h3>
          <p className="text-ui-14 text-tea-text-sec text-center max-w-[260px] leading-relaxed">
            Your reading progress will appear here as you explore articles.
          </p>
        </div>
      ) : (
        <div className="border border-tea-border overflow-hidden rounded-md">
          {visibleRows.map((row, i) => {
            const a = row.article!;
            const excerpt = excerptFor(a);
            // TODO: ArticlePage does not currently accept `?page=N` for
            // deep-linking into a specific reader page. When that lands, change
            // the target to `/article/${a.slug}?page=${row.entry.page}` so we
            // resume at the saved page instead of relying on the reader's own
            // localStorage restore. Out of scope for this PR.
            return (
              <button
                key={row.entry.storyId}
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
                    <Icons.BookOpen className="w-4 h-4 text-tea-text-sec" />
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
                  <div className="text-ui-10 text-tea-text-sec mt-0.5">
                    Page {row.entry.page + 1}
                  </div>
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
