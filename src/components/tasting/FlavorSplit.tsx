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
  const [activeFamily, setActiveFamily] = useState<string>(
    flavorCategory.groups[0].label
  );

  const selectedSet = new Set(selected);

  // Derive suggested family labels for this tea type
  const suggestedFamilies = React.useMemo((): Set<string> => {
    if (!teaType) return new Set();
    const termIds = TEA_TYPE_SUGGESTIONS[teaType] ?? [];
    const families = new Set<string>();
    for (const id of termIds) {
      const groupLabel = TERM_MAP.get(id)?.groupLabel;
      if (groupLabel) families.add(groupLabel);
    }
    return families;
  }, [teaType]);

  const suggestedFamilyNames = React.useMemo(() => {
    if (suggestedFamilies.size === 0) return null;
    const shortNames = [...suggestedFamilies]
      .slice(0, 3)
      .map(f => SHORT_FAMILY_LABEL[f] ?? f);
    return shortNames.join(' · ');
  }, [suggestedFamilies]);

  const getGroupCount = (groupLabel: string): number => {
    const group = flavorCategory.groups.find(g => g.label === groupLabel);
    if (!group) return 0;
    return group.terms.filter(t => selectedSet.has(t.id)).length;
  };

  const activeGroup = flavorCategory.groups.find(g => g.label === activeFamily)!;

  return (
    <div>
    {suggestedFamilyNames && (
      <p className="text-ui-13 text-tea-text-sec mb-3" style={{ fontFamily: 'var(--font-body)' }}>
        {teaType} teas often show up in {suggestedFamilyNames}.
      </p>
    )}
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
          const isSuggested = suggestedFamilies.has(group.label);

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
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '16px',
                letterSpacing: '0.02em',
                background: isSuggested && !isActive ? 'rgb(var(--tea-gold-rgb) / 0.06)' : undefined,
                borderRadius: isSuggested ? 6 : undefined,
              }}
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
                  className="absolute z-10 flex items-center justify-center w-[16px] h-[16px] rounded-full bg-tea-gold text-ui-10 font-bold"
                  style={{ right: -16, top: '50%', marginTop: -8, color: 'var(--tea-bg)', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", lineHeight: 1 }}
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
            {(() => {
              const [rootTerm, ...specificTerms] = activeGroup.terms;
              const isRootGeneral = rootTerm && activeGroup.label.toLowerCase().includes(rootTerm.label.toLowerCase());

              return isRootGeneral ? (
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
              ) : (
                activeGroup.terms.map(term => (
                  <SubTermButton
                    key={term.id}
                    termId={term.id}
                    label={term.label}
                    isSelected={selectedSet.has(term.id)}
                    onToggle={onToggle}
                  />
                ))
              );
            })()}
          </motion.div>
        </AnimatePresence>
      </div>
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
  general?: boolean;
}

const SubTermButton: React.FC<SubTermButtonProps> = ({ termId, label, isSelected, onToggle, general }) => {
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
          : general
            ? 'text-tea-text font-medium hover:text-tea-text'
            : 'text-tea-text-sec hover:text-tea-text'
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
