import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Trash2, MapPin, X, Loader2, Store, ExternalLink, Pencil, Check } from 'lucide-react';
import { api, type CellarItem, type ShelfOfferInput } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { CellarOfferEditor } from './CellarOfferEditor';

const chestField = 'min-w-0 rounded-md border border-tea-border bg-tea-bg px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none';

interface CellarViewProps {
  onBack: () => void;
  embedded?: boolean;
}

const PLACEMENT_LABEL: Record<CellarItem['placementStatus'], string> = {
  private: 'Private',
  requested: 'Placement requested',
  placed: 'Placed at a location',
};

export const CellarView: React.FC<CellarViewProps> = ({ embedded = false }) => {
  const qc = useQueryClient();
  const memberships = useAppStore(s => s.memberships);
  const activeAccount = useAppStore(s => s.activeAccount);

  const [name, setName] = useState('');
  const [grams, setGrams] = useState('');
  const [label, setLabel] = useState('');
  const [search, setSearch] = useState('');
  const [forSale, setForSale] = useState(false);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [placingId, setPlacingId] = useState<string | null>(null);

  // Inline edit of an existing item (name + grams).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editGrams, setEditGrams] = useState('');
  const [editLabel, setEditLabel] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['cellar'],
    queryFn: () => api.cellar.list(),
    staleTime: 1000 * 60,
  });
  const items = data?.items ?? [];

  // Step 5: shelf grant + identity. Only present once Adrian grants the shelf.
  const { data: shelf } = useQuery({
    queryKey: ['cellar-shelf'],
    queryFn: () => api.cellar.getShelf(),
    staleTime: 1000 * 60,
  });
  const shelfEnabled = !!(shelf?.enabled && shelf.slug);
  const orderable = shelfEnabled && !!shelf?.whatsapp;
  const showForSale = forSale && shelfEnabled;
  const filter = search.trim().toLocaleLowerCase();
  const visibleItems = items.filter(item => {
    if (showForSale && (!orderable || !item.shelfPublished)) return false;
    return !filter || [item.name, item.type, item.origin, item.year, item.label]
      .some(value => String(value ?? '').toLocaleLowerCase().includes(filter));
  });
  const [whatsapp, setWhatsapp] = useState('');
  const [shelfTitle, setShelfTitle] = useState('');
  useEffect(() => {
    if (shelf) { setWhatsapp(shelf.whatsapp ?? ''); setShelfTitle(shelf.title ?? ''); }
  }, [shelf]);
  const shelfDirty = shelfEnabled && shelf
    ? (whatsapp !== (shelf.whatsapp ?? '') || shelfTitle !== (shelf.title ?? ''))
    : false;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cellar'] });

  const saveShelfMut = useMutation({
    mutationFn: (payload: { title: string; whatsapp: string }) => api.cellar.updateShelf(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cellar-shelf'] }),
  });
  const publishOffer = useMutation({
    mutationFn: ({ id, offer }: { id: string; offer: ShelfOfferInput }) => api.cellar.publishToShelf(id, offer),
    onSuccess: async () => { await invalidate(); setOfferId(null); },
  });
  const withdrawOffer = useMutation({
    mutationFn: api.cellar.unpublishFromShelf,
    onSuccess: invalidate,
  });

  const createMut = useMutation({
    mutationFn: (payload: { name: string; grams: number; label: string }) => api.cellar.create(payload),
    onSuccess: () => { setName(''); setGrams(''); setLabel(''); setAdding(false); invalidate(); },
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => api.cellar.remove(id),
    onSuccess: invalidate,
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; grams?: number; label?: string } }) => api.cellar.update(id, data),
    onSuccess: () => { setEditingId(null); invalidate(); },
  });
  const requestMut = useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) => api.cellar.requestPlacement(id, accountId),
    onSuccess: () => { setPlacingId(null); invalidate(); },
  });
  const cancelMut = useMutation({
    mutationFn: (id: string) => api.cellar.cancelPlacement(id),
    onSuccess: invalidate,
  });

  const submitAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const g = Number(grams);
    createMut.mutate({ name: trimmed, label, grams: Number.isFinite(g) && g > 0 ? g : 0 });
  };

  const startEdit = (item: CellarItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditGrams(String(item.grams));
    setEditLabel(item.label ?? '');
  };
  const submitEdit = (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    const g = Number(editGrams);
    updateMut.mutate({ id, data: { name: trimmed, label: editLabel, grams: Number.isFinite(g) && g >= 0 ? g : 0 } });
  };

  const accountName = (id: string | null | undefined): string =>
    memberships.find(m => m.account_id === id)?.account_name
    ?? (activeAccount && activeAccount.id === id ? activeAccount.name : null)
    ?? 'a location';

  const layout = embedded ? 'py-6 space-y-5' : 'px-6 pt-6 pb-6 space-y-5';
  const offerItem = items.find(item => item.id === offerId);
  if (offerItem) {
    return (
      <div className={layout}>
        <CellarOfferEditor
          key={offerItem.id}
          item={offerItem}
          whatsapp={orderable ? shelf?.whatsapp ?? null : null}
          saving={publishOffer.isPending}
          error={publishOffer.error}
          onCancel={() => setOfferId(null)}
          onPublish={offer => publishOffer.mutate({ id: offerItem.id, offer })}
        />
      </div>
    );
  }

  const actionError = withdrawOffer.error ?? requestMut.error ?? cancelMut.error ?? updateMut.error ?? createMut.error ?? removeMut.error;

  return (
    <div className={layout}>

      {/* Step 5: public shelf. Appears only once Adrian grants it. */}
      {shelfEnabled && shelf?.slug && (
        <div className="bg-tea-surface border border-tea-border rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Store size={14} className="text-tea-gold" />
            <span className="text-ui-13 text-tea-text">Your public shelf</span>
            <a
              href={`/u/${shelf.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex min-w-0 items-center gap-1 text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              <span className="break-all">/u/{shelf.slug}</span> <ExternalLink size={11} className="shrink-0" />
            </a>
          </div>
          <input
            type="text"
            value={shelfTitle}
            onChange={e => setShelfTitle(e.target.value)}
            aria-label="Shelf title (optional)"
            placeholder="Shelf title (optional)"
            className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-13 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <input
              type="tel"
              inputMode="tel"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              aria-label="Personal WhatsApp number"
              placeholder="WhatsApp with country code"
              className="min-w-0 flex-1 bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-13 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
            />
            <button
              onClick={() => saveShelfMut.mutate({ title: shelfTitle, whatsapp })}
              disabled={saveShelfMut.isPending || !shelfDirty}
              className="btn-secondary btn-sm"
            >
              Save shelf
            </button>
          </div>
          {!orderable && <p className="text-ui-12 text-tea-text-sec">Save your personal WhatsApp number to take inquiries.</p>}
          {saveShelfMut.error && <p role="alert" className="text-ui-13 text-tea-text">{saveShelfMut.error.message}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-tab" aria-pressed={!showForSale} onClick={() => setForSale(false)}>All teas</button>
        {shelfEnabled && <button type="button" className="btn-tab" aria-pressed={showForSale} onClick={() => setForSale(true)}>For sale</button>}
        <input
          type="search"
          aria-label="Filter Tea Chest by tea or label"
          placeholder="Filter by tea or label"
          value={search}
          onChange={event => setSearch(event.target.value)}
          className={`${chestField} flex-1`}
        />
      </div>
      {actionError && <p role="alert" className="text-ui-13 text-tea-text">{actionError.message}</p>}

      {/* Add form */}
      {!showForSale && (adding ? (
        <div className="bg-tea-surface border border-tea-border rounded-xl p-4 space-y-3">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Tea name"
            autoFocus
            className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
          />
          <input aria-label="Private label" placeholder="Private label (optional)" maxLength={60} value={label} onChange={event => setLabel(event.target.value)} className={`w-full ${chestField}`} />
          <div className="flex items-center gap-2">
            <input
              aria-label="Holding weight in grams"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={grams}
              onChange={e => setGrams(e.target.value)}
              placeholder="grams"
              className="w-28 bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
            />
            <span className="text-ui-12 text-tea-text-dim">grams</span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => { setAdding(false); setName(''); setGrams(''); setLabel(''); }}
              className="text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submitAdd}
              disabled={!name.trim() || createMut.isPending}
              className="btn-primary"
            >
              {createMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Add to Tea Chest
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="btn-secondary"
        >
          <Plus size={14} /> Add tea you own
        </button>
      ))}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-tea-text-dim">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-xl border border-tea-border bg-tea-surface p-5 text-center">
          <p className="text-ui-14 text-tea-text-sec">We couldn't load your Tea Chest right now.</p>
          <button
            onClick={() => refetch()}
            className="tap-target mt-3 text-ui-13 text-tea-gold transition-colors hover:text-tea-gold-lt"
          >
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center text-center py-10 text-tea-text-sec">
          <Package size={28} className="text-tea-text-dim mb-2" />
          <p className="text-ui-14">Your Tea Chest is empty.</p>
        </div>
      ) : visibleItems.length === 0 ? (
        <p className="text-ui-14 text-tea-text-sec">{search ? 'No teas match your filter.' : 'You have no teas for sale.'}</p>
      ) : (
        <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
          {visibleItems.map(item => (
            <li key={item.id} className="px-4 py-3">
              {editingId === item.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    aria-label="Private tea name"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    autoFocus
                    className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
                  />
                  <input aria-label="Private label" placeholder="Private label (optional)" maxLength={60} value={editLabel} onChange={event => setEditLabel(event.target.value)} className={`w-full ${chestField}`} />
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      aria-label="Holding weight in grams"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={editGrams}
                      onChange={e => setEditGrams(e.target.value)}
                      className="w-24 bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
                    />
                    <span className="text-ui-12 text-tea-text-dim">grams</span>
                    <button
                      onClick={() => setEditingId(null)}
                      className="ml-auto text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => submitEdit(item.id)}
                      disabled={!editName.trim() || updateMut.isPending}
                      className="btn-primary"
                    >
                      {updateMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
                    </button>
                  </div>
                  {item.shelfPublished && item.shelfOffer && Number(editGrams) < item.shelfOffer.grams && (
                    <p className="text-ui-12 text-tea-text-sec">Saving below {item.shelfOffer.grams} g withdraws the offer.</p>
                  )}
                </div>
              ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="break-words text-ui-14 text-tea-text">{item.name}</div>
                  <div className="mt-0.5 break-words text-ui-12 text-tea-text-dim">
                    {[item.type, item.origin, item.year, item.label].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <span className="text-ui-13 text-tea-text-sec tabular-nums">{item.grams} g</span>
                  {item.placementStatus === 'private' && (
                    <>
                      <button
                        onClick={() => startEdit(item)}
                        aria-label="Edit item"
                        className="text-tea-text-sec hover:text-tea-text transition-colors tap-target"
                      >
                        <Pencil size={14} />
                      </button>
                      {!item.shelfPublished && <button
                        onClick={() => removeMut.mutate(item.id)}
                        aria-label="Remove from Tea Chest"
                        className="text-tea-text-sec hover:text-tea-text transition-colors tap-target"
                      >
                        <Trash2 size={14} />
                      </button>}
                    </>
                  )}
                </div>
              </div>
              )}

              {/* Placement (the move), hidden while editing this item */}
              {editingId !== item.id && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {!item.shelfPublished && (
                  <span className="text-ui-12 text-tea-text-sec">
                    {PLACEMENT_LABEL[item.placementStatus]}
                    {item.placementStatus !== 'private' && item.placementAccountId
                      ? ` · ${accountName(item.placementAccountId)}`
                      : ''}
                  </span>
                )}

                {item.placementStatus === 'private' && !item.shelfPublished && memberships.length > 0 && (
                  placingId === item.id ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        defaultValue=""
                        onChange={e => {
                          if (e.target.value) requestMut.mutate({ id: item.id, accountId: e.target.value });
                        }}
                        className="bg-tea-bg border border-tea-border rounded-md px-2 py-1 text-ui-12 text-tea-text focus:outline-none"
                      >
                        <option value="" disabled>Choose location…</option>
                        {memberships.map(m => (
                          <option key={m.account_id} value={m.account_id}>{m.account_name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setPlacingId(null)}
                        aria-label="Cancel"
                        className="text-tea-text-sec hover:text-tea-text tap-target"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPlacingId(item.id)}
                      className="inline-flex items-center gap-1 text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors"
                    >
                      <MapPin size={12} /> Request placement
                    </button>
                  )
                )}

                {item.placementStatus === 'requested' && (
                  <button
                    onClick={() => cancelMut.mutate(item.id)}
                    className="text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors"
                  >
                    Cancel request
                  </button>
                )}

                {item.placementStatus === 'private' && (
                  <>
                    {item.shelfPublished && item.shelfOffer && (
                      <span className="text-ui-12 text-tea-text-sec">
                        {orderable ? `${item.shelfOffer.grams} g for sale` : 'Offer hidden'}
                      </span>
                    )}
                    {item.shelfNeedsReview && (!orderable || !item.grams) && (
                      <span className="text-ui-12 text-tea-text-sec">Previous offer needs review</span>
                    )}
                    {orderable && item.grams > 0 && (
                      <button
                        type="button"
                        onClick={() => { publishOffer.reset(); setOfferId(item.id); }}
                        className="btn-quiet btn-sm"
                      >
                        {item.shelfPublished ? 'Edit offer' : item.shelfNeedsReview ? 'Review previous offer' : 'Offer for sale'}
                      </button>
                    )}
                    {(item.shelfPublished || item.shelfNeedsReview) && (
                      <button
                        type="button"
                        onClick={() => withdrawOffer.mutate(item.id)}
                        disabled={withdrawOffer.isPending}
                        className="btn-quiet btn-sm"
                      >
                        Withdraw offer
                      </button>
                    )}
                  </>
                )}
              </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
