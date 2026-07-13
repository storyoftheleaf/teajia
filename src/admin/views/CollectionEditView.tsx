import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Loader2, Trash2, Plus, ImagePlus,
  X as XIcon, Search, Copy, Check, AlertTriangle, Archive,
  User as UserIcon, Building2, Tag as TagIcon, Send, ArrowRight,
  CheckCircle2, MessageCircle, GripVertical, Link as LinkIcon,
} from 'lucide-react';
import { api, collectionShareUrl } from '../../lib/api';
import { buildWhatsAppUrl } from '../../lib/whatsapp';
import { useAppStore } from '../../lib/store';
import { useToast } from '../components/Toast';
import { useProducts } from '../hooks/useAdminData';
import { RecipientTypeahead } from '../components/collections/RecipientTypeahead';
import { STATUS_PILL_VARIANTS, STATUS_PILL_BASE, type StatusPillVariant } from '../constants';
import { ConfirmModal } from '../components/ConfirmModal';
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

// One product row in the builder. Shows the product, reorder/remove controls, and
// an inline "recommend" editor: how much of this tea the curator suggests and the
// price they're quoting for that amount. Both save on blur.
const CollectionItemRow: React.FC<{
  collectionId: string;
  item: CollectionItem;
  position: number;
  working: boolean;
  focused: boolean;
  focusRef: React.RefObject<HTMLLIElement | null>;
  oos: boolean;
  archived: boolean;
  dragging: boolean;
  dragOver: boolean;
  onRemove: (itemId: string) => void;
  onSaved: () => void;
  onError: (msg: string) => void;
  onDragStart: (itemId: string) => void;
  onDragEnter: (itemId: string) => void;
  onDragEnd: () => void;
  onDrop: () => void;
}> = ({ collectionId, item, position, working, focused, focusRef, oos, archived, dragging, dragOver, onRemove, onSaved, onError, onDragStart, onDragEnter, onDragEnd, onDrop }) => {
  const isTeaware = item.product_type === 'Teaware';
  const unitLabel = isTeaware ? 'units' : 'grams';
  const [qty, setQty] = useState(item.recommended_quantity ?? '');
  const [price, setPrice] = useState(
    item.recommended_price_usd === null || item.recommended_price_usd === undefined ? '' : String(item.recommended_price_usd),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setQty(item.recommended_quantity ?? '');
    setPrice(item.recommended_price_usd === null || item.recommended_price_usd === undefined ? '' : String(item.recommended_price_usd));
  }, [item.id, item.recommended_quantity, item.recommended_price_usd]);

  const saveQty = async () => {
    const current = item.recommended_quantity ?? '';
    if (qty.trim() === current.trim()) return;
    setSaving(true);
    try {
      await api.collections.patchItem(collectionId, item.id, { recommended_quantity: qty.trim() || null });
      onSaved();
    } catch (err: any) {
      onError(err?.message || 'Could not save recommended amount.');
    } finally {
      setSaving(false);
    }
  };

  const savePrice = async () => {
    const current = item.recommended_price_usd === null || item.recommended_price_usd === undefined ? '' : String(item.recommended_price_usd);
    if (price.trim() === current.trim()) return;
    const num = price.trim() === '' ? null : Number(price);
    if (num !== null && (!Number.isFinite(num) || num < 0)) {
      onError('Price must be a number.');
      setPrice(current);
      return;
    }
    setSaving(true);
    try {
      await api.collections.patchItem(collectionId, item.id, { recommended_price_usd: num });
      onSaved();
    } catch (err: any) {
      onError(err?.message || 'Could not save price.');
    } finally {
      setSaving(false);
    }
  };

  const catalogRate = item.fixed_retail_price_usd
    ? `$${item.fixed_retail_price_usd}/${isTeaware ? 'unit' : 'g'}`
    : '';

  // Two modes:
  // (a) Price blank + catalog rate exists: show what the blank will use.
  // (b) Price filled + qty filled: show the live breakdown so per-gram typos
  //     look obviously wrong (e.g. "$0.30 for 100g (~$0.003/g)").
  let priceHint = '';
  const qtyNum = Number(qty);
  const priceNum = Number(price);
  if (price.trim() !== '' && qty.trim() !== '' && Number.isFinite(qtyNum) && qtyNum > 0 && Number.isFinite(priceNum) && priceNum >= 0) {
    const perUnit = priceNum / qtyNum;
    const fmtTotal = `$${priceNum % 1 === 0 ? priceNum : priceNum.toFixed(2)}`;
    const fmtPer = `$${perUnit < 0.01 ? perUnit.toFixed(4) : perUnit.toFixed(2).replace(/\.?0+$/, '')}`;
    priceHint = isTeaware
      ? `= ${fmtTotal} for ${qtyNum} unit${qtyNum === 1 ? '' : 's'}`
      : `= ${fmtTotal} for ${qtyNum}g  (~${fmtPer}/g)`;
  } else if (price.trim() === '' && catalogRate) {
    priceHint = `Blank uses catalog ${catalogRate}`;
  }

  return (
    <li
      ref={focused ? focusRef : undefined}
      onDragOver={e => { e.preventDefault(); onDragEnter(item.id); }}
      onDrop={e => { e.preventDefault(); onDrop(); }}
      className={`relative flex flex-col gap-3 px-4 md:px-6 py-3 transition-colors ${
        focused ? 'bg-tea-gold-lt' : dragOver ? 'bg-tea-accent-sub' : 'hover:bg-tea-accent-sub'
      } ${dragging ? 'opacity-40' : ''}`}
    >
      {/* Drop indicator — a bronze hairline at the top edge of the hovered row. */}
      {dragOver && !dragging && (
        <span className="absolute left-0 right-0 top-0 h-px bg-tea-gold" aria-hidden />
      )}
      <div className="flex items-start gap-2">
        {/* Drag handle — the grip is the draggable surface, so inputs stay usable. */}
        <button
          type="button"
          draggable
          onDragStart={() => onDragStart(item.id)}
          onDragEnd={onDragEnd}
          disabled={working}
          className="tap-target shrink-0 -ml-1 mt-0.5 p-1 text-tea-text-dim hover:text-tea-text-sec cursor-grab active:cursor-grabbing transition-colors disabled:opacity-30"
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
        <span className="w-4 shrink-0 text-right text-ui-12 text-tea-text-dim num leading-6">
          {position}
        </span>
        {/* Thumbnail only when there's a real photo — no empty grey square. */}
        {item.image_url && (
          <div className="w-9 h-9 flex-shrink-0 rounded-md bg-tea-elevated overflow-hidden mt-0.5">
            <img src={item.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
        {/* Name is the hero — full width, two lines allowed before it ever clips. */}
        <div className="flex-1 min-w-0">
          <div className="font-display text-ui-15 text-tea-text leading-snug">
            <span className="break-words">{item.product_name || 'Untitled'}</span>
            {item.chinese_name && (
              <span className="text-tea-text-dim ml-1.5 text-ui-12">{item.chinese_name}</span>
            )}
          </div>
          <div className="text-ui-12 text-tea-text-dim mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate">
              {[item.origin_region, item.origin_country].filter(Boolean).join(', ') || item.product_type}
            </span>
            {archived && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-tea-elevated text-tea-text-dim text-ui-9 uppercase tracking-caps shrink-0">
                <Archive size={8} /> Archived
              </span>
            )}
            {!archived && oos && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-tea-elevated text-tea-text-sec text-ui-9 uppercase tracking-caps shrink-0">
                <AlertTriangle size={8} /> Out of stock
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => onRemove(item.id)}
          disabled={working}
          className="tap-target shrink-0 -mt-1 p-1.5 text-tea-text-sec hover:text-tea-error transition-colors"
          aria-label="Remove"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Recommend: amount + price you're quoting for this tea. Indented to the
          name column (past the grip + index) so the row reads as one unit. */}
      <div className="flex flex-wrap items-end gap-3 pl-12">
        <label className="flex flex-col gap-1">
          <span className="text-ui-9 uppercase tracking-caps text-tea-text-dim">Recommend ({unitLabel})</span>
          <input
            type="text"
            inputMode="numeric"
            value={qty}
            onChange={e => setQty(e.target.value)}
            onBlur={saveQty}
            placeholder={isTeaware ? '1' : '50'}
            className="input-warm w-24 px-2.5 py-1.5 text-ui-13"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-ui-9 uppercase tracking-caps text-tea-text-dim">Total price (USD)</span>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={e => setPrice(e.target.value)}
            onBlur={savePrice}
            placeholder={item.fixed_retail_price_usd ? String(item.fixed_retail_price_usd) : '0.00'}
            className="input-warm w-28 px-2.5 py-1.5 text-ui-13"
          />
        </label>
        {priceHint && (
          <span className="text-ui-11 text-tea-text-dim pb-2">{priceHint}</span>
        )}
        {saving && <Loader2 size={12} className="animate-spin text-tea-text-dim mb-2" />}
      </div>
    </li>
  );
};

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
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const focusRef = useRef<HTMLLIElement | null>(null);

  // Drag-and-drop reorder. `order` is a local id list that lets dragging feel
  // instant; it tracks the server order until the user drags, then commits.
  const [order, setOrder] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  // Link-first send: "Copy link" creates an open (recipient-less) link and
  // copies it. `copyingLink` guards the in-flight create; `linkCopied` flashes.
  const [copyingLink, setCopyingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  // Remember the open link's slug locally so a second click reuses it even
  // before the server refetch lands — never mint two open links.
  const openLinkSlugRef = useRef<string | null>(null);

  useEffect(() => {
    if (detail) {
      setTitleDraft(detail.collection.title);
      setNoteDraft(detail.collection.note ?? '');
    }
    openLinkSlugRef.current = null; // new collection — forget the prior open link
  }, [detail?.collection.id]);

  // Keep the local drag order in sync with the server, except mid-drag (the
  // drag handlers own `order` while a drag is in flight).
  const itemIdsKey = (detail?.items ?? []).map(i => i.id).join(',');
  useEffect(() => {
    if (draggingId) return;
    setOrder((detail?.items ?? []).map(i => i.id));
  }, [itemIdsKey, draggingId]);

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
      showToast(err?.message || 'Could not save collection details. Try again.', 'error');
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

  const handleDragEnter = (overId: string) => {
    if (!draggingId || overId === draggingId) { setDragOverId(overId === draggingId ? null : overId); return; }
    setDragOverId(overId);
    setOrder(prev => {
      const from = prev.indexOf(draggingId);
      const to = prev.indexOf(overId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = prev.slice();
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  };

  const commitOrder = async () => {
    const dropped = draggingId;
    setDraggingId(null);
    setDragOverId(null);
    if (!id || !dropped) return;
    const serverOrder = (detail?.items ?? []).map(i => i.id);
    if (order.length === serverOrder.length && order.every((x, i) => x === serverOrder[i])) return; // no change
    try {
      await api.collections.reorderItems(id, order);
      invalidate();
    } catch (err: any) {
      showToast(err?.message || 'Could not reorder collection items. Try again.', 'error');
      invalidate(); // resync to server truth on failure
    }
  };

  const removeItem = async (itemId: string) => {
    if (!id || working) return;
    setWorking(true);
    try {
      await api.collections.removeItem(id, itemId);
      invalidate();
    } catch (err: any) {
      showToast(err?.message || 'Could not remove item from collection. Try again.', 'error');
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
      showToast(err?.message || 'Could not unpublish this collection. Try again.', 'error');
    }
  };

  // The primary, most-common action: get a link to the public page and copy it.
  // Reuses an existing open (recipient-less) link if one is already active so we
  // don't mint a new link on every click; otherwise creates one. The recipient
  // needs no account to open it.
  const copyShareLink = async () => {
    if (!id || copyingLink) return;
    setCopyingLink(true);
    try {
      // Reuse, in order: a link we already made this session, then any open link
      // from the server, else create one. Guarantees the same link every time.
      const openPub = (detail?.publications ?? []).find(
        p => !p.unpublished_at && p.target_type === 'person' && p.recipients.length === 0,
      );
      let slug = openLinkSlugRef.current || openPub?.slug;
      if (!slug) {
        const res = await api.collections.publish(id, []); // open link, no recipients
        slug = res.slug;
        invalidate();
      }
      openLinkSlugRef.current = slug;
      const url = collectionShareUrl(slug);
      try {
        await navigator.clipboard.writeText(url);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1800);
      } catch {
        // Clipboard blocked (rare): surface the URL so the link is never lost.
        showToast(url, 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not create a link. Try again.', 'error');
    } finally {
      setCopyingLink(false);
    }
  };

  const setStatus = async (status: CollectionStatus) => {
    if (!id) return;
    try {
      await api.collections.update(id, { status });
      queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
      invalidate();
    } catch (err: any) {
      showToast(err?.message || 'Could not update collection status. Try again.', 'error');
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
      <div className="py-20 text-center text-sm text-tea-error">
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
      {/* Top bar — back link left, status pill right */}
      <div className="max-w-3xl mx-auto w-full px-4 md:px-6 pt-6 md:pt-8 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/admin/collections')}
            className="inline-flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
          >
            <ArrowLeft size={14} /> Collections
          </button>
          <StatusPill status={detail.collection.status} onSet={setStatus} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-nav-gap-lg">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-8">

          {/* Title + note */}
          <section className="flex flex-col gap-3">
            <input
              type="text"
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={() => titleChanged && titleDraft.trim() && saveMeta({ title: titleDraft.trim() })}
              placeholder="Untitled collection"
              className="h2 w-full bg-transparent border-b border-tea-border focus:border-tea-gold outline-none py-2 placeholder:text-tea-text-dim"
            />
            <textarea
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              onBlur={() => noteChanged && saveMeta({ note: noteDraft })}
              placeholder="A short note for whoever opens the link — this shows above the product list on the public page."
              rows={2}
              className="body-light w-full bg-transparent border-none outline-none resize-none italic placeholder:text-tea-text-dim"
            />
            {savingMeta && <p className="text-ui-10 text-tea-text-dim">Saving…</p>}
          </section>

          {/* Hero image */}
          <section className="flex flex-col gap-2">
            <h3 className="h3">Hero image</h3>
            <p className="label-caps text-tea-text-dim">Optional — appears at the top of the public collection page.</p>
            {detail.collection.hero_image_url ? (
              <div className="relative group rounded-xl overflow-hidden bg-tea-elevated border border-tea-border">
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
              <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-3 border border-dashed border-tea-border rounded-xl text-xs text-tea-text-sec hover:text-tea-text hover:border-tea-gold transition-colors w-fit">
                {uploadingHero ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                {uploadingHero ? 'Uploading…' : 'Upload hero image'}
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
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="h3">Products</h3>
                <p className="label-caps text-tea-text-dim mt-0.5">
                  {detail.items.length} ITEM{detail.items.length === 1 ? '' : 'S'}
                </p>
              </div>
              <button
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
              >
                <Plus size={13} /> Add products
              </button>
            </div>
            {detail.items.length === 0 ? (
              <div className="bg-tea-surface border border-tea-border rounded-xl">
                <div className="flex flex-col items-center justify-center py-12 px-6 gap-3 text-center">
                  <p className="font-display text-ui-16 text-tea-text">No products yet</p>
                  <p className="text-ui-12 text-tea-text-dim">Add some to make this collection shareable.</p>
                  <button
                    onClick={() => setAddOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
                  >
                    <Plus size={13} /> Add products
                  </button>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
                {(() => {
                  const byId = new Map(detail.items.map(i => [i.id, i]));
                  const ordered = order.length
                    ? order.map(oid => byId.get(oid)).filter(Boolean) as CollectionItem[]
                    : detail.items;
                  return ordered.map((item, idx) => {
                    const oos = productIsOOS(item);
                    const archived = Boolean(item.product_status && item.product_status !== 'Active');
                    const focused = item.id === focusItemId;
                    return (
                      <CollectionItemRow
                        key={item.id}
                        collectionId={id!}
                        item={item}
                        position={idx + 1}
                        working={working}
                        focused={focused}
                        focusRef={focusRef}
                        oos={oos}
                        archived={archived}
                        dragging={draggingId === item.id}
                        dragOver={dragOverId === item.id}
                        onRemove={(itemId) => setPendingRemoveId(itemId)}
                        onSaved={invalidate}
                        onError={(msg) => showToast(msg, 'error')}
                        onDragStart={(itemId) => { setDraggingId(itemId); setDragOverId(itemId); }}
                        onDragEnter={handleDragEnter}
                        onDragEnd={commitOrder}
                        onDrop={commitOrder}
                      />
                    );
                  });
                })()}
              </ul>
            )}
          </section>

          {/* Send — link-first. Copying a link is the common path; the recipient
              opens the public page and picks, no account needed. Sending to a
              specific person / tag / tea house is the optional path below. */}
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="h3">Send</h3>
              <p className="label-caps text-tea-text-dim mt-0.5">
                {detail.publications.filter(p => !p.unpublished_at).length} ACTIVE LINK{detail.publications.filter(p => !p.unpublished_at).length === 1 ? '' : 'S'}
              </p>
            </div>

            {!canPublish ? (
              <div className="bg-tea-surface border border-tea-border rounded-xl">
                <div className="flex flex-col items-center justify-center py-12 px-6 gap-3 text-center">
                  <Send size={28} strokeWidth={1.25} className="text-tea-text-dim" />
                  <p className="font-display text-ui-16 text-tea-text">Nothing to send yet</p>
                  <p className="text-ui-12 text-tea-text-dim">
                    Add at least one product above, then share a link.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Primary action — copy a link to send however you like. */}
                <div className="bg-tea-surface border border-tea-border rounded-xl px-5 py-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-md bg-tea-elevated flex items-center justify-center flex-shrink-0">
                    <LinkIcon size={15} className="text-tea-gold" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-ui-15 text-tea-text">Share a link</p>
                    <p className="text-ui-12 text-tea-text-dim mt-0.5">
                      Anyone with the link can view and pick. No account needed.
                    </p>
                  </div>
                  <button
                    onClick={copyShareLink}
                    disabled={copyingLink}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {copyingLink
                      ? <><Loader2 size={13} className="animate-spin" /> …</>
                      : linkCopied
                        ? <><Check size={13} /> Copied</>
                        : <><Copy size={13} /> Copy link</>}
                  </button>
                </div>

                {/* Optional — send to a specific person / tag / tea house. */}
                <button
                  onClick={() => setPublishOpen(true)}
                  className="group w-full inline-flex items-center justify-center gap-1.5 text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors py-1"
                >
                  <Send size={12} />
                  Or send to a specific person, tag, or tea house
                  <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </button>

                {detail.publications.length > 0 && (
                  <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden mt-1">
                    {detail.publications.map(pub => (
                      <PublicationRow
                        key={pub.id}
                        pub={pub}
                        storeNameById={storeNameById}
                        onUnpublish={() => unpublish(pub.id)}
                      />
                    ))}
                  </ul>
                )}
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
          onPublished={(opts) => { invalidate(); if (!opts?.keepOpen) setPublishOpen(false); }}
          disabled={!canPublish}
        />
      )}

      <ConfirmModal
        isOpen={!!pendingRemoveId}
        onClose={() => setPendingRemoveId(null)}
        onConfirm={async () => {
          if (pendingRemoveId) {
            await removeItem(pendingRemoveId);
            setPendingRemoveId(null);
          }
        }}
        title="Remove from collection?"
        description="This tea will be removed from the collection. The product itself is not deleted."
        confirmLabel="Remove"
        variant="destructive"
        isLoading={working}
      />
    </div>
  );
};

// ── Status pill with menu ──
const StatusPill: React.FC<{ status: CollectionStatus; onSet: (s: CollectionStatus) => void }> = ({ status, onSet }) => {
  const [open, setOpen] = useState(false);
  const label: Record<CollectionStatus, string> = { draft: 'Draft', active: 'Active', archived: 'Archived' };
  const variantFor = (s: CollectionStatus): StatusPillVariant =>
    s === 'active' ? 'active' : s === 'archived' ? 'archived' : 'draft';
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`${STATUS_PILL_BASE} ${STATUS_PILL_VARIANTS[variantFor(status)]} cursor-pointer`}
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
          <div className="absolute right-0 top-[calc(100%+6px)] z-dropdown bg-tea-elevated border border-tea-border rounded-xl shadow-lg py-1 min-w-[130px]">
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
  const url = collectionShareUrl(pub.slug);
  const isStore = pub.target_type === 'store';
  // A person-target publication with no recipients is an open "copy link" share.
  const isOpenLink = !isStore && pub.recipients.length === 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  const headline = isStore
    ? (pub.target_id && storeNameById?.get(pub.target_id)) || 'Partner tea house'
    : isOpenLink
      ? 'Open link'
      : pub.recipients.map(r => r.name).join(', ');

  return (
    <li className={`flex items-center gap-3 px-4 md:px-6 py-3 transition-colors ${active ? 'hover:bg-tea-accent-sub' : 'opacity-60'}`}>
      <div className="w-8 h-8 rounded-md bg-tea-elevated flex items-center justify-center flex-shrink-0 text-tea-text-sec">
        {isStore ? <Building2 size={14} /> : isOpenLink ? <LinkIcon size={14} /> : <UserIcon size={14} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display text-ui-15 text-tea-text truncate flex items-center gap-1.5">
          {headline}
          {isStore && (
            <span className="text-ui-9 uppercase tracking-caps text-tea-text-dim">tea house</span>
          )}
        </div>
        <div className="text-ui-12 text-tea-text-dim truncate mt-1">
          {isStore
            ? `${active ? `shared ${formatWhen(pub.published_at)}` : `unpublished ${formatWhen(pub.unpublished_at)}`}`
            : `/c/${pub.slug} · ${pub.view_count} view${pub.view_count !== 1 ? 's' : ''} · ${active ? `shared ${formatWhen(pub.published_at)}` : `unpublished ${formatWhen(pub.unpublished_at)}`}`}
        </div>
      </div>
      {active && (
        <div className="flex items-center gap-1 shrink-0">
          {!isStore && (
            <button
              onClick={copy}
              className="tap-target p-1.5 text-tea-text-sec hover:text-tea-text transition-colors"
              title="Copy link"
            >
              {copied ? <Check size={13} className="text-tea-gold" /> : <Copy size={13} />}
            </button>
          )}
          <button
            onClick={onUnpublish}
            className="text-ui-11 text-tea-text-sec hover:text-tea-error transition-colors px-2 py-1"
          >
            {isStore ? 'Stop sharing' : 'Unpublish'}
          </button>
        </div>
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
      showToast(err?.message || 'Could not add items to collection. Try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const topChip = (key: TopFilter, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTopFilter(key)}
      className={`px-2.5 py-1 rounded-md text-ui-11 tracking-wide transition-colors ${
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
      <div className="relative w-full max-w-md bg-tea-surface border border-tea-border rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-tea-gold/10 flex items-center justify-center flex-shrink-0">
              <Plus size={14} className="text-tea-gold" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-medium text-tea-text tracking-wide">Add to collection</h2>
              <p className="text-ui-11 text-tea-text-sec mt-0.5 num">{pool.length} available</p>
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
              className="w-full pl-8 pr-3 py-2 text-xs bg-tea-bg border border-tea-border rounded-xl outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
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
                    className={`px-2 py-0.5 rounded-md text-ui-11 transition-colors ${
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
                  className="px-2 py-0.5 rounded-md text-ui-11 text-tea-text-dim hover:text-tea-text transition-colors"
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
                      <div className={`w-4 h-4 rounded-md flex-shrink-0 flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-tea-gold' : 'bg-tea-surface border border-tea-border'
                      }`}>
                        {isSelected && <Check size={9} className="text-tea-bg" strokeWidth={3} />}
                      </div>
                      <div className="w-8 h-8 flex-shrink-0 rounded bg-tea-elevated overflow-hidden">
                        {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-tea-text truncate">{p.givenName || p.productName}</p>
                        <p className="text-ui-10 text-tea-text-dim truncate">{p.type}{p.year ? ` · ${p.year}` : ''}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <footer className="flex justify-between gap-2 px-6 py-4 border-t border-tea-border flex-shrink-0">
          <button onClick={onClose} disabled={submitting} className="px-2 py-1 text-xs text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40">Cancel</button>
          <button
            onClick={submit}
            disabled={selected.size === 0 || submitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-tea-gold/10"
          >
            {submitting ? <><Loader2 size={13} className="animate-spin" /> Adding…</> : <>Add {selected.size || ''}</>}
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
  onPublished: (opts?: { keepOpen?: boolean }) => void;
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
  // After a person-send, show a success card with the link + WhatsApp deep-links
  // (matches the inventory-side CollectionShareSheet). Tag/store sends close
  // straight away — they have no per-recipient link to hand to the owner.
  const [sent, setSent] = useState<{ slug: string; recipients: CollectionRecipient[] } | null>(null);

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
        // Recipients are optional: zero recipients = an open link to copy and
        // send to anyone (including several people). Names are just the WhatsApp
        // shortcut + your record of who you sent it to.
        const { slug } = await api.collections.publish(collectionId, recipients);
        // Hold the sheet open on a success card so the owner can copy the link
        // or fire WhatsApp right away. invalidate() refreshes the editor behind it.
        onPublished({ keepOpen: true });
        setSent({ slug, recipients });
        return;
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
    ? true // open link allowed; recipients optional
    : mode === 'tag'
      ? !!selectedTag
      : !!selectedStoreId;

  if (sent) {
    return (
      <PublicationSuccessCard
        collectionTitle={collectionTitle}
        slug={sent.slug}
        recipients={sent.recipients}
        onDone={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <button aria-label="Close" className="absolute inset-0 bg-tea-bg/80 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      <div className="relative w-full max-w-md bg-tea-surface border border-tea-border rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-tea-gold/10 flex items-center justify-center flex-shrink-0">
              <Send size={14} className="text-tea-gold" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-medium text-tea-text tracking-wide">Send collection</h2>
              <p className="text-ui-11 text-tea-text-sec mt-0.5 truncate">{collectionTitle}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40 p-1 -mr-1" aria-label="Close">
            <XIcon size={15} />
          </button>
        </header>

        <div className="px-5 pb-3 flex-shrink-0">
          <div role="tablist" className="grid grid-cols-3 gap-1 p-1 bg-tea-bg border border-tea-border rounded-xl">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'person'}
              onClick={() => { setMode('person'); setError(null); }}
              className={`flex items-center justify-center gap-1.5 py-2 text-ui-11 uppercase tracking-wide rounded-md transition-colors ${
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
              className={`flex items-center justify-center gap-1.5 py-2 text-ui-11 uppercase tracking-wide rounded-md transition-colors ${
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
              className={`flex items-center justify-center gap-1.5 py-2 text-ui-11 uppercase tracking-wide rounded-md transition-colors ${
                mode === 'store' ? 'bg-tea-surface text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
              }`}
            >
              <Building2 size={11} /> Tea house
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-3">
          {mode === 'person' ? (
            <>
              <p className="text-ui-11 text-tea-text-dim mb-3">
                One link, shared with everyone you add. Adding names is optional and just gives you a WhatsApp shortcut. You can also send with no names and copy the link to share it yourself.
              </p>
              <RecipientTypeahead value={recipients} onChange={setRecipients} collectionId={collectionId} autoFocus />
            </>
          ) : mode === 'tag' ? (
            <>
              <p className="text-ui-11 text-tea-text-dim mb-3">
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
                  className="w-full pl-8 pr-3 py-2 text-xs bg-tea-bg border border-tea-border rounded-xl outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
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
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
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
                            <p className="text-ui-11 text-tea-text-dim shrink-0">{t.count}</p>
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
              <p className="text-ui-11 text-tea-text-dim mb-3">
                The receiving tea house sees this collection in their admin. They choose which products to import into their own inventory.
              </p>
              <div className="relative mb-2">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
                <input
                  type="text"
                  value={storeQuery}
                  onChange={e => setStoreQuery(e.target.value)}
                  placeholder="Search tea houses…"
                  autoFocus
                  className="w-full pl-8 pr-3 py-2 text-xs bg-tea-bg border border-tea-border rounded-xl outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
                />
              </div>
              {filteredStores.length === 0 ? (
                <p className="py-6 text-xs text-tea-text-dim text-center">
                  {storeQuery ? 'No tea houses match that search.' : 'No partner tea houses yet.'}
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
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
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
                            {locality && <p className="text-ui-11 text-tea-text-dim truncate">{locality}</p>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
          {error && <p className="text-xs text-tea-error mt-3">{error}</p>}
        </div>

        <footer className="flex justify-between gap-2 px-6 py-4 border-t border-tea-border flex-shrink-0">
          <button onClick={onClose} disabled={submitting} className="px-2 py-1 text-xs text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40">Cancel</button>
          <button
            onClick={submit}
            disabled={!canSubmit || submitting || disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-tea-gold/10"
          >
            {submitting
              ? <><Loader2 size={13} className="animate-spin" /> Sending…</>
              : mode === 'person' ? <>Send link</>
              : mode === 'tag' ? <>Send to {selectedTag ? `"${selectedTag}"` : 'tag'}</>
              : <>Send {selectedStore ? `to ${selectedStore.name}` : ''}</>}
          </button>
        </footer>
      </div>
    </div>
  );
};

// ── Send success card ──
// Shown after a person-send: the shareable link to copy and one-tap WhatsApp
// deep-links for recipients with a phone on file. Mirrors the inventory-side
// CollectionShareSheet success view so sending feels the same from either entry.
const PublicationSuccessCard: React.FC<{
  collectionTitle: string;
  slug: string;
  recipients: CollectionRecipient[];
  onDone: () => void;
}> = ({ collectionTitle, slug, recipients, onDone }) => {
  const [copied, setCopied] = useState(false);
  const url = collectionShareUrl(slug);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — silent */ }
  };

  const withPhone = recipients.filter(r => r.phone && r.phone.trim());
  const withoutPhone = recipients.filter(r => !r.phone || !r.phone.trim());

  const messageFor = (r: CollectionRecipient) => {
    const greeting = r.name ? `Hi ${r.name.split(' ')[0]} — ` : 'Hi — ';
    return `${greeting}I made a small collection for you: ${collectionTitle}.\n\n${url}`;
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <button aria-label="Close" className="absolute inset-0 bg-tea-bg/80 backdrop-blur-sm" onClick={onDone} />
      <div className="relative w-full max-w-md bg-tea-surface border border-tea-border rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-tea-gold-lt flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={15} className="text-tea-gold" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-medium text-tea-text tracking-wide truncate">Sent.</h2>
              <p className="text-ui-11 text-tea-text-dim mt-0.5 truncate">{collectionTitle}</p>
            </div>
          </div>
          <button onClick={onDone} className="text-tea-text-sec hover:text-tea-text transition-colors p-1 -mr-1" aria-label="Close">
            <XIcon size={15} />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 pt-2 flex flex-col gap-4">
          <div>
            <label className="block text-ui-10 uppercase tracking-caps text-tea-text-dim mb-1.5">
              Shareable link
            </label>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 min-w-0 px-3 py-2 bg-tea-bg border border-tea-border rounded-xl overflow-hidden">
                <p className="text-ui-12 text-tea-text font-mono truncate">{url}</p>
              </div>
              <button
                onClick={copyUrl}
                className="flex items-center gap-1.5 px-3 py-2 bg-tea-elevated text-tea-text rounded-xl text-ui-11 uppercase tracking-wide hover:bg-tea-gold-lt hover:text-tea-gold transition-colors"
              >
                {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>
          </div>

          {withPhone.length > 0 && (
            <div>
              <label className="block text-ui-10 uppercase tracking-caps text-tea-text-dim mb-1.5">
                Send via WhatsApp
              </label>
              <ul className="flex flex-col gap-1.5">
                {withPhone.map((r, i) => (
                  <li key={`${r.customer_id ?? 'n'}_${i}`}>
                    <a
                      href={buildWhatsAppUrl(r.phone || '', messageFor(r))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-3 py-2.5 bg-tea-bg border border-tea-border rounded-xl hover:border-tea-gold/40 hover:bg-tea-elevated transition-colors group"
                    >
                      <MessageCircle size={13} className="text-tea-gold flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-ui-13 text-tea-text truncate">{r.name}</p>
                        <p className="text-ui-10 text-tea-text-dim truncate font-mono">{r.phone}</p>
                      </div>
                      <span className="text-ui-10 uppercase tracking-caps text-tea-text-sec group-hover:text-tea-gold transition-colors">
                        Send
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {withoutPhone.length > 0 && (
            <div className="px-3 py-2.5 bg-tea-bg rounded-xl">
              <p className="text-ui-10 uppercase tracking-caps text-tea-text-dim mb-1">No phone on file</p>
              <p className="text-ui-11 text-tea-text-sec">
                Copy the link and send it to{' '}
                {withoutPhone.map((r, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && (i === withoutPhone.length - 1 ? ' and ' : ', ')}
                    <span className="text-tea-text">{r.name}</span>
                  </React.Fragment>
                ))}{' '}
                however suits.
              </p>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 px-5 py-4 border-t border-tea-border flex-shrink-0">
          <button
            onClick={onDone}
            className="px-4 py-2 bg-tea-gold text-tea-bg rounded-xl text-xs font-semibold tracking-wide hover:bg-tea-gold/90 transition-colors"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
};
