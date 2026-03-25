import React, { useMemo, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { BrowseCard } from './BrowseCard';
import { VendorHistory } from './VendorHistory';
import { CompassIcon } from './CompassIcon';
import type { TeaCompassEntry, BrowseGrouping, BrowseFilter, TeaType, TeaForm } from './types';
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      <div className="flex flex-col items-center justify-center py-16 animate-[fadeIn_0.3s_ease-out]">
        <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
          <CompassIcon className="w-7 h-7 text-tea-gold/40" />
        </div>
        <h3 className="font-serif text-lg text-tea-text mb-2">No tea encounters yet</h3>
        <p className="text-sm text-tea-text-sec text-center max-w-[260px] leading-relaxed mb-6">
          Start capturing the teas you taste, want, and buy.
        </p>
        <button
          onClick={onNewCapture}
          className="px-6 py-2.5 bg-tea-gold text-tea-text text-xs font-bold uppercase tracking-[0.2em] hover:bg-tea-gold/90 transition-colors"
        >
          Start Capturing
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

      <div className="space-y-3">
        <div className="flex gap-1">
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
        {groups.map(([groupName, groupEntries]) => (
          <div key={groupName}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec">
                {groupName}
              </span>
              <span className="text-[10px] text-tea-text-sec">
                {groupEntries.length} {groupEntries.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
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
                      expanded={expandedId === entry.id}
                      onToggleExpand={() =>
                        setExpandedId(expandedId === entry.id ? null : entry.id)
                      }
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
