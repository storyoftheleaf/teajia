import React, { useEffect, useState } from 'react';
import { BottomSheet } from '../shared/BottomSheet';
import type { LibraryFilters } from './types';

export const LIBRARY_FILTER_FIELDS: Array<{ key: keyof LibraryFilters; label: string; options?: Array<[string, string]> }> = [
  { key: 'decision', label: 'Decision', options: [['none', 'No decision'], ['considering', 'Considering'], ['selected', 'Selected'], ['passed_on', 'Passed on']] },
  { key: 'verdict', label: 'Verdict', options: [['love', 'Love'], ['like', 'Like'], ['neutral', 'Neutral'], ['pass', 'Pass']] },
  { key: 'possession', label: 'Possession', options: [['none', 'None'], ['sample', 'Sample'], ['working', 'Working'], ['personal', 'Personal']] },
  { key: 'journey', label: 'Journey' }, { key: 'vendor', label: 'Vendor' }, { key: 'place', label: 'Place' },
  { key: 'date', label: 'Date', options: [['today', 'Today'], ['7_days', 'Past 7 days'], ['30_days', 'Past 30 days'], ['this_year', 'This year']] },
  { key: 'category', label: 'Category', options: [['tea', 'Tea'], ['teaware', 'Teaware']] },
  { key: 'type', label: 'Type' }, { key: 'origin', label: 'Origin' }, { key: 'year', label: 'Year' },
  { key: 'price', label: 'Price', options: [['known', 'Price known'], ['missing', 'Price missing']] },
  { key: 'sampleState', label: 'Sample state', options: [['requested', 'Requested'], ['received', 'Received'], ['tasted', 'Tasted']] },
  { key: 'photos', label: 'Photos', options: [['with', 'Has photos'], ['without', 'No photos']] },
  { key: 'missing', label: 'Missing information', options: [['name', 'Name'], ['price', 'Price'], ['type', 'Type'], ['origin', 'Origin'], ['notes', 'Notes']] },
];

export const LibraryFilterSheet: React.FC<{
  open: boolean;
  filters: LibraryFilters;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: LibraryFilters) => void;
  contextOptions?: Partial<Record<'journey' | 'vendor' | 'place', Array<{ value: string; label: string }>>>;
}> = ({ open, filters, onOpenChange, onApply, contextOptions = {} }) => {
  const [draft, setDraft] = useState(filters);
  useEffect(() => { if (open) setDraft(filters); }, [open, filters]);
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Filter Library" description="Narrow by any detail you remember">
      <div className="max-h-[62vh] space-y-4 overflow-y-auto px-1 pb-nav-gap">
        {LIBRARY_FILTER_FIELDS.map((field) => (
          <label key={field.key} className="block text-ui-12 text-tea-text-sec">
            <span className="mb-1.5 block text-ui-12 font-medium text-tea-text-dim">{field.label}</span>
            {field.options || contextOptions[field.key as 'journey' | 'vendor' | 'place'] ? (
              <select
                aria-label={field.label}
                value={(draft[field.key] as string | undefined) ?? ''}
                onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value || undefined }))}
                className="min-h-11 w-full rounded-md border border-tea-border bg-tea-surface px-3 text-ui-16 text-tea-text outline-none focus:border-tea-gold"
              >
                <option value="">Any</option>
                {(field.options ?? contextOptions[field.key as 'journey' | 'vendor' | 'place']?.map((option) => [option.value, option.label]) ?? []).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            ) : (
              <input
                aria-label={field.label}
                type={field.key === 'date' ? 'date' : 'text'}
                value={(draft[field.key] as string | undefined) ?? ''}
                onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value || undefined }))}
                className="min-h-11 w-full rounded-md border border-tea-border bg-tea-surface px-3 text-ui-16 text-tea-text outline-none focus:border-tea-gold"
              />
            )}
          </label>
        ))}
        <div className="flex justify-between border-t border-tea-border pt-3">
          <button type="button" onClick={() => setDraft({})} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">Clear</button>
          <button type="button" onClick={() => { onApply(draft); onOpenChange(false); }} className="tap-target min-h-11 rounded-md bg-tea-gold px-5 text-ui-12 font-semibold text-tea-bg">Apply filters</button>
        </div>
      </div>
    </BottomSheet>
  );
};
