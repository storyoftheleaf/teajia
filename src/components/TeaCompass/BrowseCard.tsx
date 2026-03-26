import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Pencil, Trash2, Store, PackagePlus, ExternalLink, Check, Loader2, Droplets } from 'lucide-react';
import { getTeaColor } from '../../designTokens';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { compassEntryToProductDraft, GRAM_PRESETS, DEFAULT_GRAMS } from './types';
import { api, isConfigured, hasToken } from '../../lib/api';
import type { TeaCompassEntry, TeaForm } from './types';

export interface BrowseCardProps {
  entry: TeaCompassEntry;
  onEdit: (id: string) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

/** Currency symbol map for compass entries */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  NT: 'NT$',
  Yuan: '\u00a5',
  IDR: 'Rp',
  JPY: '\u00a5',
  MYR: 'RM',
  HKD: 'HK$',
  UNK: '',
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
  if (['IDR', 'JPY', 'NT'].includes(currency)) {
    return `${symbol}${Math.round(amount).toLocaleString()}`;
  }
  return `${symbol}${amount.toFixed(2)}`;
}

function getStatusConfig(status: string): { label: string; className: string } {
  switch (status) {
    case 'want':
      return { label: 'Want', className: 'badge-status badge-status-amber' };
    case 'bought':
      return { label: 'Bought', className: 'badge-status badge-status-gold' };
    case 'buying':
      return { label: 'Buying', className: 'badge-status badge-status-green' };
    case 'logged':
    default:
      return { label: 'Logged', className: 'badge-status badge-status-muted' };
  }
}

function getTeaTypeBadgeStyle(type: string): React.CSSProperties {
  const color = getTeaColor(type);
  return {
    '--type-color': color,
    backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
    color,
  } as React.CSSProperties;
}

export const BrowseCard: React.FC<BrowseCardProps> = ({
  entry,
  onEdit,
  expanded,
  onToggleExpand,
}) => {
  const removeEntry = useTeaCompassStore((s) => s.removeEntry);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const statusConfig = getStatusConfig(entry.status);

  const [draftState, setDraftState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showBuyPrompt, setShowBuyPrompt] = useState(false);
  const [buyAmount, setBuyAmount] = useState('');
  const buyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showBuyPrompt && buyInputRef.current) {
      buyInputRef.current.focus();
    }
  }, [showBuyPrompt]);

  const handleCreateDraft = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isConfigured || !hasToken()) {
      setDraftState('error');
      setTimeout(() => setDraftState('idle'), 2000);
      return;
    }
    setDraftState('loading');
    try {
      const payload = compassEntryToProductDraft(entry);
      const created = await api.products.create(payload);
      if (created?.id) {
        updateEntry(entry.id, { draftProductId: created.id });
        setDraftState('success');
      } else {
        setDraftState('error');
        setTimeout(() => setDraftState('idle'), 2000);
      }
    } catch (err) {
      console.debug('Draft creation failed:', err);
      setDraftState('error');
      setTimeout(() => setDraftState('idle'), 2000);
    }
  }, [entry, updateEntry]);

  const handleConfirmBuy = useCallback((grams: number) => {
    if (grams <= 0) return;
    const isTeaware = entry.category === 'teaware';
    updateEntry(entry.id, {
      status: 'buying',
      ...(isTeaware
        ? { buyQuantityUnits: grams }
        : { buyQuantityGrams: grams }),
      buyTotal: entry.priceAmount && entry.pricePerUnitGrams
        ? (grams / entry.pricePerUnitGrams) * entry.priceAmount
        : undefined,
    });
    setShowBuyPrompt(false);
    setBuyAmount('');
  }, [entry, updateEntry]);

  const gramPresets = entry.form
    ? GRAM_PRESETS[entry.form as TeaForm] || GRAM_PRESETS.Loose
    : GRAM_PRESETS.Loose;

  const hasName = entry.name.trim().length > 0;

  const hasTasting = entry.tasting && (
    (entry.tasting.flavor && entry.tasting.flavor.length > 0) ||
    (entry.tasting.body && entry.tasting.body.length > 0) ||
    (entry.tasting.finish && entry.tasting.finish.length > 0)
  );

  const tastingNotes = React.useMemo(() => {
    if (!entry.tasting) return [];
    const notes: string[] = [];
    if (entry.tasting.flavor) notes.push(...entry.tasting.flavor);
    if (entry.tasting.body) notes.push(...entry.tasting.body);
    if (entry.tasting.finish) notes.push(...entry.tasting.finish);
    return notes.slice(0, 6);
  }, [entry.tasting]);

  const metaTags = React.useMemo(() => {
    const tags: string[] = [];
    if (entry.type) tags.push(entry.type);
    if (entry.form) tags.push(entry.form);
    if (entry.year) tags.push(String(entry.year));
    if (entry.season) tags.push(entry.season);
    if (entry.storage) tags.push(entry.storage);
    if (entry.originRegion) tags.push(entry.originRegion);
    return tags;
  }, [entry.type, entry.form, entry.year, entry.season, entry.storage, entry.originRegion]);

  return (
    <div className="bg-tea-surface/40 hover:bg-tea-surface/70 rounded-lg overflow-hidden transition-colors duration-150">
      {/* Collapsed row -- always visible, two-line layout */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full px-3 py-2.5 text-left transition-colors duration-150"
      >
        {/* Line 1: Name + Chevron */}
        <div className="flex items-center gap-2">
          <span
            className={`flex-1 min-w-0 truncate text-sm font-sans ${
              hasName ? 'text-tea-text' : 'text-tea-text-dim italic'
            }`}
          >
            {hasName ? entry.name : 'Untitled'}
          </span>

          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 text-tea-text-dim"
          >
            <ChevronDown size={14} />
          </motion.span>
        </div>

        {/* Line 2: Type + Status + Price + Date */}
        <div className="flex items-center gap-2 mt-1">
          {entry.type && (
            <span
              className="badge-status shrink-0 text-[11px]"
              style={getTeaTypeBadgeStyle(entry.type)}
            >
              {entry.type}
            </span>
          )}

          <span className={`${statusConfig.className} shrink-0 text-[11px]`}>
            {statusConfig.label}
            {(entry.status === 'buying' || entry.status === 'bought') && entry.buyQuantityGrams
              ? ` ${entry.buyQuantityGrams}g`
              : (entry.status === 'buying' || entry.status === 'bought') && entry.buyQuantityUnits
                ? ` ×${entry.buyQuantityUnits}`
                : ''}
          </span>

          {entry.priceAmount != null && entry.priceAmount > 0 && (
            <span className="text-[11px] num text-tea-gold shrink-0">
              {formatPrice(entry.priceAmount, entry.priceCurrency)}
            </span>
          )}

          <span className="text-[11px] text-tea-text-dim shrink-0 tabular-nums ml-auto">
            {formatRelativeDate(entry.createdAt)}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-3 border-t border-tea-border">
              {/* Chinese name */}
              {entry.chineseName && (
                <p className="text-sm text-tea-text-sec font-chinese">
                  {entry.chineseName}
                </p>
              )}

              {/* Metadata tags */}
              {metaTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {metaTags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Notes preview */}
              {entry.notes.trim().length > 0 && (
                <p className="text-xs text-tea-text-sec leading-relaxed line-clamp-2">
                  {entry.notes}
                </p>
              )}

              {/* Tasting profile strip */}
              {hasTasting && tastingNotes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tastingNotes.map((note) => (
                    <span
                      key={note}
                      className="tag text-[10px]"
                    >
                      {note}
                    </span>
                  ))}
                </div>
              )}

              {/* Vendor */}
              {entry.vendorName && (
                <div className="flex items-center gap-1.5 text-xs text-tea-text-dim">
                  <Store size={12} />
                  <span>{entry.vendorName}</span>
                </div>
              )}

              {/* Taste / Want / Buy buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(entry.id);
                  }}
                  className="flex-1 text-sm font-semibold rounded-lg text-center py-3 transition-all bg-tea-surface text-tea-text-sec active:bg-tea-elevated flex items-center justify-center gap-1.5"
                >
                  <Droplets size={14} />
                  Taste
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateEntry(entry.id, { status: entry.status === 'want' ? 'logged' : 'want' });
                  }}
                  className={`flex-1 text-sm font-semibold rounded-lg text-center py-3 transition-all ${
                    entry.status === 'want'
                      ? 'bg-amber-500/20 text-amber-400 shadow-[0_2px_8px_rgba(245,158,11,0.15)]'
                      : 'bg-tea-surface text-tea-text-sec active:bg-tea-elevated'
                  }`}
                >
                  Want
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (entry.status === 'buying') {
                      updateEntry(entry.id, { status: 'logged', buyQuantityGrams: undefined, buyQuantityUnits: undefined, buyTotal: undefined });
                      setShowBuyPrompt(false);
                    } else {
                      setShowBuyPrompt(!showBuyPrompt);
                    }
                  }}
                  className={`flex-1 text-sm font-semibold rounded-lg text-center py-3 transition-all ${
                    entry.status === 'buying'
                      ? 'bg-tea-gold text-tea-bg shadow-[0_2px_8px_rgba(184,146,78,0.3)]'
                      : entry.status === 'bought'
                        ? 'bg-tea-gold/20 text-tea-gold shadow-[0_2px_8px_rgba(184,146,78,0.15)]'
                        : showBuyPrompt
                          ? 'bg-tea-gold/30 text-tea-gold'
                          : 'bg-tea-surface text-tea-text-sec active:bg-tea-elevated'
                  }`}
                >
                  {entry.status === 'bought' ? 'Bought' : entry.status === 'buying' ? 'Buying' : 'Buy'}
                </button>
              </div>

              {/* Buy quantity prompt */}
              <AnimatePresence>
                {showBuyPrompt && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-tea-text-sec">
                        {entry.category === 'teaware' ? 'How many?' : 'How many grams?'}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {(entry.category !== 'teaware' ? gramPresets : [1, 2, 3]).map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmBuy(val);
                            }}
                            className={`px-3 py-2 text-xs rounded-md transition-all min-h-[36px] ${
                              'bg-tea-surface text-tea-text-sec active:bg-tea-elevated hover:text-tea-text'
                            }`}
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
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && Number(buyAmount) > 0) {
                              handleConfirmBuy(Number(buyAmount));
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder={entry.category === 'teaware' ? 'Units' : 'Grams'}
                          className="flex-1 bg-tea-surface text-tea-text text-sm rounded-lg px-3 py-2 outline-none placeholder-tea-text-dim/50 focus:ring-1 focus:ring-tea-gold/40"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (Number(buyAmount) > 0) handleConfirmBuy(Number(buyAmount));
                          }}
                          disabled={!buyAmount || Number(buyAmount) <= 0}
                          className="px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] rounded-lg bg-tea-gold text-tea-bg disabled:opacity-40 transition-all"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(entry.id);
                    }}
                    className="pill-active flex items-center gap-1.5"
                  >
                    <Pencil size={12} />
                    Edit
                  </button>

                  {/* Draft pipeline actions for bought entries */}
                  {entry.status === 'bought' && !entry.draftProductId && (
                    <button
                      type="button"
                      onClick={handleCreateDraft}
                      disabled={draftState === 'loading'}
                      className="pill flex items-center gap-1.5 text-tea-text-sec"
                    >
                      {draftState === 'loading' ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Creating...
                        </>
                      ) : draftState === 'success' ? (
                        <>
                          <Check size={12} />
                          Draft created
                        </>
                      ) : draftState === 'error' ? (
                        <span className="text-red-400">Failed</span>
                      ) : (
                        <>
                          <PackagePlus size={12} />
                          Create Draft
                        </>
                      )}
                    </button>
                  )}

                  {entry.status === 'bought' && entry.draftProductId && (
                    <a
                      href="/admin/inventory"
                      onClick={(e) => e.stopPropagation()}
                      className="pill flex items-center gap-1.5 text-tea-gold"
                    >
                      <ExternalLink size={12} />
                      View in Inventory
                    </a>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Remove this entry?')) {
                      removeEntry(entry.id);
                    }
                  }}
                  className="text-xs text-tea-text-sec hover:text-tea-text transition-colors duration-150 cursor-pointer"
                >
                  <span className="flex items-center gap-1">
                    <Trash2 size={11} />
                    Delete
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BrowseCard;
