import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { TASTING_TAXONOMY, TERM_MAP, GROUP_ICON_MAP } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';

const feelingCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'feeling')!;

interface ExperienceZoneProps {
  flow: TastingFlowState;
}

const ExperienceZoneInner: React.FC<ExperienceZoneProps> = ({ flow }) => {
  const feelingSelected = flow.value.feeling || [];
  const count = feelingSelected.length;

  const handleClearAll = () => {
    for (const id of feelingSelected) flow.toggleTerm('feeling', id);
  };

  return (
    <div role="group" aria-label="Experience and state of mind">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="tasting-section-label flex-1">
          Experience
          {count > 0 && (
            <span className="text-tea-gold ml-1 tracking-normal">{count}</span>
          )}
        </div>
        {count > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-tea-text-dim hover:text-tea-text-sec transition-colors p-2 -mr-1.5"
            aria-label="Clear all experience selections"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {count === 0 && (
        <p
          className="text-[12px] text-tea-text-dim italic mb-4"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          What experience does this tea evoke?
        </p>
      )}

      {/* Mood cards by group */}
      <div className="space-y-3">
        {feelingCategory.groups.map(group => {
          const GroupIcon = GROUP_ICON_MAP[group.label];
          return (
            <div key={group.label}>
              {/* Group label with icon */}
              <div className="flex items-center gap-1.5 mb-1.5">
                {GroupIcon && <GroupIcon size={12} className="text-tea-text-dim opacity-50" />}
                <span
                  className="text-[9px] uppercase tracking-[0.12em] text-tea-text-dim/70 font-medium"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {group.label}
                </span>
              </div>
              {/* Mood cards — horizontal flow */}
              <div className="flex flex-wrap gap-2">
                {group.terms.map(term => {
                  const isSelected = feelingSelected.includes(term.id);
                  const termInfo = TERM_MAP.get(term.id);
                  const TermIcon = termInfo?.icon;
                  return (
                    <motion.button
                      key={term.id}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => flow.toggleTerm('feeling', term.id)}
                      className={`tasting-mood-card ${isSelected ? 'tasting-mood-card-active' : ''} flex items-center gap-2 px-3 py-2.5 min-h-[44px]`}
                      style={{ fontFamily: 'var(--font-body)' }}
                      aria-pressed={isSelected}
                    >
                      {TermIcon && (
                        <TermIcon
                          size={15}
                          className={`shrink-0 ${isSelected ? 'text-tea-gold' : 'text-tea-text-dim opacity-40'} transition-colors`}
                        />
                      )}
                      <span className={`text-[12px] ${isSelected ? 'text-tea-gold font-medium' : 'text-tea-text-sec'} transition-colors`}>
                        {term.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ExperienceZone = React.memo(ExperienceZoneInner);
ExperienceZone.displayName = 'ExperienceZone';
