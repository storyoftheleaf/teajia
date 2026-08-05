import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { TastingFlowState } from './useTastingFlow';

const SELECTED_BG = 'radial-gradient(ellipse 100% 100% at 50% 50%, rgb(var(--tea-gold-rgb) / 0.28) 0%, rgb(var(--tea-gold-rgb) / 0.10) 70%)';

const WEIGHTS = [
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'full', label: 'Full' },
] as const;

const TEXTURES = [
  { id: 'silky',  label: 'Silky',      hint: 'The tea slides across your tongue with no resistance.' },
  { id: 'smooth', label: 'Smooth',     hint: 'Even and gentle, nothing catches. Easy to drink.' },
  { id: 'velvety',label: 'Velvety',    hint: 'Soft and plush, carrying a little more weight than silky.' },
  { id: 'oily',   label: 'Oily',       hint: 'Coats your mouth, feels rich. Almost buttery.' },
  { id: 'crisp',  label: 'Taut',       hint: 'Crisp structure, a little tension. Like biting into a fresh apple.' },
  { id: 'dry',    label: 'Astringent', hint: 'Drying, puckering. The same feeling as strong black tea or unripe fruit.' },
] as const;

interface BodyZoneProps {
  flow: TastingFlowState;
  value: import('../../types').TastingData;
  onChange: (data: import('../../types').TastingData) => void;
}

const BodyZoneInner: React.FC<BodyZoneProps> = ({ flow, value, onChange }) => {
  const bodySelected = flow.value.body || [];
  const selectedWeight = WEIGHTS.find(w => bodySelected.includes(w.id))?.id ?? null;
  const totalCount = bodySelected.length;

  const toggleSingleSelect = (id: string, options: ReadonlyArray<{ id: string }>) => {
    const current = value.body || [];
    const withoutGroup = current.filter(t => !options.some(o => o.id === t));
    const currentlySelected = options.find(o => bodySelected.includes(o.id))?.id;
    const next = currentlySelected === id ? withoutGroup : [...withoutGroup, id];
    onChange({ ...value, body: next.length ? next : undefined });
  };

  const handleClearAll = () => {
    for (const id of bodySelected) flow.toggleTerm('body', id);
  };

  const [lastSelectedTexture, setLastSelectedTexture] = React.useState<string | null>(null);
  const lastHint = TEXTURES.find(t => t.id === lastSelectedTexture && bodySelected.includes(t.id))?.hint;

  return (
    <div role="group" aria-label="Sensation: weight and texture">
      {/* Clear */}
      <div className="flex justify-end mb-1 -mt-1">
        <motion.button
          type="button"
          onClick={handleClearAll}
          animate={{ opacity: totalCount > 0 ? 1 : 0 }}
          transition={{ duration: 0.18 }}
          style={{ pointerEvents: totalCount > 0 ? 'auto' : 'none' }}
          className="text-ui-11 text-tea-text-dim hover:text-tea-text-sec transition-colors flex items-center gap-1 px-2 py-1"
          aria-label="Clear all sensation selections"
        >
          <X size={10} />
          Clear
        </motion.button>
      </div>

      {/* Weight */}
      <div className="mb-4">
        <div className="mb-2">
          <div
            className="text-ui-12 uppercase tracking-[0.12em] text-tea-text-dim font-medium"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Weight
          </div>
          <p className="text-ui-11 text-tea-text-sec mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
            How heavy does the liquor feel sitting on your tongue?
          </p>
        </div>
        <div className="tasting-segment-toggle" role="radiogroup" aria-label="Body weight">
          {WEIGHTS.map((w, i) => (
            <motion.button
              key={w.id}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => toggleSingleSelect(w.id, WEIGHTS)}
              role="radio"
              aria-checked={selectedWeight === w.id}
              className={`flex-1 py-2.5 transition-all duration-200 min-h-[44px] relative z-[1] ${
                selectedWeight === w.id
                  ? 'text-tea-gold font-semibold text-ui-15'
                  : 'text-tea-text-sec hover:text-tea-text font-medium text-ui-15'
              }${i < WEIGHTS.length - 1 ? ' weight-seg-div' : ''}`}
              style={{
                fontFamily: 'var(--font-body)',
                background: selectedWeight === w.id ? SELECTED_BG : 'transparent',
              }}
            >
              {w.label}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="divider-warm mb-4" />

      {/* Texture */}
      <div>
        <div className="mb-2">
          <div
            className="text-ui-12 uppercase tracking-[0.12em] text-tea-text-dim font-medium"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Texture
          </div>
          <p className="text-ui-11 text-tea-text-sec mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
            What physical sensation moves through your mouth?
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {TEXTURES.map(t => {
            const isSelected = bodySelected.includes(t.id);
            return (
              <motion.button
                key={t.id}
                type="button"
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                onClick={() => {
                  flow.toggleTerm('body', t.id);
                  if (!isSelected) setLastSelectedTexture(t.id);
                  else if (lastSelectedTexture === t.id) setLastSelectedTexture(null);
                }}
                className={`tag-selectable w-full justify-center ${isSelected ? 'tag-selectable-active' : ''}`}
                style={{ fontFamily: 'var(--font-body)', fontSize: '13px' }}
                aria-pressed={isSelected}
              >
                {t.label}
              </motion.button>
            );
          })}
        </div>

        <motion.div
          initial={false}
          animate={{ opacity: lastHint ? 1 : 0, height: lastHint ? 'auto' : 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          {lastHint && (
            <p className="text-ui-12 text-tea-text-sec mt-2 px-0.5" style={{ fontFamily: 'var(--font-body)' }}>
              {lastHint}
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export const BodyZone = React.memo(BodyZoneInner);
BodyZone.displayName = 'BodyZone';
