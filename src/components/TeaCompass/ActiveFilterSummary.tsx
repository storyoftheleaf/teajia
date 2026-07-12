import React from 'react';
import type { LibraryFilters } from './types';

export const activeLibraryFilterCount = (filters: LibraryFilters) =>
  Object.values(filters).filter((value) => value !== undefined && value !== '').length;

export const ActiveFilterSummary: React.FC<{
  filters: LibraryFilters;
  onClear: () => void;
}> = ({ filters, onClear }) => {
  const count = activeLibraryFilterCount(filters);
  if (!count) return null;
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-tea-border bg-tea-accent-sub px-3">
      <span className="text-ui-12 text-tea-text-sec">{count} filter{count === 1 ? '' : 's'} active</span>
      <button type="button" onClick={onClear} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">
        Clear all
      </button>
    </div>
  );
};
