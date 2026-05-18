import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Loader2, RefreshCw, FileText } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../components/Toast';
import { ArticleEditorModal } from '../components/ArticleEditorModal';
import { STATUS_PILL_STYLES } from '../constants';
import type { DbArticle } from '../../types';

type TabFilter = 'all' | 'draft' | 'published';

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const MagazineView: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabFilter>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<DbArticle | null>(null);
  const [loadingArticleId, setLoadingArticleId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['admin-articles'],
    queryFn: () => api.articles.list(),
    select: (d: any) => (Array.isArray(d) ? d : d?.articles ?? []) as DbArticle[],
  });

  const articles = data ?? [];

  const filtered = tab === 'all'
    ? articles
    : articles.filter(a => a.status === tab);

  const handleNewArticle = () => {
    setEditingArticle(null);
    setEditorOpen(true);
  };

  const handleRowClick = async (article: DbArticle) => {
    setLoadingArticleId(article.id);
    try {
      const fullArticle = await api.articles.get(article.id) as DbArticle;
      setEditingArticle(fullArticle);
      setEditorOpen(true);
    } catch (err) {
      console.error('Failed to load article for editing:', err);
      showToast('Could not load the full article.', 'error');
    } finally {
      setLoadingArticleId(null);
    }
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setEditingArticle(null);
  };

  const handleEditorSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-articles'] });
  };

  const TABS: { id: TabFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Drafts' },
    { id: 'published', label: 'Published' },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      {/* Header */}
      <div className="px-4 md:px-6 lg:px-10 pt-6 pb-3 flex-shrink-0 flex items-center gap-3">
        <h1 className="h2 flex-1">Magazine</h1>

        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="p-1.5 rounded-md text-tea-text-dim hover:text-tea-text-sec transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
        </button>

        <button
          onClick={handleNewArticle}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors shrink-0"
        >
          <Plus size={13} />
          New Article
        </button>
      </div>

      {/* Tab strip — bottom-border underline per §6 */}
      <div className="flex items-center gap-6 px-4 md:px-6 lg:px-10 border-b border-tea-border flex-shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`py-2.5 text-ui-12 uppercase tracking-[0.15em] border-b transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'text-tea-text border-tea-gold'
                : 'text-tea-text-sec hover:text-tea-text border-transparent'
            }`}
          >
            {t.label}
            {t.id !== 'all' && (
              <span className="ml-1.5 text-tea-text-dim">
                ({articles.filter(a => a.status === t.id).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-tea-text-dim text-sm gap-2">
            <Loader2 size={16} className="animate-spin" />
            Loading articles…
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-tea-text-dim">
            <p className="text-sm">Failed to load articles.</p>
            <button onClick={() => refetch()} className="text-xs text-tea-gold hover:underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-tea-text-dim">
            <FileText size={28} strokeWidth={1.5} />
            <p className="text-sm">
              {tab === 'all' ? 'No articles yet. Create your first.' : `No ${tab} articles.`}
            </p>
            {tab === 'all' && (
              <button
                onClick={handleNewArticle}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-medium hover:bg-tea-gold/90 transition-colors"
              >
                <Plus size={13} />
                New Article
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-tea-border">
            {filtered.map(article => (
              <button
                key={article.id}
                onClick={() => handleRowClick(article)}
                disabled={loadingArticleId === article.id}
                className="w-full text-left px-4 md:px-6 py-4 hover:bg-tea-surface/60 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-tea-text leading-snug group-hover:text-tea-gold transition-colors">
                        {article.title || <span className="italic text-tea-text-sec">Untitled</span>}
                      </span>
                      <span className={`text-ui-9 uppercase tracking-[0.15em] px-2 py-0.5 rounded-full font-medium ${STATUS_PILL_STYLES[article.status] ?? STATUS_PILL_STYLES.draft}`}>
                        {article.status}
                      </span>
                      {article.category && (
                        <span className="text-ui-9 uppercase tracking-[0.12em] text-tea-text-dim">
                          {article.category}
                        </span>
                      )}
                    </div>
                    {article.subtitle && (
                      <p className="text-xs text-tea-text-sec mb-1 leading-snug">{article.subtitle}</p>
                    )}
                    {article.blocks_preview && (
                      <p className="text-xs text-tea-text-dim leading-relaxed line-clamp-2">{article.blocks_preview}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                    {loadingArticleId === article.id && (
                      <Loader2 size={13} className="animate-spin text-tea-text-sec" />
                    )}
                    {article.published_at ? (
                      <span className="text-ui-10 text-tea-text-dim">{formatDate(article.published_at)}</span>
                    ) : (
                      <span className="text-ui-10 text-tea-text-dim italic">Draft</span>
                    )}
                    {article.reading_time_mins && (
                      <span className="text-ui-10 text-tea-text-dim">{article.reading_time_mins} min read</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {editorOpen && (
        <ArticleEditorModal
          isOpen={editorOpen}
          onClose={handleEditorClose}
          initialData={editingArticle ?? undefined}
          onSaved={handleEditorSaved}
        />
      )}
    </div>
  );
};
