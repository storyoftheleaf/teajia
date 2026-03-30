import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { TASTING_TAXONOMY, GROUP_ICON_MAP, TERM_MAP, TEA_TYPE_SUGGESTIONS } from '../../data/tastingTaxonomy';

const flavorCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'flavor')!;

interface FlavorFamiliesProps {
  selected: string[];
  onToggle: (termId: string) => void;
  teaType?: string;
}

/**
 * Two-tier flavor selection:
 * - Tier 1: 10 flavor families as tappable cards (one tap = select the family-level term)
 * - Tier 2: expand a family to pick specific sub-terms
 *
 * Selecting a family toggles its root term (e.g. "floral").
 * Expanding shows the specific terms within that group.
 */
const FlavorFamiliesInner: React.FC<FlavorFamiliesProps> = ({ selected, onToggle, teaType }) => {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const selectedSet = new Set(selected);

  // Get suggested term IDs for this tea type
  const suggestions = teaType ? (TEA_TYPE_SUGGESTIONS[teaType] || []) : [];

  const toggleExpand = useCallback((groupLabel: string) => {
    setExpandedGroup(prev => prev === groupLabel ? null : groupLabel);
  }, []);

  // Count how many terms from a group are selected
  const groupSelectedCount = (group: typeof flavorCategory.groups[0]): number => {
    return group.terms.filter(t => selectedSet.has(t.id)).length;
  };

  return (
    <div className="flex flex-col gap-1">
      {/* Suggested terms row — only if tea type has suggestions */}
      {suggestions.length > 0 && (
        <div className="mb-2">
          <div className="tasting-capture-label mb-2">Suggested for {teaType}</div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map(termId => {
              const info = TERM_MAP.get(termId);
              if (!info) return null;
              const isActive = selectedSet.has(termId);
              const Icon = info.icon;
              return (
                <motion.button
                  key={termId}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onToggle(termId)}
                  className={`tag-selectable ${isActive ? 'tag-selectable-active' : ''}`}
                  aria-pressed={isActive}
                >
                  <Icon size={11} className={`shrink-0 ${isActive ? 'opacity-100' : 'opacity-30'}`} />
                  {info.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Flavor families grid */}
      <div className="grid grid-cols-2 gap-1">
        {flavorCategory.groups.map(group => {
          const Icon = GROUP_ICON_MAP[group.label];
          // The "root" term is the first term in the group (e.g. "floral" in "Floral")
          const rootTerm = group.terms[0];
          const hasRoot = rootTerm && selectedSet.has(rootTerm.id);
          const count = groupSelectedCount(group);
          const isExpanded = expandedGroup === group.label;
          const hasSpecifics = group.terms.length > 1;

          return (
            <div key={group.label} className={`rounded-lg overflow-hidden ${isExpanded ? 'col-span-2' : ''}`}>
              {/* Family card */}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => onToggle(rootTerm.id)}
                  className={`tasting-flavor-family flex-1 ${count > 0 ? 'tasting-flavor-family-active' : ''}`}
                  aria-pressed={count > 0}
                >
                  {Icon && <Icon size={15} className={`shrink-0 ${count > 0 ? 'opacity-100' : 'opacity-35'}`} />}
                  <span className="flex-1 text-left">{group.label}</span>
                  {count > 0 && (
                    <span className="text-[10px] font-bold opacity-70 num">{count}</span>
                  )}
                </button>

                {/* Expand chevron for groups with sub-terms */}
                {hasSpecifics && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(group.label)}
                    className="p-2 text-tea-text-dim hover:text-tea-text-sec transition-colors"
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${group.label} details`}
                  >
                    <motion.span
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.15 }}
                      className="block"
                    >
                      <ChevronDown size={14} />
                    </motion.span>
                  </button>
                )}
              </div>

              {/* Sub-terms (tier 2) */}
              <AnimatePresence>
                {isExpanded && hasSpecifics && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="tasting-subterms">
                      {group.terms.map(term => {
                        const isActive = selectedSet.has(term.id);
                        const termInfo = TERM_MAP.get(term.id);
                        const TermIcon = termInfo?.icon;
                        return (
                          <motion.button
                            key={term.id}
                            type="button"
                            whileTap={{ scale: 0.93 }}
                            onClick={() => onToggle(term.id)}
                            className={`tag-selectable ${isActive ? 'tag-selectable-active' : ''}`}
                            aria-pressed={isActive}
                          >
                            {TermIcon && <TermIcon size={10} className={`shrink-0 ${isActive ? 'opacity-100' : 'opacity-30'}`} />}
                            {term.label}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const FlavorFamilies = React.memo(FlavorFamiliesInner);
FlavorFamilies.displayName = 'FlavorFamilies';
