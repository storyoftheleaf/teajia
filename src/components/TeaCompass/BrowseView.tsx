import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X, Trash2, Heart, ThumbsUp, Minus, ThumbsDown, SplitSquareHorizontal, ArrowUpDown, ListChecks, ChevronRight, Images } from 'lucide-react';
import { CompareView } from './CompareView';
import { SessionReview } from './SessionReview';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useSampleStore } from '../../samples/sampleStore';
import { BrowseCard } from './BrowseCard';
import { CompassIcon } from './CompassIcon';
import { BottomSheet, SheetOption } from '../shared/BottomSheet';
import { isUntriaged } from './types';
import type { TeaCompassEntry, BrowseFilter, BrowseSort } from './types';
import type { CompassSurfaceVariant } from './index';

const SORT_LABELS: Record<BrowseSort, string> = {
  recent: 'Most recent',
  score: 'Highest score',
  price: 'Price · low to high',
  name: 'Name · A–Z',
};

function scoreOf(e: TeaCompassEntry): number {
  return e.tasting?.quality ?? e.tasting?.rating ?? -1;
}

function pricePerGram(e: TeaCompassEntry): number {
  if (e.category === 'teaware' || !e.priceAmount || !e.pricePerUnitGrams) return Number.POSITIVE_INFINITY;
  return e.priceAmount / e.pricePerUnitGrams;
}

interface BrowseViewProps {
  onEditEntry: (id: string) => void;
  onNewCapture: () => void;
  /** External search query — when provided, overrides and hides the internal search input */
  externalSearchQuery?: string;
  /** Desktop: fires when a card is tapped, shows detail panel in right column */
  onSelectEntry?: (id: string) => void;
  /** Desktop: which entry is currently shown in the right detail panel */
  selectedEntryId?: string | null;
  surfaceVariant?: CompassSurfaceVariant;
}

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = (today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 1) return 'Today';
  if (diffDays < 2) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function hasTastingData(e: TeaCompassEntry): boolean {
  return !!(e.tasting && Object.values(e.tasting).some((v) => Array.isArray(v) ? v.length > 0 : v != null));
}

// ─── Section header ──────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ label: React.ReactNode; count: number; right?: React.ReactNode }> = ({ label, count, right }) => (
  <div className="flex items-center justify-between mb-2.5">
    <span className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec font-medium font-serif">
      {label}
    </span>
    <span className="flex items-center gap-2">
      {right}
      <span className="text-ui-10 text-tea-text-dim num">{count}</span>
    </span>
  </div>
);

// ─── Photo tile — the bag-shot view of an entry ──────────────────────────────
// Image-led card for the Photos layout: capture photo (the bag), title or
// vendor + date fallback, and a small inline note that saves on blur.

const PhotoTile: React.FC<{
  entry: TeaCompassEntry;
  onOpen: (id: string) => void;
  isSelected?: boolean;
}> = ({ entry, onOpen, isSelected }) => {
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const [note, setNote] = useState(entry.notes);
  // Follow edits made elsewhere (detail panel, capture) into the local draft
  React.useEffect(() => { setNote(entry.notes); }, [entry.notes]);

  const photo = entry.photos.find(Boolean);
  const dateLabel = new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fallbackTitle = [entry.vendorName, dateLabel].filter(Boolean).join(' · ') || 'Unnamed';
  const title = entry.name.trim() || fallbackTitle;

  return (
    <div className={`rounded-xl bg-tea-surface/60 overflow-hidden ${isSelected ? 'ring-1 ring-tea-gold/40' : ''}`}>
      <button type="button" onClick={() => onOpen(entry.id)} className="relative block w-full aspect-square">
        {photo ? (
          <img src={photo} alt={title} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center bg-tea-elevated px-3">
            <span className="font-serif text-ui-13 text-tea-text-sec text-center leading-snug">{title}</span>
          </span>
        )}
        {entry.isSample && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-tea-bg/80 text-tea-gold text-ui-9 uppercase tracking-[0.08em]">
            Sample
          </span>
        )}
      </button>
      <div className="px-2.5 pt-2 pb-2.5 space-y-1">
        <button type="button" onClick={() => onOpen(entry.id)} className="block w-full text-left">
          <span className="block text-ui-12 text-tea-text font-medium truncate">{title}</span>
        </button>
        <span className="block text-ui-10 text-tea-text-dim truncate">
          {[entry.vendorName, dateLabel].filter(Boolean).join(' · ')}
        </span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => { if (note !== entry.notes) updateEntry(entry.id, { notes: note }); }}
          placeholder="Add a note"
          aria-label={`Note for ${title}`}
          className="w-full bg-transparent text-ui-11 text-tea-text-sec placeholder:text-tea-text-dim outline-none
                     focus:text-tea-text border-b border-transparent focus:border-tea-border pb-0.5 transition-colors"
        />
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const BrowseView: React.FC<BrowseViewProps> = ({ onEditEntry, onNewCapture, externalSearchQuery, onSelectEntry, selectedEntryId, surfaceVariant = 'classic' }) => {
  const isPlaybookSurface = surfaceVariant === 'playbook';
  const navigate = useNavigate();
  const { entries, browseFilter, setBrowseFilter, browseSort, setBrowseSort, browseLayout, setBrowseLayout, removeEntry, updateEntry } = useTeaCompassStore();
  const [cleanupDismissed, setCleanupDismissed] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const sampleSets = useSampleStore((s) => s.sampleSets);

  // Reusable sort applied to flat lists (and to "All" when not sorting by date).
  const sortEntries = React.useCallback((list: TeaCompassEntry[]): TeaCompassEntry[] => {
    const arr = [...list];
    const byDateDesc = (a: TeaCompassEntry, b: TeaCompassEntry) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    switch (browseSort) {
      case 'score':
        return arr.sort((a, b) => scoreOf(b) - scoreOf(a) || byDateDesc(a, b));
      case 'price':
        return arr.sort((a, b) => pricePerGram(a) - pricePerGram(b) || byDateDesc(a, b));
      case 'name':
        return arr.sort((a, b) => (a.name || '￿').localeCompare(b.name || '￿'));
      default:
        return arr.sort(byDateDesc);
    }
  }, [browseSort]);

  const sampleSetMap = useMemo(
    () => new Map(sampleSets.map((s) => [s.id, s])),
    [sampleSets]
  );

  // Guard: remap any legacy filter value from localStorage
  React.useEffect(() => {
    const valid: BrowseFilter[] = ['all', 'mine', 'queue', 'loved', 'want', 'pass'];
    if (!valid.includes(browseFilter as BrowseFilter)) setBrowseFilter('all');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  // When an external query is provided (from the tab-level search bar), use it; otherwise use internal
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;

  const fuseInstance = useMemo(() => new Fuse(entries, {
    keys: [
      { name: 'name', weight: 2 },
      { name: 'chineseName', weight: 1.5 },
      { name: 'vendorName', weight: 1 },
      { name: 'originRegion', weight: 1 },
      { name: 'type', weight: 1 },
      { name: 'notes', weight: 0.5 },
    ],
    threshold: 0.35,
    includeScore: true,
  }), [entries]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return new Set(fuseInstance.search(searchQuery.trim()).map((r) => r.item.id));
  }, [searchQuery, fuseInstance]);

  // ─── Counts (for filter pills) ────────────────────────────────────────────

  const counts = useMemo(() => {
    const queueCount = entries.filter((e) =>
      e.isSample || (
        !hasTastingData(e) &&
        e.status !== 'pass' &&
        (e.status === 'in_stock' || e.status === 'incoming')
      )
    ).length;

    return {
      all:   entries.length,
      mine:  entries.filter((e) => e.status === 'in_stock' || e.status === 'incoming' || e.status === 'depleted').length,
      queue: queueCount,
      loved: entries.filter((e) => (e.verdict ?? e.sampleVerdict) === 'love').length,
      want:  entries.filter((e) => e.status === 'want').length,
      pass:  entries.filter((e) => e.status === 'pass').length,
    };
  }, [entries]);

  // Tasted teas still waiting for a verdict — the batch-review working set.
  const untriaged = useMemo(() => entries.filter(isUntriaged), [entries]);

  // Entries that have no name, notes, photos, or tasting data — safe to bulk-delete
  const emptyEntries = useMemo(() =>
    entries.filter((e) =>
      e.name.trim() === '' &&
      e.notes.trim() === '' &&
      e.photos.length === 0 &&
      !hasTastingData(e)
    ),
    [entries]
  );

  const handleCleanup = () => {
    if (!window.confirm(`Delete ${emptyEntries.length} entries with no name, notes, or tasting data?`)) return;
    emptyEntries.forEach((e) => removeEntry(e.id));
    setCleanupDismissed(true);
  };

  const filterOptions: { value: BrowseFilter; label: string; count: number }[] = [
    { value: 'all',   label: 'All',   count: counts.all },
    { value: 'mine',  label: 'Mine',  count: counts.mine },
    { value: 'queue', label: 'Queue', count: counts.queue },
    { value: 'loved', label: 'Loved', count: counts.loved },
    { value: 'want',  label: 'Want',  count: counts.want },
    { value: 'pass',  label: 'Pass',  count: counts.pass },
  ];

  // ─── Render helpers ───────────────────────────────────────────────────────

const renderEntries = (list: TeaCompassEntry[], opts?: {
    dimPassed?: boolean;
    dimTasted?: boolean;
    tasteQueueActive?: boolean;
  }) => (
    <div className="space-y-1.5">
      <AnimatePresence initial={false}>
        {list.map((entry) => {
          const dim = (opts?.dimPassed && entry.status === 'pass') ||
                      (opts?.dimTasted && hasTastingData(entry));
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: dim ? 0.55 : 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
            >
              <BrowseCard
                entry={entry}
                onEdit={onEditEntry}
                tasteQueueActive={opts?.tasteQueueActive}
                isCompareSelected={compareIds.has(entry.id)}
                onToggleCompare={(id) => {
                  setCompareIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else if (next.size < 3) next.add(id);
                    return next;
                  });
                }
                }
                onSelect={onSelectEntry}
                isSelected={selectedEntryId === entry.id}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );

  // ─── "All" view: date-grouped ─────────────────────────────────────────────

  const renderAll = (result: TeaCompassEntry[]) => {
    // Date grouping only makes sense for the recency sort. Any other sort
    // (score / price / name) collapses to a single ranked list so the order
    // the user asked for is actually visible.
    if (browseSort !== 'recent') {
      return renderEntries(sortEntries(result), { dimPassed: true });
    }
    const grouped = new Map<string, TeaCompassEntry[]>();
    const sorted = [...result].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    for (const entry of sorted) {
      const key = getDateGroup(entry.createdAt);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(entry);
    }
    return (
      <div className="space-y-5">
        {Array.from(grouped.entries()).map(([date, group]) => (
          <div key={date}>
            <SectionHeader label={date} count={group.length} />
            {renderEntries(group, { dimPassed: true })}
          </div>
        ))}
      </div>
    );
  };

  // ─── "Mine" view: status-grouped (Incoming → In Stock → Depleted) ─────────

  const renderMine = (result: TeaCompassEntry[]) => {
    const incoming = result.filter((e) => e.status === 'incoming');
    const inStock  = result.filter((e) => e.status === 'in_stock');
    const depleted = result.filter((e) => e.status === 'depleted');

    if (result.length === 0) {
      return (
        <div className="py-10 text-center space-y-1">
          <p className="text-ui-13 text-tea-text font-serif">Nothing in stock yet</p>
          <p className="text-ui-12 text-tea-text-dim">Buy a tea from Capture to add it here.</p>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {incoming.length > 0 && (
          <div>
            <SectionHeader label="Incoming" count={incoming.length} />
            {renderEntries(incoming)}
          </div>
        )}
        {inStock.length > 0 && (
          <div>
            <SectionHeader label="In Stock" count={inStock.length} />
            {renderEntries(inStock)}
          </div>
        )}
        {depleted.length > 0 && (
          <div>
            <SectionHeader label="Depleted" count={depleted.length} />
            {renderEntries(depleted, { dimPassed: false })}
          </div>
        )}
      </div>
    );
  };

  // ─── "Queue" view: sample sets + untasted owned ───────────────────────────

  const renderQueue = (result: TeaCompassEntry[]) => {
    const sampleEntries = result.filter((e) => e.isSample);
    const tasteEntries  = result.filter((e) => !e.isSample);

    // Group samples by set
    const bySet = new Map<string, TeaCompassEntry[]>();
    for (const e of sampleEntries) {
      const key = e.sampleSetId || '_unsorted';
      if (!bySet.has(key)) bySet.set(key, []);
      bySet.get(key)!.push(e);
    }

    // Sort untasted: queued first, then oldest
    const sortedTaste = [...tasteEntries].sort((a, b) => {
      if (a.tasteOrder && b.tasteOrder) return b.tasteOrder - a.tasteOrder;
      if (a.tasteOrder) return -1;
      if (b.tasteOrder) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    if (result.length === 0) {
      return (
        <div className="py-10 text-center space-y-1">
          <p className="text-ui-13 text-tea-text font-serif">All caught up</p>
          <p className="text-ui-12 text-tea-text-dim">Every tea in your collection has tasting notes.</p>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {/* Sample sets */}
        {Array.from(bySet.entries()).map(([setId, setEntries]) => {
          const set = sampleSetMap.get(setId);
          const tastedCount = setEntries.filter(hasTastingData).length;
          const allTasted = tastedCount === setEntries.length;

          // Decision summary counts — use sampleVerdict if set, else quality fallback
          const verdictCounts = allTasted ? setEntries.reduce((acc, e) => {
            const v = e.sampleVerdict ?? (
              e.tasting?.quality != null
                ? e.tasting.quality >= 8 ? 'love' : e.tasting.quality >= 6 ? 'like' : e.tasting.quality >= 4 ? 'neutral' : 'pass'
                : null
            );
            if (v) acc[v] = (acc[v] || 0) + 1;
            return acc;
          }, {} as Record<string, number>) : null;

          const loveList = allTasted ? setEntries.filter((e) => {
            const v = e.sampleVerdict ?? (e.tasting?.quality != null ? (e.tasting.quality >= 8 ? 'love' : e.tasting.quality >= 6 ? 'like' : 'pass') : null);
            return v === 'love' || v === 'like';
          }) : [];

          return (
            <div key={setId}>
              <SectionHeader
                label={
                  set ? (
                    <button
                      onClick={() => navigate('/admin/samples')}
                      className="hover:text-tea-gold transition-colors"
                      title="Open batch in Samples"
                    >
                      {set.name || 'Untitled Batch'}
                    </button>
                  ) : (setId === '_unsorted' ? 'Samples' : 'Sample Set')
                }
                count={setEntries.length}
                right={
                  <span className={`text-ui-10 num font-medium ${allTasted ? 'text-tea-gold/70' : 'text-tea-text-dim'}`}>
                    {tastedCount}/{setEntries.length} tasted
                  </span>
                }
              />
              {renderEntries(setEntries, { dimTasted: true })}

              {/* Decision summary — shown when all samples tasted */}
              {allTasted && verdictCounts && (
                <div className="mt-2 rounded-xl bg-tea-surface/60 border border-tea-border px-3 py-2.5 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim font-serif">Set verdict</span>
                    <div className="flex items-center gap-2.5">
                      {verdictCounts['love'] && (
                        <span className="flex items-center gap-1 text-ui-11 text-tea-text-sec">
                          <Heart size={10} className="text-tea-error/70" fill="currentColor" /> {verdictCounts['love']}
                        </span>
                      )}
                      {verdictCounts['like'] && (
                        <span className="flex items-center gap-1 text-ui-11 text-tea-text-sec">
                          <ThumbsUp size={10} className="text-tea-gold/60" /> {verdictCounts['like']}
                        </span>
                      )}
                      {verdictCounts['neutral'] && (
                        <span className="flex items-center gap-1 text-ui-11 text-tea-text-dim">
                          <Minus size={10} /> {verdictCounts['neutral']}
                        </span>
                      )}
                      {verdictCounts['pass'] && (
                        <span className="flex items-center gap-1 text-ui-11 text-tea-text-dim">
                          <ThumbsDown size={10} /> {verdictCounts['pass']}
                        </span>
                      )}
                    </div>
                  </div>
                  {loveList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => loveList.forEach((e) => updateEntry(e.id, { status: 'want' }))}
                      className="w-full py-1.5 rounded-md bg-tea-gold/10 text-tea-gold text-ui-11 font-medium hover:bg-tea-gold/15 transition-colors"
                    >
                      Order {loveList.length} tea{loveList.length !== 1 ? 's' : ''}? → Mark as Want
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Untasted in-stock / incoming */}
        {sortedTaste.length > 0 && (
          <div>
            <SectionHeader label="To Taste" count={sortedTaste.length} />
            {renderEntries(sortedTaste, { tasteQueueActive: true })}
          </div>
        )}
      </div>
    );
  };

  // ─── Photos layout — grid of capture photos (bag shots) ──────────────────

  const renderPhotos = (result: TeaCompassEntry[]) => {
    if (result.length === 0) {
      return (
        <div className="py-10 text-center">
          <p className="text-ui-13 text-tea-text-dim font-serif">Nothing here yet.</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
        {sortEntries(result).map((entry) => (
          <PhotoTile
            key={entry.id}
            entry={entry}
            onOpen={(id) => (onSelectEntry ?? onEditEntry)(id)}
            isSelected={selectedEntryId === entry.id}
          />
        ))}
      </div>
    );
  };

  // ─── Flat views (Want, Pass) ──────────────────────────────────────────────

  const renderFlat = (result: TeaCompassEntry[], emptyMessage: string) => {
    if (result.length === 0) {
      return (
        <div className="py-10 text-center">
          <p className="text-ui-13 text-tea-text-dim font-serif">{emptyMessage}</p>
        </div>
      );
    }
    return renderEntries(sortEntries(result));
  };

  // ─── Apply search + filter ────────────────────────────────────────────────

  const baseEntries = useMemo(() => {
    let result = entries;
    if (searchResults !== null) result = result.filter((e) => searchResults.has(e.id));
    return result;
  }, [entries, searchResults]);

  const filteredForView = useMemo(() => {
    switch (browseFilter) {
      case 'mine':
        return baseEntries.filter((e) => e.status === 'in_stock' || e.status === 'incoming' || e.status === 'depleted');
      case 'queue':
        return baseEntries.filter((e) =>
          e.isSample || (
            !hasTastingData(e) &&
            e.status !== 'pass' &&
            (e.status === 'in_stock' || e.status === 'incoming')
          )
        );
      case 'loved':
        return baseEntries.filter((e) => (e.verdict ?? e.sampleVerdict) === 'love');
      case 'want':
        return baseEntries.filter((e) => e.status === 'want');
      case 'pass':
        return baseEntries.filter((e) => e.status === 'pass');
      default:
        return baseEntries;
    }
  }, [baseEntries, browseFilter]);

  // ─── Empty state ──────────────────────────────────────────────────────────

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-[fadeIn_0.4s_ease-out]">
        <div className="w-20 h-20 rounded-full bg-tea-gold/8 flex items-center justify-center mb-5 shadow-[0_0_30px_var(--tea-accent-sub)]">
          <CompassIcon className="w-9 h-9 text-tea-gold/30" />
        </div>
        <h3 className="font-serif text-lg text-tea-text mb-1.5 tracking-wide">No tea encounters yet</h3>
        <p className="text-ui-13 text-tea-text-sec text-center max-w-[240px] leading-relaxed mb-8 font-serif">
          Every tea has a story. Start capturing the ones you taste, want, and buy.
        </p>
        <button
          onClick={onNewCapture}
          className="px-8 py-3 bg-tea-gold text-tea-bg text-ui-10 font-semibold uppercase tracking-[0.25em] hover:bg-tea-gold/90 transition-colors rounded-md"
        >
          Begin
        </button>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
      {/* Search — hidden when parent provides externalSearchQuery */}
      {externalSearchQuery === undefined && (
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
          <input
            type="text"
            value={internalSearchQuery}
            onChange={(e) => setInternalSearchQuery(e.target.value)}
            placeholder="Search by name, region, vendor…"
            className="w-full bg-tea-surface/60 text-tea-text text-ui-13 rounded-xl pl-8 pr-8 py-2
                       outline-none placeholder:text-tea-text-sec/70 focus:ring-1 focus:ring-tea-gold/40"
          />
          {internalSearchQuery && (
            <button
              type="button"
              onClick={() => setInternalSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tea-text-dim hover:text-tea-text-sec transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Filter controls + New */}
      <div className={isPlaybookSurface ? 'flex flex-wrap items-center gap-2' : 'flex items-center gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4'}>
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setBrowseFilter(opt.value)}
            className={isPlaybookSurface
              ? `inline-flex min-h-[36px] items-center gap-2 rounded-md border px-3 py-2 text-ui-12 transition-colors ${
                  browseFilter === opt.value
                    ? 'border-tea-gold/30 bg-tea-accent-sub text-tea-text'
                    : 'border-tea-border bg-tea-bg text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text'
                }`
              : `px-2.5 py-1.5 rounded-xl text-ui-11 font-medium transition-colors whitespace-nowrap shrink-0 ${
                  browseFilter === opt.value
                    ? 'bg-tea-gold/15 text-tea-gold font-semibold'
                    : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface/60'
                }`
            }
          >
            <span>{opt.label}</span>
            <span className={isPlaybookSurface ? 'font-mono text-ui-11 text-tea-text-dim' : 'tabular-nums'}>{opt.count}</span>
          </button>
        ))}
        <div className={isPlaybookSurface ? 'hidden' : 'w-px h-3 bg-tea-border mx-0.5 shrink-0'} />
        {/* Sort — opens a sheet of the four orderings. Active when not the
            default recency sort, so the user can see they've reordered. */}
        <button
          type="button"
          onClick={() => setSortSheetOpen(true)}
          className={isPlaybookSurface
            ? `inline-flex min-h-[36px] items-center gap-2 rounded-md border px-3 py-2 text-ui-12 transition-colors ${
                browseSort !== 'recent'
                  ? 'border-tea-gold/30 bg-tea-accent-sub text-tea-text'
                  : 'border-tea-border bg-tea-bg text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text'
              }`
            : `inline-flex items-center gap-1 px-2 py-1.5 rounded-md transition-colors shrink-0 ${
                browseSort !== 'recent' ? 'text-tea-gold bg-tea-gold/10' : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface/60'
              }`
          }
          title="Sort"
        >
          <ArrowUpDown size={13} />
          {(isPlaybookSurface || browseSort !== 'recent') && (
            <span className={isPlaybookSurface ? '' : 'text-ui-11 font-medium'}>{SORT_LABELS[browseSort]}</span>
          )}
        </button>
        {/* Photos layout toggle — swap the list for a grid of bag shots */}
        <button
          type="button"
          onClick={() => setBrowseLayout(browseLayout === 'photos' ? 'list' : 'photos')}
          className={isPlaybookSurface
            ? `inline-flex min-h-[36px] items-center gap-2 rounded-md border px-3 py-2 text-ui-12 transition-colors ${
                browseLayout === 'photos'
                  ? 'border-tea-gold/30 bg-tea-accent-sub text-tea-text'
                  : 'border-tea-border bg-tea-bg text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text'
              }`
            : `p-1.5 rounded-md transition-colors shrink-0 ${
                browseLayout === 'photos' ? 'text-tea-gold bg-tea-gold/10' : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface/60'
              }`
          }
          title={browseLayout === 'photos' ? 'Back to list' : 'Photo view'}
          aria-pressed={browseLayout === 'photos'}
        >
          <Images size={13} />
          {isPlaybookSurface && <span>Photos</span>}
        </button>
        <button
          type="button"
          onClick={() => { setCompareIds(new Set()); setCompareOpen(false); }}
          className={isPlaybookSurface
            ? `inline-flex min-h-[36px] items-center gap-2 rounded-md border px-3 py-2 text-ui-12 transition-colors ${
                compareIds.size > 0
                  ? 'border-tea-gold/30 bg-tea-accent-sub text-tea-text'
                  : 'border-tea-border bg-tea-bg text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text'
              }`
            : `p-1.5 rounded-md transition-colors shrink-0 ${
                compareIds.size > 0 ? 'text-tea-gold bg-tea-gold/10' : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface/60'
              }`
          }
          title="Compare teas"
        >
          <SplitSquareHorizontal size={13} />
          {isPlaybookSurface && <span>Compare</span>}
        </button>
        <button
          type="button"
          onClick={onNewCapture}
          className={isPlaybookSurface
            ? 'inline-flex min-h-[36px] items-center gap-2 rounded-md border border-tea-gold/30 bg-tea-accent-sub px-3 py-2 text-ui-12 text-tea-text transition-colors hover:bg-tea-gold/10'
            : 'flex items-center gap-1 px-2.5 py-1 rounded-md bg-tea-gold/10 text-tea-gold text-ui-11 font-semibold transition-colors hover:bg-tea-gold/15 border border-tea-gold/20 shrink-0'
          }
        >
          <Plus size={11} />
          New
        </button>
      </div>

      {/* Compare selection bar */}
      <AnimatePresence>
        {compareIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-tea-surface border border-tea-gold/20 text-ui-12">
              <SplitSquareHorizontal size={11} className="text-tea-gold shrink-0" />
              <span className="flex-1 text-tea-text-sec">{compareIds.size} selected</span>
              {compareIds.size >= 2 && (
                <button
                  type="button"
                  onClick={() => setCompareOpen(true)}
                  className="text-tea-gold font-medium hover:text-tea-gold/80 transition-colors"
                >
                  Compare →
                </button>
              )}
              <span className="text-tea-text-dim text-ui-10">tap cards to select</span>
              <button
                type="button"
                onClick={() => setCompareIds(new Set())}
                className="text-tea-text-dim hover:text-tea-text-sec transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cleanup banner — shown when empty test entries exist */}
      <AnimatePresence>
        {!cleanupDismissed && emptyEntries.length >= 3 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-tea-surface text-ui-12">
              <Trash2 size={12} className="text-tea-text-dim shrink-0" />
              <span className="flex-1 text-tea-text-sec">
                {emptyEntries.length} entries have no name, notes, or tasting data
              </span>
              <button
                type="button"
                onClick={handleCleanup}
                className="text-tea-error hover:text-tea-error font-medium transition-colors shrink-0"
              >
                Clean up
              </button>
              <button
                type="button"
                onClick={() => setCleanupDismissed(true)}
                className="text-tea-text-dim hover:text-tea-text-sec transition-colors shrink-0 ml-1"
              >
                <X size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Triage prompt — surfaces when tasted teas are waiting for a verdict.
          Opens the batch-review screen so a sitting of tastings can be sorted
          down to keepers in one pass. */}
      <AnimatePresence>
        {!searchQuery && untriaged.length >= 2 && (
          <motion.button
            type="button"
            onClick={() => setReviewOpen(true)}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full overflow-hidden block text-left"
          >
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-tea-gold/8 border border-tea-gold/20">
              <ListChecks size={15} className="text-tea-gold shrink-0" />
              <span className="flex-1 min-w-0 text-ui-12 text-tea-text">
                <span className="font-semibold">{untriaged.length} tasted teas</span> waiting to be sorted
              </span>
              <span className="flex items-center gap-0.5 text-ui-11 text-tea-gold font-medium shrink-0">
                Review
                <ChevronRight size={13} />
              </span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Search empty state */}
      {searchQuery && filteredForView.length === 0 && (
        <div className="py-10 text-center">
          <p className="text-ui-13 text-tea-text-dim">Nothing matched — try different words.</p>
        </div>
      )}

      {/* View */}
      {!searchQuery || filteredForView.length > 0 ? (
        browseLayout === 'photos' ? renderPhotos(filteredForView) : (
          <>
            {browseFilter === 'all'   && renderAll(filteredForView)}
            {browseFilter === 'mine'  && renderMine(filteredForView)}
            {browseFilter === 'queue' && renderQueue(filteredForView)}
            {browseFilter === 'loved' && renderFlat(filteredForView, 'Nothing loved yet — sort a tasting to flag keepers.')}
            {browseFilter === 'want'  && renderFlat(filteredForView, 'Nothing on your want list yet.')}
            {browseFilter === 'pass'  && renderFlat(filteredForView, 'Nothing passed — every tea still has a chance.')}
          </>
        )
      ) : null}

      {/* Compare view — full-screen panel */}
      {compareOpen && compareIds.size >= 2 && (
        <CompareView
          entries={entries.filter((e) => compareIds.has(e.id))}
          onClose={() => setCompareOpen(false)}
          onRemove={(id) => {
            setCompareIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              if (next.size < 2) setCompareOpen(false);
              return next;
            });
          }}
        />
      )}

      {/* Sort options sheet */}
      <BottomSheet
        open={sortSheetOpen}
        onOpenChange={setSortSheetOpen}
        title="Sort by"
        description="Order the library"
      >
        <div className="flex flex-col gap-0.5 px-1">
          {(Object.keys(SORT_LABELS) as BrowseSort[]).map((value) => (
            <SheetOption
              key={value}
              label={SORT_LABELS[value]}
              selected={browseSort === value}
              onSelect={() => { setBrowseSort(value); setSortSheetOpen(false); }}
            />
          ))}
        </div>
      </BottomSheet>

      {/* Batch tasting review — full-screen triage of untriaged tastings */}
      {reviewOpen && (
        <SessionReview
          entries={untriaged}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </div>
  );
};
