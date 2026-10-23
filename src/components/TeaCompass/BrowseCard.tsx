import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Droplets, MoreHorizontal } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { getTeaLedgerTones, TYPOGRAPHY_CLASSES } from '../../designTokens';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { TastingSession } from '../tasting/TastingSession';
import type { TastingData } from '../../types';
import type { CompassVerdict, TeaCompassEntry } from './types';
import { entryDisplayTitle, entryHasBeenTasted } from './types';
import { libraryQuotePrice, DEFAULT_LIBRARY_PRICE, type LibraryPricePreference } from './libraryPriceDisplay';
import type { RateRow } from '../../lib/currency';
import { purchaseStateLabel, type LibraryPurchaseState } from '../../lib/libraryPurchaseState';

export interface BrowseCardProps {
  entry: TeaCompassEntry;
  readOnly?: boolean;
  tastingRecorded?: boolean;
  onEdit: (id: string) => void;
  tasteQueueActive?: boolean;
  onSelect?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  isSelected?: boolean;
  onAcquire?: (id: string) => void;
  pricePreference?: LibraryPricePreference;
  rates?: readonly RateRow[];
  purchaseState?: LibraryPurchaseState;
  purchaseStatusUnknown?: string;
}

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

export const BrowseCard: React.FC<BrowseCardProps> = ({ entry, readOnly = false, tastingRecorded, onEdit, onSelect, onOpenDetail, isSelected, onAcquire, pricePreference = DEFAULT_LIBRARY_PRICE, rates, purchaseState, purchaseStatusUnknown }) => {
  const { theme } = useTheme();
  const updateEntry = useTeaCompassStore((state) => state.updateEntry);
  const [tastingOpen, setTastingOpen] = useState(false);
  const validPhotos = (entry.photos || []).filter(Boolean);
  const tones = getTeaLedgerTones(entry.type || (entry.category === 'teaware' ? 'Teaware' : 'Misc'), theme, 2);
  const title = entryDisplayTitle(entry);
  const openDetail = () => (onOpenDetail || onSelect || onEdit)(entry.id);
  const price = libraryQuotePrice(entry, pricePreference, rates);
  const tasted = tastingRecorded ?? entryHasBeenTasted(entry);
  const preparation = entry.sampleState === 'requested' ? 'Sample requested'
    : entry.sampleState === 'received' ? 'Sample ready'
    : tasted ? 'Tasted' : entry.isSample ? 'Sample' : entry.status === 'in_stock' ? 'In stock' : entry.status === 'incoming' ? 'Incoming' : entry.status === 'depleted' ? 'Depleted' : null;
  const identity = [entry.year, entry.originRegion || entry.originCountry, entry.type || (entry.category === 'teaware' ? 'Teaware' : null), preparation].filter(value => value != null && value !== '').join(' · ');
  const purchaseLabel = purchaseStatusUnknown || (purchaseState ? purchaseStateLabel(purchaseState) || 'Order' : 'Order');
  const tastingCount = entry.tastingHistory?.length || (tasted ? 1 : 0);
  return (
    <>
      <article data-testid={`library-entry-${entry.id}`} className={`relative min-w-0 border-b border-tea-border px-3 pt-3 pb-1 ${isSelected ? 'ring-1 ring-inset ring-tea-gold' : ''}`}
        style={{ '--library-wash': tones.wash, '--library-accent': tones.markFg, backgroundColor: 'var(--library-wash)' } as React.CSSProperties}>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <button type="button" onClick={openDetail} className="tap-target min-w-0 flex-1 text-left" aria-label={`Open ${title} details`}>
            <span className={`${TYPOGRAPHY_CLASSES.h3} block break-words text-tea-text`}>{title}</span>
          </button>
          <span className="max-w-[45%] shrink-0 break-words pt-0.5 text-right text-ui-12 text-tea-text-sec tabular-nums" title={price.title}>{price.text}</span>
        </div>
        {identity && <p className={`${TYPOGRAPHY_CLASSES.accountMeta} mt-1 truncate text-tea-text-sec`} title={identity}>{identity}</p>}
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => onAcquire?.(entry.id)} disabled={!onAcquire}
            className="tap-target min-h-11 min-w-0 flex-1 truncate text-left text-ui-12 text-tea-text-sec hover:text-tea-text disabled:cursor-default" title={purchaseLabel} aria-label={`${purchaseLabel}: ${title}`}>
            {purchaseLabel}
          </button>
          {entry.category !== 'teaware' && <button type="button" onClick={() => readOnly ? openDetail() : setTastingOpen(true)} className="tap-target inline-flex min-h-11 items-center gap-1.5 text-ui-12 text-tea-text hover:text-tea-gold" aria-label={`Taste ${title}`}>
            <Droplets size={14} style={{ color: 'var(--library-accent)' }} /> Taste{tastingCount > 0 ? ` · ${tastingCount}` : ''}
          </button>}
          <button type="button" onClick={openDetail} className="tap-target inline-flex min-h-11 items-center gap-1.5 text-ui-12 text-tea-text-sec hover:text-tea-text" aria-label={`More about ${title}`}><MoreHorizontal size={14} /> More</button>
        </div>
      </article>
      {/* ── Tasting session ── */}
      <AnimatePresence>
        {tastingOpen && !readOnly && (
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

    </>
  );
};

export default BrowseCard;
