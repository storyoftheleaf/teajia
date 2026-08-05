import React, { useEffect, useState } from 'react';
import { BottomSheet } from '../shared/BottomSheet';
import type { LibraryFilters } from './types';

type FilterGroup = 'Encounter' | 'Tea' | 'State' | 'Samples & Inventory' | 'Completeness';
const FILTER_GROUPS: FilterGroup[] = ['Encounter', 'Tea', 'State', 'Samples & Inventory', 'Completeness'];

export const LIBRARY_FILTER_FIELDS: Array<{ key: keyof LibraryFilters; label: string; group: FilterGroup; options?: Array<[string, string]> }> = [
  { key: 'journey', label: 'Journey', group: 'Encounter' }, { key: 'vendor', label: 'Vendor', group: 'Encounter' }, { key: 'place', label: 'Place', group: 'Encounter' },
  { key: 'date', label: 'Date', group: 'Encounter', options: [['today', 'Today'], ['7_days', 'Past 7 days'], ['30_days', 'Past 30 days'], ['this_year', 'This year']] },
  { key: 'category', label: 'Category', group: 'Tea', options: [['tea', 'Tea'], ['teaware', 'Teaware']] },
  { key: 'type', label: 'Type', group: 'Tea' }, { key: 'origin', label: 'Origin', group: 'Tea' }, { key: 'year', label: 'Year', group: 'Tea' },
  { key: 'price', label: 'Price', group: 'Tea', options: [['known', 'Price known'], ['missing', 'Price missing']] },
  { key: 'decision', label: 'Decision', group: 'State', options: [['none', 'No decision'], ['considering', 'Considering'], ['selected', 'Selected'], ['passed_on', 'Passed on']] },
  { key: 'verdict', label: 'Verdict', group: 'State', options: [['love', 'Love'], ['like', 'Like'], ['neutral', 'Neutral'], ['pass', 'Pass']] },
  { key: 'possession', label: 'Possession', group: 'Samples & Inventory', options: [['none', 'None'], ['sample', 'Sample'], ['working', 'Working'], ['personal', 'Personal']] },
  { key: 'sampleState', label: 'Sample state', group: 'Samples & Inventory', options: [['requested', 'Requested'], ['received', 'Received'], ['tasted', 'Tasted']] },
  { key: 'photos', label: 'Photos', group: 'Completeness', options: [['with', 'Has photos'], ['without', 'No photos']] },
  { key: 'missing', label: 'Missing information', group: 'Completeness', options: [['name', 'Name'], ['price', 'Price'], ['type', 'Type'], ['origin', 'Origin'], ['notes', 'Notes']] },
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
        {FILTER_GROUPS.map((group) => <section key={group} aria-labelledby={`library-filter-${group.replace(/\W+/g, '-').toLowerCase()}`} className="space-y-3">
          <h3 id={`library-filter-${group.replace(/\W+/g, '-').toLowerCase()}`} className="border-b border-tea-border pb-2 text-ui-12 font-medium text-tea-text">{group}</h3>
          {LIBRARY_FILTER_FIELDS.filter((field) => field.group === group).map((field) => (
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
        </section>)}
        <div className="flex justify-between border-t border-tea-border pt-3">
          <button type="button" onClick={() => setDraft({})} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">Clear</button>
          <button type="button" onClick={() => { onApply(draft); onOpenChange(false); }} className="tap-target min-h-11 rounded-md cta-solid px-5 text-ui-12 font-semibold">Apply filters</button>
        </div>
      </div>
    </BottomSheet>
  );
};
