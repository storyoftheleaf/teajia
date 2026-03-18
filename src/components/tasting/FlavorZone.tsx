import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, ChevronRight } from 'lucide-react';
import { TASTING_TAXONOMY, GROUP_ICON_MAP, TERM_MAP, TEA_TYPE_SUGGESTIONS } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';

const flavorCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'flavor')!;

const PRIMARY_GROUPS = ['Floral', 'Sweet', 'Fruity', 'Nutty & grain', 'Roasted & warm', 'Woody', 'Earthy', 'Fresh & vegetal'];
const COLLAPSED_GROUPS = ['Mineral', 'Other qualities'];

const primaryGroups = flavorCategory.groups.filter(g => PRIMARY_GROUPS.includes(g.label));
const collapsedGroups = flavorCategory.groups.filter(g => COLLAPSED_GROUPS.includes(g.label));

/** Number of terms to preview inline per group */
const INLINE_PREVIEW_COUNT = 3;

interface FlavorZoneProps {
  flow: TastingFlowState;
  teaType?: string;
  mode?: 'admin' | 'customer';
}

const FlavorZoneInner: React.FC<FlavorZoneProps> = ({ flow, teaType, mode }) => {
  const [showMore, setShowMore] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  const flavorCount = flow.getCategoryCount('flavor');
  const clearCategory = flow.clearCategory;
  const selectedFlavors = flow.value.flavor || [];

  // Focus custom input when shown
  useEffect(() => {
    if (showCustomInput && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [showCustomInput]);

  const handleCustomSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (trimmed) {
      flow.addCustomTerm('flavor', trimmed);
      setCustomInput('');
      setShowCustomInput(false);
    }
  }, [customInput, flow]);

  // Get suggested terms for this tea type
  const suggestedTermIds = teaType ? (TEA_TYPE_SUGGESTIONS[teaType] || []) : [];

  const visibleGroups = showMore ? [...primaryGroups, ...collapsedGroups] : primaryGroups;

  const renderGroup = (group: typeof flavorCategory.groups[0]) => {
    const isExpanded = flow.expandedGroups.has(group.label);
    const selectedTerms = flow.getGroupSelectedTerms('flavor', group.label);
    const hasSelections = selectedTerms.length > 0;
    const GroupIcon = GROUP_ICON_MAP[group.label];

    // Preview terms: show first N terms (or all if few enough)
    const previewTerms = group.terms.slice(0, INLINE_PREVIEW_COUNT);
    const hasMore = group.terms.length > INLINE_PREVIEW_COUNT;

    return (
      <div key={group.label} className="space-y-0">
        {/* Group header — always tappable to expand/collapse */}
        <motion.button
          type="button"
          onClick={() => {
            if (isExpanded) {
              flow.collapseGroup(group.label);
            } else {
              flow.expandGroup(group.label);
            }
          }}
          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-150 ${
            hasSelections
              ? 'bg-tea-gold-lt text-tea-gold'
              : 'bg-tea-surface/60 text-tea-text-sec hover:bg-tea-surface'
          }`}
          aria-expanded={isExpanded}
          aria-label={`${group.label} flavors${hasSelections ? `, ${selectedTerms.length} selected` : ''}`}
        >
          {GroupIcon && (
            <GroupIcon
              size={15}
              className={`shrink-0 ${hasSelections ? 'opacity-100' : 'opacity-40'}`}
            />
          )}
          <span className="text-xs font-medium" style={{ fontFamily: 'var(--font-body)' }}>
            {group.label}
          </span>
          {selectedTerms.length > 0 && (
            <span className="text-[10px] text-tea-gold opacity-70">
              {selectedTerms.length}
            </span>
          )}
          <motion.div
            className="ml-auto shrink-0 opacity-40"
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronRight size={12} />
          </motion.div>
        </motion.button>

        {/* Inline preview — top terms shown directly below group header */}
        {!isExpanded && (
          <div className="flex flex-wrap gap-1 px-1 pt-1.5 pb-0.5">
            {previewTerms.map(term => {
              const isTermSelected = selectedFlavors.includes(term.id);
              return (
                <motion.button
                  key={term.id}
                  type="button"
                  whileTap={{ scale: 0.93 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    flow.toggleTerm('flavor', term.id);
                  }}
                  className={`tag-selectable ${isTermSelected ? 'tag-selectable-active' : ''}`}
                  style={{ fontFamily: 'var(--font-body)', fontSize: '11px' }}
                  aria-pressed={isTermSelected}
                >
                  {term.label}
                </motion.button>
              );
            })}
            {hasMore && !isExpanded && (
              <button
                type="button"
                onClick={() => flow.expandGroup(group.label)}
                className="text-[10px] text-tea-text-dim hover:text-tea-gold transition-colors px-1.5 py-1 opacity-60 hover:opacity-100"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                +{group.terms.length - INLINE_PREVIEW_COUNT}
              </button>
            )}
          </div>
        )}

        {/* Expanded: all terms */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-1.5 px-1 pt-2 pb-1">
                {group.terms.map(term => {
                  const isTermSelected = selectedFlavors.includes(term.id);
                  const termInfo = TERM_MAP.get(term.id);
                  const TermIcon = termInfo?.icon;
                  return (
                    <motion.button
                      key={term.id}
                      type="button"
                      whileTap={{ scale: 0.93 }}
                      onClick={() => flow.toggleTerm('flavor', term.id)}
                      className={`tag-selectable ${isTermSelected ? 'tag-selectable-active' : ''}`}
                      style={{ fontFamily: 'var(--font-body)' }}
                      aria-pressed={isTermSelected}
                    >
                      {TermIcon && (
                        <TermIcon
                          size={11}
                          className={`shrink-0 ${isTermSelected ? 'opacity-100' : 'opacity-40'}`}
                        />
                      )}
                      {term.label}
                    </motion.button>
                  );
                })}

                {/* Admin custom term */}
                {mode === 'admin' && (
                  <>
                    {showCustomInput ? (
                      <form onSubmit={handleCustomSubmit} className="inline-flex items-center gap-1">
                        <input
                          ref={customInputRef}
                          type="text"
                          value={customInput}
                          onChange={e => setCustomInput(e.target.value)}
                          onBlur={() => {
                            if (!customInput.trim()) setShowCustomInput(false);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Escape') {
                              setCustomInput('');
                              setShowCustomInput(false);
                            }
                          }}
                          placeholder="Custom term..."
                          className="text-xs bg-tea-surface text-tea-text px-2 py-1 rounded w-24 outline-none"
                          style={{ fontFamily: 'var(--font-body)' }}
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowCustomInput(true)}
                        className="tag-selectable flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity"
                        aria-label="Add custom flavor term"
                      >
                        <Plus size={11} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div ref={panelRef} role="group" aria-label="Flavor notes">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-[11px] uppercase tracking-[0.15em] text-tea-text-dim font-medium"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Flavor
        </div>
        {flavorCount > 0 && (
          <button
            type="button"
            onClick={() => clearCategory('flavor')}
            className="text-tea-text-dim hover:text-tea-text transition-colors p-2 -mr-1.5"
            aria-label="Clear all flavor selections"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Empty state */}
      {flavorCount === 0 && (
        <p
          className="text-xs text-tea-text-dim italic mb-3"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          What flavors do you taste?
        </p>
      )}

      {/* Suggested row */}
      {suggestedTermIds.length > 0 && (
        <div className="mb-3">
          <div
            className="text-[10px] uppercase tracking-[0.1em] text-tea-text-dim mb-1.5"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Suggested for {teaType}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestedTermIds.map(termId => {
              const termInfo = TERM_MAP.get(termId);
              if (!termInfo) return null;
              const isTermSelected = selectedFlavors.includes(termId);
              const TermIcon = termInfo.icon;
              return (
                <motion.button
                  key={termId}
                  type="button"
                  whileTap={{ scale: 0.93 }}
                  onClick={() => flow.toggleTerm('flavor', termId)}
                  className={`tag-selectable ${isTermSelected ? 'tag-selectable-active' : ''}`}
                  style={{ fontFamily: 'var(--font-body)' }}
                  aria-pressed={isTermSelected}
                >
                  {TermIcon && (
                    <TermIcon
                      size={11}
                      className={`shrink-0 ${isTermSelected ? 'opacity-100' : 'opacity-40'}`}
                    />
                  )}
                  {termInfo.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Group list — single column, each group shows inline preview */}
      <div className="flex flex-col gap-2">
        {visibleGroups.map(group => renderGroup(group))}

        {/* "More flavors" toggle */}
        {!showMore && collapsedGroups.length > 0 && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowMore(true)}
            className="flex items-center justify-center gap-1.5 py-2 text-xs text-tea-text-dim hover:text-tea-text-sec transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <Plus size={12} />
            More flavors
          </motion.button>
        )}
      </div>
    </div>
  );
};

export const FlavorZone = React.memo(FlavorZoneInner);
FlavorZone.displayName = 'FlavorZone';
