import React from 'react';
import { motion } from 'framer-motion';
import { TASTING_TAXONOMY, TERM_MAP } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';

const brewingCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'brewing')!;

const TEMPS = [
  { id: 'low-temp', label: 'Low' },
  { id: 'medium-temp', label: 'Medium' },
  { id: 'high-temp', label: 'High' },
] as const;

interface BrewingZoneProps {
  flow: TastingFlowState;
}

export const BrewingZone: React.FC<BrewingZoneProps> = ({ flow }) => {
  const selected = flow.value.brewing || [];

  const selectedTemp = TEMPS.find(t => selected.includes(t.id))?.id ?? null;

  const toggleTemp = (id: string) => {
    if (selectedTemp === id) {
      flow.toggleTerm('brewing', id);
    } else {
      if (selectedTemp) flow.toggleTerm('brewing', selectedTemp);
      if (!selected.includes(id)) flow.toggleTerm('brewing', id);
    }
  };

  // Non-temperature groups
  const otherGroups = brewingCategory.groups.filter(g => g.label !== 'Temperature');

  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim font-medium mb-3"
        style={{ fontFamily: 'var(--font-display)' }}>
        Brewing
      </div>

      {/* Temperature toggle */}
      <div className="flex rounded-lg border border-tea-border overflow-hidden mb-3">
        {TEMPS.map(t => (
          <motion.button
            key={t.id}
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => toggleTemp(t.id)}
            className={`flex-1 py-2 text-xs font-medium transition-all duration-150 ${
              selectedTemp === t.id
                ? 'bg-tea-gold/15 text-tea-gold'
                : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'
            }`}
            style={{
              fontFamily: 'var(--font-body)',
              borderRight: t.id !== 'high-temp' ? '1px solid var(--tea-border)' : 'none',
            }}
          >
            {t.label}
          </motion.button>
        ))}
      </div>

      {/* Other brewing groups */}
      {otherGroups.map(group => (
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
                  onClick={() => flow.toggleTerm('brewing', term.id)}
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
