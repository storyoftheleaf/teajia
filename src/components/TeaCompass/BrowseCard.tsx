import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pencil, Trash2, Store, Check, Loader2, Camera,
  Mic, BookmarkPlus, BookmarkCheck, ChevronDown, ChevronUp,
  ShoppingBag, Droplets, AlertTriangle, Star,
} from 'lucide-react';
import { getTeaColor } from '../../designTokens';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useLedgerStore } from '../../lib/ledgerStore';
import { api } from '../../lib/api';
import { TastingSession } from '../tasting/TastingSession';
import type { TastingData } from '../../types';
import { TastingProfileStrip } from '../tasting/TastingProfileStrip';
import { compressImage } from '../../lib/imageCompressor';
import type { TeaCompassEntry } from './types';

export interface BrowseCardProps {
  entry: TeaCompassEntry;
  onEdit: (id: string) => void;
  /** Shows a queue/prioritise button — used in the To Taste filter */
  tasteQueueActive?: boolean;
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


export const BrowseCard: React.FC<BrowseCardProps> = ({ entry, onEdit, tasteQueueActive }) => {
  const navigate = useNavigate();
  const removeEntry = useTeaCompassStore((s) => s.removeEntry);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const transactions = useLedgerStore((s) => s.transactions);
  const removeLineItem = useLedgerStore((s) => s.removeLineItem);

  const [expanded, setExpanded] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [tastingOpen, setTastingOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset confirm-delete after 3s of no interaction
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);



  const handleUnbuy = useCallback(() => {
    for (const tx of transactions) {
      const item = tx.items.find((i) => i.compassEntryId === entry.id);
      if (item) { removeLineItem(tx.id, item.id); break; }
    }
    updateEntry(entry.id, { status: 'noted', buyQuantityGrams: undefined, buyQuantityUnits: undefined, buyTotal: undefined });
  }, [entry.id, transactions, removeLineItem, updateEntry]);

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
  // Include 'buying'/'bought' for backwards compatibility with persisted data
  const isBought = entry.status === 'in_stock' || entry.status === 'buying';
  const isWishlisted = entry.status === 'want';
  const isIncoming = entry.status === 'incoming';
  const isPassed = entry.status === 'pass';
  const pricePerGram = formatPricePerGram(entry);
  const rating = entry.tasting?.quality ?? entry.tasting?.rating;
  const flavorTags = (entry.tasting?.flavor || []).slice(0, 3);
  const hasTasting = entry.tasting && Object.values(entry.tasting).some(
    (v) => Array.isArray(v) ? v.length > 0 : v != null
  );

  return (
    <>
      <div
        className="bg-tea-surface rounded-lg overflow-hidden"
        style={typeColor
          ? { borderLeft: `3px solid color-mix(in srgb, ${typeColor} 50%, transparent)` }
          : { borderLeft: '3px solid transparent' }}
      >
        {/* ── Tappable content area ── */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-left"
          aria-expanded={expanded}
        >
          <div className="flex gap-3 px-3 pt-2.5 pb-2">
            {/* Photo thumbnail */}
            {entry.photos.length > 0 && (
              <img
                src={entry.photos[0]}
                alt=""
                className="w-11 h-11 rounded-md object-cover shrink-0 mt-0.5"
              />
            )}

            {/* Text content */}
            <div className="flex-1 min-w-0 space-y-0.5">
              {/* Name · Region */}
              <div className="flex items-baseline gap-2 min-w-0">
                <span className={`min-w-0 truncate text-sm font-serif ${hasName ? 'text-tea-text' : 'text-tea-text-dim italic'}`}>
                  {hasName ? entry.name : 'Untitled'}
                </span>
                {entry.originRegion && (
                  <span className="text-[11px] text-tea-text-sec truncate shrink-0">· {entry.originRegion}</span>
                )}
              </div>

              {/* Chinese name */}
              {entry.chineseName && (
                <p className="text-[12px] text-tea-text-sec font-chinese leading-tight truncate">{entry.chineseName}</p>
              )}

              {/* Type · Year · Price/gram */}
              <p className="text-[10px] text-tea-text-dim tabular-nums">
                {[
                  getTypeLabel(entry),
                  entry.year && String(entry.year),
                  pricePerGram,
                ].filter(Boolean).join(' · ')}
              </p>

              {/* Rating + status badge */}
              {(rating != null || isBought || isWishlisted || isIncoming || isPassed) && (
                <div className="flex items-center gap-2">
                  {rating != null && (
                    <span className="text-[11px] font-semibold tabular-nums" style={typeColor ? { color: typeColor } : undefined}>
                      {rating}/10
                    </span>
                  )}
                  {isBought && (
                    <span className="text-[10px] text-tea-gold/70 font-medium">In Stock</span>
                  )}
                  {isPassed && (
                    <span className="text-[10px] text-tea-text-dim font-medium">Passed</span>
                  )}
                  {isWishlisted && !isBought && (
                    <span className="text-[10px] text-tea-text-dim font-medium">Wishlist</span>
                  )}
                  {isIncoming && (
                    <span className="text-[10px] text-tea-accent-sub font-medium">Incoming</span>
                  )}
                </div>
              )}

              {/* Flavor tags */}
              {flavorTags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {flavorTags.map((tag) => (
                    <span key={tag} className="tag text-[10px]">{tag}</span>
                  ))}
                </div>
              )}

              {/* Vendor */}
              {entry.vendorName && (
                <div className="flex items-center gap-1 text-[10px] text-tea-text-dim">
                  <Store size={10} />
                  <span className="truncate">{entry.vendorName}</span>
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
                {/* Photo strip with + tile */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {entry.photos.map((url, i) => (
                    <img key={i} src={url} alt="" className="w-20 h-20 rounded-md object-cover shrink-0" />
                  ))}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoUploading}
                    className="w-20 h-20 rounded-md shrink-0 flex flex-col items-center justify-center gap-1
                               border-2 border-dashed border-tea-border bg-tea-surface/40
                               hover:border-tea-gold/40 hover:bg-tea-surface transition-colors"
                  >
                    {photoUploading
                      ? <Loader2 size={16} className="animate-spin text-tea-text-dim" />
                      : <Camera size={16} className="text-tea-text-dim" />}
                    <span className="text-[9px] text-tea-text-dim uppercase tracking-wider">
                      {photoUploading ? '' : 'Add'}
                    </span>
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
                  <p className="text-[12px] text-tea-text-sec leading-relaxed whitespace-pre-wrap">{entry.notes}</p>
                )}

                {/* Tasting profile (read view) */}
                {hasTasting && (
                  <TastingProfileStrip value={entry.tasting!} onRemove={() => {}} />
                )}

                {/* Audio clips */}
                {entry.audioClips.length > 0 && (
                  <div className="flex items-center gap-1 text-[11px] text-tea-text-dim">
                    <Mic size={11} />
                    {entry.audioClips.length} voice note{entry.audioClips.length > 1 ? 's' : ''}
                  </div>
                )}

                {/* Price detail + pipeline actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {entry.priceAmount != null && entry.priceAmount > 0 && (
                    <span className="text-[11px] text-tea-text-dim tabular-nums">
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
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                        <line x1="12" y1="22.08" x2="12" y2="12"/>
                      </svg>
                      In Inventory →
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
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
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
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
              isBought
                ? 'bg-tea-gold/10 text-tea-gold'
                : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated'
            }`}
          >
            {isBought ? <Check size={12} /> : <ShoppingBag size={12} />}
            {isBought ? 'In Stock' : 'Buy'}
          </button>

          {/* Taste / Rating */}
          <button
            type="button"
            onClick={() => setTastingOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
              hasTasting
                ? 'text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated'
                : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated'
            }`}
            style={rating != null && typeColor ? { color: typeColor } : undefined}
          >
            <Droplets size={12} strokeWidth={1.5} />
            {rating != null ? `${rating}/10` : 'Taste'}
          </button>

          {/* Taste queue — visible only in To Taste filter */}
          {tasteQueueActive && (
            <button
              type="button"
              onClick={() => updateEntry(entry.id, {
                tasteOrder: entry.tasteOrder ? undefined : Date.now(),
              })}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
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
              className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <AlertTriangle size={11} />
              Delete?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-md text-tea-text-dim hover:text-red-400 hover:bg-tea-elevated transition-colors"
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
              image: entry.photos?.[0],
              sourceType: 'compass',
              compassEntryId: entry.id,
            }}
            onClose={() => setTastingOpen(false)}
            onAfterSave={(data: TastingData) => updateEntry(entry.id, { tasting: data })}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default BrowseCard;
