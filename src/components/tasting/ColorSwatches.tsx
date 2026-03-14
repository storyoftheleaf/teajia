import React from 'react';
import { motion } from 'framer-motion';
import { LIQUOR_COLORS } from '../../data/tastingTaxonomy';
import { TASTING_TAXONOMY } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';

const colorCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'liquor-color')!;
const colorTerms = colorCategory.groups[0].terms;

interface ColorSwatchesProps {
  flow: TastingFlowState;
}

export const ColorSwatches: React.FC<ColorSwatchesProps> = ({ flow }) => {
  const selected = flow.value['liquor-color'] || [];

  const handleSelect = (termId: string) => {
    // Single-select — deselect old, select new (or toggle off)
    if (selected.includes(termId)) {
      flow.toggleTerm('liquor-color', termId);
    } else {
      // Remove any existing selection first
      selected.forEach(id => flow.toggleTerm('liquor-color', id));
      flow.toggleTerm('liquor-color', termId);
    }
  };

  const selectedLabel = colorTerms.find(t => selected.includes(t.id))?.label;

  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim font-medium mb-3"
        style={{ fontFamily: 'var(--font-display)' }}>
        Liquor Color
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {colorTerms.map(term => {
          const isSelected = selected.includes(term.id);
          const hex = LIQUOR_COLORS[term.id] || '#888';

          return (
            <motion.button
              key={term.id}
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => handleSelect(term.id)}
              className="relative flex flex-col items-center gap-1 p-1"
              title={term.label}
            >
              <motion.div
                animate={isSelected ? { scale: 1.15 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: hex,
                  border: isSelected ? '2px solid var(--tea-gold)' : '1px solid var(--tea-border)',
                  boxShadow: isSelected ? '0 0 0 3px rgba(var(--tea-gold-rgb, 184, 146, 78), 0.2)' : 'none',
                  transition: 'border 0.15s, box-shadow 0.15s',
                }}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Show selected label */}
      {selectedLabel && (
        <div className="text-xs text-tea-gold mt-2" style={{ fontFamily: 'var(--font-body)' }}>
          {selectedLabel}
        </div>
      )}
    </div>
  );
};
