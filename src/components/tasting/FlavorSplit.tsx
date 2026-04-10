import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import {
  TASTING_TAXONOMY,
  TERM_MAP,
  TEA_TYPE_SUGGESTIONS,
} from '../../data/tastingTaxonomy';

/** Short single-line labels for the narrow sidebar column */
const SHORT_FAMILY_LABEL: Record<string, string> = {
  'Floral': 'Floral',
  'Sweet': 'Sweet',
  'Fruity': 'Fruity',
  'Nutty & grain': 'Nutty',
  'Roasted & warm': 'Roasted',
  'Spice': 'Spice',
  'Woody': 'Woody',
  'Earthy': 'Earthy',
  'Mineral': 'Mineral',
  'Fresh & vegetal': 'Fresh',
  'Taste & character': 'Taste',
  // Legacy
  'Other qualities': 'Other',
};

const flavorCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'flavor')!;

interface FlavorSplitProps {
  selected: string[];
  onToggle: (termId: string) => void;
  teaType?: string;
}

/**
 * Split-pane flavor selector — always side-by-side, mobile and desktop.
 *
 * Left (~88px): vertical list of 10 family names. Tap to switch.
 * Right: sub-terms for the active family, plain text, tap to select.
 *
 * No horizontal scroll. No drill-down. Everything one tap away.
 */
const FlavorSplitInner: React.FC<FlavorSplitProps> = ({ selected, onToggle, teaType }) => {
  const suggestions = teaType ? (TEA_TYPE_SUGGESTIONS[teaType] || []) : [];

  const defaultFamily = suggestions.length > 0
    ? flavorCategory.groups.find(g => g.terms.some(t => suggestions.includes(t.id)))?.label
    : undefined;

  const [activeFamily, setActiveFamily] = useState<string>(
    defaultFamily ?? flavorCategory.groups[0].label
  );

  const selectedSet = new Set(selected);

  const getGroupCount = (groupLabel: string): number => {
    const group = flavorCategory.groups.find(g => g.label === groupLabel);
    if (!group) return 0;
    return group.terms.filter(t => selectedSet.has(t.id)).length;
  };

  const activeGroup = flavorCategory.groups.find(g => g.label === activeFamily)!;
  const activeSuggestions = activeGroup
    ? activeGroup.terms.filter(t => suggestions.includes(t.id))
    : [];

  return (
    <div className="flex flex-row gap-0" style={{ minHeight: 300 }}>

      {/* ── Left: vertical family list, always ── */}
      <div
        className="flex flex-col shrink-0 border-r border-tea-border pr-2 mr-3"
        style={{ width: 82 }}
        role="listbox"
        aria-label="Flavor families"
      >
        {flavorCategory.groups.map(group => {
          const isActive = group.label === activeFamily;
          const count = getGroupCount(group.label);
          const shortLabel = SHORT_FAMILY_LABEL[group.label] ?? group.label;

          return (
            <button
              key={group.label}
              type="button"
              role="option"
              aria-selected={isActive}
              onClick={() => setActiveFamily(group.label)}
              className={`
                relative flex items-center justify-between
                w-full text-left
                py-2 px-1
                min-h-[36px]
                transition-colors duration-150
                ${isActive ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'}
              `}
              style={{ fontFamily: 'var(--font-display)', fontSize: '16px', letterSpacing: '0.02em' }}
            >
              {isActive && (
                <motion.div
                  layoutId="flavor-family-bar"
                  className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full"
                  style={{ background: 'rgb(var(--tea-gold-rgb) / 0.5)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              <span className="pl-3 whitespace-nowrap">{shortLabel}</span>

              {count > 0 && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="absolute z-10 flex items-center justify-center w-5 h-5 rounded-full bg-tea-gold text-[9px] font-bold"
                  style={{ right: -18, top: '50%', marginTop: -10, color: 'var(--tea-bg)' }}
                >
                  {count}
                </motion.span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Right: sub-terms for active family ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeFamily}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.12 }}
          >
            {/* Suggested terms — pinned at top of this family's panel */}
            {activeSuggestions.length > 0 && (
              <div className="mb-2">
                <div
                  className="text-[10px] uppercase tracking-[0.12em] text-tea-gold/50 font-medium mb-1"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Suggested
                </div>
                {activeSuggestions.map(term => (
                  <SubTermButton
                    key={term.id}
                    termId={term.id}
                    label={term.label}
                    isSelected={selectedSet.has(term.id)}
                    onToggle={onToggle}
                    suggested
                  />
                ))}
                <div className="divider-warm mt-1 mb-2" />
              </div>
            )}

            {/* General / root term — shown first with a divider if it matches the group name */}
            {(() => {
              const remaining = activeGroup.terms
                .filter(term => !(activeSuggestions.length > 0 && activeSuggestions.some(s => s.id === term.id)));
              const rootTerm = remaining[0];
              const isRootGeneral = rootTerm && activeGroup.label.toLowerCase().includes(rootTerm.label.toLowerCase());
              const specificTerms = isRootGeneral ? remaining.slice(1) : remaining;

              return (
                <>
                  {isRootGeneral && rootTerm && (
                    <>
                      <SubTermButton
                        key={rootTerm.id}
                        termId={rootTerm.id}
                        label={rootTerm.label}
                        isSelected={selectedSet.has(rootTerm.id)}
                        onToggle={onToggle}
                        general
                      />
                      {specificTerms.length > 0 && (
                        <div className="border-b border-tea-border my-1" />
                      )}
                    </>
                  )}
                  {specificTerms.map(term => (
                    <SubTermButton
                      key={term.id}
                      termId={term.id}
                      label={term.label}
                      isSelected={selectedSet.has(term.id)}
                      onToggle={onToggle}
                    />
                  ))}
                </>
              );
            })()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

/* ─── Sub-term button — plain text, full tap target ─── */

interface SubTermButtonProps {
  termId: string;
  label: string;
  isSelected: boolean;
  onToggle: (id: string) => void;
  suggested?: boolean;
  general?: boolean;
}

const SubTermButton: React.FC<SubTermButtonProps> = ({ termId, label, isSelected, onToggle, suggested, general }) => {
  const termInfo = TERM_MAP.get(termId);
  const Icon = termInfo?.icon;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={() => onToggle(termId)}
      aria-pressed={isSelected}
      className={`
        flex items-center gap-2
        w-full text-left
        py-1.5 px-1.5
        min-h-[36px]
        transition-colors duration-150
        ${isSelected
          ? 'text-tea-gold font-medium'
          : suggested || general
            ? 'text-tea-text-sec hover:text-tea-text'
            : 'text-tea-text-dim hover:text-tea-text-sec'
        }
      `}
      style={{ fontFamily: 'var(--font-body)', fontSize: '16px' }}
    >
      {Icon && (
        <Icon
          size={12}
          className={`shrink-0 transition-opacity ${isSelected ? 'opacity-70 text-tea-gold' : 'opacity-20'}`}
        />
      )}
      <span className="leading-snug">{label}</span>
      {isSelected && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className="ml-auto shrink-0"
        >
          <Check size={11} className="text-tea-gold" />
        </motion.span>
      )}
    </motion.button>
  );
};

export const FlavorSplit = React.memo(FlavorSplitInner);
FlavorSplit.displayName = 'FlavorSplit';
