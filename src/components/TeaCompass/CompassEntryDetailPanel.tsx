import React from 'react';
import { ArrowRight, BookmarkCheck, BookmarkPlus, Store, X } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { TastingProfileStrip } from '../tasting/TastingProfileStrip';
import { getDateGroup } from './BrowseCard';
import { AddToSampleButton } from '../samples/AddToSampleButton';

interface CompassEntryDetailPanelProps {
  entryId: string;
  onEdit: (id: string) => void;
  onClose: () => void;
}

const SECTION_LABEL = 'text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-2';

export const CompassEntryDetailPanel: React.FC<CompassEntryDetailPanelProps> = ({
  entryId,
  onEdit,
  onClose,
}) => {
  const getEntry = useTeaCompassStore((s) => s.getEntry);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);

  const entry = getEntry(entryId);
  if (!entry) return null;

  const validPhotos = (entry.photos || []).filter(Boolean);
  const hasTasting = entry.tasting && Object.values(entry.tasting).some(
    (v) => Array.isArray(v) ? v.length > 0 : v != null
  );
  const hasNotes = entry.notes.trim().length > 0;
  const hasTastingHistory = (entry.tastingHistory?.length ?? 0) > 0;
  const isWishlisted = entry.status === 'want';

  // Price per gram display
  const pricePerGram = (() => {
    if (entry.category === 'teaware') return null;
    const perGram = entry.pricePerUnitGrams;
    if (!perGram || !entry.priceAmount) return null;
    const symbols: Record<string, string> = {
      USD: '$', NT: 'NT$', Yuan: '¥', IDR: 'Rp', JPY: '¥', MYR: 'RM', HKD: 'HK$', UNK: '',
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
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-tea-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge-status badge-status-default">{typeLabel}</span>
            <span className={statusBadgeClass}>{statusLabel}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-tea-text-sec hover:text-tea-text transition-colors shrink-0"
            aria-label="Close detail panel"
          >
            <X size={16} />
          </button>
        </div>
        <h2 className="font-serif text-xl text-tea-text leading-snug mt-3">
          {entry.name || <span className="italic text-tea-text-dim">Untitled</span>}
        </h2>
        {entry.chineseName && (
          <p
            className="text-sm text-tea-text-dim mt-0.5"
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
            <div className="flex items-center gap-2 text-ui-13 text-tea-text-sec">
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
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="w-full aspect-[4/3] object-cover rounded-lg"
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
            <p className="text-ui-13 text-tea-text-sec leading-relaxed whitespace-pre-wrap">
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
                    <span className="text-ui-11 text-tea-text-dim shrink-0 tabular-nums mt-px">
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
      <div className="shrink-0 px-6 py-4 border-t border-tea-border flex items-center gap-2">
        <button
          type="button"
          onClick={() => onEdit(entryId)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-tea-gold/10 text-tea-gold text-ui-12 font-semibold hover:bg-tea-gold/15 transition-colors"
        >
          Edit Entry
          <ArrowRight size={13} />
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
          />
        )}

        <button
          type="button"
          onClick={() =>
            updateEntry(entryId, {
              status: isWishlisted ? 'noted' : 'want',
            })
          }
          className="p-2 rounded-lg hover:bg-tea-surface transition-colors"
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          {isWishlisted ? (
            <BookmarkCheck size={16} className="text-tea-gold" />
          ) : (
            <BookmarkPlus size={16} className="text-tea-text-dim" />
          )}
        </button>
      </div>

    </div>
  );
};

export default CompassEntryDetailPanel;
