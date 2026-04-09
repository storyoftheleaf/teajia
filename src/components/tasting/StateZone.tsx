import React from 'react';
import { motion } from 'framer-motion';
import { X, Sun, Cloud, Moon } from 'lucide-react';
import { TASTING_TAXONOMY, TERM_MAP } from '../../data/tastingTaxonomy';
import type { TastingFlowState } from './useTastingFlow';
import type { TastingData } from '../../types';

const feelingCategory = TASTING_TAXONOMY.categories.find(c => c.id === 'feeling')!;

const CLARITY_OPTIONS: { id: TastingData['clarity']; label: string; sub: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'clear',  label: 'Clear',  sub: 'focused, bright', icon: Sun },
  { id: 'hazy',   label: 'Hazy',   sub: 'mild fuzz',       icon: Cloud },
  { id: 'cloudy', label: 'Cloudy', sub: 'heavy, slow',     icon: Moon },
];

interface StateZoneProps {
  flow: TastingFlowState;
  value: TastingData;
  onChange: (data: TastingData) => void;
}

const StateZoneInner: React.FC<StateZoneProps> = ({ flow, value, onChange }) => {
  const feelingSelected = flow.value.feeling || [];
  const totalCount =
    feelingSelected.length +
    (value.clarity ? 1 : 0) +
    (value.quality != null ? 1 : 0);

  const setClarity = (id: TastingData['clarity']) => {
    onChange({ ...value, clarity: value.clarity === id ? undefined : id });
  };

  const setQuality = (v: number | undefined) => onChange({ ...value, quality: v });

  const handleClearAll = () => {
    for (const id of feelingSelected) flow.toggleTerm('feeling', id);
    if (value.clarity) onChange({ ...value, clarity: undefined, quality: undefined });
    else if (value.quality != null) onChange({ ...value, quality: undefined });
  };

  return (
    <div role="group" aria-label="State and overall quality">
      {/* ── Clear — fades in/out ── */}
      <div className="flex justify-end mb-1 -mt-1">
        <motion.button
          type="button"
          onClick={handleClearAll}
          animate={{ opacity: totalCount > 0 ? 1 : 0 }}
          transition={{ duration: 0.18 }}
          style={{ pointerEvents: totalCount > 0 ? 'auto' : 'none' }}
          className="text-[11px] text-tea-text-dim hover:text-tea-text-sec transition-colors flex items-center gap-1 px-2 py-1"
          aria-label="Clear all state selections"
        >
          <X size={10} />
          Clear
        </motion.button>
      </div>

      {/* ── Quality 1–10 ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[13px] text-tea-text font-medium"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
          >
            Quality
          </span>
          <span
            className={`text-[11px] transition-colors ${value.quality != null ? 'text-tea-gold' : 'text-tea-text-dim'}`}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {value.quality != null ? `${value.quality}/10` : '—/10'}
          </span>
        </div>
        <div className="tasting-segment-toggle" role="radiogroup" aria-label="Quality rating">
          {[1,2,3,4,5,6,7,8,9,10].map((v, i) => {
            const isSelected = value.quality === v;
            return (
              <motion.button
                key={v}
                type="button"
                whileTap={{ scale: 0.93 }}
                onClick={() => setQuality(isSelected ? undefined : v)}
                role="radio"
                aria-checked={isSelected}
                className={`flex-1 py-3 text-[13px] font-medium transition-all duration-200 min-h-[48px] relative z-[1] ${
                  isSelected ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
                }${i < 9 ? ' weight-seg-div' : ''}`}
                style={{
                  fontFamily: 'var(--font-mono)',
                  background: isSelected
                    ? 'radial-gradient(ellipse 120% 120% at 50% 50%, rgb(var(--tea-gold-rgb) / 0.14) 0%, rgb(var(--tea-gold-rgb) / 0.04) 70%)'
                    : 'transparent',
                }}
              >
                {v}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="divider-warm my-4" />

      {/* ── Head clarity ── */}
      <div className="mb-5">
        <div
          className="text-[13px] text-tea-text font-medium mb-2"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
        >
          Head clarity
        </div>
        <div className="tasting-segment-toggle" role="radiogroup" aria-label="Head clarity">
          {CLARITY_OPTIONS.map((opt, i) => {
            const isSelected = value.clarity === opt.id;
            const Icon = opt.icon;
            return (
              <motion.button
                key={opt.id as string}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setClarity(opt.id)}
                role="radio"
                aria-checked={isSelected}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-3.5 text-center transition-all duration-200 min-h-[68px] relative z-[1] ${
                  isSelected ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
                }${i < CLARITY_OPTIONS.length - 1 ? ' weight-seg-div' : ''}`}
                style={{
                  fontFamily: 'var(--font-body)',
                  background: isSelected
                    ? 'radial-gradient(ellipse 100% 100% at 50% 50%, rgb(var(--tea-gold-rgb) / 0.12) 0%, rgb(var(--tea-gold-rgb) / 0.04) 70%)'
                    : 'transparent',
                }}
              >
                <Icon
                  size={14}
                  className={`transition-opacity ${isSelected ? 'opacity-80' : 'opacity-30'}`}
                />
                <span className="text-[14px] font-medium leading-tight">{opt.label}</span>
                <span className={`text-[11px] leading-tight ${isSelected ? 'text-tea-gold/70' : 'text-tea-text-dim'}`}>
                  {opt.sub}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="divider-warm my-4" />

      {/* ── Feeling — 2×2 quadrants ── */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 mb-5">
        {feelingCategory.groups.map(group => (
          <div key={group.label} className="rounded-xl p-2.5 bg-tea-surface/40">
            <div
              className="text-[12px] text-tea-text font-medium mb-2 pb-1 border-b border-tea-border"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
            >
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.terms.map(term => {
                const isSelected = feelingSelected.includes(term.id);
                const termInfo = TERM_MAP.get(term.id);
                const Icon = termInfo?.icon;
                return (
                  <motion.button
                    key={term.id}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => flow.toggleTerm('feeling', term.id)}
                    aria-pressed={isSelected}
                    // #4: clear bg change on select
                    className={`flex items-center gap-2 w-full text-left px-2.5 py-2 min-h-[40px] rounded-lg transition-all duration-150 ${
                      isSelected
                        ? 'bg-tea-gold/12 text-tea-gold'
                        : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-surface'
                    }`}
                    style={{ fontFamily: 'var(--font-body)', fontSize: '13px' }}
                  >
                    {Icon && (
                      // #9: raise unselected icon opacity
                      <Icon
                        size={12}
                        className={`shrink-0 transition-opacity ${isSelected ? 'opacity-80' : 'opacity-45'}`}
                      />
                    )}
                    <span className={isSelected ? 'font-medium' : ''}>{term.label}</span>
                    {isSelected && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-auto w-1.5 h-1.5 rounded-full bg-tea-gold shrink-0"
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export const StateZone = React.memo(StateZoneInner);
StateZone.displayName = 'StateZone';
