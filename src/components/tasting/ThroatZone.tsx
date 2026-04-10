import React from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles, Wind, ArrowDown, Layers, Droplets } from 'lucide-react';
import type { TastingFlowState } from './useTastingFlow';
import type { TastingData } from '../../types';

type Cleanliness = 'clean' | 'some-edge' | 'rough';

const CLEANLINESS_OPTIONS: { id: Cleanliness; label: string; sub: string }[] = [
  { id: 'clean',     label: 'Clean',     sub: 'clear, pure' },
  { id: 'some-edge', label: 'Some edge', sub: 'slight roughness' },
  { id: 'rough',     label: 'Rough',     sub: 'harsh, unclean' },
];

// Fix #1: 3 options — "Long" removed, "Lingering" covers extended finish
const FINISH_DURATIONS = [
  { id: 'finish-short',  label: 'Short' },
  { id: 'finish-medium', label: 'Medium' },
  { id: 'lingering',     label: 'Lingering' },
] as const;

// Fix #2: 6 options for clean 3×2 grid (added "Bitter")
const FINISH_CHARACTER = [
  { id: 'finish-clean',   label: 'Clean' },
  { id: 'finish-dry',     label: 'Dry' },
  { id: 'finish-bitter',  label: 'Bitter' },
  { id: 'finish-cooling', label: 'Cooling' },
  { id: 'finish-warming', label: 'Warming' },
  { id: 'sweet-return',   label: 'Sweet return' },
] as const;

const THROAT_TERMS: { id: string; label: string; sub: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'throat-opening', label: 'Opens',       sub: 'throat relaxes',   icon: Wind },
  { id: 'throat-depth',   label: 'Deep reach',  sub: 'travels deep',     icon: ArrowDown },
  { id: 'coating',        label: 'Coats',        sub: 'lingers in throat',icon: Layers },
  { id: 'salivating',     label: 'Mouth waters', sub: '生津 · saliva',    icon: Droplets },
];

interface ThroatZoneProps {
  flow: TastingFlowState;
  value: TastingData;
  onChange: (data: TastingData) => void;
}

const ThroatZoneInner: React.FC<ThroatZoneProps> = ({ flow, value, onChange }) => {
  const finishSelected = flow.value.finish || [];
  const selectedDuration = FINISH_DURATIONS.find(d => finishSelected.includes(d.id))?.id ?? null;

  const totalCount =
    THROAT_TERMS.filter(t => finishSelected.includes(t.id)).length +
    (value.cleanliness ? 1 : 0) +
    finishSelected.filter(id =>
      FINISH_DURATIONS.some(d => d.id === id) || FINISH_CHARACTER.some(c => c.id === id)
    ).length +
    (value.huiGan ? 1 : 0);

  const setCleanliness = (v: Cleanliness) => {
    onChange({ ...value, cleanliness: value.cleanliness === v ? undefined : v });
  };

  const toggleDuration = (id: string) => {
    if (selectedDuration === id) {
      flow.toggleTerm('finish', id);
    } else {
      if (selectedDuration) flow.toggleTerm('finish', selectedDuration);
      flow.toggleTerm('finish', id);
    }
  };

  const toggleHuiGan = () => {
    onChange({ ...value, huiGan: !value.huiGan });
  };

  const handleClearAll = () => {
    for (const id of [...finishSelected]) flow.toggleTerm('finish', id);
    if (value.cleanliness || value.huiGan) {
      onChange({ ...value, cleanliness: undefined, huiGan: false });
    }
  };

  return (
    <div role="group" aria-label="Finish, cleanliness, and throat sensation">
      <div className="flex justify-end mb-1 -mt-1">
        <motion.button
          type="button"
          onClick={handleClearAll}
          animate={{ opacity: totalCount > 0 ? 1 : 0 }}
          transition={{ duration: 0.18 }}
          style={{ pointerEvents: totalCount > 0 ? 'auto' : 'none' }}
          className="text-[11px] text-tea-text-dim hover:text-tea-text-sec transition-colors flex items-center gap-1 px-2 py-1"
          aria-label="Clear all finish selections"
        >
          <X size={10} />
          Clear
        </motion.button>
      </div>

      {/* ── Cleanliness ── Fix #6: mb-4 instead of mb-5 to tighten gap before divider */}
      <div className="mb-4">
        <div
          className="text-[11px] uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Cleanliness
        </div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Cleanliness">
          {CLEANLINESS_OPTIONS.map(opt => {
            const isSelected = value.cleanliness === opt.id;
            return (
              <motion.button
                key={opt.id}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setCleanliness(opt.id)}
                role="radio"
                aria-checked={isSelected}
                className={`flex flex-col items-center justify-center px-2 py-3 rounded-xl min-h-[60px] text-center transition-all duration-200 ${
                  isSelected
                    ? 'bg-tea-gold/20 ring-1 ring-inset ring-tea-gold/50 text-tea-gold'
                    : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'
                }`}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <span className="text-[13px] font-medium leading-tight">{opt.label}</span>
                <span className={`text-[11px] leading-tight mt-0.5 ${isSelected ? 'text-tea-gold/70' : 'text-tea-text-dim'}`}>
                  {opt.sub}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="divider-warm my-4" />

      {/* ── Finish: duration + character as one block ── */}
      <div className="mb-4">
        <div
          className="text-[11px] uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Finish
        </div>
        {/* Fix #1: 3-item toggle — no more clipping */}
        <div className="tasting-segment-toggle mb-3" role="radiogroup" aria-label="Finish duration">
          {FINISH_DURATIONS.map((d, i) => (
            <motion.button
              key={d.id}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => toggleDuration(d.id)}
              role="radio"
              aria-checked={selectedDuration === d.id}
              className={`flex-1 py-2.5 text-[14px] font-medium transition-all duration-200 min-h-[44px] relative z-[1] ${
                selectedDuration === d.id
                  ? 'text-tea-gold'
                  : 'text-tea-text-sec hover:text-tea-text'
              }${i < FINISH_DURATIONS.length - 1 ? ' weight-seg-div' : ''}`}
              style={{
                fontFamily: 'var(--font-body)',
                background: selectedDuration === d.id
                  ? 'radial-gradient(ellipse 100% 100% at 50% 50%, rgb(var(--tea-gold-rgb) / 0.12) 0%, rgb(var(--tea-gold-rgb) / 0.04) 70%)'
                  : 'transparent',
              }}
            >
              {d.label}
            </motion.button>
          ))}
        </div>
        {/* Finish character — lightweight tag pills, flex-wrap */}
        <div className="flex flex-wrap gap-1.5">
          {FINISH_CHARACTER.map(term => {
            const isSelected = finishSelected.includes(term.id);
            return (
              <motion.button
                key={term.id}
                type="button"
                whileTap={{ scale: 0.93 }}
                whileHover={{ scale: 1.04 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                onClick={() => flow.toggleTerm('finish', term.id)}
                aria-pressed={isSelected}
                className={`tag-selectable text-[13px] ${isSelected ? 'tag-selectable-active' : ''}`}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {term.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="divider-warm my-4" />

      {/* ── Throat feel ── Fix #4: renamed from "Throat" */}
      <div className="mb-4">
        <div
          className="text-[11px] uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Throat feel
        </div>
        <div className="grid grid-cols-2 gap-2">
          {THROAT_TERMS.map(term => {
            const isSelected = finishSelected.includes(term.id);
            const Icon = term.icon;
            return (
              <motion.button
                key={term.id}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => flow.toggleTerm('finish', term.id)}
                aria-pressed={isSelected}
                className={`flex flex-col items-start px-3 py-3 rounded-xl min-h-[60px] transition-all duration-200 ${
                  isSelected
                    ? 'bg-tea-gold/20 ring-1 ring-inset ring-tea-gold/50 text-tea-gold'
                    : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'
                }`}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon
                    size={12}
                    className={`shrink-0 transition-opacity ${isSelected ? 'opacity-70' : 'opacity-30'}`}
                  />
                  <span className="text-[13px] font-medium leading-tight">{term.label}</span>
                </div>
                <span className={`text-[11px] leading-tight pl-[18px] ${isSelected ? 'text-tea-gold/70' : 'text-tea-text-dim'}`}>
                  {term.sub}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="divider-warm my-4" />

      {/* ── Hui Gan ── Fix #5: pb-2 gives visual closure above nav */}
      <div className="pb-2">
        <div
          className="text-[11px] uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-3"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          回甘 Returning sweetness
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={toggleHuiGan}
          aria-pressed={!!value.huiGan}
          className={`tasting-huigan-toggle w-full justify-center min-h-[48px] ${value.huiGan ? 'tasting-huigan-toggle-active' : ''}`}
        >
          <motion.span
            animate={{ rotate: value.huiGan ? [0, -10, 10, 0] : 0 }}
            transition={{ duration: 0.4 }}
          >
            <Sparkles size={13} className={`shrink-0 transition-opacity ${value.huiGan ? 'opacity-100' : 'opacity-30'}`} />
          </motion.span>
          {value.huiGan ? '回甘 · Hui gan present' : '回甘 · Hui gan present?'}
        </motion.button>
      </div>

    </div>
  );
};

export const ThroatZone = React.memo(ThroatZoneInner);
ThroatZone.displayName = 'ThroatZone';
