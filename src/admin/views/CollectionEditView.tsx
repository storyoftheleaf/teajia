import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Loader2, Trash2, ChevronUp, ChevronDown, Plus, ImagePlus,
  X as XIcon, Search, Copy, Check, AlertTriangle, Archive,
  User as UserIcon, UserPlus, Building2, Tag as TagIcon,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
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

  // Network stores — used to label store-target publications and to populate the
  // "Publish to store" picker.
  const { data: networkStores } = useQuery({
    queryKey: ['network-stores'],
    queryFn: () => api.network.getStores(),
    staleTime: 60_000,
  });
  const storeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of networkStores ?? []) m.set(s.id, s.name);
    return m;
  }, [networkStores]);

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

          {/* Shared with */}
          <section className="flex flex-col gap-3">
            <label className="text-[10px] uppercase tracking-[1.2px] text-tea-text-dim">
              Shared with {detail.publications.filter(p => !p.unpublished_at).length > 0 && (
                <span className="text-tea-text-dim/70 num">({detail.publications.filter(p => !p.unpublished_at).length})</span>
              )}
            </label>

            {detail.publications.length === 0 ? (
              <button
                onClick={() => canPublish && setPublishOpen(true)}
                disabled={!canPublish}
                className="group flex items-center justify-center gap-2 py-6 rounded-lg border border-dashed border-tea-border hover:border-tea-gold/40 hover:bg-tea-gold/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-tea-border disabled:hover:bg-transparent"
                title={!canPublish ? 'Add at least one product first' : undefined}
              >
                <UserPlus size={14} className="text-tea-text-sec group-hover:text-tea-gold group-disabled:text-tea-text-dim transition-colors" />
                <span className="text-[12px] text-tea-text-sec group-hover:text-tea-text group-disabled:text-tea-text-dim transition-colors">
                  {canPublish ? 'Share with people' : 'Add a product before sharing'}
                </span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => setPublishOpen(true)}
                  disabled={!canPublish}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-tea-gold/10 hover:bg-tea-gold/15 text-tea-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={!canPublish ? 'Add at least one product first' : 'Share with new people, by tag, or with a store'}
                >
                  <UserPlus size={13} />
                  <span className="text-[12px] font-medium tracking-wide">Share with people</span>
                </button>
                <ul className="flex flex-col gap-1.5">
                  {detail.publications.map(pub => (
                    <PublicationRow
                      key={pub.id}
                      pub={pub}
                      storeNameById={storeNameById}
                      onUnpublish={() => unpublish(pub.id)}
                    />
                  ))}
                </ul>
              </>
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
          collectionTitle={detail.collection.title}
          stores={networkStores ?? []}
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
const PublicationRow: React.FC<{
  pub: CollectionPublication;
  storeNameById?: Map<string, string>;
  onUnpublish: () => void;
}> = ({ pub, storeNameById, onUnpublish }) => {
  const [copied, setCopied] = useState(false);
  const active = !pub.unpublished_at;
  const url = `${window.location.origin}/c/${pub.slug}`;
  const isStore = pub.target_type === 'store';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  const headline = isStore
    ? (pub.target_id && storeNameById?.get(pub.target_id)) || 'Partner store'
    : pub.recipients.length > 0
      ? pub.recipients.map(r => r.name).join(', ')
      : 'No recipients';

  return (
    <li className={`flex items-center gap-3 px-3 py-2.5 rounded-md ${active ? 'bg-tea-surface' : 'bg-tea-elevated opacity-60'}`}>
      <div className="w-7 h-7 rounded-md bg-tea-elevated flex items-center justify-center flex-shrink-0 text-tea-text-sec">
        {isStore ? <Building2 size={13} /> : <UserIcon size={13} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-tea-text truncate">
          {headline}
          {isStore && (
            <span className="ml-1.5 text-[10px] uppercase tracking-[1.2px] text-tea-text-dim">store</span>
          )}
        </p>
        <p className="text-[10px] text-tea-text-dim truncate mt-0.5 font-mono">
          {isStore
            ? `${active ? `shared ${formatWhen(pub.published_at)}` : `unpublished ${formatWhen(pub.unpublished_at)}`}`
            : `/c/${pub.slug} · ${pub.view_count} view${pub.view_count !== 1 ? 's' : ''} · ${active ? `shared ${formatWhen(pub.published_at)}` : `unpublished ${formatWhen(pub.unpublished_at)}`}`}
        </p>
      </div>
      {active && (
        <>
          {!isStore && (
            <button
              onClick={copy}
              className="p-1.5 text-tea-text-sec hover:text-tea-text transition-colors"
              title="Copy link"
            >
              {copied ? <Check size={13} className="text-tea-gold" /> : <Copy size={13} />}
            </button>
          )}
          <button
            onClick={onUnpublish}
            className="text-[10px] uppercase tracking-[1.2px] text-tea-text-sec hover:text-red-400 transition-colors"
          >
            {isStore ? 'Stop sharing' : 'Unpublish'}
          </button>
        </>
      )}
    </li>
  );
};

// ── Add products sheet ──
const TEA_TYPE_FILTERS = ['Sheng', 'Shou', 'Oolong', 'Red', 'Green', 'White', 'Yellow', 'Dark', 'Herbal', 'Misc'] as const;
type TopFilter = 'all' | 'tea' | 'teaware';

const AddProductsSheet: React.FC<{
  collectionId: string;
  existingProductIds: Set<string>;
  onClose: () => void;
  onAdded: () => void;
}> = ({ collectionId, existingProductIds, onClose, onAdded }) => {
  const { data: products } = useProducts();
  const [query, setQuery] = useState('');
  const [topFilter, setTopFilter] = useState<TopFilter>('all');
  const [teaSubFilter, setTeaSubFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  // Eligible pool = active products not already in the collection.
  const pool = useMemo(() => {
    return (products ?? []).filter(p =>
      p.status === 'Active' && !existingProductIds.has(p.id)
    );
  }, [products, existingProductIds]);

  // Counts for the chip badges — derived from the un-filtered pool so the
  // numbers stay stable as the user narrows.
  const counts = useMemo(() => {
    const c = { all: pool.length, tea: 0, teaware: 0, byType: new Map<string, number>() };
    for (const p of pool) {
      const t = p.type || 'Misc';
      if (t === 'Teaware') c.teaware++;
      else { c.tea++; c.byType.set(t, (c.byType.get(t) ?? 0) + 1); }
    }
    return c;
  }, [pool]);

  const available = useMemo(() => {
    const q = query.toLowerCase().trim();
    return pool.filter(p => {
      const t = p.type || 'Misc';
      if (topFilter === 'tea' && t === 'Teaware') return false;
      if (topFilter === 'teaware' && t !== 'Teaware') return false;
      if (teaSubFilter && t !== teaSubFilter) return false;
      if (!q) return true;
      const hay = `${p.givenName ?? ''} ${p.productName ?? ''} ${p.chineseName ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [pool, query, topFilter, teaSubFilter]);

  // When switching to Teaware, drop any tea-only sub-filter.
  useEffect(() => {
    if (topFilter === 'teaware' && teaSubFilter) setTeaSubFilter(null);
  }, [topFilter, teaSubFilter]);

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

  const topChip = (key: TopFilter, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTopFilter(key)}
      className={`px-2.5 py-1 rounded-md text-[11px] tracking-wide transition-colors ${
        topFilter === key
          ? 'bg-tea-gold/15 text-tea-text'
          : 'bg-tea-elevated/60 text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated'
      }`}
    >
      {label} <span className="text-tea-text-dim num ml-0.5">{count}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <button aria-label="Close" className="absolute inset-0 bg-tea-bg/80 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      <div className="relative w-full max-w-md bg-tea-surface border border-tea-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-tea-gold/10 flex items-center justify-center flex-shrink-0">
              <Plus size={14} className="text-tea-gold" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-medium text-tea-text tracking-wide">Add to collection</h2>
              <p className="text-[11px] text-tea-text-dim mt-0.5 num">{pool.length} available</p>
            </div>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40 p-1 -mr-1" aria-label="Close">
            <XIcon size={15} />
          </button>
        </header>

        <div className="px-5 pb-3 flex flex-col gap-2.5">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter by name…"
              autoFocus
              className="w-full pl-8 pr-3 py-2 text-xs bg-tea-bg border border-tea-border rounded-lg outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {topChip('all', 'All', counts.all)}
            {topChip('tea', 'Tea', counts.tea)}
            {topChip('teaware', 'Teaware', counts.teaware)}
          </div>

          {topFilter !== 'teaware' && (
            <div className="flex flex-wrap gap-1">
              {TEA_TYPE_FILTERS.filter(t => (counts.byType.get(t) ?? 0) > 0).map(t => {
                const active = teaSubFilter === t;
                const c = counts.byType.get(t) ?? 0;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTeaSubFilter(active ? null : t)}
                    className={`px-2 py-0.5 rounded-md text-[11px] transition-colors ${
                      active
                        ? 'bg-tea-gold/12 text-tea-gold'
                        : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated/60'
                    }`}
                  >
                    {t} <span className={`num ml-0.5 ${active ? 'text-tea-gold/70' : 'text-tea-text-dim'}`}>{c}</span>
                  </button>
                );
              })}
              {teaSubFilter && (
                <button
                  type="button"
                  onClick={() => setTeaSubFilter(null)}
                  className="px-2 py-0.5 rounded-md text-[11px] text-tea-text-dim hover:text-tea-text transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-3">
          {available.length === 0 ? (
            <p className="py-6 text-xs text-tea-text-dim text-center italic">
              {query || teaSubFilter || topFilter !== 'all'
                ? 'Nothing matches these filters.'
                : 'All products are already in this collection.'}
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
type PublishMode = 'person' | 'store' | 'tag';

interface NetworkStore {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  location_city?: string;
  location_country?: string;
}

const AddPublicationSheet: React.FC<{
  collectionId: string;
  collectionTitle: string;
  stores: NetworkStore[];
  onClose: () => void;
  onPublished: () => void;
  disabled: boolean;
}> = ({ collectionId, collectionTitle, stores, onClose, onPublished, disabled }) => {
  const { activeAccountId } = useAppStore();
  const [mode, setMode] = useState<PublishMode>('person');
  const [recipients, setRecipients] = useState<CollectionRecipient[]>([]);
  const [storeQuery, setStoreQuery] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [tagFilter, setTagFilter] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.customerTags.listAll().then(setAllTags).catch(() => setAllTags([]));
  }, []);

  const filteredTags = useMemo(() => {
    if (!tagFilter.trim()) return allTags;
    const q = tagFilter.toLowerCase();
    return allTags.filter(t => t.tag.includes(q));
  }, [allTags, tagFilter]);

  const eligibleStores = useMemo(
    () => stores.filter(s => s.id !== activeAccountId),
    [stores, activeAccountId]
  );
  const filteredStores = useMemo(() => {
    if (!storeQuery.trim()) return eligibleStores;
    const q = storeQuery.toLowerCase();
    return eligibleStores.filter(s =>
      s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q)
    );
  }, [eligibleStores, storeQuery]);
  const selectedStore = eligibleStores.find(s => s.id === selectedStoreId) || null;

  const submit = async () => {
    if (submitting || disabled) return;
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'person') {
        if (recipients.length === 0) {
          setError('Add at least one recipient.');
          return;
        }
        await api.collections.publish(collectionId, recipients);
      } else if (mode === 'tag') {
        if (!selectedTag) {
          setError('Pick a tag to share with.');
          return;
        }
        await api.collections.publishToTag(collectionId, selectedTag);
      } else {
        if (!selectedStoreId) {
          setError('Pick a store to share with.');
          return;
        }
        await api.collections.publishToStore(collectionId, selectedStoreId);
      }
      onPublished();
    } catch (err: any) {
      setError(err?.message || 'Publish failed');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = mode === 'person'
    ? recipients.length > 0
    : mode === 'tag'
      ? !!selectedTag
      : !!selectedStoreId;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <button aria-label="Close" className="absolute inset-0 bg-tea-bg/80 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      <div className="relative w-full max-w-md bg-tea-surface border border-tea-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-tea-gold/10 flex items-center justify-center flex-shrink-0">
              <UserPlus size={14} className="text-tea-gold" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-medium text-tea-text tracking-wide">Share collection</h2>
              <p className="text-[11px] text-tea-text-dim mt-0.5 truncate">{collectionTitle}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40 p-1 -mr-1" aria-label="Close">
            <XIcon size={15} />
          </button>
        </header>

        <div className="px-5 pb-3 flex-shrink-0">
          <div role="tablist" className="grid grid-cols-3 gap-1 p-1 bg-tea-bg border border-tea-border rounded-lg">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'person'}
              onClick={() => { setMode('person'); setError(null); }}
              className={`flex items-center justify-center gap-1.5 py-2 text-[11px] uppercase tracking-wide rounded-md transition-colors ${
                mode === 'person' ? 'bg-tea-surface text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
              }`}
            >
              <UserIcon size={11} /> Person
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'tag'}
              onClick={() => { setMode('tag'); setError(null); }}
              className={`flex items-center justify-center gap-1.5 py-2 text-[11px] uppercase tracking-wide rounded-md transition-colors ${
                mode === 'tag' ? 'bg-tea-surface text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
              }`}
            >
              <TagIcon size={11} /> By tag
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'store'}
              onClick={() => { setMode('store'); setError(null); }}
              className={`flex items-center justify-center gap-1.5 py-2 text-[11px] uppercase tracking-wide rounded-md transition-colors ${
                mode === 'store' ? 'bg-tea-surface text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
              }`}
            >
              <Building2 size={11} /> Store
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-3">
          {mode === 'person' ? (
            <>
              <p className="text-[11px] text-tea-text-dim mb-3">
                Each recipient gets the same link. Only people with the link can see the page.
              </p>
              <RecipientTypeahead value={recipients} onChange={setRecipients} collectionId={collectionId} autoFocus />
            </>
          ) : mode === 'tag' ? (
            <>
              <p className="text-[11px] text-tea-text-dim mb-3">
                Publishes the collection to everyone tagged with the chosen tag. Recipients are snapshotted now, so adding or removing the tag later won't change who has the link.
              </p>
              <div className="relative mb-2">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
                <input
                  type="text"
                  value={tagFilter}
                  onChange={e => setTagFilter(e.target.value)}
                  placeholder="Filter tags…"
                  autoFocus
                  className="w-full pl-8 pr-3 py-2 text-xs bg-tea-bg border border-tea-border rounded-lg outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
                />
              </div>
              {filteredTags.length === 0 ? (
                <p className="py-6 text-xs text-tea-text-dim text-center">
                  {tagFilter ? 'No tags match that search.' : 'No contact tags yet. Add tags to people in the People view first.'}
                </p>
              ) : (
                <ul className="space-y-1">
                  {filteredTags.map(t => {
                    const isSel = t.tag === selectedTag;
                    return (
                      <li key={t.tag}>
                        <button
                          type="button"
                          onClick={() => setSelectedTag(t.tag)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                            isSel ? 'bg-tea-gold-lt' : 'bg-tea-bg hover:bg-tea-elevated'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center transition-colors ${
                            isSel ? 'bg-tea-gold' : 'bg-tea-surface'
                          }`}>
                            {isSel && <Check size={10} className="text-tea-bg" strokeWidth={3} />}
                          </div>
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                            <p className="text-sm text-tea-text truncate">{t.tag}</p>
                            <p className="text-[11px] text-tea-text-dim shrink-0">{t.count}</p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <>
              <p className="text-[11px] text-tea-text-dim mb-3">
                The receiving store sees this collection in their admin. They choose which products to import into their own inventory.
              </p>
              <div className="relative mb-2">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
                <input
                  type="text"
                  value={storeQuery}
                  onChange={e => setStoreQuery(e.target.value)}
                  placeholder="Search stores…"
                  autoFocus
                  className="w-full pl-8 pr-3 py-2 text-xs bg-tea-bg border border-tea-border rounded-lg outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
                />
              </div>
              {filteredStores.length === 0 ? (
                <p className="py-6 text-xs text-tea-text-dim text-center">
                  {storeQuery ? 'No stores match that search.' : 'No partner stores yet.'}
                </p>
              ) : (
                <ul className="space-y-1">
                  {filteredStores.map(s => {
                    const isSel = s.id === selectedStoreId;
                    const locality = [s.location_city, s.location_country].filter(Boolean).join(', ');
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedStoreId(s.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                            isSel ? 'bg-tea-gold-lt' : 'bg-tea-bg hover:bg-tea-elevated'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center transition-colors ${
                            isSel ? 'bg-tea-gold' : 'bg-tea-surface'
                          }`}>
                            {isSel && <Check size={10} className="text-tea-bg" strokeWidth={3} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-tea-text truncate">{s.name}</p>
                            {locality && <p className="text-[11px] text-tea-text-dim truncate">{locality}</p>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
          {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
        </div>

        <footer className="flex items-center justify-between gap-3 px-5 py-4 border-t border-tea-border flex-shrink-0">
          <button onClick={onClose} disabled={submitting} className="text-xs text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40">Cancel</button>
          <button
            onClick={submit}
            disabled={!canSubmit || submitting || disabled}
            className="flex items-center gap-2 px-4 py-2 bg-tea-gold text-tea-bg rounded-lg text-xs font-semibold tracking-wide hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting
              ? <><Loader2 size={12} className="animate-spin" /> {mode === 'person' ? 'Publishing…' : mode === 'tag' ? 'Publishing…' : 'Sharing…'}</>
              : mode === 'person' ? <>Create link</>
              : mode === 'tag' ? <>Publish to {selectedTag ? `"${selectedTag}"` : 'tag'}</>
              : <>Share {selectedStore ? `to ${selectedStore.name}` : ''}</>}
          </button>
        </footer>
      </div>
    </div>
  );
};
