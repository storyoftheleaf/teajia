import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, X as XIcon, Check, BookOpen, Plus } from 'lucide-react';
import { api } from '../../../lib/api';
import type { CollectionListRow, CollectionRecipient } from '../../../types';
import { RecipientTypeahead } from './RecipientTypeahead';

interface CollectionShareSheetProps {
  open: boolean;
  productIds: string[];
  onClose: () => void;
  onSuccess: (args: { collectionId: string; collectionTitle: string; addedCount: number; publicationSlug?: string }) => void;
}

type Mode = 'new' | 'existing';

export const CollectionShareSheet: React.FC<CollectionShareSheetProps> = ({
  open, productIds, onClose, onSuccess,
}) => {
  const [mode, setMode] = useState<Mode>('new');

  // Create-new state
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [recipients, setRecipients] = useState<CollectionRecipient[]>([]);

  // Existing state
  const [collections, setCollections] = useState<CollectionListRow[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [publishAfterAdd, setPublishAfterAdd] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = productIds.length;

  useEffect(() => {
    if (!open) {
      setMode('new');
      setTitle('');
      setNote('');
      setRecipients([]);
      setSearch('');
      setSelectedCollectionId(null);
      setPublishAfterAdd(false);
      setError(null);
      return;
    }
    // Load collections when opening existing mode (do it once on open, cheap).
    let cancelled = false;
    setCollectionsLoading(true);
    api.collections.list()
      .then(res => { if (!cancelled) setCollections(res.collections); })
      .catch(() => { if (!cancelled) setCollections([]); })
      .finally(() => { if (!cancelled) setCollectionsLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const filteredCollections = useMemo(() => {
    const eligible = collections.filter(c => c.status !== 'archived');
    if (!search.trim()) return eligible;
    const q = search.toLowerCase();
    return eligible.filter(c => c.title.toLowerCase().includes(q));
  }, [collections, search]);

  const selectedCollection = filteredCollections.find(c => c.id === selectedCollectionId);

  const canSubmitNew = title.trim().length > 0 && recipients.length > 0 && count > 0;
  const canSubmitExisting = !!selectedCollectionId && count > 0 && (!publishAfterAdd || recipients.length > 0);

  const handleSubmitNew = async () => {
    if (!canSubmitNew || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { id } = await api.collections.create({
        title: title.trim(),
        note: note.trim() || undefined,
        initial_product_ids: productIds,
      });
      const { slug } = await api.collections.publish(id, recipients);
      onSuccess({ collectionId: id, collectionTitle: title.trim(), addedCount: count, publicationSlug: slug });
    } catch (err: any) {
      setError(err?.message || 'Failed to create collection');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitExisting = async () => {
    if (!canSubmitExisting || !selectedCollection || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.collections.addItems(selectedCollection.id, productIds);
      let pubSlug: string | undefined;
      if (publishAfterAdd && recipients.length > 0) {
        const pub = await api.collections.publish(selectedCollection.id, recipients);
        pubSlug = pub.slug;
      }
      onSuccess({
        collectionId: selectedCollection.id,
        collectionTitle: selectedCollection.title,
        addedCount: result.added,
        publicationSlug: pubSlug,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to add to collection');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="collection-share-title"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-tea-bg/80 backdrop-blur-sm"
        onClick={submitting ? undefined : onClose}
      />

      <div className="relative w-full max-w-md bg-tea-surface border border-tea-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-tea-gold-lt flex items-center justify-center flex-shrink-0">
              <BookOpen size={14} className="text-tea-gold" />
            </div>
            <div className="min-w-0">
              <h2 id="collection-share-title" className="text-sm font-medium text-tea-text tracking-wide">
                Share as Collection
              </h2>
              <p className="text-[11px] text-tea-text-dim mt-0.5">
                {count} product{count !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-tea-text-sec hover:text-tea-text transition-colors p-1 -mr-1 disabled:opacity-40"
            aria-label="Close"
          >
            <XIcon size={15} />
          </button>
        </header>

        <div className="px-5 pb-1 flex-shrink-0">
          <div role="tablist" className="grid grid-cols-2 gap-1 p-1 bg-tea-bg border border-tea-border rounded-lg">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'new'}
              onClick={() => setMode('new')}
              className={`flex items-center justify-center gap-1.5 py-2 text-[11px] uppercase tracking-wide rounded-md transition-colors ${
                mode === 'new' ? 'bg-tea-surface text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
              }`}
            >
              <Plus size={11} /> New collection
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'existing'}
              onClick={() => setMode('existing')}
              className={`flex items-center justify-center gap-1.5 py-2 text-[11px] uppercase tracking-wide rounded-md transition-colors ${
                mode === 'existing' ? 'bg-tea-surface text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
              }`}
            >
              <BookOpen size={11} /> Add to existing
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {mode === 'new' ? (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-[1.2px] text-tea-text-dim mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Spring 2026 for Saskia"
                  autoFocus
                  className="w-full px-3 py-2 text-sm bg-tea-bg border border-tea-border rounded-lg outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[1.2px] text-tea-text-dim mb-1">
                  Note <span className="text-tea-text-dim/70 normal-case tracking-normal">(optional — shown above the list)</span>
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="A short message for whoever opens the link…"
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-tea-bg border border-tea-border rounded-lg outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40 resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[1.2px] text-tea-text-dim mb-1">
                  Recipients
                </label>
                <RecipientTypeahead
                  value={recipients}
                  onChange={setRecipients}
                  placeholder="Type a customer name — or a new name + Enter"
                />
                <p className="text-[10px] text-tea-text-dim mt-1.5">
                  Each recipient gets the same link. Matches existing customers or adds a new name.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search your collections…"
                  autoFocus
                  className="w-full pl-8 pr-3 py-2 text-xs bg-tea-bg border border-tea-border rounded-lg outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
                />
              </div>

              <div className="min-h-[100px]">
                {collectionsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-tea-text-dim text-xs">
                    <Loader2 size={13} className="animate-spin" /> Loading collections…
                  </div>
                ) : filteredCollections.length === 0 ? (
                  <p className="py-8 text-xs text-tea-text-dim text-center">
                    {search ? 'No collections match that search.' : 'No collections yet. Create a new one instead.'}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {filteredCollections.map(c => {
                      const isSelected = c.id === selectedCollectionId;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedCollectionId(c.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                              isSelected ? 'bg-tea-gold-lt' : 'bg-tea-bg hover:bg-tea-elevated'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-tea-gold' : 'bg-tea-surface'
                            }`}>
                              {isSelected && <Check size={10} className="text-tea-bg" strokeWidth={3} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-tea-text truncate">{c.title}</p>
                              <p className="text-[11px] text-tea-text-dim truncate">
                                {c.item_count} product{c.item_count !== 1 ? 's' : ''} ·
                                {' '}{c.active_publication_count > 0
                                  ? `${c.active_publication_count} active share${c.active_publication_count !== 1 ? 's' : ''}`
                                  : c.status === 'draft' ? 'draft' : 'not shared yet'}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {selectedCollection && (
                <div className="flex flex-col gap-2 pt-1">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={publishAfterAdd}
                      onChange={e => setPublishAfterAdd(e.target.checked)}
                      className="mt-[3px] accent-tea-gold"
                    />
                    <span className="text-xs text-tea-text">
                      Also share to new recipient(s)
                      <span className="block text-[10px] text-tea-text-dim mt-0.5">
                        Creates another link on the same collection.
                      </span>
                    </span>
                  </label>
                  {publishAfterAdd && (
                    <RecipientTypeahead
                      value={recipients}
                      onChange={setRecipients}
                      placeholder="Type a customer name"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 text-xs text-red-400">{error}</p>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 px-5 py-4 border-t border-tea-border flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-xs text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          {mode === 'new' ? (
            <button
              type="button"
              onClick={handleSubmitNew}
              disabled={!canSubmitNew || submitting}
              className="flex items-center gap-2 px-4 py-2 bg-tea-gold text-tea-bg rounded-lg text-xs font-semibold tracking-wide hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting
                ? <><Loader2 size={12} className="animate-spin" /> Publishing…</>
                : <>Create &amp; share</>
              }
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmitExisting}
              disabled={!canSubmitExisting || submitting}
              className="flex items-center gap-2 px-4 py-2 bg-tea-gold text-tea-bg rounded-lg text-xs font-semibold tracking-wide hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting
                ? <><Loader2 size={12} className="animate-spin" /> Adding…</>
                : publishAfterAdd ? <>Add &amp; share</> : <>Add to collection</>
              }
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};
