import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Loader2, RefreshCw, Package } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../components/Toast';
import type { CollectionListRow, CollectionStatus } from '../../types';

type TabFilter = 'all' | 'draft' | 'active' | 'archived';

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLES: Record<CollectionStatus, string> = {
  draft:    'bg-tea-elevated text-tea-text-sec',
  active:   'bg-tea-gold-lt text-tea-gold',
  archived: 'bg-tea-elevated text-tea-text-dim',
};

const STATUS_LABEL: Record<CollectionStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

export const CollectionsView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabFilter>('all');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creatingSubmitting, setCreatingSubmitting] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['admin-collections'],
    queryFn: () => api.collections.list(),
    select: (d) => d.collections,
  });

  const collections: CollectionListRow[] = data ?? [];
  const filtered = tab === 'all' ? collections : collections.filter(c => c.status === tab);

  const TABS: { id: TabFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Drafts' },
    { id: 'active', label: 'Active' },
    { id: 'archived', label: 'Archived' },
  ];

  const handleCreateDraft = async () => {
    if (!newTitle.trim() || creatingSubmitting) return;
    setCreatingSubmitting(true);
    try {
      const { id } = await api.collections.create({ title: newTitle.trim() });
      setCreating(false);
      setNewTitle('');
      queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
      navigate(`/admin/collections/${id}`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to create collection', 'error');
    } finally {
      setCreatingSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-tea-border bg-tea-bg flex-shrink-0">
        <BookOpen size={17} className="text-tea-text-sec shrink-0" />
        <h1 className="text-sm font-semibold text-tea-text tracking-wide flex-1">Collections</h1>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="p-1.5 rounded-md text-tea-text-dim hover:text-tea-text-sec transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-tea-gold text-tea-bg rounded-md text-xs font-semibold tracking-wide hover:bg-tea-gold/90 transition-colors"
        >
          <Plus size={12} /> New
        </button>
      </div>

      <div className="flex items-center gap-1 px-4 md:px-6 py-3 border-b border-tea-border flex-shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-[11px] uppercase tracking-wide transition-colors ${
              tab === t.id
                ? 'bg-tea-elevated text-tea-text'
                : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-surface'
            }`}
          >
            {t.label}
            {t.id !== 'all' && (
              <span className="ml-1.5 text-tea-text-dim">
                {collections.filter(c => c.status === t.id).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-nav-gap-lg">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-tea-text-dim text-xs">
            <Loader2 size={14} className="animate-spin" /> Loading collections…
          </div>
        ) : isError ? (
          <p className="py-20 text-center text-xs text-red-400">Failed to load collections.</p>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center max-w-sm mx-auto px-6">
            <BookOpen size={28} className="text-tea-text-dim mx-auto mb-4" strokeWidth={1.25} />
            <p className="text-sm text-tea-text mb-1.5">
              {tab === 'all' ? 'No collections yet' : `No ${STATUS_LABEL[tab as CollectionStatus].toLowerCase()} collections`}
            </p>
            <p className="text-[12px] text-tea-text-dim leading-relaxed">
              {tab === 'all'
                ? 'Collections are curated sets of products. Start one from the inventory list or create an empty draft.'
                : 'Switch to "All" to see your other collections.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-tea-border">
            {filtered.map(c => (
              <li key={c.id}>
                <button
                  onClick={() => navigate(`/admin/collections/${c.id}`)}
                  className="w-full flex items-center gap-4 px-4 md:px-6 py-4 hover:bg-tea-surface transition-colors text-left"
                >
                  <ThumbnailStrip urls={c.thumbnails} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h3 className="text-sm text-tea-text truncate font-display" style={{ fontWeight: 400 }}>
                        {c.title}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-[1.2px] ${STATUS_STYLES[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </div>
                    <p className="text-[11px] text-tea-text-dim mt-1">
                      {c.item_count} product{c.item_count !== 1 ? 's' : ''}
                      {' · '}
                      {c.active_publication_count > 0
                        ? `${c.active_publication_count} active link${c.active_publication_count !== 1 ? 's' : ''}`
                        : 'no active links'}
                      {c.last_published_at && ` · last shared ${formatDate(c.last_published_at)}`}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {creating && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-tea-bg/80 backdrop-blur-sm"
            onClick={() => !creatingSubmitting && setCreating(false)}
          />
          <div className="relative w-full max-w-sm bg-tea-surface border border-tea-border rounded-2xl shadow-2xl p-5">
            <h2 className="text-sm font-medium text-tea-text mb-3">New collection</h2>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateDraft(); }}
              placeholder="Title"
              autoFocus
              className="w-full px-3 py-2 text-sm bg-tea-bg border border-tea-border rounded-lg outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40 mb-4"
            />
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCreating(false)}
                disabled={creatingSubmitting}
                className="text-xs text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateDraft}
                disabled={!newTitle.trim() || creatingSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-tea-gold text-tea-bg rounded-lg text-xs font-semibold tracking-wide hover:bg-tea-gold/90 transition-colors disabled:opacity-40"
              >
                {creatingSubmitting ? <Loader2 size={12} className="animate-spin" /> : null}
                Create draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ThumbnailStrip: React.FC<{ urls: string[] }> = ({ urls }) => {
  if (!urls.length) {
    return (
      <div className="w-20 h-14 flex items-center justify-center rounded-md bg-tea-elevated text-tea-text-dim flex-shrink-0">
        <Package size={14} strokeWidth={1.25} />
      </div>
    );
  }
  return (
    <div className="w-20 h-14 flex-shrink-0 flex gap-0.5">
      {urls.slice(0, 3).map((u, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-tea-elevated overflow-hidden"
        >
          <img src={u} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      ))}
    </div>
  );
};
