import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { TASTING_TAXONOMY, TERM_MAP } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';
import type { TastingData } from '../../types';

const feelingCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'feeling')!;

/** Look up the hint for a term from the taxonomy JSON */
function getTermHint(termId: string): string | undefined {
  for (const cat of TASTING_TAXONOMY.categories) {
    for (const group of cat.groups) {
      for (const term of group.terms) {
        if (term.id === termId && 'hint' in term) return (term as { hint?: string }).hint;
      }
    }
  }
  return undefined;
}

interface StateZoneProps {
  flow: TastingFlowState;
  value: TastingData;
  onChange: (data: TastingData) => void;
}

const StateZoneInner: React.FC<StateZoneProps> = ({ flow, value, onChange }) => {
  const feelingSelected = flow.value.feeling || [];
  const totalCount =
    feelingSelected.length +
    (value.quality != null ? 1 : 0);

  const setQuality = (v: number | undefined) => onChange({ ...value, quality: v });

  const handleClearAll = () => {
    for (const id of feelingSelected) flow.toggleTerm('feeling', id);
    if (value.quality != null) onChange({ ...value, quality: undefined });
  };

  // Track last selected feeling for hint display
  const [lastSelectedFeeling, setLastSelectedFeeling] = useState<string | null>(null);
  const lastHint = lastSelectedFeeling && feelingSelected.includes(lastSelectedFeeling)
    ? getTermHint(lastSelectedFeeling)
    : undefined;

  return (
    <div role="group" aria-label="Feeling and overall quality">
      {/* Clear */}
      <div className="flex justify-end mb-1 -mt-1">
        <motion.button
          type="button"
          onClick={handleClearAll}
          animate={{ opacity: totalCount > 0 ? 1 : 0 }}
          transition={{ duration: 0.18 }}
          style={{ pointerEvents: totalCount > 0 ? 'auto' : 'none' }}
          className="text-ui-11 text-tea-text-dim hover:text-tea-text-sec transition-colors flex items-center gap-1 px-2 py-1"
          aria-label="Clear all feeling selections"
        >
          <X size={10} />
          Clear
        </motion.button>
      </div>

      {/* Feeling quadrants */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 mb-4">
        {feelingCategory.groups.map(group => (
          <div key={group.label} className="rounded-xl p-2.5 bg-tea-surface/40">
            <div
              className="text-ui-12 text-tea-text font-medium mb-2 pb-1 border-b border-tea-border"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
            >
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.terms.map(term => {
                const isSelected = feelingSelected.includes(term.id);
                const termInfo = TERM_MAP.get(term.id);
                const Icon = termInfo?.icon;
                return (
                  <motion.button
                    key={term.id}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      flow.toggleTerm('feeling', term.id);
                      if (!isSelected) setLastSelectedFeeling(term.id);
                      else if (lastSelectedFeeling === term.id) setLastSelectedFeeling(null);
                    }}
                    aria-pressed={isSelected}
                    className={`flex items-center gap-2 w-full text-left px-2.5 py-2 min-h-[40px] rounded-xl transition-all duration-150 ${
                      isSelected
                        ? 'bg-tea-gold/12 text-tea-gold'
                        : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-surface'
                    }`}
                    style={{ fontFamily: 'var(--font-body)', fontSize: '13px' }}
                  >
                    {Icon && (
                      <Icon
                        size={12}
                        className={`shrink-0 transition-opacity ${isSelected ? 'opacity-80' : 'opacity-45'}`}
                      />
                    )}
                    <span className={isSelected ? 'font-medium' : ''}>{term.label}</span>
                    {isSelected && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-auto w-1.5 h-1.5 rounded-full bg-tea-gold shrink-0"
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Hint sentence for selected feeling */}
      <AnimatePresence>
        {lastHint && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="text-ui-12 text-tea-text-sec px-1 mb-4 overflow-hidden"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {lastHint}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="divider-warm my-4" />

      {/* Quality 1-10 */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-ui-13 text-tea-text font-medium"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
          >
            Quality
          </span>
          <span
            className={`text-ui-11 transition-colors ${value.quality != null ? 'text-tea-gold' : 'text-tea-text-dim'}`}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {value.quality != null ? `${value.quality}/10` : '/10'}
          </span>
        </div>
        <div className="tasting-segment-toggle" role="radiogroup" aria-label="Quality rating">
          {[1,2,3,4,5,6,7,8,9,10].map((v, i) => {
            const isSelected = value.quality === v;
            return (
              <motion.button
                key={v}
                type="button"
                whileTap={{ scale: 0.93 }}
                onClick={() => setQuality(isSelected ? undefined : v)}
                role="radio"
                aria-checked={isSelected}
                className={`flex-1 py-3 text-ui-13 font-medium transition-all duration-200 min-h-[48px] relative z-[1] ${
                  isSelected ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
                }${i < 9 ? ' weight-seg-div' : ''}`}
                style={{
                  fontFamily: 'var(--font-mono)',
                  background: isSelected
                    ? 'radial-gradient(ellipse 120% 120% at 50% 50%, rgb(var(--tea-gold-rgb) / 0.14) 0%, rgb(var(--tea-gold-rgb) / 0.04) 70%)'
                    : 'transparent',
                }}
              >
                {v}
              </motion.button>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export const StateZone = React.memo(StateZoneInner);
StateZone.displayName = 'StateZone';
