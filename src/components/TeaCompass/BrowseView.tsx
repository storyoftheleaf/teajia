import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X, Trash2, Heart, ThumbsUp, Minus, ThumbsDown, SplitSquareHorizontal } from 'lucide-react';
import { CompareView } from './CompareView';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useSampleStore } from '../../samples/sampleStore';
import { BrowseCard } from './BrowseCard';
import { CompassIcon } from './CompassIcon';
import type { TeaCompassEntry, BrowseFilter } from './types';

interface BrowseViewProps {
  onEditEntry: (id: string) => void;
  onNewCapture: () => void;
  /** External search query — when provided, overrides and hides the internal search input */
  externalSearchQuery?: string;
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
    <span className="text-[11px] uppercase tracking-[0.15em] text-tea-text-sec font-medium font-serif">
      {label}
    </span>
    <span className="flex items-center gap-2">
      {right}
      <span className="text-[10px] text-tea-text-dim num">{count}</span>
    </span>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const BrowseView: React.FC<BrowseViewProps> = ({ onEditEntry, onNewCapture, externalSearchQuery }) => {
  const navigate = useNavigate();
  const { entries, browseFilter, setBrowseFilter, removeEntry, updateEntry } = useTeaCompassStore();
  const [cleanupDismissed, setCleanupDismissed] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const sampleSets = useSampleStore((s) => s.sampleSets);

  const sampleSetMap = useMemo(
    () => new Map(sampleSets.map((s) => [s.id, s])),
    [sampleSets]
  );

  // Guard: remap any legacy filter value from localStorage
  React.useEffect(() => {
    const valid: BrowseFilter[] = ['all', 'mine', 'queue', 'want', 'pass'];
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
      want:  entries.filter((e) => e.status === 'want').length,
      pass:  entries.filter((e) => e.status === 'pass').length,
    };
  }, [entries]);

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
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );

  // ─── "All" view: date-grouped ─────────────────────────────────────────────

  const renderAll = (result: TeaCompassEntry[]) => {
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
          <p className="text-[13px] text-tea-text font-serif">Nothing in stock yet</p>
          <p className="text-[12px] text-tea-text-dim">Buy a tea from Capture to add it here.</p>
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
          <p className="text-[13px] text-tea-text font-serif">All caught up</p>
          <p className="text-[12px] text-tea-text-dim">Every tea in your collection has tasting notes.</p>
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
                  <span className={`text-[10px] num font-medium ${allTasted ? 'text-tea-gold/70' : 'text-tea-text-dim'}`}>
                    {tastedCount}/{setEntries.length} tasted
                  </span>
                }
              />
              {renderEntries(setEntries, { dimTasted: true })}

              {/* Decision summary — shown when all samples tasted */}
              {allTasted && verdictCounts && (
                <div className="mt-2 rounded-lg bg-tea-surface/60 border border-tea-border px-3 py-2.5 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-tea-text-dim font-serif">Set verdict</span>
                    <div className="flex items-center gap-2.5">
                      {verdictCounts['love'] && (
                        <span className="flex items-center gap-1 text-[11px] text-tea-text-sec">
                          <Heart size={10} className="text-red-400/70" fill="currentColor" /> {verdictCounts['love']}
                        </span>
                      )}
                      {verdictCounts['like'] && (
                        <span className="flex items-center gap-1 text-[11px] text-tea-text-sec">
                          <ThumbsUp size={10} className="text-tea-gold/60" /> {verdictCounts['like']}
                        </span>
                      )}
                      {verdictCounts['neutral'] && (
                        <span className="flex items-center gap-1 text-[11px] text-tea-text-dim">
                          <Minus size={10} /> {verdictCounts['neutral']}
                        </span>
                      )}
                      {verdictCounts['pass'] && (
                        <span className="flex items-center gap-1 text-[11px] text-tea-text-dim">
                          <ThumbsDown size={10} /> {verdictCounts['pass']}
                        </span>
                      )}
                    </div>
                  </div>
                  {loveList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => loveList.forEach((e) => updateEntry(e.id, { status: 'want' }))}
                      className="w-full py-1.5 rounded-md bg-tea-gold/10 text-tea-gold text-[11px] font-medium hover:bg-tea-gold/15 transition-colors"
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

  // ─── Flat views (Want, Pass) ──────────────────────────────────────────────

  const renderFlat = (result: TeaCompassEntry[], emptyMessage: string) => {
    if (result.length === 0) {
      return (
        <div className="py-10 text-center">
          <p className="text-[13px] text-tea-text-dim font-serif">{emptyMessage}</p>
        </div>
      );
    }
    const sorted = [...result].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return renderEntries(sorted);
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
        <div className="w-20 h-20 rounded-full bg-tea-gold/8 flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(184,146,78,0.08)]">
          <CompassIcon className="w-9 h-9 text-tea-gold/30" />
        </div>
        <h3 className="font-serif text-lg text-tea-text mb-1.5 tracking-wide">No tea encounters yet</h3>
        <p className="text-[13px] text-tea-text-sec text-center max-w-[240px] leading-relaxed mb-8 font-serif">
          Every tea has a story. Start capturing the ones you taste, want, and buy.
        </p>
        <button
          onClick={onNewCapture}
          className="px-8 py-3 bg-tea-gold text-tea-bg text-[10px] font-semibold uppercase tracking-[0.25em] hover:bg-tea-gold/90 transition-colors rounded-sm"
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
            className="w-full bg-tea-surface/60 text-tea-text text-[13px] rounded-lg pl-8 pr-8 py-2
                       outline-none placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
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

      {/* Filter pills + New */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setBrowseFilter(opt.value)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              browseFilter === opt.value
                ? 'bg-tea-gold/15 text-tea-gold font-semibold'
                : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface/60'
            }`}
          >
            {opt.label} {opt.count}
          </button>
        ))}
        <div className="w-px h-3 bg-tea-border mx-0.5 shrink-0" />
        <button
          type="button"
          onClick={() => { setCompareIds(new Set()); setCompareOpen(false); }}
          className={`p-1.5 rounded-md transition-colors shrink-0 ${
            compareIds.size > 0 ? 'text-tea-gold bg-tea-gold/10' : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface/60'
          }`}
          title="Compare teas"
        >
          <SplitSquareHorizontal size={13} />
        </button>
        <button
          type="button"
          onClick={onNewCapture}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-tea-gold/10 text-tea-gold text-[11px] font-semibold transition-colors hover:bg-tea-gold/15 border border-tea-gold/20 shrink-0"
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
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-tea-surface border border-tea-gold/20 text-[12px]">
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
              <span className="text-tea-text-dim text-[10px]">tap cards to select</span>
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
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-tea-surface text-[12px]">
              <Trash2 size={12} className="text-tea-text-dim shrink-0" />
              <span className="flex-1 text-tea-text-sec">
                {emptyEntries.length} entries have no name, notes, or tasting data
              </span>
              <button
                type="button"
                onClick={handleCleanup}
                className="text-red-400 hover:text-red-300 font-medium transition-colors shrink-0"
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

      {/* Search empty state */}
      {searchQuery && filteredForView.length === 0 && (
        <div className="py-10 text-center">
          <p className="text-[13px] text-tea-text-dim">Nothing matched — try different words.</p>
        </div>
      )}

      {/* View */}
      {!searchQuery || filteredForView.length > 0 ? (
        <>
          {browseFilter === 'all'   && renderAll(filteredForView)}
          {browseFilter === 'mine'  && renderMine(filteredForView)}
          {browseFilter === 'queue' && renderQueue(filteredForView)}
          {browseFilter === 'want'  && renderFlat(filteredForView, 'Nothing on your want list yet.')}
          {browseFilter === 'pass'  && renderFlat(filteredForView, 'Nothing passed — every tea still has a chance.')}
        </>
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
    </div>
  );
};
