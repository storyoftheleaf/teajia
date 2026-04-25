import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Loader2, Trash2, ChevronUp, ChevronDown, Plus, ImagePlus,
  Send, X as XIcon, Search, Copy, Check, AlertTriangle, Archive,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../components/Toast';
import { useProducts } from '../hooks/useAdminData';
import { RecipientTypeahead } from '../components/collections/RecipientTypeahead';
import type {
  CollectionDetail, CollectionItem, CollectionPublication,
  CollectionRecipient, CollectionStatus,
} from '../../types';

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function productIsOOS(item: CollectionItem): boolean {
  if (item.product_status && item.product_status !== 'Active') return true;
  if (item.product_type === 'Teaware') return (item.quantity_units ?? 0) <= 0;
  return (item.stock_grams ?? 0) <= 0;
}

export const CollectionEditView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const focusItemId = searchParams.get('item');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-collection', id],
    queryFn: () => api.collections.get(id!),
    enabled: !!id,
  });

  const detail = data as CollectionDetail | undefined;
  const [titleDraft, setTitleDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const focusRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (detail) {
      setTitleDraft(detail.collection.title);
      setNoteDraft(detail.collection.note ?? '');
    }
  }, [detail?.collection.id]);

  useEffect(() => {
    if (focusItemId && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusItemId, detail?.items.length]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-collection', id] });

  const saveMeta = async (patch: { title?: string; note?: string }) => {
    if (!id) return;
    setSavingMeta(true);
    try {
      await api.collections.update(id, patch);
      queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
      invalidate();
    } catch (err: any) {
      showToast(err?.message || 'Save failed', 'error');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleHeroUpload = async (file: File) => {
    if (!id) return;
    setUploadingHero(true);
    try {
      const url: string = await api.uploadImage(file);
      await api.collections.update(id, { hero_image_url: url });
      invalidate();
    } catch (err: any) {
      showToast(err?.message || 'Image upload failed', 'error');
    } finally {
      setUploadingHero(false);
    }
  };

  const handleHeroRemove = async () => {
    if (!id) return;
    try {
      await api.collections.update(id, { hero_image_url: null });
      invalidate();
    } catch (err: any) {
      showToast(err?.message || 'Failed to remove image', 'error');
    }
  };

  const reorder = async (itemId: string, direction: 'up' | 'down') => {
    if (!id || working) return;
    setWorking(true);
    try {
      await api.collections.reorderItem(id, itemId, direction);
      invalidate();
    } catch (err: any) {
      showToast(err?.message || 'Reorder failed', 'error');
    } finally {
      setWorking(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!id || working) return;
    setWorking(true);
    try {
      await api.collections.removeItem(id, itemId);
      invalidate();
    } catch (err: any) {
      showToast(err?.message || 'Remove failed', 'error');
    } finally {
      setWorking(false);
    }
  };

  const unpublish = async (pubId: string) => {
    if (!id) return;
    try {
      await api.collections.unpublish(id, pubId);
      invalidate();
    } catch (err: any) {
      showToast(err?.message || 'Unpublish failed', 'error');
    }
  };

  const setStatus = async (status: CollectionStatus) => {
    if (!id) return;
    try {
      await api.collections.update(id, { status });
      queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
      invalidate();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update status', 'error');
    }
  };

  if (!id) return <p className="p-6 text-sm text-tea-text-dim">Missing id.</p>;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-tea-text-dim text-xs">
        <Loader2 size={14} className="animate-spin" /> Loading collection…
      </div>
    );
  }
  if (isError || !detail) {
    return (
      <div className="py-20 text-center text-sm text-red-400">
        Failed to load collection.
        <button onClick={() => refetch()} className="block mx-auto mt-3 text-xs text-tea-gold underline">Retry</button>
      </div>
    );
  }

  const titleChanged = titleDraft !== detail.collection.title;
  const noteChanged = noteDraft !== (detail.collection.note ?? '');
  const canPublish = detail.items.length > 0;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      <div className="flex items-center gap-2 px-4 md:px-6 py-4 border-b border-tea-border bg-tea-bg flex-shrink-0">
        <button
          onClick={() => navigate('/admin/collections')}
          className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
        >
          <ArrowLeft size={14} /> Collections
        </button>
        <div className="flex-1" />
        <StatusPill status={detail.collection.status} onSet={setStatus} />
      </div>

      <div className="flex-1 overflow-y-auto pb-nav-gap-lg">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-6">

          {/* Title + note */}
          <section className="flex flex-col gap-3">
            <input
              type="text"
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={() => titleChanged && titleDraft.trim() && saveMeta({ title: titleDraft.trim() })}
              placeholder="Untitled collection"
              className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold outline-none py-2 font-display text-[clamp(24px,3.5vw,32px)] leading-[1.2] text-tea-text placeholder:text-tea-text-dim"
              style={{ fontWeight: 500 }}
            />
            <textarea
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              onBlur={() => noteChanged && saveMeta({ note: noteDraft })}
              placeholder="A short note for whoever opens the link — this shows above the product list on the public page."
              rows={2}
              className="w-full bg-transparent border-none outline-none resize-none font-body text-[15px] leading-[1.65] text-tea-text placeholder:text-tea-text-dim italic"
            />
            {savingMeta && <p className="text-[10px] text-tea-text-dim">Saving…</p>}
          </section>

          {/* Hero image */}
          <section className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-[1.2px] text-tea-text-dim">Hero image</label>
            {detail.collection.hero_image_url ? (
              <div className="relative group rounded-lg overflow-hidden bg-tea-elevated">
                <img
                  src={detail.collection.hero_image_url}
                  alt=""
                  className="w-full h-[200px] object-cover"
                />
                <button
                  onClick={handleHeroRemove}
                  className="absolute top-2 right-2 p-1.5 bg-tea-bg/80 rounded-md text-tea-text-sec hover:text-tea-text transition-colors"
                  aria-label="Remove hero image"
                >
                  <XIcon size={14} />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer flex items-center gap-2 px-3 py-3 border border-dashed border-tea-border rounded-lg text-xs text-tea-text-sec hover:text-tea-text hover:border-tea-gold transition-colors w-fit">
                {uploadingHero ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                {uploadingHero ? 'Uploading…' : 'Upload hero (optional)'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleHeroUpload(f); }}
                />
              </label>
            )}
          </section>

          {/* Items */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-[1.2px] text-tea-text-dim">
                Products <span className="text-tea-text-dim/70">({detail.items.length})</span>
              </label>
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-tea-text-sec hover:text-tea-text transition-colors"
              >
                <Plus size={11} /> Add products
              </button>
            </div>
            {detail.items.length === 0 ? (
              <p className="text-xs text-tea-text-dim py-6 text-center border border-dashed border-tea-border rounded-lg">
                No products yet. Add some to make this collection shareable.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {detail.items.map((item, idx) => {
                  const oos = productIsOOS(item);
                  const archived = item.product_status && item.product_status !== 'Active';
                  const focused = item.id === focusItemId;
                  return (
                    <li
                      key={item.id}
                      ref={focused ? focusRef : undefined}
                      className={`flex items-center gap-3 px-2.5 py-2 rounded-md transition-colors ${
                        focused ? 'bg-tea-gold-lt' : 'hover:bg-tea-surface'
                      }`}
                    >
                      <span className="w-5 text-right text-[11px] text-tea-text-dim font-mono tabular-nums">
                        {item.position}
                      </span>
                      <div className="w-10 h-10 flex-shrink-0 rounded bg-tea-elevated overflow-hidden">
                        {item.image_url && (
                          <img src={item.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-tea-text truncate">
                          {item.product_name || 'Untitled'}
                          {item.chinese_name && <span className="text-tea-text-dim ml-1.5 text-xs">{item.chinese_name}</span>}
                        </p>
                        <p className="text-[11px] text-tea-text-dim truncate flex items-center gap-1.5">
                          {[item.origin_region, item.origin_country].filter(Boolean).join(', ') || item.product_type}
                          {archived && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-tea-elevated text-tea-text-dim text-[9px] uppercase tracking-wider">
                              <Archive size={8} /> Archived
                            </span>
                          )}
                          {!archived && oos && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-tea-elevated text-tea-text-sec text-[9px] uppercase tracking-wider">
                              <AlertTriangle size={8} /> Out of stock
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-60 hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => reorder(item.id, 'up')}
                          disabled={idx === 0 || working}
                          className="p-1.5 text-tea-text-sec hover:text-tea-text disabled:opacity-30 transition-colors"
                          aria-label="Move up"
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          onClick={() => reorder(item.id, 'down')}
                          disabled={idx === detail.items.length - 1 || working}
                          className="p-1.5 text-tea-text-sec hover:text-tea-text disabled:opacity-30 transition-colors"
                          aria-label="Move down"
                        >
                          <ChevronDown size={13} />
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={working}
                          className="p-1.5 text-tea-text-sec hover:text-red-400 transition-colors"
                          aria-label="Remove"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Publications */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-[1.2px] text-tea-text-dim">
                Shared links <span className="text-tea-text-dim/70">({detail.publications.filter(p => !p.unpublished_at).length} active)</span>
              </label>
              <button
                onClick={() => setPublishOpen(true)}
                disabled={!canPublish}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-tea-gold hover:text-tea-gold-lt transition-colors disabled:text-tea-text-dim disabled:cursor-not-allowed"
                title={!canPublish ? 'Add at least one product first' : 'Share with new recipients'}
              >
                <Send size={11} /> New share
              </button>
            </div>
            {detail.publications.length === 0 ? (
              <p className="text-xs text-tea-text-dim py-4 text-center">
                Not shared yet. {canPublish ? 'Click “New share” to create a link.' : 'Add a product before sharing.'}
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {detail.publications.map(pub => (
                  <PublicationRow key={pub.id} pub={pub} onUnpublish={() => unpublish(pub.id)} />
                ))}
              </ul>
            )}
          </section>

        </div>
      </div>

      {addOpen && id && (
        <AddProductsSheet
          collectionId={id}
          existingProductIds={new Set(detail.items.map(i => i.product_id))}
          onClose={() => setAddOpen(false)}
          onAdded={() => { setAddOpen(false); invalidate(); }}
        />
      )}

      {publishOpen && id && (
        <AddPublicationSheet
          collectionId={id}
          onClose={() => setPublishOpen(false)}
          onPublished={() => { setPublishOpen(false); invalidate(); }}
          disabled={!canPublish}
        />
      )}
    </div>
  );
};

// ── Status pill with menu ──
const StatusPill: React.FC<{ status: CollectionStatus; onSet: (s: CollectionStatus) => void }> = ({ status, onSet }) => {
  const [open, setOpen] = useState(false);
  const label: Record<CollectionStatus, string> = { draft: 'Draft', active: 'Active', archived: 'Archived' };
  const cls: Record<CollectionStatus, string> = {
    draft:    'bg-tea-elevated text-tea-text-sec',
    active:   'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40',
    archived: 'bg-tea-elevated text-tea-text-dim',
  };
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[1.2px] ${cls[status]}`}
      >
        {label[status]}
      </button>
      {open && (
        <>
          <button
            aria-label="Close"
            className="fixed inset-0 z-dropdown"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-[calc(100%+6px)] z-dropdown bg-tea-elevated border border-tea-border rounded-lg shadow-lg py-1 min-w-[130px]">
            {(['draft', 'active', 'archived'] as CollectionStatus[]).map(s => (
              <button
                key={s}
                onClick={() => { onSet(s); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                  status === s ? 'text-tea-gold' : 'text-tea-text hover:bg-tea-surface'
                }`}
              >
                {label[s]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ── Publication row ──
const PublicationRow: React.FC<{ pub: CollectionPublication; onUnpublish: () => void }> = ({ pub, onUnpublish }) => {
  const [copied, setCopied] = useState(false);
  const active = !pub.unpublished_at;
  const url = `${window.location.origin}/c/${pub.slug}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  return (
    <li className={`flex items-center gap-3 px-3 py-2.5 rounded-md ${active ? 'bg-tea-surface' : 'bg-tea-elevated opacity-60'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-tea-text truncate">
          {pub.recipients.length > 0
            ? pub.recipients.map(r => r.name).join(', ')
            : 'No recipients'}
        </p>
        <p className="text-[10px] text-tea-text-dim truncate mt-0.5 font-mono">
          /c/{pub.slug} · {pub.view_count} view{pub.view_count !== 1 ? 's' : ''} · {active ? `shared ${formatWhen(pub.published_at)}` : `unpublished ${formatWhen(pub.unpublished_at)}`}
        </p>
      </div>
      {active && (
        <>
          <button
            onClick={copy}
            className="p-1.5 text-tea-text-sec hover:text-tea-text transition-colors"
            title="Copy link"
          >
            {copied ? <Check size={13} className="text-tea-gold" /> : <Copy size={13} />}
          </button>
          <button
            onClick={onUnpublish}
            className="text-[10px] uppercase tracking-[1.2px] text-tea-text-sec hover:text-red-400 transition-colors"
          >
            Unpublish
          </button>
        </>
      )}
    </li>
  );
};

// ── Add products sheet ──
const AddProductsSheet: React.FC<{
  collectionId: string;
  existingProductIds: Set<string>;
  onClose: () => void;
  onAdded: () => void;
}> = ({ collectionId, existingProductIds, onClose, onAdded }) => {
  const { data: products } = useProducts();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const available = useMemo(() => {
    const q = query.toLowerCase().trim();
    return (products ?? []).filter(p => {
      if (existingProductIds.has(p.id)) return false;
      if (p.status !== 'Active') return false;
      if (!q) return true;
      const hay = `${p.givenName ?? ''} ${p.productName ?? ''} ${p.chineseName ?? ''}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 60);
  }, [products, query, existingProductIds]);

  const toggle = (id: string) => {
    setSelected(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const submit = async () => {
    if (selected.size === 0 || submitting) return;
    setSubmitting(true);
    try {
      await api.collections.addItems(collectionId, [...selected]);
      showToast(`Added ${selected.size} product${selected.size !== 1 ? 's' : ''}`, 'success');
      onAdded();
    } catch (err: any) {
      showToast(err?.message || 'Add failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <button aria-label="Close" className="absolute inset-0 bg-tea-bg/80 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      <div className="relative w-full max-w-md bg-tea-surface border border-tea-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <header className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-sm font-medium text-tea-text">Add products</h2>
          <button onClick={onClose} disabled={submitting} className="text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40" aria-label="Close">
            <XIcon size={15} />
          </button>
        </header>
        <div className="px-5 pb-3">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search products…"
              autoFocus
              className="w-full pl-8 pr-3 py-2 text-xs bg-tea-bg border border-tea-border rounded-lg outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-3">
          {available.length === 0 ? (
            <p className="py-6 text-xs text-tea-text-dim text-center">
              {query ? 'No matches.' : 'All products are already in this collection.'}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {available.map(p => {
                const isSelected = selected.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => toggle(p.id)}
                      className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-left transition-colors ${
                        isSelected ? 'bg-tea-gold-lt' : 'hover:bg-tea-bg'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-sm flex-shrink-0 flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-tea-gold' : 'bg-tea-surface border border-tea-border'
                      }`}>
                        {isSelected && <Check size={9} className="text-tea-bg" strokeWidth={3} />}
                      </div>
                      <div className="w-8 h-8 flex-shrink-0 rounded bg-tea-elevated overflow-hidden">
                        {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-tea-text truncate">{p.givenName || p.productName}</p>
                        <p className="text-[10px] text-tea-text-dim truncate">{p.type}{p.year ? ` · ${p.year}` : ''}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <footer className="flex items-center justify-between gap-3 px-5 py-4 border-t border-tea-border flex-shrink-0">
          <button onClick={onClose} disabled={submitting} className="text-xs text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40">Cancel</button>
          <button
            onClick={submit}
            disabled={selected.size === 0 || submitting}
            className="flex items-center gap-2 px-4 py-2 bg-tea-gold text-tea-bg rounded-lg text-xs font-semibold tracking-wide hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <><Loader2 size={12} className="animate-spin" /> Adding…</> : <>Add {selected.size || ''}</>}
          </button>
        </footer>
      </div>
    </div>
  );
};

// ── Add publication sheet ──
const AddPublicationSheet: React.FC<{
  collectionId: string;
  onClose: () => void;
  onPublished: () => void;
  disabled: boolean;
}> = ({ collectionId, onClose, onPublished, disabled }) => {
  const [recipients, setRecipients] = useState<CollectionRecipient[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (recipients.length === 0 || submitting || disabled) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.collections.publish(collectionId, recipients);
      onPublished();
    } catch (err: any) {
      setError(err?.message || 'Publish failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <button aria-label="Close" className="absolute inset-0 bg-tea-bg/80 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      <div className="relative w-full max-w-md bg-tea-surface border border-tea-border rounded-2xl shadow-2xl p-5">
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-tea-text">New share</h2>
          <button onClick={onClose} disabled={submitting} className="text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40" aria-label="Close">
            <XIcon size={15} />
          </button>
        </header>
        <p className="text-[11px] text-tea-text-dim mb-3">
          Each recipient gets the same link. Only people with the link can see the page.
        </p>
        <RecipientTypeahead value={recipients} onChange={setRecipients} autoFocus />
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        <footer className="flex items-center justify-between gap-3 mt-5">
          <button onClick={onClose} disabled={submitting} className="text-xs text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40">Cancel</button>
          <button
            onClick={submit}
            disabled={recipients.length === 0 || submitting || disabled}
            className="flex items-center gap-2 px-4 py-2 bg-tea-gold text-tea-bg rounded-lg text-xs font-semibold tracking-wide hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <><Loader2 size={12} className="animate-spin" /> Publishing…</> : <>Create link</>}
          </button>
        </footer>
      </div>
    </div>
  );
};
