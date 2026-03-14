import React from 'react';
import { motion } from 'framer-motion';
import { TASTING_TAXONOMY, TERM_MAP } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';

const finishCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'finish')!;

interface FinishZoneProps {
  flow: TastingFlowState;
}

export const FinishZone: React.FC<FinishZoneProps> = ({ flow }) => {
  const selected = flow.value.finish || [];

  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim font-medium mb-3"
        style={{ fontFamily: 'var(--font-display)' }}>
        Finish
      </div>

      {finishCategory.groups.map(group => (
        <div key={group.label} className="mb-3">
          <div className="text-[9px] uppercase tracking-[0.12em] text-tea-text-dim/70 mb-1.5 font-medium">
            {group.label}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {group.terms.map(term => {
              const isSelected = selected.includes(term.id);
              const termInfo = TERM_MAP.get(term.id);
              const Icon = termInfo?.icon;
              return (
                <motion.button
                  key={term.id}
                  type="button"
                  whileTap={{ scale: 0.93 }}
                  onClick={() => flow.toggleTerm('finish', term.id)}
                  className={`tag-selectable ${isSelected ? 'tag-selectable-active' : ''}`}
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {Icon && <Icon size={11} style={{ opacity: isSelected ? 1 : 0.4, flexShrink: 0 }} />}
                  {term.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
