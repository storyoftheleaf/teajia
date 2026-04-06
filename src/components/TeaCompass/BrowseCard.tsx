import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pencil, Trash2, Store, PackagePlus, Check, Loader2, Camera,
  Mic, BookmarkPlus, BookmarkCheck, ChevronDown, ChevronUp,
} from 'lucide-react';
import { getTeaColor } from '../../designTokens';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useLedgerStore } from '../../lib/ledgerStore';
import { compassEntryToProductDraft, GRAM_PRESETS, DEFAULT_GRAMS } from './types';
import { api, isConfigured, hasToken } from '../../lib/api';
import { TastingFlow } from '../tasting/TastingFlow';
import { TastingProfileStrip } from '../tasting/TastingProfileStrip';
import { compressImage } from '../../lib/imageCompressor';
import type { TeaCompassEntry, TeaForm } from './types';
import type { TastingData } from '../../types';
import type { Currency } from '../../admin/types';

export interface BrowseCardProps {
  entry: TeaCompassEntry;
  onEdit: (id: string) => void;
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

const EMPTY_TASTING: TastingData = {};

export const BrowseCard: React.FC<BrowseCardProps> = ({ entry, onEdit }) => {
  const navigate = useNavigate();
  const removeEntry = useTeaCompassStore((s) => s.removeEntry);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const transactions = useLedgerStore((s) => s.transactions);
  const getOrCreatePurchaseTransaction = useLedgerStore((s) => s.getOrCreatePurchaseTransaction);
  const addLineItem = useLedgerStore((s) => s.addLineItem);
  const removeLineItem = useLedgerStore((s) => s.removeLineItem);

  const [expanded, setExpanded] = useState(false);
  const [draftState, setDraftState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showBuyPrompt, setShowBuyPrompt] = useState(false);
  const [buyAmount, setBuyAmount] = useState('');
  const buyInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [tastingOpen, setTastingOpen] = useState(false);
  const [localTasting, setLocalTasting] = useState<TastingData>(EMPTY_TASTING);

  useEffect(() => {
    if (showBuyPrompt && buyInputRef.current) buyInputRef.current.focus();
  }, [showBuyPrompt]);

  const openTasting = useCallback(() => {
    setLocalTasting(entry.tasting || EMPTY_TASTING);
    setTastingOpen(true);
  }, [entry.tasting]);

  const closeTasting = useCallback(() => {
    updateEntry(entry.id, { tasting: localTasting });
    setTastingOpen(false);
  }, [entry.id, localTasting, updateEntry]);

  const handleCreateDraft = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isConfigured || !hasToken()) { setDraftState('error'); setTimeout(() => setDraftState('idle'), 2000); return; }
    setDraftState('loading');
    try {
      const payload = compassEntryToProductDraft(entry);
      const created = await api.products.create(payload);
      if (created?.id) { updateEntry(entry.id, { draftProductId: created.id }); setDraftState('success'); }
      else { setDraftState('error'); setTimeout(() => setDraftState('idle'), 2000); }
    } catch { setDraftState('error'); setTimeout(() => setDraftState('idle'), 2000); }
  }, [entry, updateEntry]);

  const handleConfirmBuy = useCallback((grams: number) => {
    if (grams <= 0) return;
    const isTeaware = entry.category === 'teaware';
    const buyTotal = entry.priceAmount && entry.pricePerUnitGrams
      ? (grams / entry.pricePerUnitGrams) * entry.priceAmount : undefined;
    updateEntry(entry.id, {
      status: 'bought',
      ...(isTeaware ? { buyQuantityUnits: grams } : { buyQuantityGrams: grams }),
      buyTotal,
    });
    if (entry.vendorName) {
      const currency = (entry.priceCurrency || 'NT') as Currency;
      const txId = getOrCreatePurchaseTransaction(entry.vendorName, currency, entry.vendorId);
      const pricePerUnit = entry.pricePerUnitGrams || (entry.priceAmount || 0);
      addLineItem(txId, {
        name: entry.name || 'Untitled', chineseName: entry.chineseName,
        type: entry.type, form: entry.form, year: entry.year,
        ...(isTeaware
          ? { quantityUnits: grams, pricePerUnit: entry.priceAmount || 0, priceIsPerGram: false }
          : { quantityGrams: grams, pricePerUnit, priceIsPerGram: !!entry.pricePerUnitGrams }),
        currency, compassEntryId: entry.id,
      });
    }
    setShowBuyPrompt(false);
    setBuyAmount('');
  }, [entry, updateEntry, getOrCreatePurchaseTransaction, addLineItem]);

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

  const gramPresets = entry.form ? GRAM_PRESETS[entry.form as TeaForm] || GRAM_PRESETS.Loose : GRAM_PRESETS.Loose;

  const hasName = entry.name.trim().length > 0;
  const typeColor = entry.type ? getTeaColor(entry.type) : null;
  const isBought = entry.status === 'bought' || entry.status === 'buying';
  const isWishlisted = entry.status === 'want';
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
        style={typeColor ? { borderLeft: `3px solid color-mix(in srgb, ${typeColor} 50%, transparent)` } : { borderLeft: '3px solid transparent' }}
      >
        {/* ── Tappable content area (expands for details) ── */}
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

              {/* Type · Year */}
              <p className="text-[10px] text-tea-text-dim tabular-nums">
                {[getTypeLabel(entry), entry.year && String(entry.year)]
                  .filter(Boolean).join(' · ')}
              </p>

              {/* Rating + price/gram */}
              {(rating != null || pricePerGram) && (
                <div className="flex items-center gap-2">
                  {rating != null && (
                    <span className="text-[11px] font-semibold tabular-nums" style={typeColor ? { color: typeColor } : undefined}>
                      {rating}/10
                    </span>
                  )}
                  {pricePerGram && (
                    <span className="text-[11px] text-tea-text-dim tabular-nums">{pricePerGram}</span>
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

        {/* ── Expanded detail: photos + notes ── */}
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
                    <img
                      key={i}
                      src={url}
                      alt=""
                      className="w-20 h-20 rounded-md object-cover shrink-0"
                    />
                  ))}
                  {/* Add photo tile — looks like a photo slot */}
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
                      : <Camera size={16} className="text-tea-text-dim" />
                    }
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
                  {/* Draft to inventory */}
                  {isBought && !entry.draftProductId && (
                    <button type="button" onClick={handleCreateDraft} disabled={draftState === 'loading'} className="pill flex items-center gap-1">
                      {draftState === 'loading' ? <Loader2 size={10} className="animate-spin" /> :
                       draftState === 'success' ? <Check size={10} /> : <PackagePlus size={10} />}
                      {draftState === 'idle' ? '→ Inventory draft' : draftState === 'loading' ? '…' : draftState === 'success' ? 'Done' : 'Error'}
                    </button>
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
                      View in inventory
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Buy quantity prompt (slides in above action bar) ── */}
        <AnimatePresence>
          {showBuyPrompt && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="inset-panel mx-3 mb-2 px-3 py-2.5 space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-tea-text-sec">
                  {entry.category === 'teaware' ? 'How many?' : 'How many grams?'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(entry.category !== 'teaware' ? gramPresets : [1, 2, 3]).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleConfirmBuy(val)}
                      className="px-3 py-1.5 text-xs rounded-md bg-tea-surface text-tea-text-sec hover:text-tea-text transition-colors"
                    >
                      {entry.category === 'teaware' ? val : `${val}g`}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    ref={buyInputRef}
                    type="number"
                    inputMode="numeric"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && Number(buyAmount) > 0) handleConfirmBuy(Number(buyAmount)); }}
                    placeholder={entry.category === 'teaware' ? 'Units' : 'Grams'}
                    className="flex-1 bg-tea-surface text-tea-text text-sm rounded-lg px-3 py-1.5 outline-none placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40 tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => { if (Number(buyAmount) > 0) handleConfirmBuy(Number(buyAmount)); }}
                    disabled={!buyAmount || Number(buyAmount) <= 0}
                    className="px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] rounded-lg bg-tea-gold text-tea-bg disabled:opacity-40 transition-all"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Action bar — always visible ── */}
        <div className="flex items-center gap-1 px-2 pb-2 pt-1.5 border-t border-tea-border">
          {/* Wishlist */}
          <button
            type="button"
            onClick={() => updateEntry(entry.id, { status: isWishlisted ? 'logged' : 'want' })}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
              isWishlisted
                ? 'bg-tea-gold/10 text-tea-gold'
                : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated'
            }`}
          >
            {isWishlisted ? <BookmarkCheck size={12} /> : <BookmarkPlus size={12} />}
            {isWishlisted ? 'Wanted' : 'Want'}
          </button>

          {/* Buy / Bought */}
          <button
            type="button"
            onClick={() => {
              if (isBought) {
                for (const tx of transactions) {
                  const item = tx.items.find((i) => i.compassEntryId === entry.id);
                  if (item) { removeLineItem(tx.id, item.id); break; }
                }
                updateEntry(entry.id, { status: 'logged' });
                setShowBuyPrompt(false);
              } else {
                setShowBuyPrompt((v) => !v);
              }
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
              isBought
                ? 'bg-tea-gold/10 text-tea-gold'
                : showBuyPrompt
                  ? 'bg-tea-gold/10 text-tea-gold'
                  : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated'
            }`}
          >
            {isBought
              ? <><Check size={12} /> Bought</>
              : entry.priceAmount
                ? formatPrice(entry.priceAmount, entry.priceCurrency)
                : 'Buy'
            }
          </button>

          {/* Taste / Rating */}
          <button
            type="button"
            onClick={openTasting}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
              hasTasting
                ? 'text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated'
                : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated'
            }`}
            style={rating != null && typeColor ? { color: typeColor } : undefined}
          >
            {rating != null ? `${rating}/10` : 'Taste'}
          </button>

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

          {/* Delete (icon-only) */}
          <button
            type="button"
            onClick={() => { if (window.confirm('Remove this entry?')) removeEntry(entry.id); }}
            className="p-1.5 rounded-md text-tea-text-dim hover:text-red-400 hover:bg-tea-elevated transition-colors"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* ── Tasting overlay ── */}
      <AnimatePresence>
        {tastingOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-tea-bg flex flex-col"
            style={{
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              paddingLeft: 'env(safe-area-inset-left, 0px)',
              paddingRight: 'env(safe-area-inset-right, 0px)',
            }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-tea-border shrink-0">
              <div className="min-w-0">
                <h2 className="text-tea-text text-sm font-medium tracking-wide truncate">
                  {entry.name || 'Tasting'}
                </h2>
                {entry.chineseName && (
                  <p className="text-[11px] text-tea-text-sec font-chinese truncate">{entry.chineseName}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => setTastingOpen(false)} className="pill text-xs text-tea-text-sec">Cancel</button>
                <button type="button" onClick={closeTasting} className="pill-active text-xs">Save</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TastingFlow mode="customer" value={localTasting} onChange={setLocalTasting} teaType={entry.type} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BrowseCard;
