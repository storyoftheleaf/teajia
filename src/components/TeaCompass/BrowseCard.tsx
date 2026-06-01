import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pencil, Trash2, Store, Check, Loader2, Camera,
  Mic, BookmarkPlus, BookmarkCheck, ChevronDown, ChevronUp,
  ShoppingBag, Droplets, AlertTriangle, Star, ChevronLeft, ChevronRight, X, RefreshCw,
} from 'lucide-react';
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
import { LIQUOR_COLORS } from '../../data/tastingTaxonomy';

export interface BrowseCardProps {
  entry: TeaCompassEntry;
  onEdit: (id: string) => void;
  /** Shows a queue/prioritise button — used in the To Taste filter */
  tasteQueueActive?: boolean;
  /** Compare mode: whether this card is selected for comparison */
  isCompareSelected?: boolean;
  onToggleCompare?: (id: string) => void;
  /** Desktop: fires instead of expand-in-place when provided */
  onSelect?: (id: string) => void;
  /** Desktop: shows selection highlight on the card */
  isSelected?: boolean;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', NT: 'NT$', Yuan: '¥', IDR: 'Rp', JPY: '¥', MYR: 'RM', HKD: 'HK$', UNK: '',
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
  if (!perGram || !entry.priceAmount) return null;
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


export const BrowseCard: React.FC<BrowseCardProps> = ({ entry, onEdit, tasteQueueActive, isCompareSelected, onToggleCompare, onSelect, isSelected }) => {
  const navigate = useNavigate();
  const removeEntry = useTeaCompassStore((s) => s.removeEntry);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const transactions = useLedgerStore((s) => s.transactions);
  const removeLineItem = useLedgerStore((s) => s.removeLineItem);
  const getOrCreatePurchaseTransaction = useLedgerStore((s) => s.getOrCreatePurchaseTransaction);
  const addLineItem = useLedgerStore((s) => s.addLineItem);

  const [expanded, setExpanded] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [tastingOpen, setTastingOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const validPhotos = (entry.photos || []).filter(Boolean);

  // Reset confirm-delete after 3s of no interaction
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  // Lightbox keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') setLightboxIndex((i) => i !== null ? Math.min(i + 1, validPhotos.length - 1) : null);
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => i !== null ? Math.max(i - 1, 0) : null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, validPhotos.length]);



  const handleUnbuy = useCallback(() => {
    for (const tx of transactions) {
      const item = tx.items.find((i) => i.compassEntryId === entry.id);
      if (item) { removeLineItem(tx.id, item.id); break; }
    }
    updateEntry(entry.id, { status: 'noted', buyQuantityGrams: undefined, buyQuantityUnits: undefined, buyTotal: undefined });
  }, [entry.id, transactions, removeLineItem, updateEntry]);

  const handleReorder = useCallback(() => {
    const vendorName = entry.vendorName || 'Unknown Vendor';
    const currency = entry.priceCurrency;
    const txId = getOrCreatePurchaseTransaction(vendorName, currency, entry.vendorId);
    const unitBased = (['Cake', 'Brick', 'Tuo'] as string[]).includes(entry.form || '');
    addLineItem(txId, {
      name: entry.name || 'Unnamed',
      chineseName: entry.chineseName,
      type: entry.type,
      form: entry.form,
      year: entry.year,
      quantityGrams: unitBased ? undefined : 100,
      quantityUnits: unitBased ? 1 : undefined,
      pricePerUnit: entry.priceAmount ?? 0,
      priceIsPerGram: !unitBased && !!entry.pricePerUnitGrams,
      currency,
      compassEntryId: entry.id,
    });
    updateEntry(entry.id, { status: 'incoming' });
  }, [entry, getOrCreatePurchaseTransaction, addLineItem, updateEntry]);

  const handleAddPhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setPhotoUploading(true);
    try {
      const compressed = await compressImage(file);
      const compressedFile = new File([compressed], 'photo.jpg', { type: 'image/jpeg' });
      const imageUrl = await api.uploadImage(compressedFile).catch(() => null);
      if (imageUrl) updateEntry(entry.id, { photos: [...entry.photos, imageUrl] });
    } catch { /* silently fail */ } finally { setPhotoUploading(false); }
  }, [entry.id, entry.photos, updateEntry]);

  const hasName = entry.name.trim().length > 0;
  const typeColor = entry.type ? getTeaColor(entry.type) : null;
  const currentYear = new Date().getFullYear();
  const ageYears = entry.year && entry.category !== 'teaware' && currentYear > entry.year
    ? currentYear - entry.year
    : null;
  // Include 'buying'/'bought' for backwards compatibility with persisted data
  const isBought = entry.status === 'in_stock' || entry.status === 'buying';
  const isWishlisted = entry.status === 'want';
  const isIncoming = entry.status === 'incoming';
  const isPassed = entry.status === 'pass';
  const pricePerGram = formatPricePerGram(entry);
  const rating = entry.tasting?.quality ?? entry.tasting?.rating;
  const hasTasting = entry.tasting && Object.values(entry.tasting).some(
    (v) => Array.isArray(v) ? v.length > 0 : v != null
  );

  // Collapsed summary tags: body first (most diagnostic), then up to 2 flavor tags
  const bodyTag = entry.tasting?.body?.slice(0, 1) ?? [];
  const flavorTags = (entry.tasting?.flavor || []).slice(0, 2);
  const summaryTags = [...bodyTag, ...flavorTags].slice(0, 3);

  // Liquor color swatch for collapsed header
  const liquorColorKey = entry.tasting?.['liquor-color']?.[0];
  const liquorColorHex = liquorColorKey ? LIQUOR_COLORS[liquorColorKey] : null;

  return (
    <>
      <div
        className={`relative bg-tea-surface border border-tea-border rounded-xl overflow-hidden${isSelected ? ' ring-1 ring-tea-gold/40 bg-tea-gold/5' : ''}`}
        style={{
          ...(isCompareSelected ? { outline: '2px solid var(--tea-gold)', outlineOffset: '-2px' } : {}),
        }}
      >
        {/* Compare select dot — shown when compare mode active */}
        {onToggleCompare && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleCompare(entry.id); }}
            className={`absolute top-2 right-2 z-10 w-5 h-5 rounded-full border transition-colors flex items-center justify-center ${
              isCompareSelected
                ? 'bg-tea-gold border-tea-gold text-tea-bg'
                : 'border-tea-border bg-tea-surface/80 text-transparent hover:border-tea-gold/50'
            }`}
            aria-label={isCompareSelected ? 'Deselect for compare' : 'Select for compare'}
          >
            {isCompareSelected && <Check size={10} strokeWidth={3} />}
          </button>
        )}
        {/* ── Tappable content area ── */}
        <button
          type="button"
          onClick={() => {
            if (onSelect) {
              onSelect(entry.id);
            } else {
              setExpanded((v) => !v);
            }
          }}
          className="w-full text-left"
          aria-expanded={onSelect ? undefined : expanded}
        >
          <div className="flex gap-3 px-3 pt-2.5 pb-2">
            {/* Photo or type swatch */}
            {validPhotos.length > 0 ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(0); }}
                className="relative shrink-0 mt-0.5 group"
                aria-label="View photos"
              >
                <img
                  src={validPhotos[0]}
                  alt=""
                  className="w-14 h-14 rounded-md object-cover"
                />
                {validPhotos.length > 1 && (
                  <span className="absolute bottom-0.5 right-0.5 text-ui-9 font-semibold text-tea-text bg-tea-bg/70 rounded px-0.5 leading-tight">
                    +{validPhotos.length - 1}
                  </span>
                )}
              </button>
            ) : typeColor ? (
              <div
                className="shrink-0 mt-0.5 w-14 h-14 rounded-md flex items-center justify-center text-ui-9 font-semibold tracking-[0.1em] uppercase"
                style={{ background: `${typeColor}18`, color: typeColor }}
                aria-hidden="true"
              >
                {(entry.type || entry.category || 'TEA').slice(0, 3)}
              </div>
            ) : null}

            {/* Text content */}
            <div className="flex-1 min-w-0 space-y-0.5">
              {/* Name · Region · liquor color dot */}
              <div className="flex items-baseline gap-2 min-w-0">
                <span className={`min-w-0 truncate text-sm font-serif ${hasName ? 'text-tea-text' : 'text-tea-text-dim italic'}`}>
                  {hasName ? entry.name : 'Untitled'}
                </span>
                {entry.originRegion && (
                  <span className="text-ui-11 text-tea-text-sec truncate shrink-0">· {entry.originRegion}</span>
                )}
                {liquorColorHex && (
                  <span
                    className="shrink-0 rounded-full self-center"
                    style={{ width: 8, height: 8, backgroundColor: liquorColorHex, display: 'inline-block' }}
                    aria-label={`Liquor color: ${liquorColorKey}`}
                  />
                )}
              </div>

              {/* Chinese name */}
              {entry.chineseName && (
                <p className="text-ui-12 text-tea-text-sec font-chinese leading-tight truncate">{entry.chineseName}</p>
              )}

              {/* Vendor — provenance group, right after Chinese name */}
              {entry.vendorName && (
                <div className="flex items-center gap-1 text-ui-10 text-tea-text-dim">
                  <Store size={10} />
                  <span className="truncate">{entry.vendorName}</span>
                </div>
              )}

              {/* Type · Year · Age · Price/gram */}
              <p className="text-ui-10 text-tea-text-dim tabular-nums">
                {[
                  getTypeLabel(entry),
                  entry.year && String(entry.year),
                  ageYears != null && ageYears > 0 ? `${ageYears}y` : null,
                  pricePerGram,
                ].filter(Boolean).join(' · ')}
              </p>

              {/* Rating + status badge */}
              {(rating != null || isBought || isWishlisted || isIncoming || isPassed) && (
                <div className="flex items-center gap-2">
                  {rating != null && (
                    <span className="text-ui-11 font-semibold tabular-nums" style={typeColor ? { color: typeColor } : undefined}>
                      {rating}/10
                    </span>
                  )}
                  {isBought && (
                    <span className="text-ui-10 text-tea-gold/70 font-medium">In Stock</span>
                  )}
                  {isPassed && (
                    <span className="text-ui-10 text-tea-text-dim font-medium">Passed</span>
                  )}
                  {isWishlisted && !isBought && (
                    <span className="text-ui-10 text-tea-text-dim font-medium">Wishlist</span>
                  )}
                  {isIncoming && (
                    <span className="text-ui-10 text-tea-accent-sub font-medium">Incoming</span>
                  )}
                </div>
              )}

              {/* Summary tags (body + flavor) — only when collapsed */}
              {!expanded && summaryTags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {summaryTags.map((tag) => (
                    <span key={tag} className="tag text-ui-10">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Right: expand chevron */}
            <div className="shrink-0 flex items-start pt-1">
              <span className="text-tea-text-dim">
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </span>
            </div>
          </div>
        </button>

        {/* ── Expanded detail ── */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="border-t border-tea-border px-3 pt-3 pb-2 space-y-3">
                {/* Photo strip with inline add link */}
                <div className="flex gap-2 items-center flex-wrap">
                  {validPhotos.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightboxIndex(i)}
                      className="shrink-0"
                      aria-label={`View photo ${i + 1}`}
                    >
                      <img src={url} alt="" className="w-24 h-24 rounded-md object-cover" loading="lazy" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoUploading}
                    className="shrink-0 flex items-center gap-1 text-ui-10 text-tea-text-dim hover:text-tea-text-sec transition-colors px-2 py-1.5"
                  >
                    {photoUploading
                      ? <Loader2 size={11} className="animate-spin" />
                      : <Camera size={11} />}
                    {!photoUploading && <span>Add photo</span>}
                  </button>
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
                  <div className="flex items-center gap-2 flex-wrap text-ui-11 text-tea-text-dim">
                    {entry.tasting.brewingVessel && <span>{entry.tasting.brewingVessel}</span>}
                    {entry.tasting.brewingTemp && <span>{entry.tasting.brewingTemp}°C</span>}
                    {entry.tasting.brewingTime && <span>{entry.tasting.brewingTime}</span>}
                  </div>
                )}

                {/* Tasting profile (read view) */}
                {hasTasting && (
                  <TastingProfileStrip value={entry.tasting!} />
                )}

                {/* Tasting history timeline */}
                {entry.tastingHistory && entry.tastingHistory.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim font-serif">
                      {entry.tastingHistory.length === 1 ? '1 tasting' : `${entry.tastingHistory.length} tastings`}
                    </p>
                    {entry.tastingHistory.slice().reverse().map((h, i) => {
                      const q = h.data.quality ?? h.data.rating;
                      const dateLabel = getDateGroup(h.date);
                      return (
                        <div key={i} className="flex items-center gap-2 text-ui-11 text-tea-text-sec">
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
                  <div className="flex items-center gap-1 text-ui-11 text-tea-text-dim">
                    <Mic size={11} />
                    {entry.audioClips.length} voice note{entry.audioClips.length > 1 ? 's' : ''}
                  </div>
                )}

                {/* Price detail + pipeline actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {entry.priceAmount != null && entry.priceAmount > 0 && (
                    <span className="text-ui-11 text-tea-text-dim tabular-nums">
                      {formatPrice(entry.priceAmount, entry.priceCurrency)}
                      {pricePerGram && ` · ${pricePerGram}`}
                    </span>
                  )}
                  {entry.draftProductId && (
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/inventory?panel=${encodeURIComponent(entry.draftProductId!)}`)}
                      className="pill flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                        <line x1="12" y1="22.08" x2="12" y2="12"/>
                      </svg>
                      View in Stock →
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Action bar — always visible ── */}
        <div className="flex items-center gap-0.5 px-2 pb-2 pt-1.5 border-t border-tea-border">
          {/* Wishlist toggle */}
          <button
            type="button"
            onClick={() => updateEntry(entry.id, { status: isWishlisted ? 'noted' : 'want' })}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-ui-11 font-medium transition-colors ${
              isWishlisted
                ? 'bg-tea-gold/10 text-tea-gold'
                : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated'
            }`}
          >
            {isWishlisted ? <BookmarkCheck size={12} /> : <BookmarkPlus size={12} />}
            {isWishlisted ? 'Wanted' : 'Want'}
          </button>

          {/* Buy / Bought — label is always "Buy" or "Bought", never a price string */}
          <button
            type="button"
            onClick={() => { if (isBought) handleUnbuy(); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-ui-11 font-medium transition-colors ${
              isBought
                ? 'bg-tea-gold/10 text-tea-gold'
                : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated'
            }`}
          >
            {isBought ? <Check size={12} /> : <ShoppingBag size={12} />}
            {isBought ? 'In Stock' : 'Buy'}
          </button>

          {/* Divider: intentions (Want/Buy) vs. assessments (Taste) */}
          <div className="w-px h-3 bg-tea-border mx-0.5" />

          {/* Taste / Rating */}
          <button
            type="button"
            onClick={() => setTastingOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-ui-11 font-medium transition-colors ${
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

          {/* Reorder — visible only when depleted */}
          {entry.status === 'depleted' && (
            <button
              type="button"
              onClick={handleReorder}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-ui-11 font-medium text-tea-text-dim hover:text-tea-accent-sub hover:bg-tea-elevated transition-colors"
              title="Add to ledger to reorder"
            >
              <RefreshCw size={12} />
              Reorder
            </button>
          )}

          {/* Taste queue — visible only in To Taste filter */}
          {tasteQueueActive && (
            <button
              type="button"
              onClick={() => updateEntry(entry.id, {
                tasteOrder: entry.tasteOrder ? undefined : Date.now(),
              })}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-ui-11 font-medium transition-colors ${
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
            />
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Edit → Capture (icon-only) */}
          <button
            type="button"
            onClick={() => onEdit(entry.id)}
            className="p-1.5 rounded-md text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated transition-colors"
            title="Edit in Capture"
          >
            <Pencil size={12} />
          </button>

          {/* Delete — two-tap confirm */}
          {confirmDelete ? (
            <button
              type="button"
              onClick={() => { removeEntry(entry.id); setConfirmDelete(false); }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-md text-ui-11 font-medium bg-tea-error/10 text-tea-error hover:bg-tea-error/20 transition-colors ml-1"
            >
              <AlertTriangle size={11} />
              Delete?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-md text-tea-text-dim hover:text-tea-error hover:bg-tea-elevated transition-colors ml-1"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

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
            onAfterSave={(data: TastingData) => {
              const existingHistory = entry.tastingHistory || [];
              const today = new Date().toDateString();
              const lastEntry = existingHistory[existingHistory.length - 1];
              const lastWasToday = lastEntry && new Date(lastEntry.date).toDateString() === today;
              const history = lastWasToday
                ? [...existingHistory.slice(0, -1), { data, date: new Date().toISOString() }]
                : [...existingHistory, { data, date: new Date().toISOString() }];
              updateEntry(entry.id, { tasting: data, tastingHistory: history });
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Photo lightbox ── */}
      {lightboxIndex !== null && validPhotos[lightboxIndex] && createPortal(
        <motion.div
          key="browse-lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-toast flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-tea-text/10 text-tea-text hover:bg-tea-text/20 transition-colors"
          >
            <X size={18} />
          </button>
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-tea-text/10 text-tea-text hover:bg-tea-text/20 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <motion.img
            key={lightboxIndex}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            src={validPhotos[lightboxIndex]}
            alt={`Photo ${lightboxIndex + 1}`}
            className="max-w-[92vw] max-h-[88vh] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxIndex < validPhotos.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-tea-text/10 text-tea-text hover:bg-tea-text/20 transition-colors"
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
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === lightboxIndex ? 'bg-tea-text' : 'bg-tea-text/30'}`}
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
