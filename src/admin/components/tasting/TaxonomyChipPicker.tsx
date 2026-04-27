import React, { useState, useMemo } from 'react';
import { TASTING_TAXONOMY, TERM_MAP } from '../../../data/tastingTaxonomy';

// Which taxonomy category to pull from for each picker mode
const CATEGORY_MAP = {
  mood: 'feeling',
  flavor: 'flavor',
} as const;

export interface TaxonomyChipPickerProps {
  category: 'mood' | 'flavor';
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  disabled?: boolean;
}

interface TermEntry {
  id: string;
  termLabel: string;
  groupLabel: string;
  hint?: string;
}

function buildTermList(categoryId: string): TermEntry[] {
  const cat = TASTING_TAXONOMY.categories.find(c => c.id === categoryId);
  if (!cat) return [];
  const result: TermEntry[] = [];
  for (const group of cat.groups) {
    for (const term of group.terms) {
      result.push({
        id: term.id,
        termLabel: term.label,
        groupLabel: group.label,
        hint: (term as any).hint,
      });
    }
  }
  return result;
}

export const TaxonomyChipPicker: React.FC<TaxonomyChipPickerProps> = ({
  category,
  value,
  onChange,
  label,
  disabled = false,
}) => {
  const [query, setQuery] = useState('');

  const categoryId = CATEGORY_MAP[category];
  const allTerms = useMemo(() => buildTermList(categoryId), [categoryId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allTerms;
    const q = query.toLowerCase();
    return allTerms.filter(t =>
      t.termLabel.toLowerCase().includes(q) ||
      t.hint?.toLowerCase().includes(q) ||
      t.groupLabel.toLowerCase().includes(q)
    );
  }, [allTerms, query]);

  // Group filtered terms by their group label for layout
  const groups = useMemo(() => {
    const map = new Map<string, TermEntry[]>();
    for (const t of filtered) {
      if (!map.has(t.groupLabel)) map.set(t.groupLabel, []);
      map.get(t.groupLabel)!.push(t);
    }
    return map;
  }, [filtered]);

  const toggle = (id: string) => {
    if (disabled) return;
    const next = value.includes(id) ? value.filter(v => v !== id) : [...value, id];
    onChange(next);
  };

  const sectionLabel = label ?? (category === 'mood' ? 'State' : 'Flavor');
  const selectedCount = value.length;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-ui-10 text-tea-text-sec uppercase tracking-[0.1em]">
          {sectionLabel}
        </span>
        {selectedCount > 0 && (
          <span className="text-ui-10 text-tea-gold/80 tabular-nums">
            {selectedCount} selected
          </span>
        )}
      </div>

      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Filter…"
        disabled={disabled}
        className="w-full bg-transparent text-ui-11 text-tea-text placeholder:text-tea-text-dim border-b border-tea-accent-sub focus:border-tea-gold/40 outline-none pb-1 transition-colors"
      />

      <p className="text-ui-10 text-tea-text-dim italic">
        Pick the ones that fit. Multi-select.
      </p>

      {groups.size === 0 ? (
        <p className="text-ui-10 text-tea-text-dim italic py-1">No matches.</p>
      ) : (
        <div className="space-y-3">
          {Array.from(groups.entries()).map(([groupLabel, terms]) => (
            <div key={groupLabel}>
              <div className="text-ui-9 text-tea-text-dim uppercase tracking-[0.12em] mb-1.5">
                {groupLabel}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {terms.map(term => {
                  const termInfo = TERM_MAP.get(term.id);
                  const Icon = termInfo?.icon;
                  const isSelected = value.includes(term.id);
                  return (
                    <button
                      key={term.id}
                      type="button"
                      onClick={() => toggle(term.id)}
                      disabled={disabled}
                      title={term.hint}
                      className={[
                        'flex items-center gap-1 text-ui-11 transition-colors py-0.5',
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tea-gold/50 rounded-sm',
                        isSelected
                          ? 'text-tea-text border-b border-tea-gold/60'
                          : 'text-tea-text-dim hover:text-tea-text-sec border-b border-transparent',
                        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                      ].join(' ')}
                    >
                      {Icon && (
                        <Icon
                          size={10}
                          className={isSelected ? 'text-tea-gold/70' : 'text-tea-text-dim'}
                          aria-hidden="true"
                        />
                      )}
                      <span>{term.termLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
