import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import {
  TASTING_TAXONOMY,
  TERM_MAP,
  TASTING_CATEGORY_ORDER,
  SECTION_ICONS,
} from '../../data/tastingTaxonomy';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';

/* ─── Types ─── */

interface FlatTerm {
  id: string;
  label: string;
  categoryId: TastingCategoryId;
  groupLabel: string;
}

interface RapidEntryModeProps {
  flow: TastingFlowState;
}

/* ─── Category labels ─── */

const CATEGORY_LABELS: Record<string, string> = {
  brewing: 'Brewing',
  'liquor-color': 'Color',
  flavor: 'Flavor',
  body: 'Body',
  finish: 'Finish',
  feeling: 'Feeling',
};

/* ─── Build flat term list ─── */

const ALL_TERMS: FlatTerm[] = [];

for (const catId of TASTING_CATEGORY_ORDER) {
  const cat = TASTING_TAXONOMY.categories.find((c) => c.id === catId);
  if (!cat) continue;
  for (const group of cat.groups) {
    for (const term of group.terms) {
      ALL_TERMS.push({
        id: term.id,
        label: term.label,
        categoryId: catId,
        groupLabel: group.label,
      });
    }
  }
}

/* ─── Component ─── */

const RapidEntryMode: React.FC<RapidEntryModeProps> = ({ flow }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Filtered terms
  const filteredTerms = useMemo(() => {
    if (!query.trim()) return ALL_TERMS;
    const q = query.toLowerCase().trim();
    return ALL_TERMS.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.id.includes(q) ||
        t.groupLabel.toLowerCase().includes(q) ||
        t.categoryId.toLowerCase().includes(q)
    );
  }, [query]);

  // Group filtered terms by category
  const groupedByCategory = useMemo(() => {
    const map = new Map<TastingCategoryId, FlatTerm[]>();
    for (const term of filteredTerms) {
      const existing = map.get(term.categoryId);
      if (existing) {
        existing.push(term);
      } else {
        map.set(term.categoryId, [term]);
      }
    }
    // Return in category order
    const result: { categoryId: TastingCategoryId; terms: FlatTerm[] }[] = [];
    for (const catId of TASTING_CATEGORY_ORDER) {
      const terms = map.get(catId);
      if (terms && terms.length > 0) {
        result.push({ categoryId: catId, terms });
      }
    }
    return result;
  }, [filteredTerms]);

  // Check if a term is selected
  const isSelected = useCallback(
    (categoryId: TastingCategoryId, termId: string): boolean => {
      const vals = flow.value[categoryId];
      return Array.isArray(vals) && vals.includes(termId);
    },
    [flow.value]
  );

  // Handle Enter key — select first match
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && filteredTerms.length > 0) {
        e.preventDefault();
        const first = filteredTerms[0];
        flow.toggleTerm(first.categoryId, first.id);
        setQuery('');
      } else if (e.key === 'Escape') {
        setQuery('');
        inputRef.current?.blur();
      }
    },
    [filteredTerms, flow]
  );

  const totalSelected = useMemo(() => {
    let count = 0;
    for (const catId of TASTING_CATEGORY_ORDER) {
      count += flow.getCategoryCount(catId);
    }
    return count;
  }, [flow]);

  return (
    <div className="flex flex-col gap-3">
      {/* Search input */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type to filter terms..."
          className="w-full pl-9 pr-9 py-2.5 bg-tea-surface text-tea-text text-[13px] rounded-lg outline-none focus:ring-1 focus:ring-tea-gold/40 placeholder:text-tea-text-dim/50 transition-all"
          style={{ fontFamily: 'var(--font-body)' }}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tea-text-dim hover:text-tea-text transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Summary line */}
      <div
        className="flex items-center justify-between text-[10px] text-tea-text-dim px-1"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        <span>
          {filteredTerms.length} term{filteredTerms.length !== 1 ? 's' : ''}
          {query && ` matching "${query}"`}
        </span>
        {totalSelected > 0 && (
          <button
            type="button"
            onClick={flow.clearAll}
            className="text-tea-text-dim hover:text-tea-gold transition-colors"
          >
            Clear all ({totalSelected})
          </button>
        )}
      </div>

      {/* Terms grid grouped by category */}
      <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
        <AnimatePresence initial={false}>
          {groupedByCategory.map(({ categoryId, terms }) => {
            const Icon = SECTION_ICONS[categoryId];
            const label = CATEGORY_LABELS[categoryId] || categoryId;

            return (
              <motion.div
                key={categoryId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {/* Category header */}
                <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                  {Icon && <Icon size={12} className="text-tea-text-dim" />}
                  <span
                    className="text-[9px] uppercase tracking-[0.15em] text-tea-text-dim font-medium"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {label}
                  </span>
                  <span className="text-[9px] text-tea-text-dim/50">
                    {flow.getCategoryCount(categoryId)}
                  </span>
                </div>

                {/* Terms flex grid */}
                <div className="flex flex-wrap gap-1.5">
                  {terms.map((term) => {
                    const selected = isSelected(term.categoryId, term.id);

                    return (
                      <motion.button
                        key={`${term.categoryId}-${term.id}`}
                        type="button"
                        whileTap={{ scale: 0.93 }}
                        onClick={() => flow.toggleTerm(term.categoryId, term.id)}
                        className={`tag-selectable ${selected ? 'tag-selectable-active' : ''}`}
                        style={{ fontFamily: 'var(--font-body)' }}
                        aria-pressed={selected}
                        title={`${term.groupLabel} > ${term.label}`}
                      >
                        {term.label}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Empty state */}
        {groupedByCategory.length === 0 && query && (
          <div
            className="text-center py-8 text-tea-text-dim text-[12px]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            No terms matching "{query}"
          </div>
        )}
      </div>
    </div>
  );
};

export default RapidEntryMode;
