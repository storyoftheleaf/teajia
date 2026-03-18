import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X, Plus } from 'lucide-react';
import { TASTING_TAXONOMY, GROUP_ICON_MAP, TERM_MAP, TEA_TYPE_SUGGESTIONS } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';

const flavorCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'flavor')!;

// Primary groups (shown by default)
const PRIMARY_GROUPS = ['Floral', 'Sweet', 'Fruity', 'Nutty & grain', 'Roasted & warm', 'Woody', 'Earthy', 'Fresh & vegetal'];
// Collapsed groups (shown after "More")
const COLLAPSED_GROUPS = ['Mineral', 'Other qualities'];

const primaryGroups = flavorCategory.groups.filter(g => PRIMARY_GROUPS.includes(g.label));
const collapsedGroups = flavorCategory.groups.filter(g => COLLAPSED_GROUPS.includes(g.label));

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

  // Click-outside handler to collapse expanded groups
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        flow.expandedGroups.forEach(groupLabel => {
          flow.collapseGroup(groupLabel);
        });
      }
    };
    if (flow.expandedGroups.size > 0) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [flow.expandedGroups.size, flow]);

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
  const selectedFlavors = flow.value.flavor || [];

  // Groups to render
  const visibleGroups = showMore ? [...primaryGroups, ...collapsedGroups] : primaryGroups;

  const renderGroupButton = (group: typeof flavorCategory.groups[0]) => {
    const isSelected = flow.isGroupSelected('flavor', group.label);
    const isExpanded = flow.expandedGroups.has(group.label);
    const selectedTerms = flow.getGroupSelectedTerms('flavor', group.label);
    const GroupIcon = GROUP_ICON_MAP[group.label];

    return (
      <React.Fragment key={group.label}>
        {/* Group button with split interaction zones */}
        <div
          className={`flex items-center rounded-lg transition-all duration-150 ${
            isSelected
              ? 'bg-tea-gold-lt text-tea-gold'
              : 'bg-tea-surface text-tea-text-sec'
          }`}
        >
          {/* Main area — toggles selection */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => flow.toggleGroup('flavor', group.label)}
            aria-pressed={isSelected}
            className="flex items-center gap-2.5 px-3 py-2.5 flex-1 min-w-0"
          >
            {GroupIcon && (
              <GroupIcon
                size={16}
                className={`shrink-0 ${isSelected ? 'opacity-100' : 'opacity-50'}`}
              />
            )}
            <span className="text-xs font-medium truncate" style={{ fontFamily: 'var(--font-body)' }}>
              {group.label}
            </span>
            {selectedTerms.length > 1 && (
              <span className="ml-auto text-[10px] text-tea-gold shrink-0 opacity-70">
                {selectedTerms.length}
              </span>
            )}
          </motion.button>

          {/* Chevron area — toggles expansion */}
          {group.terms.length > 0 && (
            <motion.button
              type="button"
              onClick={() => {
                if (isExpanded) {
                  flow.collapseGroup(group.label);
                } else {
                  flow.expandGroup(group.label);
                }
              }}
              className="flex items-center justify-center w-11 min-h-[44px] shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              aria-label={isExpanded ? `Collapse ${group.label}` : `Expand ${group.label}`}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={14} />
              </motion.div>
            </motion.button>
          )}
        </div>

        {/* Sub-terms panel — spans full width below group row */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="col-span-2 overflow-hidden"
            >
              <div className="flex flex-wrap gap-1.5 pb-2 pt-1 px-1">
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

                {/* Admin custom term button */}
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
      </React.Fragment>
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
            className="text-tea-text-dim hover:text-tea-text transition-colors p-0.5"
            aria-label="Clear all flavor selections"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Description — only when no selections */}
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

      {/* Group grid — 2 columns */}
      <div className="grid grid-cols-2 gap-2">
        {visibleGroups.map(group => renderGroupButton(group))}

        {/* "More flavors" toggle for collapsed groups */}
        {!showMore && collapsedGroups.length > 0 && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowMore(true)}
            className="col-span-2 flex items-center justify-center gap-1.5 py-2 text-xs text-tea-text-dim hover:text-tea-text-sec transition-colors"
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
