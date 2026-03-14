import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Zap, Mountain, Sunrise } from 'lucide-react';
import { TASTING_TAXONOMY, TERM_MAP } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';

const feelingCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'feeling')!;

const GROUP_ICONS: Record<string, React.FC<{ size: number; className?: string }>> = {
  'Calming': Moon,
  'Activating': Zap,
  'Physical': Mountain,
  'Spatial': Sunrise,
};

interface FeelingCardsProps {
  flow: TastingFlowState;
}

export const FeelingCards: React.FC<FeelingCardsProps> = ({ flow }) => {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim font-medium mb-3"
        style={{ fontFamily: 'var(--font-display)' }}>
        Feeling
      </div>

      <div className="grid grid-cols-2 gap-2">
        {feelingCategory.groups.map(group => {
          const isSelected = flow.isGroupSelected('feeling', group.label);
          const isExpanded = flow.expandedGroups.has(group.label);
          const GroupIcon = GROUP_ICONS[group.label] || Moon;

          return (
            <React.Fragment key={group.label}>
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (isSelected && !isExpanded) {
                    flow.expandGroup(group.label);
                  } else if (isSelected && isExpanded) {
                    flow.collapseGroup(group.label);
                  } else {
                    flow.toggleGroup('feeling', group.label);
                  }
                }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all duration-150 ${
                  isSelected
                    ? 'border-tea-gold/40 bg-tea-gold/10 text-tea-gold'
                    : 'border-tea-border bg-tea-surface text-tea-text-sec hover:border-tea-gold/20 hover:text-tea-text'
                }`}
              >
                <GroupIcon size={16} className="shrink-0" style={{ opacity: isSelected ? 1 : 0.5 }} />
                <span className="text-xs font-medium" style={{ fontFamily: 'var(--font-body)' }}>
                  {group.label}
                </span>
              </motion.button>

              {isExpanded && isSelected && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="col-span-2 overflow-hidden"
                  >
                    <div className="flex flex-wrap gap-1.5 pb-2 pt-1 px-1">
                      {group.terms.map(term => {
                        const isTermSelected = (flow.value.feeling || []).includes(term.id);
                        const termInfo = TERM_MAP.get(term.id);
                        const TermIcon = termInfo?.icon;
                        return (
                          <motion.button
                            key={term.id}
                            type="button"
                            whileTap={{ scale: 0.93 }}
                            onClick={() => flow.toggleTerm('feeling', term.id)}
                            className={`tag-selectable ${isTermSelected ? 'tag-selectable-active' : ''}`}
                            style={{ fontFamily: 'var(--font-body)' }}
                          >
                            {TermIcon && <TermIcon size={11} style={{ opacity: isTermSelected ? 1 : 0.4, flexShrink: 0 }} />}
                            {term.label}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
