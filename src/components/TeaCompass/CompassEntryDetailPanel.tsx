import React, { useCallback, useState } from 'react';
import { mediaUrl } from '../../lib/mediaUrl';
import { useNavigate } from 'react-router-dom';
import { BookmarkCheck, BookmarkPlus, Check, Droplets, Share2, ShoppingBag, Star, Store, Trash2, X } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { TastingProfileStrip } from '../tasting/TastingProfileStrip';
import { getDateGroup } from './BrowseCard';
import { entryDisplayTitle } from './types';
import { AddToSampleButton } from '../samples/AddToSampleButton';
import { DecisionControl } from './DecisionControl';
import { CreateInventoryRecordAction } from './CreateInventoryRecordAction';
import { useLedgerStore } from '../../lib/ledgerStore';
import { TastingSession } from '../tasting/TastingSession';
import type { TastingData } from '../../types';
import type { CompassVerdict } from './types';

interface CompassEntryDetailPanelProps {
  entryId: string;
  onEdit: (id: string) => void;
  onClose: () => void;
  onShare?: (id: string) => void;
  onAcquire?: (id: string) => void;
}

const SECTION_LABEL = 'text-ui-12 text-tea-text-dim font-medium mb-2';

export const CompassEntryDetailPanel: React.FC<CompassEntryDetailPanelProps> = ({
  entryId,
  onEdit,
  onClose,
  onShare,
  onAcquire,
}) => {
  const navigate = useNavigate();
  const getEntry = useTeaCompassStore((s) => s.getEntry);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const removeEntry = useTeaCompassStore((s) => s.removeEntry);
  const transactions = useLedgerStore((s) => s.transactions);
  const removeLineItem = useLedgerStore((s) => s.removeLineItem);
  const [tastingOpen, setTastingOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const entry = getEntry(entryId);
  if (!entry) return null;

  const validPhotos = (entry.photos || []).filter(Boolean);
  const hasTasting = entry.tasting && Object.values(entry.tasting).some(
    (v) => Array.isArray(v) ? v.length > 0 : v != null
  );
  const hasNotes = entry.notes.trim().length > 0;
  const hasTastingHistory = (entry.tastingHistory?.length ?? 0) > 0;
  const isWishlisted = entry.status === 'want';
  const isBought = entry.status === 'in_stock' || entry.status === 'buying';
  const isIncoming = entry.status === 'incoming';
  const isInLedger = transactions.some((transaction) => transaction.items.some((item) => item.compassEntryId === entry.id));
  const acquisitionPending = isIncoming || (!isBought && isInLedger);

  const handleUnbuy = useCallback(() => {
    for (const transaction of transactions) {
      for (const item of transaction.items.filter((candidate) => candidate.compassEntryId === entry.id)) {
        removeLineItem(transaction.id, item.id);
      }
    }
    updateEntry(entry.id, { status: 'noted', buyQuantityGrams: undefined, buyQuantityUnits: undefined, buyTotal: undefined });
  }, [entry.id, removeLineItem, transactions, updateEntry]);

  // Price per gram display
  const pricePerGram = (() => {
    if (entry.category === 'teaware') return null;
    const perGram = entry.pricePerUnitGrams;
    if (!perGram || !entry.priceAmount) return null;
    const symbols: Record<string, string> = {
      USD: '$', NT: 'NT$', Yuan: 'CN¥', IDR: 'Rp', JPY: 'JP¥', MYR: 'RM', HKD: 'HK$', UNK: '',
    };
    const symbol = symbols[entry.priceCurrency] || '';
    const val = entry.priceAmount / perGram;
    if (['IDR', 'JPY', 'NT'].includes(entry.priceCurrency)) return `${symbol}${Math.round(val)}/g`;
    return `${symbol}${val.toFixed(2)}/g`;
  })();

  // Status badge variant
  const statusBadgeClass = (entry.status === 'want' || entry.status === 'incoming')
    ? 'badge-status badge-status-gold'
    : 'badge-status badge-status-default';

  const statusLabel = {
    noted: 'Noted',
    want: 'Wishlist',
    incoming: 'Incoming',
    in_stock: 'In Stock',
    depleted: 'Depleted',
    pass: 'Passed',
    buying: 'In Stock',
  }[entry.status] ?? entry.status;

  const typeLabel = entry.type || (entry.category === 'teaware' ? 'Teaware' : 'Tea');

  const metaParts = [
    entry.originRegion,
    entry.year ? String(entry.year) : null,
    entry.season,
    entry.form,
  ].filter(Boolean);

  return (
    <div className="flex h-full flex-col" data-testid="library-entry-detail">

      {/* ── Header ── */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-tea-border">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onClose}
            className="tap-target flex min-h-11 min-w-11 shrink-0 items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors"
            aria-label="Close detail panel"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge-status badge-status-default">{typeLabel}</span>
            <span className={statusBadgeClass}>{statusLabel}</span>
          </div>
        </div>
        <h2 className="mt-3 font-serif text-ui-16 leading-snug text-tea-text">
          {entry.name || <span className="text-tea-text-sec">{entryDisplayTitle(entry)}</span>}
        </h2>
        {entry.chineseName && (
          <p
            className="mt-0.5 text-ui-12 text-tea-text-dim"
            style={{ fontFamily: 'var(--font-chinese)' }}
          >
            {entry.chineseName}
          </p>
        )}
      </div>

      {/* ── Scrollable content ── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-6"
        style={{ scrollbarGutter: 'stable' }}
      >

        <DecisionControl value={entry.decision} onChange={(decision) => updateEntry(entry.id, { decision })} />

        {/* Metadata strip */}
        {metaParts.length > 0 && (
          <div>
            <p className={SECTION_LABEL}>Details</p>
            <p className="text-ui-12 text-tea-text-sec">
              {metaParts.map((part, i) => (
                <span key={i}>
                  {i > 0 && <span className="mx-1 text-tea-text-dim">·</span>}
                  {part}
                </span>
              ))}
            </p>
          </div>
        )}

        {/* Vendor */}
        {entry.vendorName && (
          <div>
            <p className={SECTION_LABEL}>Source</p>
            <div className="flex items-center gap-2 text-ui-12 text-tea-text-sec">
              <Store size={12} className="text-tea-text-dim shrink-0" />
              <span className="flex-1 min-w-0 truncate">{entry.vendorName}</span>
              {pricePerGram && (
                <span className="text-ui-12 text-tea-text-dim ml-auto tabular-nums shrink-0">{pricePerGram}</span>
              )}
            </div>
          </div>
        )}

        {/* Photos */}
        {validPhotos.length > 0 && (
          <div>
            <p className={SECTION_LABEL}>Photos</p>
            <div className="grid grid-cols-2 gap-2">
              {validPhotos.map((url, i) => (
                <img
                  key={i}
                  src={mediaUrl(url)}
                  alt={`Photo ${i + 1}`}
                  className="w-full aspect-[4/3] object-cover rounded-xl"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        )}

        {/* Tasting profile */}
        {hasTasting && (
          <div>
            <p className={SECTION_LABEL}>Tasting Profile</p>
            <TastingProfileStrip value={entry.tasting!} />
          </div>
        )}

        {/* Notes */}
        {hasNotes && (
          <div>
            <p className={SECTION_LABEL}>Notes</p>
            <p className="text-ui-12 text-tea-text-sec leading-relaxed whitespace-pre-wrap">
              {entry.notes}
            </p>
          </div>
        )}

        {/* Tasting history */}
        {hasTastingHistory && (
          <div>
            <p className={SECTION_LABEL}>
              {entry.tastingHistory!.length === 1 ? '1 Tasting' : `${entry.tastingHistory!.length} Tastings`}
            </p>
            <div className="space-y-2">
              {entry.tastingHistory!.slice().reverse().map((h, i) => {
                const q = h.data.quality ?? h.data.rating;
                const flavorSnippet = h.data.flavor?.slice(0, 3).join(', ');
                return (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-ui-12 text-tea-text-dim shrink-0 tabular-nums mt-px">
                      {getDateGroup(h.date)}
                    </span>
                    <div className="flex-1 min-w-0">
                      {q != null && (
                        <span className="text-ui-12 text-tea-text-sec font-medium tabular-nums">
                          {q}/10
                          {flavorSnippet ? ' · ' : ''}
                        </span>
                      )}
                      {flavorSnippet && (
                        <span className="text-ui-12 text-tea-text-sec truncate">{flavorSnippet}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* ── Footer action bar ── */}
      <div className="shrink-0 border-t border-tea-border px-4 py-2">
        <div className="flex flex-wrap items-center gap-x-1">
        <button
          type="button"
          onClick={() => onEdit(entryId)}
          className="tap-target min-h-11 rounded-md px-3 text-ui-12 font-medium text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text"
          aria-label="Edit entry"
        >
          Edit
        </button>

        <button type="button" onClick={() => updateEntry(entryId, { status: isWishlisted ? 'noted' : 'want' })}
          className="tap-target min-h-11 rounded-md px-3 text-ui-12 font-medium text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text"
          aria-label={isWishlisted ? 'Remove Want' : 'Want'}>
          {isWishlisted ? <BookmarkCheck size={14} className="inline mr-1.5 text-tea-gold" /> : <BookmarkPlus size={14} className="inline mr-1.5" />}Want
        </button>

        <button
          type="button"
          onClick={() => isBought ? handleUnbuy() : onAcquire?.(entry.id)}
          disabled={acquisitionPending || (!isBought && !onAcquire)}
          className="tap-target min-h-11 rounded-md px-3 text-ui-12 font-medium text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text disabled:text-tea-text-dim"
          aria-label={isBought ? 'Remove acquisition' : entry.status === 'depleted' ? 'Reorder' : acquisitionPending ? (isIncoming ? 'Incoming' : 'In ledger') : 'Buy'}>
          {isBought ? <Check size={14} className="inline mr-1.5" /> : <ShoppingBag size={14} className="inline mr-1.5" />}
          {isBought ? 'In stock' : entry.status === 'depleted' ? 'Reorder' : isIncoming ? 'Incoming' : isInLedger ? 'In ledger' : 'Buy'}
        </button>

        <button type="button" onClick={() => setTastingOpen(true)}
          className="tap-target min-h-11 rounded-md px-3 text-ui-12 font-medium text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text"
          aria-label="Taste">
          <Droplets size={14} className="inline mr-1.5" />Taste
        </button>

        <button
          type="button"
          onClick={() => updateEntry(entry.id, { tasteOrder: entry.tasteOrder ? undefined : Date.now() })}
          className="tap-target min-h-11 rounded-md px-3 text-ui-12 font-medium text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text"
          aria-label={entry.tasteOrder ? 'Remove from queue' : 'Queue'}
        >
          <Star size={14} className="inline mr-1.5" fill={entry.tasteOrder ? 'currentColor' : 'none'} />{entry.tasteOrder ? 'Queued' : 'Queue'}
        </button>

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
            variant="labeled"
            className="tap-target min-h-11 rounded-md bg-transparent px-3 text-ui-12 text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text"
          />
        )}

        <CreateInventoryRecordAction
          entryId={entry.id}
          productId={entry.draftProductId}
          onOpenInventory={(productId) => navigate(`/admin/stock?panel=${encodeURIComponent(productId)}`)}
        />

        {onShare && <button type="button" onClick={() => onShare(entryId)} className="tap-target min-h-11 rounded-md px-3 text-ui-12 font-medium text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text" aria-label="Share"><Share2 size={14} className="inline mr-1.5" />Share</button>}
        {confirmDelete ? (
          <button
            type="button"
            onClick={() => { removeEntry(entry.id); onClose(); }}
            className="tap-target min-h-11 rounded-md px-3 text-ui-12 font-medium text-tea-error hover:bg-tea-accent-sub"
            aria-label="Confirm delete entry"
          >
            <Trash2 size={14} className="inline mr-1.5" />Confirm delete
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="tap-target min-h-11 rounded-md px-3 text-ui-12 font-medium text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-error"
            aria-label="Delete entry"
          >
            <Trash2 size={14} className="inline mr-1.5" />Delete
          </button>
        )}
        </div>
      </div>

      {tastingOpen && (
        <TastingSession
          item={{ id: entry.id, name: entry.name, type: entry.type, image: validPhotos[0], sourceType: 'compass', compassEntryId: entry.id }}
          onClose={() => setTastingOpen(false)}
          onAfterSave={(data: TastingData, verdict?: CompassVerdict) => updateEntry(entry.id, {
            tasting: data,
            tastingHistory: [...(entry.tastingHistory ?? []), { data, date: new Date().toISOString() }],
            ...(verdict ? { verdict } : {}),
          })}
        />
      )}

    </div>
  );
};

export default CompassEntryDetailPanel;
