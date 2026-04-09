import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { TASTING_TAXONOMY, TERM_MAP } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';
import type { TastingData } from '../../types';

const feelingCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'feeling')!;
const finishCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'finish')!;
const finishCharacterGroup = finishCategory.groups.find(g => g.label === 'Character');

// Flatten all 14 feeling terms in a single list
const ALL_FEELING_TERMS = feelingCategory.groups.flatMap(g => g.terms);

interface EnergyZoneProps {
  flow: TastingFlowState;
  value: TastingData;
  onChange: (data: TastingData) => void;
}

const EnergyZoneInner: React.FC<EnergyZoneProps> = ({ flow, value, onChange }) => {
  const feelingSelected = flow.value.feeling || [];
  const finishSelected = flow.value.finish || [];
  const totalCount =
    feelingSelected.length +
    finishSelected.filter(id => finishCharacterGroup?.terms.some(t => t.id === id)).length +
    (value.huiGan ? 1 : 0);

  const toggleHuiGan = () => {
    onChange({ ...value, huiGan: !value.huiGan });
  };

  const handleClearAll = () => {
    for (const id of feelingSelected) flow.toggleTerm('feeling', id);
    for (const term of finishCharacterGroup?.terms ?? []) {
      if (finishSelected.includes(term.id)) flow.toggleTerm('finish', term.id);
    }
    if (value.huiGan) onChange({ ...value, huiGan: false });
  };

  return (
    <div role="group" aria-label="Energy and qi">
      <div className="flex justify-end mb-1 -mt-1">
        <button
          type="button"
          onClick={handleClearAll}
          className={`text-[11px] text-tea-text-dim hover:text-tea-text-sec transition-colors flex items-center gap-1 px-2 py-1 ${totalCount > 0 ? 'visible' : 'invisible'}`}
          aria-label="Clear all energy selections"
          tabIndex={totalCount > 0 ? 0 : -1}
        >
          <X size={10} />
          Clear
        </button>
      </div>

      {/* ── Feeling — flat pill grid ── */}
      <div className="mb-5">
        <div className="flex flex-wrap gap-2">
          {ALL_FEELING_TERMS.map(term => {
            const isSelected = feelingSelected.includes(term.id);
            const termInfo = TERM_MAP.get(term.id);
            const Icon = termInfo?.icon;
            return (
              <motion.button
                key={term.id}
                type="button"
                whileTap={{ scale: 0.93 }}
                onClick={() => flow.toggleTerm('feeling', term.id)}
                className={`tasting-mood-card ${isSelected ? 'tasting-mood-card-active' : ''} flex items-center gap-2 px-3.5 py-2.5 min-h-[44px]`}
                style={{ fontFamily: 'var(--font-body)' }}
                aria-pressed={isSelected}
              >
                {Icon && (
                  <Icon
                    size={13}
                    className={`shrink-0 ${isSelected ? 'text-tea-gold' : 'text-tea-text-dim opacity-40'} transition-colors`}
                  />
                )}
                <span className={`text-[13px] ${isSelected ? 'text-tea-gold font-medium' : 'text-tea-text-sec'} transition-colors`}>
                  {term.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="divider-warm my-4" />

      {/* ── Hui Gan toggle ── */}
      <div className="mb-5">
        <div
          className="text-[11px] uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-3"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          回甘 Returning sweetness
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={toggleHuiGan}
          aria-pressed={!!value.huiGan}
          className={`tasting-huigan-toggle min-h-[44px] px-5 ${value.huiGan ? 'tasting-huigan-toggle-active' : ''}`}
        >
          {value.huiGan ? '✓ ' : ''}Hui gan present
        </motion.button>
      </div>

      {/* ── Finish character ── */}
      {finishCharacterGroup && (
        <div>
          <div
            className="text-[11px] uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Finish character
          </div>
          <div className="flex flex-wrap gap-2">
            {finishCharacterGroup.terms.map(term => {
              const isSelected = finishSelected.includes(term.id);
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
                  aria-pressed={isSelected}
                >
                  {Icon && <Icon size={11} className={`shrink-0 ${isSelected ? 'opacity-100' : 'opacity-30'}`} />}
                  {term.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const EnergyZone = React.memo(EnergyZoneInner);
EnergyZone.displayName = 'EnergyZone';
