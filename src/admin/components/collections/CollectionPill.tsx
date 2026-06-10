import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ChevronDown, Plus, Loader2, Check, X as XIcon } from 'lucide-react';
import { AnchoredMenu } from '../../../components/shared/AnchoredMenu';
import { api } from '../../../lib/api';

const LAST_ID_KEY = 'teajia_last_collection_id';
const LAST_TITLE_KEY = 'teajia_last_collection_title';

interface CollectionPillProps {
  productId: string;
}

/**
 * Compact "Add to collection" control for the always-visible toggle row in
 * ProductEditPanel. Two gestures in one pill:
 *   • Tap the body → file this product into the LAST collection used (global,
 *     remembered in localStorage). No second click. Flashes a check.
 *   • Tap the caret → expand an inline picker; choosing a collection adds it
 *     and contracts. Use this to file into a different collection.
 * First-ever use (no last collection): the body opens the picker too.
 *
 * Reuses the same React Query keys as ProductCollectionsSection so membership
 * stays consistent if both are mounted.
 */
export const CollectionPill: React.FC<CollectionPillProps> = ({ productId }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const lastId = typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_ID_KEY) : null;
  const lastTitle = typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_TITLE_KEY) : null;

  const { data: inCollections } = useQuery({
    queryKey: ['product-collections', productId],
    queryFn: () => api.collections.list({ productId }),
    select: d => d.collections,
    enabled: !!productId,
  });

  const { data: allCollections, isLoading: loadingAll } = useQuery({
    queryKey: ['admin-collections'],
    queryFn: () => api.collections.list(),
    select: d => d.collections,
    enabled: open,
  });

  const membershipIds = new Set((inCollections ?? []).map(c => c.id));
  const available = (allCollections ?? []).filter(c => c.status !== 'archived' && !membershipIds.has(c.id));
  const memberCount = (inCollections ?? []).length;

  // Last collection is only a valid one-tap target if the product isn't already in it.
  const lastUsable = !!lastId && !membershipIds.has(lastId);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['product-collections', productId] });
    queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
  };

  const remember = (id: string, title: string) => {
    try {
      localStorage.setItem(LAST_ID_KEY, id);
      localStorage.setItem(LAST_TITLE_KEY, title);
    } catch { /* storage disabled — degrade to no last-used */ }
  };

  const flashOk = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 1100);
  };

  const addTo = async (id: string, title: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.collections.addItems(id, [productId]);
      remember(id, title);
      invalidate();
      setOpen(false);
      flashOk();
    } finally { setBusy(false); }
  };

  const createAndAdd = async () => {
    const title = newTitle.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      const res = await api.collections.create({ title, initial_product_ids: [productId] });
      remember(res.id, title);
      invalidate();
      setCreating(false);
      setNewTitle('');
      setOpen(false);
      flashOk();
    } finally { setBusy(false); }
  };

  // Body tap: file into last collection if usable, else open the picker.
  const onBodyClick = () => {
    if (busy) return;
    if (lastUsable && lastId && lastTitle) {
      addTo(lastId, lastTitle);
    } else {
      setOpen(v => !v);
    }
  };

  const bodyLabel = flash
    ? 'Added'
    : lastUsable && lastTitle
      ? lastTitle
      : memberCount > 0
        ? `In ${memberCount}`
        : 'Collection';

  return (
    <div className="relative inline-flex">
      {/* The pill: body (tap = file into last / open) + caret (tap = open picker). */}
      <div className={`admin-pill ${memberCount > 0 ? 'admin-pill-on' : ''} !pr-1.5 !gap-0`}>
        <button
          type="button"
          onClick={onBodyClick}
          disabled={busy}
          title={lastUsable && lastTitle ? `Add to ${lastTitle}` : 'Add to a collection'}
          className="inline-flex items-center gap-1 pr-1.5 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={10} className="animate-spin" />
          ) : flash ? (
            <Check size={10} className="text-tea-gold" />
          ) : (
            <BookOpen size={10} className={memberCount > 0 ? 'text-tea-gold' : ''} />
          )}
          <span className="max-w-[120px] truncate">{bodyLabel}</span>
        </button>
        <AnchoredMenu
          align="left"
          width={224}
          className="!bg-admin-elevated !border-admin-border overflow-hidden"
          open={open}
          onOpenChange={(o) => { setOpen(o); if (!o) setCreating(false); }}
          trigger={(menuProps) => (
            <button
              {...menuProps}
              type="button"
              disabled={busy}
              aria-label="Choose a collection"
              className="inline-flex items-center pl-1 border-l border-admin-border/60 disabled:opacity-50"
            >
              <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
        >
          {(close) => (
            loadingAll ? (
              <div className="flex items-center gap-2 px-3 py-2 text-ui-11 text-admin-text-dim">
                <Loader2 size={11} className="animate-spin" /> Loading…
              </div>
            ) : (
              <>
                {available.length > 0 ? (
                  <ul className="max-h-[200px] overflow-y-auto">
                    {available.map(c => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => addTo(c.id, c.title)}
                          disabled={busy}
                          className="w-full text-left px-3 py-2 text-ui-12 text-admin-text hover:bg-admin-bg/40 transition-colors disabled:opacity-40 flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{c.title}</span>
                          {c.id === lastId && (
                            <span className="text-ui-9 text-tea-gold uppercase tracking-[0.1em] shrink-0">last</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 py-2 text-ui-11 text-admin-text-dim italic">
                    {memberCount > 0 ? 'In all your collections.' : 'No collections yet.'}
                  </p>
                )}

                <div className="h-px bg-admin-border my-1" />

                {creating ? (
                  <div className="flex items-center gap-1.5 px-2 py-1">
                    <input
                      type="text"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') createAndAdd();
                        if (e.key === 'Escape') { setCreating(false); setNewTitle(''); }
                      }}
                      placeholder="New collection"
                      autoFocus
                      className="flex-1 min-w-0 px-2 py-1 text-ui-11 bg-admin-bg border border-admin-border rounded outline-none text-admin-text placeholder:text-admin-text-dim focus:ring-1 focus:ring-tea-gold/40"
                    />
                    <button
                      type="button"
                      onClick={createAndAdd}
                      disabled={!newTitle.trim() || busy}
                      className="shrink-0 px-2 py-1 bg-tea-gold text-tea-bg rounded text-ui-10 font-medium hover:bg-tea-gold/90 transition-colors disabled:opacity-40"
                    >
                      {busy ? <Loader2 size={10} className="animate-spin" /> : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCreating(false); setNewTitle(''); }}
                      className="shrink-0 text-admin-text-sec hover:text-admin-text transition-colors tap-target"
                      aria-label="Cancel"
                    >
                      <XIcon size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="w-full text-left px-3 py-2 text-ui-11 text-tea-gold hover:text-tea-gold-lt hover:bg-admin-bg/40 transition-colors inline-flex items-center gap-1.5"
                  >
                    <Plus size={11} /> New collection
                  </button>
                )}
              </>
            )
          )}
        </AnchoredMenu>
      </div>
    </div>
  );
};
