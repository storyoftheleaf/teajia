import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, X as XIcon, BookOpen } from 'lucide-react';
import { api } from '../../../lib/api';
import type { CollectionListRow } from '../../../types';

interface ProductCollectionsSectionProps {
  productId: string;
}

export const ProductCollectionsSection: React.FC<ProductCollectionsSectionProps> = ({ productId }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: inCollections, isLoading: loadingIn } = useQuery({
    queryKey: ['product-collections', productId],
    queryFn: () => api.collections.list({ productId }),
    select: d => d.collections,
    enabled: !!productId,
  });

  const { data: allCollections, isLoading: loadingAll } = useQuery({
    queryKey: ['admin-collections'],
    queryFn: () => api.collections.list(),
    select: d => d.collections,
  });

  const [picker, setPicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const membershipIds = new Set((inCollections ?? []).map(c => c.id));
  const available = (allCollections ?? []).filter(c => c.status !== 'archived' && !membershipIds.has(c.id));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['product-collections', productId] });
    queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
  };

  const addToExisting = async (collectionId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.collections.addItems(collectionId, [productId]);
      invalidate();
      setPicker(false);
    } finally { setBusy(false); }
  };

  const createAndAdd = async () => {
    const title = newTitle.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await api.collections.create({ title, initial_product_ids: [productId] });
      invalidate();
      setCreating(false);
      setNewTitle('');
      setPicker(false);
    } finally { setBusy(false); }
  };

  const removeFromCollection = async (collection: CollectionListRow) => {
    if (busy) return;
    setBusy(true);
    try {
      // Fetch detail to find item id for this product (no direct endpoint).
      const detail = await api.collections.get(collection.id);
      const item = detail.items.find(i => i.product_id === productId);
      if (item) {
        await api.collections.removeItem(collection.id, item.id);
        invalidate();
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-2">
      {loadingIn ? (
        <p className="text-[11px] text-tea-text-dim">Loading…</p>
      ) : (inCollections ?? []).length === 0 ? (
        <p className="text-[11px] text-tea-text-dim italic">Not in any collection yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {(inCollections ?? []).map(c => (
            <li key={c.id}>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-tea-elevated text-[11px] text-tea-text">
                <BookOpen size={10} className="text-tea-gold" />
                <button
                  type="button"
                  onClick={() => navigate(`/admin/collections/${c.id}`)}
                  className="hover:underline"
                >
                  {c.title}
                </button>
                <button
                  type="button"
                  onClick={() => removeFromCollection(c)}
                  disabled={busy}
                  className="text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40 ml-0.5"
                  aria-label={`Remove from ${c.title}`}
                >
                  <XIcon size={10} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div>
        <button
          type="button"
          onClick={() => setPicker(v => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-tea-gold hover:text-tea-gold-lt transition-colors"
        >
          <Plus size={11} /> Add to collection
        </button>
      </div>

      {picker && (
        <div className="border border-tea-border rounded-md p-3 mt-1 flex flex-col gap-2 bg-tea-bg">
          {loadingAll ? (
            <div className="flex items-center gap-2 text-[11px] text-tea-text-dim">
              <Loader2 size={11} className="animate-spin" /> Loading collections…
            </div>
          ) : (
            <>
              {available.length > 0 && (
                <ul className="max-h-[160px] overflow-y-auto flex flex-col gap-0.5">
                  {available.map(c => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => addToExisting(c.id)}
                        disabled={busy}
                        className="w-full text-left px-2 py-1.5 rounded text-[12px] text-tea-text hover:bg-tea-elevated transition-colors disabled:opacity-40"
                      >
                        {c.title}
                        <span className="text-tea-text-dim ml-2 text-[10px]">
                          · {c.status === 'draft' ? 'draft' : `${c.active_publication_count} link${c.active_publication_count !== 1 ? 's' : ''}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {creating ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createAndAdd(); }}
                    placeholder="New collection title"
                    autoFocus
                    className="flex-1 px-2 py-1.5 text-xs bg-tea-surface border border-tea-border rounded outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
                  />
                  <button
                    type="button"
                    onClick={createAndAdd}
                    disabled={!newTitle.trim() || busy}
                    className="px-3 py-1.5 bg-tea-gold text-tea-bg rounded text-[11px] font-medium hover:bg-tea-gold/90 transition-colors disabled:opacity-40"
                  >
                    {busy ? <Loader2 size={11} className="animate-spin" /> : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreating(false); setNewTitle(''); }}
                    disabled={busy}
                    className="text-xs text-tea-text-sec hover:text-tea-text transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="text-left text-[11px] text-tea-gold hover:text-tea-gold-lt transition-colors pt-1 border-t border-tea-border"
                >
                  + Create new collection with this product
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
