import React, { useState, useCallback, useRef, useEffect } from 'react';
import { mediaUrl } from '../../lib/mediaUrl';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Pencil, Trash2, Check, Loader2, Camera,
  Mic, BookmarkPlus, BookmarkCheck,
  ShoppingBag, Droplets, AlertTriangle, Star, ChevronLeft, ChevronRight, X, RefreshCw,
  Heart, ThumbsUp, Minus, ThumbsDown,
} from 'lucide-react';
import type { CompassVerdict } from './types';
import { entryDisplayTitle } from './types';
import { AddToSampleButton } from '../samples/AddToSampleButton';
import { getTeaColor } from '../../designTokens';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useLedgerStore } from '../../lib/ledgerStore';
import { api } from '../../lib/api';
import { TastingSession } from '../tasting/TastingSession';
import type { TastingData } from '../../types';
import { TastingProfileStrip } from '../tasting/TastingProfileStrip';
import { compressImage } from '../../lib/imageCompressor';
import type { TeaCompassEntry } from './types';
import { TeaLedgerRow } from '../shop/TeaLedger';
import { LIQUOR_COLORS } from '../../data/tastingTaxonomy';
import { DecisionControl } from './DecisionControl';
import { CreateInventoryRecordAction } from './CreateInventoryRecordAction';

export interface BrowseCardProps {
  entry: TeaCompassEntry;
  onEdit: (id: string) => void;
  /** Shows a queue/prioritise button, used in the To Taste filter */
  tasteQueueActive?: boolean;
  /** Desktop: fires instead of expand-in-place when provided */
  onSelect?: (id: string) => void;
  /** Desktop: shows selection highlight on the card */
  isSelected?: boolean;
  onAcquire?: (id: string) => void;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', NT: 'NT$', Yuan: 'CN¥', IDR: 'Rp', JPY: 'JP¥', MYR: 'RM', HKD: 'HK$', UNK: '',
};

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  if (diffDays < 2) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = (today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 1) return 'Today';
  if (diffDays < 2) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatPrice(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || '';
  if (['IDR', 'JPY', 'NT'].includes(currency)) return `${symbol}${Math.round(amount).toLocaleString()}`;
  return `${symbol}${amount.toFixed(2)}`;
}

function formatPricePerGram(entry: TeaCompassEntry): string | null {
  if (entry.category === 'teaware') return null;
  const perGram = entry.pricePerUnitGrams;
  if (!perGram || entry.priceAmount == null) return null;
  const symbol = CURRENCY_SYMBOLS[entry.priceCurrency] || '';
  const val = entry.priceAmount / perGram;
  if (['IDR', 'JPY', 'NT'].includes(entry.priceCurrency)) return `${symbol}${Math.round(val)}/g`;
  return `${symbol}${val.toFixed(2)}/g`;
}

function getTypeLabel(entry: TeaCompassEntry): string {
  if (entry.type) return entry.type;
  if (entry.category === 'teaware') return 'Teaware';
  return 'Tea';
}

// Verdict chips shown in the expanded card. Heart/thumbs mirror the icons used
// across the triage review and sample-set summaries so the signal reads the same
// everywhere.
const VERDICT_CHIPS: { value: CompassVerdict; label: string; icon: React.ReactNode; activeCls: string }[] = [
  { value: 'love',    label: 'Love',  icon: <Heart size={12} />,      activeCls: 'bg-tea-error/15 text-tea-error border-tea-error/40' },
  { value: 'like',    label: 'Like',  icon: <ThumbsUp size={12} />,   activeCls: 'bg-tea-gold/15 text-tea-gold border-tea-gold/40' },
  { value: 'neutral', label: 'Meh',   icon: <Minus size={12} />,      activeCls: 'bg-tea-elevated text-tea-text-sec border-tea-border' },
  { value: 'pass',    label: 'Pass',  icon: <ThumbsDown size={12} />, activeCls: 'bg-tea-elevated text-tea-text-dim border-tea-border' },
];


export const BrowseCard: React.FC<BrowseCardProps> = ({ entry, onEdit, tasteQueueActive, onSelect, isSelected, onAcquire }) => {
  const navigate = useNavigate();
  const removeEntry = useTeaCompassStore((s) => s.removeEntry);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const transactions = useLedgerStore((s) => s.transactions);
  const removeLineItem = useLedgerStore((s) => s.removeLineItem);

  const [expanded, setExpanded] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [tastingOpen, setTastingOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lightboxCloseRef = useRef<HTMLButtonElement>(null);
  const lightboxDialogRef = useRef<HTMLDivElement>(null);
  const lightboxReturnFocusRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const validPhotos = (entry.photos || []).filter(Boolean);
  const openLightbox = useCallback((index: number) => {
    lightboxReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLightboxIndex(index);
  }, []);
  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    window.requestAnimationFrame(() => lightboxReturnFocusRef.current?.focus());
  }, []);

  // Reset confirm-delete after 3s of no interaction
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  // Lightbox keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;
    const appRoot = document.getElementById('root');
    const previousAriaHidden = appRoot?.getAttribute('aria-hidden');
    if (appRoot) {
      appRoot.inert = true;
      appRoot.setAttribute('aria-hidden', 'true');
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') setLightboxIndex((i) => i !== null ? Math.min(i + 1, validPhotos.length - 1) : null);
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => i !== null ? Math.max(i - 1, 0) : null);
      if (e.key === 'Tab') {
        const focusable = Array.from(lightboxDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? []);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handleKey);
    window.requestAnimationFrame(() => lightboxCloseRef.current?.focus());
    return () => {
      window.removeEventListener('keydown', handleKey);
      if (appRoot) {
        appRoot.inert = false;
        if (previousAriaHidden == null) appRoot.removeAttribute('aria-hidden');
        else appRoot.setAttribute('aria-hidden', previousAriaHidden);
      }
    };
  }, [closeLightbox, lightboxIndex, validPhotos.length]);



  const handleUnbuy = useCallback(() => {
    for (const tx of transactions) {
      const item = tx.items.find((i) => i.compassEntryId === entry.id);
      if (item) removeLineItem(tx.id, item.id);
    }
    updateEntry(entry.id, { status: 'noted', buyQuantityGrams: undefined, buyQuantityUnits: undefined, buyTotal: undefined });
  }, [entry.id, transactions, removeLineItem, updateEntry]);

  const handleAddPhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setPhotoUploading(true);
    setPhotoFailed(false);
    try {
      const compressed = await compressImage(file);
      const compressedFile = new File([compressed], 'photo.jpg', { type: 'image/jpeg' });
      const imageUrl = await api.uploadImage(compressedFile);
      if (!imageUrl) throw new Error('no url');
      updateEntry(entry.id, { photos: [...entry.photos, imageUrl] });
    } catch {
      // Not silent, on a flaky connection the user must know to retap.
      setPhotoFailed(true);
    } finally { setPhotoUploading(false); }
  }, [entry.id, entry.photos, updateEntry]);

  const typeColor = entry.type ? getTeaColor(entry.type) : null;
  // Include 'buying'/'bought' for backwards compatibility with persisted data
  const isBought = entry.status === 'in_stock' || entry.status === 'buying';
  const isWishlisted = entry.status === 'want';
  const isIncoming = entry.status === 'incoming';
  const isInLedger = transactions.some((transaction) => transaction.items.some((item) => item.compassEntryId === entry.id));
  const acquisitionPending = isIncoming || (!isBought && isInLedger);
  const isPassed = entry.status === 'pass';
  const pricePerGram = formatPricePerGram(entry);
  const rating = entry.tasting?.quality ?? entry.tasting?.rating;
  const hasTasting = entry.tasting && Object.values(entry.tasting).some(
    (v) => Array.isArray(v) ? v.length > 0 : v != null
  );
  // Effective verdict, first-class field, falling back to legacy sample verdict.
  const verdict: CompassVerdict | undefined = entry.verdict ?? entry.sampleVerdict;
  const setVerdict = (v: CompassVerdict) => updateEntry(entry.id, { verdict: verdict === v ? undefined : v });

  // Collapsed summary tags: body first (most diagnostic), then up to 2 flavor tags
  const bodyTag = entry.tasting?.body?.slice(0, 1) ?? [];
  const flavorTags = (entry.tasting?.flavor || []).slice(0, 2);
  const summaryTags = [...bodyTag, ...flavorTags].slice(0, 3);

  return (
    <>
      <article
        data-testid={`library-entry-${entry.id}`}
        className="relative min-w-0"
      >
        <TeaLedgerRow
          item={{
            name: entryDisplayTitle(entry),
            year: entry.year == null ? '' : String(entry.year),
            type: getTypeLabel(entry),
            origin: [entry.originRegion, entry.originCountry].filter(Boolean).join(', '),
            description: entry.notes,
          }}
          showType
          saved={isWishlisted}
          onToggleSave={() => updateEntry(entry.id, { status: isWishlisted ? 'noted' : 'want' })}
          onOpen={() => onSelect ? onSelect(entry.id) : setExpanded(value => !value)}
          openLabel={`${onSelect ? 'Open' : expanded ? 'Collapse' : 'Expand'} ${entryDisplayTitle(entry)} details`}
          expanded={onSelect ? undefined : expanded}
          selected={isSelected}
          tastingCount={entry.tastingHistory?.length || (hasTasting ? 1 : 0)}
          trailing={entry.priceAmount != null ? (
            <span className="flex flex-col items-end text-ui-12 text-tea-text-sec tabular-nums">
              <span className="text-ui-10 text-tea-text-dim">Cost</span>
              <span>{formatPrice(entry.priceAmount, entry.priceCurrency)}</span>
              {pricePerGram && <span className="text-ui-10 text-tea-text-dim">{pricePerGram}</span>}
            </span>
          ) : undefined}
        />

        {/* ── Expanded detail ── */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="border-t border-tea-border px-3 pt-3 pb-2 space-y-3">
                <DecisionControl value={entry.decision} onChange={(decision) => updateEntry(entry.id, { decision })} compact />
                {/* Photo strip with inline add link */}
                <div className="flex gap-2 items-center flex-wrap">
                  {validPhotos.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => openLightbox(i)}
                      className="shrink-0"
                      aria-label={`View photo ${i + 1}`}
                    >
                      <img src={mediaUrl(url)} alt="" className="w-24 h-24 rounded-md object-cover" loading="lazy" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoUploading}
                    className="tap-target shrink-0 flex min-h-11 items-center gap-1 text-ui-12 text-tea-text-dim hover:text-tea-text-sec transition-colors px-2"
                  >
                    {photoUploading
                      ? <Loader2 size={11} className="animate-spin" />
                      : <Camera size={11} />}
                    {!photoUploading && <span>{photoFailed ? 'Retry photo' : 'Add photo'}</span>}
                  </button>
                  {photoFailed && !photoUploading && (
                    <span className="shrink-0 self-center text-ui-12 text-tea-error">Didn't save, tap to retry</span>
                  )}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleAddPhoto}
                  />
                </div>

                {/* Full notes */}
                {entry.notes.trim().length > 0 && (
                  <p className="text-ui-12 text-tea-text-sec leading-relaxed whitespace-pre-wrap">{entry.notes}</p>
                )}

                {/* Brew parameters */}
                {(entry.tasting?.brewingTemp || entry.tasting?.brewingTime || entry.tasting?.brewingVessel) && (
                  <div className="flex items-center gap-2 flex-wrap text-ui-12 text-tea-text-dim">
                    {entry.tasting.brewingVessel && <span>{entry.tasting.brewingVessel}</span>}
                    {entry.tasting.brewingTemp && <span>{entry.tasting.brewingTemp}°C</span>}
                    {entry.tasting.brewingTime && <span>{entry.tasting.brewingTime}</span>}
                  </div>
                )}

                {/* Tasting profile (read view) */}
                {hasTasting && (
                  <TastingProfileStrip value={entry.tasting!} />
                )}

                {/* Verdict, quick set/clear; the organizing signal behind the
                    Loved lens and the want-list suggestion. Only shown once a
                    tea has been tasted. */}
                {hasTasting && (
                  <div className="flex items-center gap-1">
                    {VERDICT_CHIPS.map((chip) => {
                      const active = verdict === chip.value;
                      return (
                        <button
                          key={chip.value}
                          type="button"
                          onClick={() => setVerdict(chip.value)}
                          aria-pressed={active}
                          className={`tap-target flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 rounded-md border text-ui-12 font-medium transition-colors ${
                            active
                              ? chip.activeCls
                              : 'border-tea-border bg-tea-bg text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated'
                          }`}
                        >
                          {chip.icon}
                          <span>{chip.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Tasting history timeline */}
                {entry.tastingHistory && entry.tastingHistory.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-ui-12 text-tea-text-dim font-serif">
                      {entry.tastingHistory.length === 1 ? '1 tasting' : `${entry.tastingHistory.length} tastings`}
                    </p>
                    {entry.tastingHistory.slice().reverse().map((h, i) => {
                      const q = h.data.quality ?? h.data.rating;
                      const dateLabel = getDateGroup(h.date);
                      return (
                        <div key={i} className="flex items-center gap-2 text-ui-12 text-tea-text-sec">
                          <span className="tabular-nums text-tea-text-dim shrink-0">{dateLabel}</span>
                          {q != null && (
                            <span className="font-medium tabular-nums" style={typeColor ? { color: typeColor } : undefined}>
                              {q}/10
                            </span>
                          )}
                          {h.data.flavor && h.data.flavor.length > 0 && (
                            <span className="truncate text-tea-text-dim">{h.data.flavor.slice(0, 2).join(', ')}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Audio clips */}
                {entry.audioClips.length > 0 && (
                  <div className="flex items-center gap-1 text-ui-12 text-tea-text-dim">
                    <Mic size={11} />
                    {entry.audioClips.length} voice note{entry.audioClips.length > 1 ? 's' : ''}
                  </div>
                )}

                {/* Price detail + pipeline actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {entry.priceAmount != null && entry.priceAmount > 0 && (
                    <span className="text-ui-12 text-tea-text-dim tabular-nums">
                      {formatPrice(entry.priceAmount, entry.priceCurrency)}
                      {pricePerGram && ` · ${pricePerGram}`}
                    </span>
                  )}
                  <CreateInventoryRecordAction entryId={entry.id} productId={entry.draftProductId}
                    onOpenInventory={(productId) => navigate(`/admin/stock?panel=${encodeURIComponent(productId)}`)} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Action bar, always visible. Wraps on narrow columns so the
            Sample action is never clipped by the card edge. ── */}
        <div data-testid={`library-entry-actions-${entry.id}`} className="library-entry-actions">
          <div className="library-entry-context text-ui-12">
            {entry.chineseName && <span className="font-chinese">{entry.chineseName}</span>}
            {entry.vendorName && <span>{entry.vendorName}</span>}
            {entry.sampleState && <span>Sample {entry.sampleState}</span>}
            {isIncoming && <span>Incoming</span>}
            {isPassed && <span>Passed</span>}
            {entry.status === 'depleted' && <span>Depleted</span>}
            {verdict && <span>{verdict === 'love' ? 'Loved' : verdict === 'like' ? 'Liked' : verdict === 'neutral' ? 'Meh' : 'Pass'}</span>}
            {entry.tasting?.['liquor-color']?.[0] && LIQUOR_COLORS[entry.tasting['liquor-color'][0]] && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: LIQUOR_COLORS[entry.tasting['liquor-color'][0]] }} /> {/* color-data: recorded liquor colour */}
                {entry.tasting['liquor-color'][0]}
              </span>
            )}
            {summaryTags.length > 0 && <span>{summaryTags.join(' · ')}</span>}
            {validPhotos.length > 0 && <button type="button" onClick={() => openLightbox(0)} aria-label="View photos" className="tap-target min-h-11 text-tea-text-sec hover:text-tea-text">{validPhotos.length} photo{validPhotos.length === 1 ? '' : 's'}</button>}
            <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} details for ${entryDisplayTitle(entry)}`} className="tap-target min-h-11 text-tea-text-sec hover:text-tea-text">{expanded ? 'Less' : 'Details'}</button>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-1">
          {/* Wishlist toggle */}
          <button
            type="button"
            data-library-action
            onClick={() => updateEntry(entry.id, { status: isWishlisted ? 'noted' : 'want' })}
            className={`tap-target flex min-h-11 items-center gap-1.5 px-1 rounded-md text-ui-12 font-medium transition-colors ${
              isWishlisted
                ? 'bg-tea-gold/10 text-tea-gold'
                : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated'
            }`}
          >
            {isWishlisted ? <BookmarkCheck size={12} /> : <BookmarkPlus size={12} />}
            {isWishlisted ? 'Wanted' : 'Want'}
          </button>

          {/* Buy / Bought, label is always "Buy" or "Bought", never a price string */}
          <button
            type="button"
            data-library-action
            onClick={() => { if (isBought) handleUnbuy(); else if (!acquisitionPending) onAcquire?.(entry.id); }}
            disabled={acquisitionPending || (!isBought && !onAcquire)}
            className={`tap-target flex min-h-11 items-center gap-1.5 px-1 rounded-md text-ui-12 font-medium transition-colors ${
              isBought
                ? 'bg-tea-gold/10 text-tea-gold'
                : acquisitionPending
                  ? 'cursor-default text-tea-text-dim'
                : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated'
            }`}
          >
            {isBought ? <Check size={12} /> : <ShoppingBag size={12} />}
            {isBought ? 'In Stock' : isIncoming ? 'Incoming' : isInLedger ? 'In ledger' : 'Buy'}
          </button>

          {/* Divider: intentions (Want/Buy) vs. assessments (Taste) */}
          <div className="w-px h-3 bg-tea-border mx-0.5" />

          {/* Taste / Rating */}
          <button
            type="button"
            data-library-action
            onClick={() => setTastingOpen(true)}
            className={`tap-target flex min-h-11 items-center gap-1.5 px-1 rounded-md text-ui-12 font-medium transition-colors ${
              hasTasting
                ? 'text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated'
                : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated'
            }`}
            style={rating != null && typeColor ? { color: typeColor } : undefined}
          >
            <Droplets size={12} strokeWidth={1.5} />
            {rating != null
              ? entry.tastingHistory && entry.tastingHistory.length > 1
                ? `${rating}/10 ×${entry.tastingHistory.length}`
                : `${rating}/10`
              : 'Taste'}
          </button>

          {/* Reorder, visible only when depleted */}
          {entry.status === 'depleted' && (
            <button
              type="button"
              data-library-action
              onClick={() => onAcquire?.(entry.id)}
              disabled={!onAcquire}
              className="tap-target flex min-h-11 items-center gap-1.5 px-1 rounded-md text-ui-12 font-medium text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated transition-colors"
              title="Add to ledger to reorder"
            >
              <RefreshCw size={12} />
              Reorder
            </button>
          )}

          {/* Taste queue, visible only in To Taste filter */}
          {tasteQueueActive && (
            <button
              type="button"
              data-library-action
              onClick={() => updateEntry(entry.id, {
                tasteOrder: entry.tasteOrder ? undefined : Date.now(),
              })}
              className={`tap-target flex min-h-11 items-center gap-1 px-1 rounded-md text-ui-12 font-medium transition-colors ${
                entry.tasteOrder
                  ? 'bg-tea-gold/10 text-tea-gold'
                  : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated'
              }`}
              title={entry.tasteOrder ? 'Remove from queue' : 'Taste this next'}
            >
              <Star size={12} fill={entry.tasteOrder ? 'currentColor' : 'none'} />
              {entry.tasteOrder ? 'Next' : 'Queue'}
            </button>
          )}

          {/* Add to sample list */}
          {entry.category !== 'teaware' && (
            <AddToSampleButton
              item={{
                id: entry.id,
                name: entry.name,
                chineseName: entry.chineseName,
                type: entry.type,
                vendorName: entry.vendorName,
                compassEntryId: entry.id,
              }}
              size={12}
              className="tap-target min-h-11 px-1 text-ui-12"
            />
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Edit → Capture (icon-only) */}
          <button
            type="button"
            data-library-action
            onClick={() => onEdit(entry.id)}
            className="tap-target flex min-h-11 min-w-11 items-center justify-center rounded-md text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated transition-colors"
            title="Edit in Capture"
            aria-label="Edit entry"
          >
            <Pencil size={12} />
          </button>

          {/* Delete, two-tap confirm */}
          {confirmDelete ? (
            <button
              type="button"
              data-library-action
              onClick={() => { removeEntry(entry.id); setConfirmDelete(false); }}
              className="tap-target flex min-h-11 items-center gap-1 px-2 rounded-md text-ui-12 font-medium bg-tea-error/10 text-tea-error hover:bg-tea-error/20 transition-colors ml-1"
            >
              <AlertTriangle size={11} />
              Delete?
            </button>
          ) : (
            <button
              type="button"
              data-library-action
              onClick={() => setConfirmDelete(true)}
              className="tap-target flex min-h-11 min-w-11 items-center justify-center rounded-md text-tea-text-sec hover:text-tea-error hover:bg-tea-elevated transition-colors ml-1"
              title="Delete"
              aria-label="Delete entry"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
        </div>
      </article>

      {/* ── Tasting session ── */}
      <AnimatePresence>
        {tastingOpen && (
          <TastingSession
            item={{
              id: entry.id,
              name: entry.name,
              type: entry.type,
              image: validPhotos[0],
              sourceType: 'compass',
              compassEntryId: entry.id,
            }}
            onClose={() => setTastingOpen(false)}
            onAfterSave={(data: TastingData, sessionVerdict?: CompassVerdict) => {
              const existingHistory = entry.tastingHistory || [];
              const today = new Date().toDateString();
              const lastEntry = existingHistory[existingHistory.length - 1];
              const lastWasToday = lastEntry && new Date(lastEntry.date).toDateString() === today;
              const history = lastWasToday
                ? [...existingHistory.slice(0, -1), { data, date: new Date().toISOString() }]
                : [...existingHistory, { data, date: new Date().toISOString() }];
              updateEntry(entry.id, {
                tasting: data,
                tastingHistory: history,
                // Only overwrite verdict if the session captured one, otherwise
                // leave it for later triage in the batch review.
                ...(sessionVerdict ? { verdict: sessionVerdict } : {}),
              });
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Photo lightbox ── */}
      {lightboxIndex !== null && validPhotos[lightboxIndex] && createPortal(
        <motion.div
          ref={lightboxDialogRef}
          key="browse-lightbox"
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-toast flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label={`Photos for ${entryDisplayTitle(entry)}`}
        >
          <button
            type="button"
            ref={lightboxCloseRef}
            onClick={closeLightbox}
            className="tap-target absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-tea-text/10 text-tea-text hover:bg-tea-text/20 transition-colors"
            aria-label="Close photos"
          >
            <X size={18} />
          </button>
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              className="tap-target absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-tea-text/10 text-tea-text hover:bg-tea-text/20 transition-colors"
              aria-label="Previous photo"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <motion.img
            key={lightboxIndex}
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            src={mediaUrl(validPhotos[lightboxIndex])}
            alt={`Photo ${lightboxIndex + 1}`}
            className="max-w-[92vw] max-h-[88vh] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxIndex < validPhotos.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              className="tap-target absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-tea-text/10 text-tea-text hover:bg-tea-text/20 transition-colors"
              aria-label="Next photo"
            >
              <ChevronRight size={20} />
            </button>
          )}
          {validPhotos.length > 1 && (
            <div className="absolute bottom-6 flex gap-1.5">
              {validPhotos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                  className={`tap-target w-1.5 h-1.5 rounded-full transition-colors ${i === lightboxIndex ? 'bg-tea-text' : 'bg-tea-text/30'}`}
                  aria-label={`Show photo ${i + 1}`}
                />
              ))}
            </div>
          )}
        </motion.div>,
        document.body
      )}
    </>
  );
};

export default BrowseCard;
