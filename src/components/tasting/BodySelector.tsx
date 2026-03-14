import React from 'react';
import { motion } from 'framer-motion';
import type { TastingFlowState } from './useTastingFlow';

const WEIGHTS = [
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'full', label: 'Full' },
] as const;

const TEXTURES = [
  { id: 'silky', label: 'Silky' },
  { id: 'smooth', label: 'Smooth' },
  { id: 'crisp', label: 'Crisp' },
  { id: 'oily', label: 'Oily' },
  { id: 'dry', label: 'Dry' },
] as const;

interface BodySelectorProps {
  flow: TastingFlowState;
}

export const BodySelector: React.FC<BodySelectorProps> = ({ flow }) => {
  const selected = flow.value.body || [];

  const selectedWeight = WEIGHTS.find(w => selected.includes(w.id))?.id ?? null;

  const toggleWeight = (id: string) => {
    // Radio behavior — only one weight at a time
    const withoutWeights = selected.filter(s => !WEIGHTS.some(w => w.id === s));
    if (selectedWeight === id) {
      // Deselect
      flow.toggleTerm('body', id);
    } else {
      // Remove old weight, add new
      if (selectedWeight) flow.toggleTerm('body', selectedWeight);
      if (!selected.includes(id)) flow.toggleTerm('body', id);
    }
  };

  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim font-medium mb-3"
        style={{ fontFamily: 'var(--font-display)' }}>
        Body
      </div>

      {/* Weight — 3-segment toggle */}
      <div className="flex rounded-lg border border-tea-border overflow-hidden mb-3">
        {WEIGHTS.map(w => (
          <motion.button
            key={w.id}
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => toggleWeight(w.id)}
            className={`flex-1 py-2 text-xs font-medium transition-all duration-150 ${
              selectedWeight === w.id
                ? 'bg-tea-gold/15 text-tea-gold border-tea-gold/30'
                : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'
            }`}
            style={{
              fontFamily: 'var(--font-body)',
              borderRight: w.id !== 'full' ? '1px solid var(--tea-border)' : 'none',
            }}
          >
            {w.label}
          </motion.button>
        ))}
      </div>

      {/* Texture — pill row */}
      <div className="flex flex-wrap gap-1.5">
        {TEXTURES.map(t => {
          const isSelected = selected.includes(t.id);
          return (
            <motion.button
              key={t.id}
              type="button"
              whileTap={{ scale: 0.93 }}
              onClick={() => flow.toggleTerm('body', t.id)}
              className={`tag-selectable ${isSelected ? 'tag-selectable-active' : ''}`}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {t.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
