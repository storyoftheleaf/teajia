import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { LIQUOR_COLORS, TASTING_TAXONOMY } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';

const colorCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'liquor-color')!;
const colorTerms = colorCategory.groups[0].terms;

interface ColorSwatchesProps {
  flow: TastingFlowState;
  compact?: boolean;
}

const DecanterSvg = ({ color }: { color: string }) => {
  const id = color.replace(/[^a-z0-9]/gi, '');
  // Round fair cup (公道杯): wide open mouth, bulbous body
  const bodyD = "M4 8 Q1 8 1 13 Q1 21 11 21 Q21 21 21 13 Q21 8 18 8";
  return (
    <svg width="30" height="26" viewBox="0 0 26 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id={`dG${id}`} x1="0" y1="21" x2="0" y2="13" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0.55" />
        </linearGradient>
        <clipPath id={`dC${id}`}>
          <path d={`${bodyD} Z`} />
        </clipPath>
      </defs>
      {/* Liquid ~65% full with gradient */}
      <rect x="0" y="13" width="26" height="10" fill={`url(#dG${id})`} clipPath={`url(#dC${id})`} />
      {/* Body outline */}
      <path d={bodyD} stroke="currentColor" strokeWidth="1.2" fill="none" />
      {/* Rim */}
      <line x1="4" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
};

const ColorSwatchesInner: React.FC<ColorSwatchesProps> = ({ flow, compact = false }) => {
  const selected = flow.value['liquor-color'] || [];
  const colorCount = flow.getCategoryCount('liquor-color');
  const isDragging = useRef(false);
  const lastPickedId = useRef<string | null>(null);

  const pickColorAt = (clientX: number, rect: DOMRect) => {
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const idx = Math.round(x * (colorTerms.length - 1));
    const termId = colorTerms[idx].id;
    if (termId !== lastPickedId.current) {
      lastPickedId.current = termId;
      flow.selectExclusive('liquor-color', termId);
    }
  };

  if (compact) {
    const selectedId = selected[0] ?? null;
    const selectedHex = selectedId ? (LIQUOR_COLORS[selectedId] || '#888') : null;
    const n = colorTerms.length;

    return (
      <div role="radiogroup" aria-label="Liquor color">
        {/* Label row */}
        <div className="flex items-center justify-between mb-2.5">
          <span
            className="text-ui-13 text-tea-text font-medium"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
          >
            Liquor color
          </span>
          {selectedHex && (
            <motion.div
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2"
            >
              <span className="text-ui-11 text-tea-text-sec" style={{ fontFamily: 'var(--font-body)' }}>
                {colorTerms.find(t => t.id === selectedId)?.label}
              </span>
              <span className="text-tea-text-dim">
                <DecanterSvg color={selectedHex} />
              </span>
              <button
                type="button"
                onClick={() => flow.clearCategory('liquor-color')}
                className="text-tea-text-dim hover:text-tea-text transition-colors p-0.5"
                aria-label="Clear color"
              >
                <X size={11} />
              </button>
            </motion.div>
          )}
        </div>

        {/* Segmented color bar — pointer events for drag + tap */}
        <div
          className="relative flex cursor-pointer select-none outline-none"
          style={{
            height: 32,
            borderRadius: 8,
            overflow: 'hidden',
            touchAction: 'none',
            background: '#1a1a1a',
          }}
          onPointerDown={(e) => {
            isDragging.current = true;
            lastPickedId.current = null;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            pickColorAt(e.clientX, e.currentTarget.getBoundingClientRect());
          }}
          onPointerMove={(e) => {
            if (!isDragging.current) return;
            pickColorAt(e.clientX, e.currentTarget.getBoundingClientRect());
          }}
          onPointerUp={() => { isDragging.current = false; }}
          onPointerCancel={() => { isDragging.current = false; }}
        >
          {colorTerms.map((term, i) => {
            const isSelected = term.id === selectedId;
            const hex = LIQUOR_COLORS[term.id] || '#888';
            return (
              <div
                key={term.id}
                style={{
                  flex: 1,
                  background: hex,
                  borderRight: i < n - 1 ? '1.5px solid rgba(0,0,0,0.2)' : undefined,
                  boxShadow: isSelected ? 'inset 0 0 0 2.5px rgba(255,255,255,0.95)' : undefined,
                  transition: 'box-shadow 0.1s ease',
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // Non-compact: swatch grid
  return (
    <div role="radiogroup" aria-label="Liquor color">
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim font-medium"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Liquor Color
        </div>
        {colorCount > 0 && (
          <button
            type="button"
            onClick={() => flow.clearCategory('liquor-color')}
            className="text-tea-text-dim hover:text-tea-text transition-colors p-2 -mr-1.5"
            aria-label="Clear liquor color selection"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {colorCount === 0 && (
        <p
          className="text-xs text-tea-text-dim italic mb-3"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          What color is the liquor in your cup?
        </p>
      )}

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
              onClick={() => flow.selectExclusive('liquor-color', term.id)}
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
                style={{ width: 44, height: 44, borderRadius: '50%', background: hex }}
              />
              <span
                className={`text-ui-11 leading-tight text-center transition-colors duration-150 ${
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
