import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { ColorSwatches } from './ColorSwatches';
import type { TastingFlowState } from './useTastingFlow';

const WEIGHTS = [
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'full', label: 'Full' },
] as const;

const TEXTURES = [
  { id: 'silky', label: 'Silky' },
  { id: 'smooth', label: 'Smooth' },
  { id: 'velvety', label: 'Velvety' },
  { id: 'oily', label: 'Oily' },
  { id: 'crisp', label: 'Taut' },
  { id: 'dry', label: 'Astringent' },
] as const;

interface BodyZoneProps {
  flow: TastingFlowState;
  value: import('../../types').TastingData;
  onChange: (data: import('../../types').TastingData) => void;
}

const BodyZoneInner: React.FC<BodyZoneProps> = ({ flow, value, onChange }) => {
  const bodySelected = flow.value.body || [];
  const selectedWeight = WEIGHTS.find(w => bodySelected.includes(w.id))?.id ?? null;
  const colorCount = flow.getCategoryCount('liquor-color');
  const totalCount = bodySelected.length + colorCount;

  const toggleWeight = (id: string) => {
    const current = value.body || [];
    const withoutWeights = current.filter(t => !WEIGHTS.some(w => w.id === t));
    const next = selectedWeight === id ? withoutWeights : [...withoutWeights, id];
    onChange({ ...value, body: next.length ? next : undefined });
  };

  const handleClearAll = () => {
    for (const id of bodySelected) flow.toggleTerm('body', id);
    flow.clearCategory('liquor-color');
  };

  return (
    <div role="group" aria-label="Body weight and texture">
      {/* Clear — fades in/out */}
      <div className="flex justify-end mb-1 -mt-1">
        <motion.button
          type="button"
          onClick={handleClearAll}
          animate={{ opacity: totalCount > 0 ? 1 : 0 }}
          transition={{ duration: 0.18 }}
          style={{ pointerEvents: totalCount > 0 ? 'auto' : 'none' }}
          className="text-[11px] text-tea-text-dim hover:text-tea-text-sec transition-colors flex items-center gap-1 px-2 py-1"
          aria-label="Clear all body selections"
        >
          <X size={10} />
          Clear
        </motion.button>
      </div>

      {/* ── #6: Color with divider after ── */}
      <div className="mb-3">
        <ColorSwatches flow={flow} compact />
      </div>

      <div className="divider-warm mb-4" />

      {/* ── #2: Stronger section header ── */}
      <div className="mb-4">
        <div
          className="text-[13px] text-tea-text font-medium mb-2"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
        >
          Weight
        </div>
        <div className="tasting-segment-toggle" role="radiogroup" aria-label="Body weight">
          {WEIGHTS.map((w, i) => (
            <motion.button
              key={w.id}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => toggleWeight(w.id)}
              role="radio"
              aria-checked={selectedWeight === w.id}
              className={`flex-1 py-2.5 text-[15px] font-medium transition-all duration-200 min-h-[44px] relative z-[1] ${
                selectedWeight === w.id
                  ? 'text-tea-gold'
                  : 'text-tea-text-sec hover:text-tea-text'
              }${i < WEIGHTS.length - 1 ? ' weight-seg-div' : ''}`}
              style={{
                fontFamily: 'var(--font-body)',
                /* #5: more visible selected bg */
                background: selectedWeight === w.id
                  ? 'radial-gradient(ellipse 100% 100% at 50% 50%, rgb(var(--tea-gold-rgb) / 0.18) 0%, rgb(var(--tea-gold-rgb) / 0.06) 70%)'
                  : 'transparent',
              }}
            >
              {w.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── #2 & #4: Texture ── */}
      <div>
        <div
          className="text-[13px] text-tea-text font-medium mb-2"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
        >
          Texture
        </div>
        {/* #4: tighter gap so tags stay on one line */}
        <div className="flex flex-wrap gap-1.5">
          {TEXTURES.map(t => {
            const isSelected = bodySelected.includes(t.id);
            return (
              <motion.button
                key={t.id}
                type="button"
                whileTap={{ scale: 0.93 }}
                whileHover={{ scale: 1.04 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                onClick={() => flow.toggleTerm('body', t.id)}
                className={`tag-selectable ${isSelected ? 'tag-selectable-active' : ''}`}
                style={{ fontFamily: 'var(--font-body)', fontSize: '12px' }}
                aria-pressed={isSelected}
              >
                {t.label}
              </motion.button>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export const BodyZone = React.memo(BodyZoneInner);
BodyZone.displayName = 'BodyZone';
