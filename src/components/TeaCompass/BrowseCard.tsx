import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2, Store, PackagePlus, ExternalLink, Check, Loader2, Droplets } from 'lucide-react';
import { getTeaColor } from '../../designTokens';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useLedgerStore } from '../../lib/ledgerStore';
import { compassEntryToProductDraft, GRAM_PRESETS, DEFAULT_GRAMS } from './types';
import { api, isConfigured, hasToken } from '../../lib/api';
import type { TeaCompassEntry, TeaForm } from './types';
import type { Currency } from '../../admin/types';

export interface BrowseCardProps {
  entry: TeaCompassEntry;
  onEdit: (id: string) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
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
}) => {
  const removeEntry = useTeaCompassStore((s) => s.removeEntry);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const getOrCreatePurchaseTransaction = useLedgerStore((s) => s.getOrCreatePurchaseTransaction);
  const addLineItem = useLedgerStore((s) => s.addLineItem);
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

    // Add to ledger transaction if vendor is known
    if (entry.vendorName) {
      const currency = (entry.priceCurrency || 'NT') as Currency;
      const txId = getOrCreatePurchaseTransaction(entry.vendorName, currency, entry.vendorId);
      const pricePerUnit = entry.pricePerUnitGrams || (entry.priceAmount || 0);
      const priceIsPerGram = !!entry.pricePerUnitGrams;
      addLineItem(txId, {
        name: entry.name || 'Untitled',
        chineseName: entry.chineseName,
        type: entry.type,
        form: entry.form,
        year: entry.year,
        ...(isTeaware
          ? { quantityUnits: grams, pricePerUnit: entry.priceAmount || 0, priceIsPerGram: false }
          : { quantityGrams: grams, pricePerUnit, priceIsPerGram }),
        currency,
        compassEntryId: entry.id,
      });
    }

    setShowBuyPrompt(false);
    setBuyAmount('');
  }, [entry, updateEntry, getOrCreatePurchaseTransaction, addLineItem]);

  const gramPresets = entry.form
    ? GRAM_PRESETS[entry.form as TeaForm] || GRAM_PRESETS.Loose
    : GRAM_PRESETS.Loose;

  const hasName = entry.name.trim().length > 0;

  // Year + region line
  const yearRegion = [entry.year && String(entry.year), entry.originRegion].filter(Boolean).join(' · ');

  const typeColor = entry.type ? getTeaColor(entry.type) : null;
  const hasPhoto = entry.photos.length > 0;

  return (
    <div
      className="bg-tea-surface/40 rounded-lg overflow-hidden space-y-0 relative"
      style={typeColor ? { borderLeft: `2.5px solid color-mix(in srgb, ${typeColor} 25%, transparent)` } : undefined}
    >
      {/* Main content area */}
      <div className="flex gap-3 px-3 py-2.5">
        {/* Photo thumbnail */}
        {hasPhoto && (
          <img
            src={entry.photos[0]}
            alt=""
            className="w-11 h-11 rounded-md object-cover shrink-0 mt-0.5"
          />
        )}

        {/* Text content */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Line 1: Name + date */}
          <div className="flex items-center gap-2">
            <span
              className={`flex-1 min-w-0 truncate text-sm font-serif ${
                hasName ? 'text-tea-text' : 'text-tea-text-dim italic'
              }`}
            >
              {hasName ? entry.name : 'Untitled'}
            </span>
            <span className="text-[10px] text-tea-text-dim shrink-0 tabular-nums">
              {formatRelativeDate(entry.createdAt)}
            </span>
          </div>

          {/* Chinese name — promoted above metadata when present */}
          {entry.chineseName && (
            <p className="text-[13px] text-tea-text-sec font-chinese leading-tight truncate">{entry.chineseName}</p>
          )}

          {/* Line 2: Type + status + year/region + price */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {entry.type && (
              <span
                className="badge-status shrink-0 text-[10px]"
                style={getTeaTypeBadgeStyle(entry.type)}
              >
                {entry.type}
              </span>
            )}
            {entry.category === 'teaware' && !entry.type && (
              <span className="badge-status badge-status-muted shrink-0 text-[10px]">Teaware</span>
            )}

            <span className={`${statusConfig.className} shrink-0 text-[10px]`}>
              {statusConfig.label}
              {(entry.status === 'buying' || entry.status === 'bought') && entry.buyQuantityGrams
                ? ` ${entry.buyQuantityGrams}g`
                : (entry.status === 'buying' || entry.status === 'bought') && entry.buyQuantityUnits
                  ? ` ×${entry.buyQuantityUnits}`
                  : ''}
            </span>

            {yearRegion && (
              <span className="text-[10px] text-tea-text-sec shrink-0">{yearRegion}</span>
            )}

            {entry.priceAmount != null && entry.priceAmount > 0 && (
              <span className="text-[10px] num text-tea-gold shrink-0 ml-auto">
                {formatPrice(entry.priceAmount, entry.priceCurrency)}
              </span>
            )}
          </div>

          {/* Notes preview */}
          {entry.notes.trim().length > 0 && (
            <p className="text-[11px] text-tea-text-dim leading-relaxed line-clamp-1">{entry.notes}</p>
          )}

          {/* Vendor */}
          {entry.vendorName && (
            <div className="flex items-center gap-1 text-[10px] text-tea-text-dim">
              <Store size={10} />
              <span>{entry.vendorName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Compact Taste / Want / Buy row */}
      <div className="flex items-center border-t border-tea-gold/8 gap-px bg-tea-gold/[0.06]">
        <button
          type="button"
          onClick={() => onEdit(entry.id)}
          className="flex-1 text-[11px] font-semibold text-center py-2 transition-all text-tea-text-sec active:bg-tea-elevated bg-tea-surface/40 flex items-center justify-center gap-1"
        >
          <Droplets size={12} />
          Taste
        </button>
        <button
          type="button"
          onClick={() => updateEntry(entry.id, { status: entry.status === 'want' ? 'logged' : 'want' })}
          className={`flex-1 text-[11px] font-semibold text-center py-2 transition-all ${
            entry.status === 'want'
              ? 'bg-tea-gold/10 text-tea-gold'
              : 'text-tea-text-sec active:bg-tea-elevated bg-tea-surface/40'
          }`}
        >
          Want
        </button>
        <button
          type="button"
          onClick={() => setShowBuyPrompt(!showBuyPrompt)}
          className={`flex-1 text-[11px] font-semibold text-center py-2 transition-all ${
            entry.status === 'buying'
              ? 'bg-tea-gold/15 text-tea-gold'
              : entry.status === 'bought'
                ? 'bg-tea-gold/10 text-tea-gold'
                : showBuyPrompt
                  ? 'bg-tea-gold/10 text-tea-gold'
                  : 'text-tea-text-sec active:bg-tea-elevated bg-tea-surface/40'
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
            <div className="px-3 py-2 space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-tea-text-sec">
                {entry.category === 'teaware' ? 'How many?' : 'How many grams?'}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(entry.category !== 'teaware' ? gramPresets : [1, 2, 3]).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleConfirmBuy(val)}
                    className="px-3 py-1.5 text-xs rounded-md transition-all bg-tea-surface text-tea-text-sec active:bg-tea-elevated hover:text-tea-text"
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
                  placeholder={entry.category === 'teaware' ? 'Units' : 'Grams'}
                  className="flex-1 bg-tea-surface text-tea-text text-sm rounded-lg px-3 py-1.5 outline-none placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40 tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (Number(buyAmount) > 0) handleConfirmBuy(Number(buyAmount));
                  }}
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

      {/* Actions row — compact pill strip */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-tea-gold/8">
        <button
          type="button"
          onClick={() => onEdit(entry.id)}
          className="pill flex items-center gap-1"
        >
          <Pencil size={10} />
          Edit
        </button>

        {entry.status === 'bought' && !entry.draftProductId && (
          <button
            type="button"
            onClick={handleCreateDraft}
            disabled={draftState === 'loading'}
            className="pill flex items-center gap-1"
          >
            {draftState === 'loading' ? (
              <Loader2 size={10} className="animate-spin" />
            ) : draftState === 'success' ? (
              <Check size={10} />
            ) : draftState === 'error' ? (
              <span className="text-red-400 text-[10px]">Failed</span>
            ) : (
              <PackagePlus size={10} />
            )}
            {draftState === 'idle' ? 'Draft' : draftState === 'loading' ? '...' : draftState === 'success' ? 'Done' : ''}
          </button>
        )}

        {entry.status === 'bought' && entry.draftProductId && (
          <a
            href="/admin/inventory"
            className="pill flex items-center gap-1 text-tea-gold"
          >
            <ExternalLink size={10} />
            Inventory
          </a>
        )}

        <button
          type="button"
          onClick={() => {
            if (window.confirm('Remove this entry?')) {
              removeEntry(entry.id);
            }
          }}
          className="pill flex items-center gap-1 ml-auto text-tea-text-dim"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
};

export default BrowseCard;
