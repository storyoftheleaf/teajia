import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { LIQUOR_COLORS, TASTING_TAXONOMY } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';

const colorCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'liquor-color')!;
const colorTerms = colorCategory.groups[0].terms;

interface ColorSwatchesProps {
  flow: TastingFlowState;
}

const ColorSwatchesInner: React.FC<ColorSwatchesProps> = ({ flow }) => {
  const selected = flow.value['liquor-color'] || [];
  const colorCount = flow.getCategoryCount('liquor-color');
  const clearCategory = flow.clearCategory;

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

  return (
    <div role="radiogroup" aria-label="Liquor color">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-[11px] uppercase tracking-[0.15em] text-tea-text-dim font-medium"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Liquor Color
        </div>
        {colorCount > 0 && (
          <button
            type="button"
            onClick={() => clearCategory('liquor-color')}
            className="text-tea-text-dim hover:text-tea-text transition-colors p-2 -mr-1.5"
            aria-label="Clear liquor color selection"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Description — only when nothing selected */}
      {colorCount === 0 && (
        <p
          className="text-xs text-tea-text-dim italic mb-3"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          What color is the liquor in your cup?
        </p>
      )}

      {/* Swatch grid: 2 rows x 5 columns */}
      <div className="grid grid-cols-5 gap-3">
        {colorTerms.map(term => {
          const isSelected = selected.includes(term.id);
          const hex = LIQUOR_COLORS[term.id] || '#888';

          return (
            <motion.button
              key={term.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={term.label}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleSelect(term.id)}
              className="flex flex-col items-center gap-1.5 p-1 cursor-pointer min-h-[44px] min-w-[44px]"
            >
              <motion.div
                animate={{
                  scale: isSelected ? 1.1 : 1,
                  boxShadow: isSelected
                    ? '0 0 0 2px var(--tea-gold), 0 0 8px color-mix(in srgb, var(--tea-gold) 30%, transparent)'
                    : '0 0 0 1px var(--tea-border)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="rounded-full"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: hex,
                }}
              />
              {/* Label always visible */}
              <span
                className={`text-[11px] leading-tight text-center transition-colors duration-150 ${
                  isSelected ? 'text-tea-gold' : 'text-tea-text-dim'
                }`}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {term.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export const ColorSwatches = React.memo(ColorSwatchesInner);
ColorSwatches.displayName = 'ColorSwatches';
