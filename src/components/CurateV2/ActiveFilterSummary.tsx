import React from 'react';
import { X } from 'lucide-react';
import type { LibraryFilters } from './types';
import { LIBRARY_FILTER_FIELDS } from './LibraryFilterSheet';

export const activeLibraryFilterCount = (filters: LibraryFilters) =>
  Object.values(filters).filter((value) => value !== undefined && value !== '').length;

export const ActiveFilterSummary: React.FC<{
  filters: LibraryFilters;
  onClear: () => void;
  onRemove: (key: keyof LibraryFilters) => void;
  valueLabels?: Partial<Record<keyof LibraryFilters, string>>;
}> = ({ filters, onClear, onRemove, valueLabels = {} }) => {
  const count = activeLibraryFilterCount(filters);
  if (!count) return null;
  const active = LIBRARY_FILTER_FIELDS.flatMap((field) => {
    const value = filters[field.key];
    if (value === undefined || value === '') return [];
    const valueLabel = valueLabels[field.key] ?? field.options?.find(([option]) => option === value)?.[1] ?? String(value);
    return [{ ...field, valueLabel }];
  });
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-x-3 border-y border-tea-border py-1.5">
      <span className="text-ui-12 text-tea-text-dim">Showing</span>
      {active.map(({ key, label, valueLabel }) => (
        <button
          key={key}
          type="button"
          onClick={() => onRemove(key)}
          className="tap-target inline-flex min-h-11 items-center gap-1.5 text-ui-12 text-tea-text-sec hover:text-tea-text"
          aria-label={`Remove ${label}: ${valueLabel}`}
        >
          <span>{label}: {valueLabel}</span>
          <X size={12} aria-hidden="true" />
        </button>
      ))}
      <span className="flex-1" />
      <button type="button" onClick={onClear} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">
        Clear all
      </button>
    </div>
  );
};
