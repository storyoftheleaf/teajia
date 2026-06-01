import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Loader2, RefreshCw, Package, Inbox, Building2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../components/Toast';
import { STATUS_PILL_VARIANTS, STATUS_PILL_BASE, type StatusPillVariant } from '../constants';
import type { CollectionListRow, CollectionStatus, InboundCollectionRow } from '../../types';

type ListMode = 'mine' | 'inbound';
type TabFilter = 'all' | 'draft' | 'active' | 'archived';

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_LABEL: Record<CollectionStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

function statusVariant(s: CollectionStatus): StatusPillVariant {
  if (s === 'active') return 'active';
  if (s === 'archived') return 'archived';
  return 'draft';
}

export const CollectionsView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<ListMode>('mine');
  const [tab, setTab] = useState<TabFilter>('all');
  // Auto-open the create form when arriving via "Send a Collection" (?new=1),
  // so the profile-panel entry lands straight in the build flow, not the list.
  const [creating, setCreating] = useState(() => searchParams.get('new') === '1');
  const [newTitle, setNewTitle] = useState('');
  const [creatingSubmitting, setCreatingSubmitting] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['admin-collections'],
    queryFn: () => api.collections.list(),
    select: (d) => d.collections,
  });

  const inboundQuery = useQuery({
    queryKey: ['admin-collections-inbound'],
    queryFn: () => api.collections.listInbound(),
  });

  const collections: CollectionListRow[] = data ?? [];
  const filtered = tab === 'all' ? collections : collections.filter(c => c.status === tab);
  const inbound: InboundCollectionRow[] = inboundQuery.data?.inbound ?? [];
  const unreadCount = inboundQuery.data?.unread_count ?? 0;

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

  const subtitleCount = mode === 'inbound'
    ? inbound.length
    : (tab === 'all' ? collections.length : filtered.length);
  const subtitleScope = mode === 'inbound'
    ? 'INBOUND'
    : (tab === 'all' ? 'ALL' : tab.toUpperCase());
  const subtitle = `${subtitleScope} · ${subtitleCount} COLLECTION${subtitleCount === 1 ? '' : 'S'}`;

  const handleRefresh = () => {
    if (mode === 'mine') refetch();
    else inboundQuery.refetch();
  };
  const refreshSpinning = isRefetching || inboundQuery.isRefetching;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      {/* Page chrome — narrow */}
      <div className="max-w-3xl mx-auto w-full px-4 md:px-6 pt-6 md:pt-8 pb-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="h2">Collections</h1>
            <p className="label-caps text-tea-text-dim mt-1">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshSpinning}
              className="tap-target p-1.5 rounded-md text-tea-text-dim hover:text-tea-text-sec transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={14} className={refreshSpinning ? 'animate-spin' : ''} />
            </button>
            {mode === 'mine' && (
              <button
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
              >
                <Plus size={13} /> New Collection
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mine vs Inbound — underline tabs §6 */}
      <div className="max-w-3xl mx-auto w-full px-4 md:px-6 flex-shrink-0">
        <div className="flex items-center gap-6 border-b border-tea-border flex-wrap">
          <button
            onClick={() => setMode('mine')}
            className={`whitespace-nowrap py-2.5 text-ui-12 uppercase tracking-caps font-sans border-b transition-colors inline-flex items-center gap-1.5 ${
              mode === 'mine'
                ? 'text-tea-text border-tea-gold'
                : 'text-tea-text-sec hover:text-tea-text border-transparent'
            }`}
          >
            <BookOpen size={12} /> Mine
            <span className="text-tea-text-dim normal-case tracking-normal">({collections.length})</span>
          </button>
          <button
            onClick={() => setMode('inbound')}
            className={`whitespace-nowrap py-2.5 text-ui-12 uppercase tracking-caps font-sans border-b transition-colors inline-flex items-center gap-1.5 ${
              mode === 'inbound'
                ? 'text-tea-text border-tea-gold'
                : 'text-tea-text-sec hover:text-tea-text border-transparent'
            }`}
          >
            <Inbox size={12} /> Inbound
            <span className="text-tea-text-dim normal-case tracking-normal">({inbound.length})</span>
            {unreadCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-tea-gold text-tea-bg text-ui-9 font-semibold tabular-nums normal-case tracking-normal">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Status filter — only for mine */}
      {mode === 'mine' && (
        <div className="max-w-3xl mx-auto w-full px-4 md:px-6 flex-shrink-0 mt-3">
          <div className="flex items-center gap-6 border-b border-tea-border flex-wrap">
            {TABS.map(t => {
              const count = t.id === 'all'
                ? collections.length
                : collections.filter(c => c.status === t.id).length;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`whitespace-nowrap py-2.5 text-ui-12 uppercase tracking-caps font-sans border-b transition-colors ${
                    isActive
                      ? 'text-tea-text border-tea-gold'
                      : 'text-tea-text-sec hover:text-tea-text border-transparent'
                  }`}
                >
                  {t.label}
                  <span className="ml-1.5 text-tea-text-dim normal-case tracking-normal">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-nav-gap-lg">
        <div className="max-w-3xl mx-auto w-full px-4 md:px-6 py-6">
          {mode === 'inbound' ? (
            inboundQuery.isLoading ? (
              <div className="flex items-center justify-center h-40 text-tea-text-dim text-ui-13 gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading inbound…
              </div>
            ) : inboundQuery.isError ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-tea-text-dim">
                <p className="text-ui-13 text-tea-error">Failed to load inbound collections.</p>
                <button
                  onClick={() => inboundQuery.refetch()}
                  className="text-xs font-semibold text-tea-gold hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : inbound.length === 0 ? (
              <div className="bg-tea-surface border border-tea-border rounded-xl">
                <div className="flex flex-col items-center justify-center py-16 px-6 gap-4 text-center">
                  <Inbox size={32} strokeWidth={1.25} className="text-tea-text-dim" />
                  <div>
                    <p className="font-display text-ui-16 text-tea-text">No inbound collections</p>
                    <p className="text-ui-12 text-tea-text-dim mt-1">
                      When another store shares a collection with you, it appears here.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
                {inbound.map(row => (
                  <li key={row.publication_id}>
                    <button
                      onClick={() => navigate(`/admin/collections/inbound/${row.publication_id}`)}
                      className="w-full text-left px-4 md:px-6 py-4 hover:bg-tea-accent-sub transition-colors flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <ThumbnailStrip urls={row.thumbnails} />
                        <div className="min-w-0 flex-1">
                          <div className="font-display text-ui-15 text-tea-text truncate">
                            {row.title}
                          </div>
                          <div className="text-ui-12 text-tea-text-dim mt-1 truncate flex items-center gap-1">
                            <Building2 size={11} className="opacity-70 shrink-0" />
                            From {row.publisher_account_name}
                            {' · '}
                            {row.item_count} product{row.item_count !== 1 ? 's' : ''}
                            {row.imported_count > 0 && ` · ${row.imported_count} imported`}
                            {' · shared '}{formatDate(row.published_at)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!row.recipient_seen_at && (
                          <span className={`${STATUS_PILL_BASE} ${STATUS_PILL_VARIANTS.active}`}>
                            New
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : isLoading ? (
            <div className="flex items-center justify-center h-40 text-tea-text-dim text-ui-13 gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading collections…
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-tea-text-dim">
              <p className="text-ui-13 text-tea-error">Failed to load collections.</p>
              <button
                onClick={() => refetch()}
                className="text-xs font-semibold text-tea-gold hover:underline"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-tea-surface border border-tea-border rounded-xl">
              <div className="flex flex-col items-center justify-center py-16 px-6 gap-4 text-center">
                <BookOpen size={32} strokeWidth={1.25} className="text-tea-text-dim" />
                <div>
                  <p className="font-display text-ui-16 text-tea-text">
                    {tab === 'all' ? 'No collections yet' : `No ${STATUS_LABEL[tab as CollectionStatus].toLowerCase()} collections`}
                  </p>
                  <p className="text-ui-12 text-tea-text-dim mt-1">
                    {tab === 'all'
                      ? 'Collections are curated sets of products. Start one from the inventory list or create an empty draft.'
                      : 'Switch to "All" to see your other collections.'}
                  </p>
                </div>
                {tab === 'all' && (
                  <button
                    onClick={() => setCreating(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
                  >
                    <Plus size={13} /> New Collection
                  </button>
                )}
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
              {filtered.map(c => {
                const variant = statusVariant(c.status);
                const metaParts: string[] = [];
                metaParts.push(`${c.item_count} product${c.item_count !== 1 ? 's' : ''}`);
                metaParts.push(
                  c.active_publication_count > 0
                    ? `${c.active_publication_count} active link${c.active_publication_count !== 1 ? 's' : ''}`
                    : 'no active links'
                );
                if (c.last_published_at) metaParts.push(`last shared ${formatDate(c.last_published_at)}`);
                if ((c as any).curator_display_name) metaParts.push(`Curated by ${(c as any).curator_display_name}`);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => navigate(`/admin/collections/${c.id}`)}
                      className="w-full text-left px-4 md:px-6 py-4 hover:bg-tea-accent-sub transition-colors flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <ThumbnailStrip urls={c.thumbnails} />
                        <div className="min-w-0 flex-1">
                          <div className="font-display text-ui-15 text-tea-text truncate">
                            {c.title}
                          </div>
                          <div className="text-ui-12 text-tea-text-dim mt-1 truncate">
                            {metaParts.join(' · ')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`${STATUS_PILL_BASE} ${STATUS_PILL_VARIANTS[variant]}`}>
                          {STATUS_LABEL[c.status]}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {creating && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-tea-bg/80 backdrop-blur-sm"
            onClick={() => !creatingSubmitting && setCreating(false)}
          />
          <div className="relative w-full max-w-sm bg-tea-surface border border-tea-border rounded-xl shadow-2xl p-5">
            <h2 className="h3 mb-3">New collection</h2>
            <label className="label-caps text-tea-text-sec mb-1.5 block">Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateDraft(); }}
              placeholder="Untitled collection"
              autoFocus
              className="w-full px-3 py-2 text-ui-14 bg-tea-bg border border-tea-border rounded-md outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40 mb-4"
            />
            <div className="flex justify-between items-center gap-3">
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40"
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
          className="flex-1 rounded-md bg-tea-elevated overflow-hidden"
        >
          <img src={u} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      ))}
    </div>
  );
};
