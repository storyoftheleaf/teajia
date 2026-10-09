import { costPerGramUsd, quotedUnit } from './curateV2Model';
import { useRates } from '../../admin/hooks/useAdminData';
import { CURRENCY_LABELS } from './PricingRow';
import React, { useMemo, useState } from 'react';
import { mediaUrl } from '../../lib/mediaUrl';
import { useNavigate } from 'react-router-dom';
import { Search, X, Heart, ThumbsUp, Minus, ThumbsDown } from 'lucide-react';
import { SessionReview } from './SessionReview';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import Fuse from 'fuse.js';
import { entryHasDeliberateInput, useTeaCompassStore } from '../../lib/teaCompassStore';
import { useSampleStore } from '../../samples/sampleStore';
import { BrowseCard } from './BrowseCard';
import { BottomSheet, SheetOption } from './CurateSheet';
import { isUntriaged, entryDisplayTitle, entryIsSample } from './types';
import { entryHasBeenTasted, entryNeedsTasting } from '../TeaCompass/types';
import type { TeaCompassEntry, BrowseFilter, BrowseSort } from './types';
import { LibraryFilterSheet } from './LibraryFilterSheet';
import { ActiveFilterSummary, activeLibraryFilterCount } from './ActiveFilterSummary';
import { api } from '../../lib/api';
import type { CurateJourney, CurateVisit } from './types';
import { useAppStore } from '../../lib/store';
import { buildEntryPossessionMap } from './libraryPossession';
import { hydrateCompassEntries } from '../../lib/teaCompassSync';

const SORT_LABELS: Record<BrowseSort, string> = {
  recent: 'Most recent',
  score: 'Highest score',
  price: 'Price · low to high',
  name: 'Name · A–Z',
};

function scoreOf(e: TeaCompassEntry): number {
  return e.tasting?.quality ?? e.tasting?.rating ?? -1;
}

interface BrowseViewProps {
  onEditEntry: (id: string) => void;
  onNewCapture: () => void;
  /** External search query, when provided, overrides and hides the internal search input */
  externalSearchQuery?: string;
  /** Desktop: fires when a card is tapped, shows detail panel in right column */
  onSelectEntry?: (id: string) => void;
  /** Desktop: which entry is currently shown in the right detail panel */
  selectedEntryId?: string | null;
  onAcquireEntry?: (id: string) => void;
  /** Curate v2: a tea opens as its own screen on top of this tab (Back returns here). */
  onOpenTea?: (id: string) => void;
  /**
   * Desktop: when true, cards lay out as a responsive multi-column grid that
   * fills the full width instead of a single stacked column. Used in Library
   * before an entry is selected, so the list fills the pane rather than
   * cramming into a narrow rail beside an empty detail panel.
   */
  gridMode?: boolean;
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

// ─── Section header ──────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ label: React.ReactNode; count: number; right?: React.ReactNode }> = ({ label, count, right }) => (
  <div className="curate-v2 pt-6" data-testid="browse-section">
    <div className="flex items-baseline justify-between gap-3 pb-2.5">
      <h2 className="min-w-0 font-display text-ui-26 font-normal tracking-[0.02em] text-tea-text">{label}</h2>
      <span className="flex shrink-0 items-baseline gap-3">
        {right}
        <span className="text-ui-11 text-tea-text-sec tabular-nums">{String(count).padStart(2, '0')}</span>
      </span>
    </div>
    <div className="h-px bg-tea-gold/20" aria-hidden="true" />
  </div>
);

// ─── Photo tile, the bag-shot view of an entry ──────────────────────────────
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
  const title = entryDisplayTitle(entry);

  return (
    <div className={`rounded-xl bg-tea-surface/60 overflow-hidden ${isSelected ? 'ring-1 ring-tea-gold/40' : ''}`}>
      <button type="button" onClick={() => onOpen(entry.id)} className="relative block w-full aspect-square">
        {photo ? (
          <img src={mediaUrl(photo)} alt={title} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center bg-tea-elevated px-3">
            <span className="font-serif text-ui-16 text-tea-text-sec text-center leading-snug">{title}</span>
          </span>
        )}
        {entryIsSample(entry) && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-tea-bg/80 text-tea-gold text-ui-12">
            Sample
          </span>
        )}
      </button>
      <div className="px-2.5 pt-2 pb-2.5 space-y-1">
        <button type="button" onClick={() => onOpen(entry.id)} className="tap-target flex min-h-11 w-full items-center text-left">
          <span className="block text-ui-16 text-tea-text font-medium truncate">{title}</span>
        </button>
        <span className="block text-ui-12 text-tea-text-dim truncate">
          {[entry.vendorName, dateLabel].filter(Boolean).join(' · ')}
        </span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => { if (note !== entry.notes) updateEntry(entry.id, { notes: note }); }}
          placeholder="Add a note"
          aria-label={`Note for ${title}`}
          className="min-h-11 w-full bg-transparent text-ui-16 text-tea-text-sec placeholder:text-tea-text-dim outline-none
                     focus:text-tea-text border-b border-transparent focus:border-tea-border pb-0.5 transition-colors"
        />
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const BrowseView: React.FC<BrowseViewProps> = ({ onEditEntry, onNewCapture, externalSearchQuery, onSelectEntry, selectedEntryId, gridMode, onAcquireEntry, onOpenTea }) => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { entries, browseFilter, setBrowseFilter, browseSort, setBrowseSort, browseLayout, setBrowseLayout, libraryFilters, setLibraryFilters, removeEntry, updateEntry, hydrationStatus } = useTeaCompassStore();
  // Curate v2: each tea is one line; tapping it opens the full card in place.
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [cleanupDismissed, setCleanupDismissed] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [journeys, setJourneys] = useState<CurateJourney[]>([]);
  const [visits, setVisits] = useState<CurateVisit[]>([]);
  const [contextErrors, setContextErrors] = useState<{ journeys?: boolean; visits?: boolean }>({});
  const [contextRetry, setContextRetry] = useState(0);
  const [inventoryProducts, setInventoryProducts] = useState<any[]>([]);
  const [possessionError, setPossessionError] = useState(false);
  const [possessionLoading, setPossessionLoading] = useState(true);
  const [possessionRetry, setPossessionRetry] = useState(0);
  const contextRequestRef = React.useRef(0);
  const contextAccountRef = React.useRef<string | null>(null);
  const activeAccountId = useAppStore((state) => state.activeAccountId);
  const sampleSets = useSampleStore((s) => s.sampleSets);

  React.useEffect(() => {
    const request = ++contextRequestRef.current;
    const account = activeAccountId;
    if (contextAccountRef.current !== account) {
      contextAccountRef.current = account;
      setJourneys([]);
      setVisits([]);
    }
    setContextErrors({});
    const current = () => contextRequestRef.current === request && useAppStore.getState().activeAccountId === account;
    api.curateContext.listJourneys()
      .then((data) => { if (current()) setJourneys(data.journeys); })
      .catch(() => { if (current()) setContextErrors((errors) => ({ ...errors, journeys: true })); });
    api.curateContext.listVisits()
      .then((data) => { if (current()) setVisits(data.visits); })
      .catch(() => { if (current()) setContextErrors((errors) => ({ ...errors, visits: true })); });
  }, [activeAccountId, contextRetry]);

  React.useEffect(() => {
    let cancelled = false;
    setInventoryProducts([]);
    setPossessionError(false);
    setPossessionLoading(true);
    api.products.list()
      .then((data) => {
        if (!cancelled && useAppStore.getState().activeAccountId === activeAccountId) {
          setInventoryProducts(Array.isArray(data) ? data : (data?.products ?? []));
          setPossessionLoading(false);
        }
      })
      .catch(() => { if (!cancelled && useAppStore.getState().activeAccountId === activeAccountId) { setPossessionError(true); setPossessionLoading(false); } });
    return () => { cancelled = true; };
  }, [activeAccountId, possessionRetry]);

  const entryPossession = useMemo(
    () => buildEntryPossessionMap(entries, inventoryProducts),
    [entries, inventoryProducts],
  );

  const journeyMap = useMemo(() => new Map(journeys.map((journey) => [journey.id, journey])), [journeys]);
  const visitMap = useMemo(() => new Map(visits.map((visit) => [visit.id, visit])), [visits]);
  const contextText = React.useCallback((entry: TeaCompassEntry) => {
    const journey = entry.journeyId ? journeyMap.get(entry.journeyId) : undefined;
    const visit = entry.visitId ? visitMap.get(entry.visitId) : undefined;
    return [journey?.name, journey?.season, journey?.year, visit?.place, visit?.vendor_name, visit?.notes].filter(Boolean).join(' ');
  }, [journeyMap, visitMap]);

  const { data: rates } = useRates();
  // Reusable sort applied to flat lists (and to "All" when not sorting by date).
  const sortEntries = React.useCallback((list: TeaCompassEntry[]): TeaCompassEntry[] => {
    const arr = [...list];
    const byDateDesc = (a: TeaCompassEntry, b: TeaCompassEntry) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    switch (browseSort) {
      case 'score':
        return arr.sort((a, b) => scoreOf(b) - scoreOf(a) || byDateDesc(a, b));
      case 'price':
        return arr.sort((a, b) => {
          const pa = costPerGramUsd(a, rates);
          const pb = costPerGramUsd(b, rates);
          // Infinity - Infinity is NaN: two teas with no figure fall through to the date.
          return (pa === pb ? 0 : pa < pb ? -1 : 1) || byDateDesc(a, b);
        });
      case 'name':
        return arr.sort((a, b) => (a.name || '￿').localeCompare(b.name || '￿'));
      default:
        return arr.sort(byDateDesc);
    }
  }, [browseSort, rates]);

  const sampleSetMap = useMemo(
    () => new Map(sampleSets.map((s) => [s.id, s])),
    [sampleSets]
  );

  // Guard malformed values that predate the versioned persisted migration.
  React.useEffect(() => {
    const valid: BrowseFilter[] = ['all', 'to_taste', 'selected'];
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
      { name: 'journeyId', weight: 1 },
      { name: 'visitId', weight: 1 },
      { name: 'originRegion', weight: 1 },
      { name: 'type', weight: 1 },
      { name: 'notes', weight: 0.5 },
    ],
    threshold: 0.35,
    includeScore: true,
  }), [entries]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.trim().toLowerCase();
    const ids = new Set(fuseInstance.search(searchQuery.trim()).map((r) => r.item.id));
    entries.forEach((entry) => { if (contextText(entry).toLowerCase().includes(query)) ids.add(entry.id); });
    return ids;
  }, [searchQuery, fuseInstance, entries, contextText]);

  // ─── Counts (for filter pills) ────────────────────────────────────────────

  const counts = useMemo(() => {
    const toTasteCount = entries.filter(entryNeedsTasting).length;

    return {
      all:   entries.length,
      to_taste: toTasteCount,
      selected: entries.filter((e) => e.decision === 'selected').length,
    };
  }, [entries]);

  // Tasted teas still waiting for a verdict, the batch-review working set.
  const untriaged = useMemo(() => entries.filter(isUntriaged), [entries]);

  // Entries with no deliberate field fragment, safe to bulk-delete.
  const emptyEntries = useMemo(() =>
    entries.filter((e) => !entryHasDeliberateInput(e)),
    [entries]
  );

  const handleCleanup = () => {
    if (!window.confirm(`Delete ${emptyEntries.length} entries with no name, notes, or tasting data?`)) return;
    emptyEntries.forEach((e) => removeEntry(e.id));
    setCleanupDismissed(true);
  };

  const filterOptions: { value: BrowseFilter; label: string; count: number }[] = [
    { value: 'all',   label: 'All',   count: counts.all },
    { value: 'to_taste', label: 'To taste', count: counts.to_taste },
    { value: 'selected', label: 'Selected', count: counts.selected },
  ];

  // ─── Render helpers ───────────────────────────────────────────────────────

const renderEntries = (list: TeaCompassEntry[], opts?: {
    dimPassed?: boolean;
    dimTasted?: boolean;
    tasteQueueActive?: boolean;
  }) => (
    <div className="-mx-4">
      <AnimatePresence initial={false}>
        {list.map((entry) => {
          const dim = (opts?.dimPassed && entry.status === 'pass') ||
                      (opts?.dimTasted && entryHasBeenTasted(entry));
          return (
            <motion.div
              key={entry.id}
              initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: dim ? 0.55 : 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
            >
              {expandedRowId === entry.id ? (
                <div className="curate-v2">
                  <button type="button" onClick={() => setExpandedRowId(null)} className="curate-v2-row w-full text-left" aria-expanded="true">
                    <span className="curate-v2-name">{entry.name || 'Untitled tea'}</span>
                    <span className="flex-1" />
                    <span className="font-mono text-ui-13 text-tea-gold">Close</span>
                  </button>
                  <BrowseCard
                    entry={entry}
                    onEdit={onEditEntry}
                    tasteQueueActive={opts?.tasteQueueActive}
                    onSelect={onSelectEntry}
                    isSelected={selectedEntryId === entry.id}
                    onAcquire={onAcquireEntry}
                  />
                </div>
              ) : (
                <V2TeaRow entry={entry} onOpen={() => (onOpenTea ? onOpenTea(entry.id) : setExpandedRowId(entry.id))} />
              )}
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
      <div>
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
          <p className="text-ui-16 text-tea-text font-serif">Nothing in stock yet</p>
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
    const sampleEntries = result.filter(entryIsSample);
    const tasteEntries  = result.filter((e) => !entryIsSample(e));

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
          <p className="text-ui-16 text-tea-text font-serif">All caught up</p>
          <p className="text-ui-12 text-tea-text-dim">Every tea in your collection has tasting notes.</p>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {/* Sample sets */}
        {Array.from(bySet.entries()).map(([setId, setEntries]) => {
          const set = sampleSetMap.get(setId);
          const tastedCount = setEntries.filter(entryHasBeenTasted).length;
          const allTasted = tastedCount === setEntries.length;

          // Decision summary counts, use sampleVerdict if set, else quality fallback
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
                      onClick={() => navigate(`/admin/compass/v2?sampleOrder=manage&set=${encodeURIComponent(set.id)}`)}
                      className="tap-target min-h-11 hover:text-tea-gold transition-colors"
                      title="Open batch in Samples"
                    >
                      {set.name || 'Untitled Batch'}
                    </button>
                  ) : (setId === '_unsorted' ? 'Samples' : 'Sample Set')
                }
                count={setEntries.length}
                right={
                  <span className={`text-ui-12 num font-medium ${allTasted ? 'text-tea-gold/70' : 'text-tea-text-dim'}`}>
                    {tastedCount}/{setEntries.length} tasted
                  </span>
                }
              />
              {renderEntries(setEntries, { dimTasted: true })}

              {/* Decision summary, shown when all samples tasted */}
              {allTasted && verdictCounts && (
                <div className="mt-2 rounded-xl bg-tea-surface/60 border border-tea-border px-3 py-2.5 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-ui-12 text-tea-text-dim font-serif">Set verdict</span>
                    <div className="flex items-center gap-2.5">
                      {verdictCounts['love'] && (
                        <span className="flex items-center gap-1 text-ui-12 text-tea-text-sec">
                          <Heart size={10} className="text-tea-error/70" fill="currentColor" /> {verdictCounts['love']}
                        </span>
                      )}
                      {verdictCounts['like'] && (
                        <span className="flex items-center gap-1 text-ui-12 text-tea-text-sec">
                          <ThumbsUp size={10} className="text-tea-gold/60" /> {verdictCounts['like']}
                        </span>
                      )}
                      {verdictCounts['neutral'] && (
                        <span className="flex items-center gap-1 text-ui-12 text-tea-text-dim">
                          <Minus size={10} /> {verdictCounts['neutral']}
                        </span>
                      )}
                      {verdictCounts['pass'] && (
                        <span className="flex items-center gap-1 text-ui-12 text-tea-text-dim">
                          <ThumbsDown size={10} /> {verdictCounts['pass']}
                        </span>
                      )}
                    </div>
                  </div>
                  {loveList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => loveList.forEach((e) => updateEntry(e.id, { status: 'want' }))}
                      className="tap-target min-h-11 w-full rounded-md bg-tea-gold/10 text-tea-gold text-ui-12 font-medium hover:bg-tea-gold/15 transition-colors"
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

  // ─── Photos layout, grid of capture photos (bag shots) ──────────────────

  const renderPhotos = (result: TeaCompassEntry[]) => {
    if (result.length === 0) {
      return (
        <div className="py-10 text-center">
          <p className="text-ui-16 text-tea-text-dim font-serif">Nothing here yet.</p>
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
          <p className="text-ui-16 text-tea-text-dim font-serif">{emptyMessage}</p>
        </div>
      );
    }
    return renderEntries(sortEntries(result));
  };

  // ─── Apply search + filter ────────────────────────────────────────────────

  const baseEntries = useMemo(() => {
    let result = entries;
    if (searchResults !== null) result = result.filter((e) => searchResults.has(e.id));
    const f = libraryFilters;
    result = result.filter((e) => {
      if (f.decision && (f.decision === 'none' ? e.decision != null : e.decision !== f.decision)) return false;
      if (f.verdict && (e.verdict ?? e.sampleVerdict) !== f.verdict) return false;
      if (f.possession) {
        if (possessionLoading || possessionError) return false;
        const purpose = entryPossession.get(e.id);
        if (f.possession === 'none' && purpose != null) return false;
        if (f.possession !== 'none' && purpose !== f.possession) return false;
      }
      if (f.journey && e.journeyId !== f.journey) return false;
      if (f.vendor && !`${e.vendorName ?? ''} ${e.vendorId ?? ''}`.toLowerCase().includes(f.vendor.toLowerCase())) return false;
      if (f.place && e.visitId !== f.place) return false;
      if (f.date) {
        const created = new Date(e.createdAt);
        const now = new Date();
        const days = (now.getTime() - created.getTime()) / 86_400_000;
        if (f.date === 'today' && created.toDateString() !== now.toDateString()) return false;
        if (f.date === '7_days' && days > 7) return false;
        if (f.date === '30_days' && days > 30) return false;
        if (f.date === 'this_year' && created.getFullYear() !== now.getFullYear()) return false;
      }
      if (f.category && e.category !== f.category) return false;
      if (f.type && !`${e.type ?? ''} ${e.teawareCategory ?? ''}`.toLowerCase().includes(f.type.toLowerCase())) return false;
      if (f.origin && !(e.originRegion ?? '').toLowerCase().includes(f.origin.toLowerCase())) return false;
      if (f.year && String(e.year ?? '') !== f.year) return false;
      if (f.price && (f.price === 'known' ? e.priceAmount == null : e.priceAmount != null)) return false;
      if (f.sampleState) {
        if (e.sampleState !== f.sampleState) return false;
      }
      if (f.photos && (f.photos === 'with' ? !e.photos.some(Boolean) : e.photos.some(Boolean))) return false;
      if (f.missing) {
        const missing = f.missing === 'name' ? !e.name.trim()
          : f.missing === 'price' ? e.priceAmount == null
          : f.missing === 'type' ? !e.type && !e.teawareCategory
          : f.missing === 'origin' ? !e.originRegion?.trim()
          : !e.notes.trim();
        if (!missing) return false;
      }
      return true;
    });
    return result;
  }, [entries, searchResults, libraryFilters, entryPossession, possessionLoading, possessionError]);

  const filteredForView = useMemo(() => {
    switch (browseFilter) {
      case 'to_taste':
        return baseEntries.filter(entryNeedsTasting);
      case 'selected':
        return baseEntries.filter((e) => e.decision === 'selected');
      default:
        return baseEntries;
    }
  }, [baseEntries, browseFilter]);

  // ─── Empty state ──────────────────────────────────────────────────────────

  if (entries.length === 0 && hydrationStatus === 'loading') {
    return (
      <div role="status" aria-label="Loading Library" className="space-y-2 py-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-md border border-tea-border bg-tea-surface" />)}
      </div>
    );
  }

  if (entries.length === 0 && hydrationStatus === 'error') {
    return (
      <div role="alert" className="flex flex-col items-center justify-center py-16 text-center">
        <p className="max-w-[20rem] font-body text-ui-14 leading-relaxed text-tea-text-sec">Your teas could not be loaded. Check the connection and try again.</p>
        <button type="button" onClick={() => void hydrateCompassEntries(activeAccountId ?? undefined)} className="curate-v2-word tap-target mt-2" aria-label="Retry Library sync">Try again</button>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 px-4 py-16 text-center animate-[fadeIn_0.4s_ease-out]" data-testid="library-empty">
        <p className="max-w-[18rem] font-body text-ui-14 leading-relaxed text-tea-text-sec">No teas yet. Teas you add at a table or from a photo are kept here.</p>
        <button type="button" onClick={onNewCapture} className="curate-v2-frame is-on is-tall px-8 uppercase tracking-[0.16em]">
          Add a tea
        </button>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
      {/* Search, hidden when parent provides externalSearchQuery */}
      {externalSearchQuery === undefined && (
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
          <input
            type="text"
            value={internalSearchQuery}
            onChange={(e) => setInternalSearchQuery(e.target.value)}
            placeholder="Search by name, region, vendor…"
            className="w-full min-h-11 rounded-[3px] border border-tea-border bg-transparent py-2 pl-9 pr-10 font-mono text-ui-16 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold"
          />
          {internalSearchQuery && (
            <button
              type="button"
              onClick={() => setInternalSearchQuery('')}
              className="tap-target absolute right-2.5 top-1/2 -translate-y-1/2 text-tea-text-sec hover:text-tea-text transition-colors"
              aria-label="Clear Library search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Controls, two groups, separated by a hairline:
            1. status filters (which subset of the library)
            2. view controls (how to view it: sort + photo grid)
          "New" was removed here, it duplicated the header "+ NEW" and the
          empty-pane "+ New Entry". Text-only labels per the chrome rule. */}
      <div data-testid="library-controls" className="curate-v2 -mx-4">
        {/* Which teas: three equal columns on one line, as Orders does. */}
        <div className="curate-v2-tabs border-b border-tea-border" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setBrowseFilter(opt.value)}
              aria-pressed={browseFilter === opt.value}
              className="curate-v2-tab"
              style={browseFilter === opt.value ? { color: 'var(--tea-gold)', boxShadow: 'inset 0 -1px 0 var(--tea-gold)' } : undefined}
            >
              <span>{opt.label}</span>
              <span className="ml-1.5 tabular-nums">{opt.count}</span>
            </button>
          ))}
        </div>
        {/* How to look at them: plain words, gold when something is set. */}
        <div className="flex flex-wrap items-center justify-between gap-x-5 px-4">
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            className={`tap-target min-h-11 font-mono text-ui-13 ${activeLibraryFilterCount(libraryFilters) ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'}`}
            aria-label={activeLibraryFilterCount(libraryFilters) ? `${activeLibraryFilterCount(libraryFilters)} filters` : 'Filters'}
          >
            {activeLibraryFilterCount(libraryFilters) ? `${activeLibraryFilterCount(libraryFilters)} filter${activeLibraryFilterCount(libraryFilters) === 1 ? '' : 's'}` : 'Filters'}
          </button>
          {/* Sort opens a sheet of the four orderings; gold when it is not the default. */}
          <button
            type="button"
            onClick={() => setSortSheetOpen(true)}
            className={`tap-target min-h-11 font-mono text-ui-13 ${browseSort !== 'recent' ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'}`}
            title="Sort"
          >
            {SORT_LABELS[browseSort]}
          </button>
          {/* Photos swaps the list for a grid of bag shots. */}
          <button
            type="button"
            onClick={() => setBrowseLayout(browseLayout === 'photos' ? 'list' : 'photos')}
            className={`tap-target min-h-11 font-mono text-ui-13 ${browseLayout === 'photos' ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'}`}
            title={browseLayout === 'photos' ? 'Back to list' : 'Photo grid'}
            aria-pressed={browseLayout === 'photos'}
          >
            {browseLayout === 'photos' ? 'List' : 'Photos'}
          </button>
        </div>
      </div>

      <ActiveFilterSummary
        filters={libraryFilters}
        onClear={() => setLibraryFilters({})}
        onRemove={(key) => setLibraryFilters({ ...libraryFilters, [key]: undefined })}
        valueLabels={{
          journey: libraryFilters.journey ? journeyMap.get(libraryFilters.journey)?.name ?? undefined : undefined,
          place: libraryFilters.place ? visitMap.get(libraryFilters.place)?.place ?? undefined : undefined,
        }}
      />
      {hydrationStatus === 'error' && (
        <div role="alert" className="flex min-h-11 flex-wrap items-center justify-between gap-3 border-y border-tea-border py-2 text-ui-12 text-tea-text-sec">
          <span>{entries.length ? 'Showing local Library data. The server copy could not refresh.' : 'Library could not refresh. No server entries are available.'}</span>
          <button
            type="button"
            className="tap-target min-h-11 text-tea-gold hover:text-tea-gold-lt"
            aria-label="Retry Library sync"
            onClick={() => void hydrateCompassEntries(activeAccountId ?? undefined)}
          >
            Retry
          </button>
        </div>
      )}
      {(contextErrors.journeys || contextErrors.visits) && (
        <div role="status" className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-tea-border bg-tea-surface px-3 text-ui-12 text-tea-text-sec">
          <span>{[contextErrors.journeys && 'journeys', contextErrors.visits && 'visits'].filter(Boolean).join(' and ')} unavailable</span>
          <button type="button" className="tap-target min-h-11 text-tea-gold hover:text-tea-gold-lt" onClick={() => setContextRetry((value) => value + 1)}>Retry</button>
        </div>
      )}
      {possessionError && libraryFilters.possession && (
        <div role="alert" className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-tea-border bg-tea-surface px-3 text-ui-12 text-tea-text-sec">
          <span>Inventory unavailable. Possession results are hidden to avoid misclassifying entries.</span>
          <button type="button" className="tap-target min-h-11 text-tea-gold hover:text-tea-gold-lt" onClick={() => setPossessionRetry((value) => value + 1)}>Retry</button>
        </div>
      )}
      {possessionLoading && libraryFilters.possession && (
        <div role="status" className="min-h-11 rounded-md border border-tea-border bg-tea-surface px-3 py-3 text-ui-12 text-tea-text-sec">Loading Inventory possession…</div>
      )}

      {/* Cleanup banner, shown when empty test entries exist */}
      <AnimatePresence>
        {!cleanupDismissed && emptyEntries.length >= 3 && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 border-y border-tea-border py-2 text-ui-12">
              <span className="flex-1 text-tea-text-sec">
                {emptyEntries.length} entries have no name, notes, or tasting data
              </span>
              <button
                type="button"
                onClick={handleCleanup}
                className="tap-target min-h-11 text-tea-error hover:text-tea-error font-medium transition-colors shrink-0"
              >
                Clean up
              </button>
              <button
                type="button"
                onClick={() => setCleanupDismissed(true)}
                className="tap-target flex min-h-11 shrink-0 items-center justify-center font-mono text-tea-text-sec hover:text-tea-text transition-colors ml-1"
                aria-label="Dismiss cleanup"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Triage prompt, surfaces when tasted teas are waiting for a verdict.
          Opens the batch-review screen so a sitting of tastings can be sorted
          down to keepers in one pass. */}
      <AnimatePresence>
        {!searchQuery && untriaged.length >= 2 && (
          <motion.button
            type="button"
            onClick={() => setReviewOpen(true)}
            initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            className="block min-h-11 w-full overflow-hidden text-left"
          >
            <div className="flex items-baseline gap-3 border-y border-tea-gold/30 py-3">
              <span className="min-w-0 flex-1 text-ui-13 text-tea-text">
                <span className="font-mono">{untriaged.length}</span> tasted teas waiting to be sorted
              </span>
              <span className="shrink-0 font-mono text-ui-13 text-tea-gold">Review</span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Search empty state */}
      {searchQuery && filteredForView.length === 0 && (
        <div className="py-10 text-center">
          <p className="text-ui-12 text-tea-text-dim">Nothing matched, try different words.</p>
        </div>
      )}

      {/* View */}
      {!searchQuery || filteredForView.length > 0 ? (
        browseLayout === 'photos' ? renderPhotos(filteredForView) : (
          <>
            {browseFilter === 'all'   && renderAll(filteredForView)}
            {browseFilter === 'to_taste' && renderQueue(filteredForView)}
            {browseFilter === 'selected' && renderFlat(filteredForView, 'Nothing selected yet.')}
          </>
        )
      ) : null}

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

      <LibraryFilterSheet
        open={filterSheetOpen}
        filters={libraryFilters}
        onOpenChange={setFilterSheetOpen}
        onApply={setLibraryFilters}
        contextOptions={{
          journey: journeys.map((journey) => ({ value: journey.id, label: [journey.name, journey.season, journey.year].filter(Boolean).join(', ') })),
          vendor: Array.from(new Set([...entries.map((entry) => entry.vendorName), ...visits.map((visit) => visit.vendor_name)].filter((value): value is string => !!value))).map((value) => ({ value, label: value })),
          place: visits.map((visit) => ({ value: visit.id, label: [visit.place, visit.vendor_name].filter(Boolean).join(' · ') })),
        }}
      />

      {/* Batch tasting review, full-screen triage of untriaged tastings */}
      {reviewOpen && (
        <SessionReview
          entries={untriaged}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </div>
  );
};


/** Curate v2's tea row: the name in full, who sold it and when beneath, the
 *  price as quoted and the score anchored right. */
const V2TeaRow: React.FC<{ entry: TeaCompassEntry; onOpen: () => void }> = ({ entry, onOpen }) => {
  const sym = CURRENCY_LABELS[entry.priceCurrency] ?? '';
  const unit = quotedUnit(entry);
  const sub = [entry.year, entry.vendorName?.trim()].filter((x) => x != null && String(x).trim()).join(' · ');
  return (
    <button type="button" onClick={onOpen} className="curate-v2 curate-v2-row w-full text-left" aria-expanded="false">
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="curate-v2-name">{entry.name || 'Untitled tea'}</span>
        {sub && <span className="truncate font-mono text-ui-12 text-tea-text-sec tabular-nums">{sub}</span>}
      </span>
      <span className="grid shrink-0 justify-items-end gap-0.5">
        {entry.priceAmount != null
          ? <span className="text-ui-13 font-medium text-tea-text tabular-nums">{sym}{entry.priceAmount.toLocaleString()}{unit && <span className="ml-1 text-ui-12 font-normal text-tea-text-sec">{unit}</span>}</span>
          : <span className="text-ui-12 text-tea-text-sec">add cost</span>}
        {entry.tasting?.quality != null && <span className="text-ui-12 text-tea-gold tabular-nums">{entry.tasting.quality}/10</span>}
      </span>
    </button>
  );
};
