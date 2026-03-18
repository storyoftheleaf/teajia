import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { TASTING_TAXONOMY, TERM_MAP } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';

const finishCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'finish')!;
const feelingCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'feeling')!;

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

const finishCharacterGroup = finishCategory.groups.find(g => g.label === 'Character');
const finishThroatGroup = finishCategory.groups.find(g => g.label === 'Throat');

// Flatten all feeling terms for a simpler display
const allFeelingTerms = feelingCategory.groups.flatMap(g => g.terms);

interface FeelZoneProps {
  flow: TastingFlowState;
  mode?: 'admin' | 'customer';
}

const FeelZoneInner: React.FC<FeelZoneProps> = ({ flow }) => {
  const bodySelected = flow.value.body || [];
  const finishSelected = flow.value.finish || [];
  const feelingSelected = flow.value.feeling || [];
  const totalCount = bodySelected.length + finishSelected.length + feelingSelected.length;

  // Weight: radio behavior (single select)
  const selectedWeight = WEIGHTS.find(w => bodySelected.includes(w.id))?.id ?? null;

  const toggleWeight = (id: string) => {
    if (selectedWeight === id) {
      flow.toggleTerm('body', id);
    } else {
      if (selectedWeight) flow.toggleTerm('body', selectedWeight);
      flow.toggleTerm('body', id);
    }
  };

  // Finish Duration: radio behavior (single select)
  const selectedDuration = FINISH_DURATIONS.find(d => finishSelected.includes(d.id))?.id ?? null;

  const toggleDuration = (id: string) => {
    if (selectedDuration === id) {
      flow.toggleTerm('finish', id);
    } else {
      if (selectedDuration) flow.toggleTerm('finish', selectedDuration);
      flow.toggleTerm('finish', id);
    }
  };

  const handleClearAll = () => {
    for (const id of bodySelected) flow.toggleTerm('body', id);
    for (const id of finishSelected) flow.toggleTerm('finish', id);
    for (const id of feelingSelected) flow.toggleTerm('feeling', id);
  };

  return (
    <div role="group" aria-label="Feel and mouthfeel">
      {/* Section header */}
      <div className="flex items-center justify-between mb-1">
        <div
          className="text-[11px] uppercase tracking-[0.15em] text-tea-text-dim font-medium"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Feel
        </div>
        {totalCount > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-tea-text-dim hover:text-tea-text-sec transition-colors p-2 -mr-1.5"
            aria-label="Clear all feel selections"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {totalCount === 0 && (
        <p
          className="text-[11px] text-tea-text-dim italic mb-3"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          How does this tea feel — in mouth, body, and mind?
        </p>
      )}

      {/* ── Body weight — 3-segment toggle ── */}
      <div className="mb-4">
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

      {/* ── Texture ── */}
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

      {/* ── Subtle divider ── */}
      <div className="divider-warm my-4" />

      {/* ── Finish duration — segment toggle ── */}
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

      {/* ── Finish character + throat — flowing pills ── */}
      {(finishCharacterGroup || finishThroatGroup) && (
        <div className="mb-4">
          <div className="text-[9px] uppercase tracking-[0.12em] text-tea-text-dim/70 mb-1.5 font-medium">
            Character
          </div>
          <div className="flex flex-wrap gap-1.5">
            {finishCharacterGroup?.terms.map(term => {
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
            {finishThroatGroup?.terms.map(term => {
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

      {/* ── Subtle divider ── */}
      <div className="divider-warm my-4" />

      {/* ── Mood / Feeling — flowing pills by group ── */}
      <div>
        <div className="text-[9px] uppercase tracking-[0.12em] text-tea-text-dim/70 mb-2 font-medium">
          State of mind
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allFeelingTerms.map(term => {
            const isSelected = feelingSelected.includes(term.id);
            const termInfo = TERM_MAP.get(term.id);
            const TermIcon = termInfo?.icon;
            return (
              <motion.button
                key={term.id}
                type="button"
                whileTap={{ scale: 0.93 }}
                onClick={() => flow.toggleTerm('feeling', term.id)}
                className={`tag-selectable ${isSelected ? 'tag-selectable-active' : ''}`}
                style={{ fontFamily: 'var(--font-body)' }}
                aria-pressed={isSelected}
              >
                {TermIcon && (
                  <TermIcon
                    size={12}
                    className="shrink-0"
                    style={{ opacity: isSelected ? 1 : 0.4 }}
                  />
                )}
                {term.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* CSS for weight/finish segment borders */}
      <style>{`
        .weight-segment-border {
          border-right: 1px solid var(--tea-border);
        }
      `}</style>
    </div>
  );
};

export const FeelZone = React.memo(FeelZoneInner);
FeelZone.displayName = 'FeelZone';
