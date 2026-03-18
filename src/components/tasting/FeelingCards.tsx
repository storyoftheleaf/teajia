import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { TASTING_TAXONOMY, TERM_MAP } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';

const feelingCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'feeling')!;

interface FeelingCardsProps {
  flow: TastingFlowState;
  mode?: 'admin' | 'customer';
}

const FeelingCardsInner: React.FC<FeelingCardsProps> = ({ flow }) => {
  const selected = flow.value.feeling || [];
  const count = selected.length;

  const handleClear = () => {
    for (const id of selected) {
      flow.toggleTerm('feeling', id);
    }
  };

  return (
    <div role="group" aria-label="Feeling selections">
      {/* Section header */}
      <div className="flex items-center justify-between mb-1">
        <div
          className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim font-medium"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Feel
          {count > 0 && (
            <span className="ml-1.5 text-tea-gold">{count}</span>
          )}
        </div>
        {count > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-tea-text-dim hover:text-tea-text-sec transition-colors"
            aria-label="Clear feeling selections"
          >
            <X size={12} />
          </button>
        )}
      </div>
      <div
        className="text-[11px] text-tea-text-dim mb-3"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        What does this tea do to your state?
      </div>

      {/* Flat grid of all feeling terms, with subtle group labels */}
      <div role="group" aria-label="Feeling">
        {feelingCategory.groups.map((group, groupIdx) => (
          <React.Fragment key={group.label}>
            {/* Non-interactive group label divider */}
            <div
              className={`text-[9px] uppercase tracking-[0.12em] text-tea-text-dim/60 font-medium ${
                groupIdx > 0 ? 'mt-3' : ''
              } mb-1.5`}
            >
              {group.label}
            </div>

            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {group.terms.map(term => {
                const isSelected = selected.includes(term.id);
                const termInfo = TERM_MAP.get(term.id);
                const TermIcon = termInfo?.icon;

                return (
                  <motion.button
                    key={term.id}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => flow.toggleTerm('feeling', term.id)}
                    className={`tag-selectable ${
                      isSelected ? 'tag-selectable-active' : ''
                    } flex flex-col items-center justify-center gap-1 rounded-lg min-h-[52px] py-2 px-1`}
                    style={{ fontFamily: 'var(--font-body)' }}
                    aria-pressed={isSelected}
                  >
                    {TermIcon && (
                      <TermIcon
                        size={20}
                        className="shrink-0"
                        style={{ opacity: isSelected ? 1 : 0.4 }}
                      />
                    )}
                    <span className="text-[11px] leading-tight text-center">
                      {term.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export const FeelingCards = React.memo(FeelingCardsInner);
FeelingCards.displayName = 'FeelingCards';
