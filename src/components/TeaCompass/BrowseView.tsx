import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X, Trash2 } from 'lucide-react';
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
}

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = (today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 1) return 'Today';
  if (diffDays < 2) return 'Yesterday';
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

export const BrowseView: React.FC<BrowseViewProps> = ({ onEditEntry, onNewCapture }) => {
  const navigate = useNavigate();
  const { entries, browseFilter, setBrowseFilter, removeEntry } = useTeaCompassStore();
  const [cleanupDismissed, setCleanupDismissed] = useState(false);
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

  const [searchQuery, setSearchQuery] = useState('');

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
      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search teas, vendors, regions…"
          className="w-full bg-tea-surface/60 text-tea-text text-[13px] rounded-lg pl-8 pr-8 py-2
                     outline-none placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tea-text-dim hover:text-tea-text-sec transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Filter pills + New — single row, no scroll */}
      <div className="flex items-center gap-1.5">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setBrowseFilter(opt.value)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
              browseFilter === opt.value
                ? 'bg-tea-elevated text-tea-text-sec'
                : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface/60'
            }`}
          >
            {opt.label}{opt.count > 0 ? ` ${opt.count}` : ''}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onNewCapture}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-tea-gold/10 text-tea-gold text-[11px] font-semibold transition-colors hover:bg-tea-gold/15 shrink-0"
        >
          <Plus size={11} />
          New
        </button>
      </div>

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
          <p className="text-[13px] text-tea-text-dim">No teas matching "{searchQuery}"</p>
        </div>
      )}

      {/* View */}
      {!searchQuery || filteredForView.length > 0 ? (
        <>
          {browseFilter === 'all'   && renderAll(filteredForView)}
          {browseFilter === 'mine'  && renderMine(filteredForView)}
          {browseFilter === 'queue' && renderQueue(filteredForView)}
          {browseFilter === 'want'  && renderFlat(filteredForView, 'Nothing on your want list yet.')}
          {browseFilter === 'pass'  && renderFlat(filteredForView, 'No passed teas.')}
        </>
      ) : null}
    </div>
  );
};
