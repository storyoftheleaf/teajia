import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { TASTING_TAXONOMY, TERM_MAP } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';

const finishCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'finish')!;

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

const FINISH_DURATIONS = [
  { id: 'finish-short', label: 'Short' },
  { id: 'finish-medium', label: 'Medium' },
  { id: 'finish-long', label: 'Long' },
  { id: 'lingering', label: 'Lingering' },
] as const;

// Character and Throat groups from finish taxonomy
const finishCharacterGroup = finishCategory.groups.find(g => g.label === 'Character');
const finishThroatGroup = finishCategory.groups.find(g => g.label === 'Throat');

interface MouthfeelZoneProps {
  flow: TastingFlowState;
  mode?: 'admin' | 'customer';
}

const MouthfeelZoneInner: React.FC<MouthfeelZoneProps> = ({ flow }) => {
  const bodySelected = flow.value.body || [];
  const finishSelected = flow.value.finish || [];
  const combinedCount = bodySelected.length + finishSelected.length;

  // Weight: radio behavior (single select)
  const selectedWeight = WEIGHTS.find(w => bodySelected.includes(w.id))?.id ?? null;

  const toggleWeight = (id: string) => {
    if (selectedWeight === id) {
      flow.toggleTerm('body', id); // deselect
    } else {
      if (selectedWeight) flow.toggleTerm('body', selectedWeight); // remove old
      flow.toggleTerm('body', id); // add new
    }
  };

  // Finish Duration: radio behavior (single select)
  const selectedDuration = FINISH_DURATIONS.find(d => finishSelected.includes(d.id))?.id ?? null;

  const toggleDuration = (id: string) => {
    if (selectedDuration === id) {
      flow.toggleTerm('finish', id); // deselect
    } else {
      if (selectedDuration) flow.toggleTerm('finish', selectedDuration); // remove old
      flow.toggleTerm('finish', id); // add new
    }
  };

  const handleClear = () => {
    for (const id of bodySelected) {
      flow.toggleTerm('body', id);
    }
    for (const id of finishSelected) {
      flow.toggleTerm('finish', id);
    }
  };

  return (
    <div role="group" aria-label="Mouthfeel and finish">
      {/* Section header */}
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim font-medium"
          style={{ fontFamily: 'var(--font-display)' }}>
          Mouthfeel
          {combinedCount > 0 && (
            <span className="ml-1.5 text-tea-gold">{combinedCount}</span>
          )}
        </div>
        {combinedCount > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-tea-text-dim hover:text-tea-text-sec transition-colors"
            aria-label="Clear mouthfeel selections"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {combinedCount === 0 && (
        <div className="text-[11px] text-tea-text-dim mb-3" style={{ fontFamily: 'var(--font-body)' }}>
          How does it feel in your mouth? What remains after you swallow?
        </div>
      )}

      {/* Part 1: Weight — 3-segment toggle */}
      <div className="mb-3">
        <div className="text-[9px] uppercase tracking-[0.12em] text-tea-text-dim/70 mb-1.5 font-medium">
          Weight
        </div>
        <div className="flex rounded-lg overflow-hidden bg-tea-surface" role="radiogroup" aria-label="Body weight">
          {WEIGHTS.map((w, i) => (
            <motion.button
              key={w.id}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => toggleWeight(w.id)}
              role="radio"
              aria-checked={selectedWeight === w.id}
              className={`flex-1 py-2.5 text-xs font-medium transition-all duration-150 min-h-[44px] ${
                selectedWeight === w.id
                  ? 'tag-selectable-active'
                  : 'text-tea-text-sec hover:text-tea-text'
              }${i < WEIGHTS.length - 1 ? ' weight-segment-border' : ''}`}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {w.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Part 2: Texture — pill row */}
      <div className="mb-4">
        <div className="text-[9px] uppercase tracking-[0.12em] text-tea-text-dim/70 mb-1.5 font-medium">
          Texture
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TEXTURES.map(t => {
            const isSelected = bodySelected.includes(t.id);
            return (
              <motion.button
                key={t.id}
                type="button"
                whileTap={{ scale: 0.93 }}
                onClick={() => flow.toggleTerm('body', t.id)}
                className={`tag-selectable ${isSelected ? 'tag-selectable-active' : ''}`}
                style={{ fontFamily: 'var(--font-body)' }}
                aria-pressed={isSelected}
              >
                {t.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="divider-warm my-4" />

      {/* Part 3: Finish Duration — segment toggle */}
      <div className="mb-3">
        <div className="text-[9px] uppercase tracking-[0.12em] text-tea-text-dim/70 mb-1.5 font-medium">
          Finish
        </div>
        <div className="flex rounded-lg overflow-hidden bg-tea-surface" role="radiogroup" aria-label="Finish duration">
          {FINISH_DURATIONS.map((d, i) => (
            <motion.button
              key={d.id}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => toggleDuration(d.id)}
              role="radio"
              aria-checked={selectedDuration === d.id}
              className={`flex-1 py-2.5 text-xs font-medium transition-all duration-150 min-h-[44px] ${
                selectedDuration === d.id
                  ? 'tag-selectable-active'
                  : 'text-tea-text-sec hover:text-tea-text'
              }${i < FINISH_DURATIONS.length - 1 ? ' weight-segment-border' : ''}`}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {d.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Part 4: Finish Character — pill row */}
      {finishCharacterGroup && (
        <div className="mb-3">
          <div className="text-[9px] uppercase tracking-[0.12em] text-tea-text-dim/70 mb-1.5 font-medium">
            Character
          </div>
          <div className="flex flex-wrap gap-1.5">
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
                  {Icon && <Icon size={11} style={{ opacity: isSelected ? 1 : 0.4, flexShrink: 0 }} />}
                  {term.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* CSS for weight/finish segment borders via CSS variables */}
      <style>{`
        .weight-segment-border {
          border-right: 1px solid var(--tea-border);
        }
      `}</style>

      {/* Part 5: Throat — pill row */}
      {finishThroatGroup && (
        <div>
          <div className="text-[9px] uppercase tracking-[0.12em] text-tea-text-dim/70 mb-1.5 font-medium">
            Throat
          </div>
          <div className="flex flex-wrap gap-1.5">
            {finishThroatGroup.terms.map(term => {
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
                  {Icon && <Icon size={11} style={{ opacity: isSelected ? 1 : 0.4, flexShrink: 0 }} />}
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

export const MouthfeelZone = React.memo(MouthfeelZoneInner);
MouthfeelZone.displayName = 'MouthfeelZone';
