import React, { useMemo, useState, useCallback } from 'react';
import { ChevronDown, Store, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { BrowseCard } from './BrowseCard';
import { VendorHistory } from './VendorHistory';
import { VendorInfoPanel } from './VendorInfoPanel';
import { CompassIcon } from './CompassIcon';
import type { TeaCompassEntry, BrowseGrouping, BrowseFilter, TeaType, TeaForm, VendorDetails } from './types';
import type { Currency } from '../../admin/types';

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
  const { entries, browseGrouping, browseFilter, setBrowseGrouping, setBrowseFilter, lastVendorId, lastVendorName } = useTeaCompassStore();
  const startNewCapture = useTeaCompassStore((s) => s.startNewCapture);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  // collapsedIds kept for potential future use but no longer drives UI

  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());

  // Get vendor details from the most recent entry for a given vendor name
  const getVendorDetailsForGroup = useCallback((vendorNameKey: string): { details?: VendorDetails; vendorId?: string } => {
    // Find the most recent entry with vendorDetails for this vendor
    for (const e of entries) {
      if ((e.vendorName || 'No Vendor') === vendorNameKey && e.vendorDetails) {
        const hasInfo = e.vendorDetails.businessCardUrl || e.vendorDetails.storefrontUrl ||
          e.vendorDetails.lat != null || e.vendorDetails.phone ||
          e.vendorDetails.whatsapp || e.vendorDetails.wechat || e.vendorDetails.line;
        if (hasInfo) return { details: e.vendorDetails, vendorId: e.vendorId };
      }
    }
    // Return vendorId even if no details
    const withId = entries.find((e) => (e.vendorName || 'No Vendor') === vendorNameKey && e.vendorId);
    return { details: undefined, vendorId: withId?.vendorId };
  }, [entries]);

  // Update vendor details across all entries for this vendor
  const handleVendorDetailsChange = useCallback((vendorNameKey: string, details: VendorDetails) => {
    for (const e of entries) {
      if ((e.vendorName || 'No Vendor') === vendorNameKey) {
        updateEntry(e.id, { vendorDetails: details });
      }
    }
  }, [entries, updateEntry]);

  const handleBuyAgain = useCallback((item: {
    name: string;
    type?: string;
    form?: string;
    priceAmount?: number;
    priceCurrency: string;
    pricePerUnitGrams?: number;
  }) => {
    const newId = startNewCapture();
    updateEntry(newId, {
      name: item.name,
      type: item.type as TeaType | undefined,
      form: item.form as TeaForm | undefined,
      priceAmount: item.priceAmount,
      priceCurrency: item.priceCurrency as Currency,
      pricePerUnitGrams: item.pricePerUnitGrams,
      status: 'buying',
    });
  }, [startNewCapture, updateEntry]);

  const filteredEntries = useMemo(() => {
    if (browseFilter === 'all') return entries;
    if (browseFilter === 'want') return entries.filter((e) => e.status === 'want');
    if (browseFilter === 'bought') return entries.filter((e) => e.status === 'bought');
    return entries;
  }, [entries, browseFilter]);

  const counts = useMemo(() => ({
    all: entries.length,
    want: entries.filter((e) => e.status === 'want').length,
    bought: entries.filter((e) => e.status === 'bought').length,
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
    { value: 'want', label: 'Want', count: counts.want },
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
    <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
      {lastVendorName && (
        <div className="mb-4">
          <VendorHistory
            vendorId={lastVendorId || undefined}
            vendorName={lastVendorName}
            onBuyAgain={handleBuyAgain}
          />
        </div>
      )}

      <div className="space-y-2.5">
        {/* Controls row: grouping + filter + new capture */}
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
