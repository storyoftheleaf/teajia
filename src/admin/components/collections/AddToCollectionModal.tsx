import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, X as XIcon, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../../lib/api';

interface AddToCollectionModalProps {
  open: boolean;
  productIds: string[];
  onClose: () => void;
  /** Called after items are added (or a new collection is created with them). */
  onSuccess: (info: { collectionId: string; added: number; skipped: number; created: boolean }) => void;
}

/**
 * Bulk "Add to collection" picker for the inventory action drawer. Mirrors
 * ProductCollectionsSection's logic but operates on a set of product ids at once:
 * pick an existing collection or create a new one seeded with the selection.
 * api.collections.addItems already takes an array and skips duplicates server-side.
 */
export const AddToCollectionModal: React.FC<AddToCollectionModalProps> = ({
  open, productIds, onClose, onSuccess,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: allCollections, isLoading } = useQuery({
    queryKey: ['admin-collections'],
    queryFn: () => api.collections.list(),
    select: d => d.collections,
    enabled: open,
  });

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const available = (allCollections ?? []).filter(c => c.status !== 'archived');
  const count = productIds.length;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
    productIds.forEach(pid =>
      queryClient.invalidateQueries({ queryKey: ['product-collections', pid] }));
  };

  const addToExisting = async (collectionId: string) => {
    if (busy || !count) return;
    setBusy(true);
    try {
      const res = await api.collections.addItems(collectionId, productIds);
      invalidate();
      onSuccess({ collectionId, added: res.added, skipped: res.skipped, created: false });
    } finally { setBusy(false); }
  };

  const createAndAdd = async () => {
    const title = newTitle.trim();
    if (!title || busy || !count) return;
    setBusy(true);
    try {
      const res = await api.collections.create({ title, initial_product_ids: productIds });
      invalidate();
      setCreating(false);
      setNewTitle('');
      onSuccess({ collectionId: res.id, added: count, skipped: 0, created: true });
    } finally { setBusy(false); }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        onClick={e => e.stopPropagation()}
        /* Lift shadow stays a warm near-black in both modes, like every entry
           in designTokens SHADOWS. Written as an arbitrary shadow class so it
           falls under the documented Rule 2 carve-out rather than sitting as a
           bare literal inside a style object. */
        className="relative w-full sm:max-w-md bg-tea-surface border-t sm:border border-tea-border sm:rounded-xl rounded-t-xl overflow-hidden flex flex-col max-h-[85vh] shadow-[0_24px_60px_rgba(24,19,14,0.5)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-tea-border">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-tea-gold" />
            <h2 className="font-display text-ui-16 text-tea-text">Add to collection</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-tea-text-sec hover:text-tea-text transition-colors tap-target"
            aria-label="Close"
          >
            <XIcon size={18} />
          </button>
        </div>

        <p className="px-5 pt-3 text-ui-12 text-tea-text-sec">
          {count} item{count !== 1 ? 's' : ''} selected. Pick a collection or create a new one. Items already in a collection are skipped.
        </p>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-ui-12 text-tea-text-dim py-4">
              <Loader2 size={13} className="animate-spin" /> Loading collections…
            </div>
          ) : (
            <>
              {available.length > 0 ? (
                <ul className="flex flex-col gap-0.5">
                  {available.map(c => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => addToExisting(c.id)}
                        disabled={busy}
                        className="w-full text-left px-3 py-2.5 rounded-md text-ui-13 text-tea-text hover:bg-tea-elevated transition-colors disabled:opacity-40 flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{c.title}</span>
                        <span className="text-tea-text-dim text-ui-10 shrink-0">
                          {c.status === 'draft'
                            ? 'draft'
                            : `${c.active_publication_count} link${c.active_publication_count !== 1 ? 's' : ''}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ui-12 text-tea-text-dim italic py-2">No collections yet. Create one below.</p>
              )}
            </>
          )}
        </div>

        {/* Footer, create-new + cancel. Cancel sits bottom-left per app rules. */}
        <div className="border-t border-tea-border px-5 py-4 flex flex-col gap-3">
          {creating ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createAndAdd(); }}
                placeholder="New collection title"
                autoFocus
                className="flex-1 px-3 py-2 text-ui-13 bg-tea-bg border border-tea-border rounded-md outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
              />
              <button
                type="button"
                onClick={createAndAdd}
                disabled={!newTitle.trim() || busy}
                className="px-4 py-2 cta-solid rounded-md text-ui-12 font-medium transition-colors disabled:opacity-40 shrink-0"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : 'Create'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-ui-12 text-tea-gold hover:text-tea-gold-lt transition-colors disabled:opacity-40 self-start"
            >
              <Plus size={13} /> Create new collection with these
            </button>
          )}

          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={creating ? () => { setCreating(false); setNewTitle(''); } : onClose}
              disabled={busy}
              className="text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            {creating && (
              <button
                type="button"
                onClick={() => navigate('/admin/collections')}
                className="text-ui-11 text-tea-text-dim hover:text-tea-text-sec transition-colors"
              >
                View all collections
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
