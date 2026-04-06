import React, { useMemo, useState, useCallback } from 'react';
import { ChevronDown, Store, Plus, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { BrowseCard } from './BrowseCard';
import { VendorInfoPanel } from './VendorInfoPanel';
import { CompassIcon } from './CompassIcon';
import type { TeaCompassEntry, BrowseGrouping, BrowseFilter, VendorDetails } from './types';

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

export const BrowseView: React.FC<BrowseViewProps> = ({ onEditEntry, onNewCapture }) => {
  const { entries, browseGrouping, browseFilter, setBrowseGrouping, setBrowseFilter } = useTeaCompassStore();
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);

  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Get vendor details from the most recent entry for a given vendor name
  const getVendorDetailsForGroup = useCallback((vendorNameKey: string): { details?: VendorDetails; vendorId?: string } => {
    for (const e of entries) {
      if ((e.vendorName || 'No Vendor') === vendorNameKey && e.vendorDetails) {
        const hasInfo = e.vendorDetails.businessCardUrl || e.vendorDetails.storefrontUrl ||
          e.vendorDetails.lat != null || e.vendorDetails.phone ||
          e.vendorDetails.whatsapp || e.vendorDetails.wechat || e.vendorDetails.line;
        if (hasInfo) return { details: e.vendorDetails, vendorId: e.vendorId };
      }
    }
    const withId = entries.find((e) => (e.vendorName || 'No Vendor') === vendorNameKey && e.vendorId);
    return { details: undefined, vendorId: withId?.vendorId };
  }, [entries]);

  const handleVendorDetailsChange = useCallback((vendorNameKey: string, details: VendorDetails) => {
    for (const e of entries) {
      if ((e.vendorName || 'No Vendor') === vendorNameKey) {
        updateEntry(e.id, { vendorDetails: details });
      }
    }
  }, [entries, updateEntry]);

  // Fuse.js instance for fuzzy search
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
    getFn: (entry, path) => {
      if (path[0] === 'tasting.flavor') {
        return (entry.tasting?.flavor || []).join(' ');
      }
      return Fuse.config.getFn(entry, path);
    },
  }), [entries]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return new Set(fuseInstance.search(searchQuery.trim()).map((r) => r.item.id));
  }, [searchQuery, fuseInstance]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    // Apply text search
    if (searchResults !== null) {
      result = result.filter((e) => searchResults.has(e.id));
    }
    // Apply status filter
    if (browseFilter === 'want') return result.filter((e) => e.status === 'want');
    if (browseFilter === 'bought') return result.filter((e) => e.status === 'bought' || e.status === 'buying');
    return result;
  }, [entries, browseFilter, searchResults]);

  const counts = useMemo(() => ({
    all: entries.length,
    want: entries.filter((e) => e.status === 'want').length,
    bought: entries.filter((e) => e.status === 'bought' || e.status === 'buying').length,
  }), [entries]);

  const groups = useMemo(() => {
    const grouped = new Map<string, TeaCompassEntry[]>();
    const sorted = [...filteredEntries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    for (const entry of sorted) {
      const key = browseGrouping === 'date'
        ? getDateGroup(entry.createdAt)
        : (entry.vendorName || 'No Vendor');
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(entry);
    }
    return Array.from(grouped.entries());
  }, [filteredEntries, browseGrouping]);

  const groupingOptions: { value: BrowseGrouping; label: string }[] = [
    { value: 'date', label: 'By Date' },
    { value: 'vendor', label: 'By Vendor' },
  ];

  const filterOptions: { value: BrowseFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'want', label: 'Wishlist', count: counts.want },
    { value: 'bought', label: 'Bought', count: counts.bought },
  ];

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

  return (
    <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
      {/* Search bar */}
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

      {/* Controls row: grouping + filter + new capture */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1 flex-1">
            {groupingOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setBrowseGrouping(opt.value)}
                className={browseGrouping === opt.value ? 'pill-active' : 'pill'}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={onNewCapture}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-tea-gold/10 text-tea-gold text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors hover:bg-tea-gold/15"
          >
            <Plus size={12} />
            New
          </button>
        </div>
        <div className="flex gap-1">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setBrowseFilter(opt.value)}
              className={browseFilter === opt.value ? 'pill-active' : 'pill'}
            >
              {opt.label}{opt.count > 0 ? ` (${opt.count})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Search empty state */}
      {searchQuery && filteredEntries.length === 0 && (
        <div className="py-10 text-center">
          <p className="text-[13px] text-tea-text-dim">No teas matching "{searchQuery}"</p>
        </div>
      )}

      <div className="space-y-5">
        {groups.map(([groupName, groupEntries]) => {
          const isVendorGrouping = browseGrouping === 'vendor';
          const vendorExpanded = expandedVendors.has(groupName);
          const vendorInfo = isVendorGrouping ? getVendorDetailsForGroup(groupName) : null;

          return (
            <div key={groupName}>
              {isVendorGrouping && groupName !== 'No Vendor' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setExpandedVendors((prev) => {
                      const next = new Set(prev);
                      if (next.has(groupName)) next.delete(groupName);
                      else next.add(groupName);
                      return next;
                    })}
                    className="flex items-center justify-between w-full mb-2.5 group"
                  >
                    <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-tea-text-sec font-medium group-hover:text-tea-gold transition-colors">
                      <Store size={12} className="text-tea-gold/50" />
                      {groupName}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] text-tea-text-dim num">
                        {groupEntries.length}
                      </span>
                      <motion.span
                        animate={{ rotate: vendorExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-tea-text-dim"
                      >
                        <ChevronDown size={12} />
                      </motion.span>
                    </span>
                  </button>
                  <AnimatePresence>
                    {vendorExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden mb-3"
                      >
                        <VendorInfoPanel
                          vendorName={groupName}
                          vendorId={vendorInfo?.vendorId}
                          vendorDetails={vendorInfo?.details}
                          onDetailsChange={(details) => handleVendorDetailsChange(groupName, details)}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] uppercase tracking-[0.15em] text-tea-text-sec font-medium font-serif">
                    {groupName}
                  </span>
                  <span className="text-[10px] text-tea-text-dim num">
                    {groupEntries.length}
                  </span>
                </div>
              )}
              <div className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {groupEntries.map((entry) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <BrowseCard
                        entry={entry}
                        onEdit={onEditEntry}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
