import React from 'react';
import { motion } from 'framer-motion';
import type { TastingData } from '../../types';

type Cleanliness = 'clean' | 'hazy' | 'off';

const CLEANLINESS_OPTIONS: { id: Cleanliness; label: string; sub: string }[] = [
  { id: 'clean', label: 'Clean', sub: 'pure, clear' },
  { id: 'hazy', label: 'Hazy', sub: 'some edge' },
  { id: 'off', label: 'Off', sub: 'not clean' },
];

const QUALITY_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface ResponseZoneProps {
  value: TastingData;
  onChange: (data: TastingData) => void;
}

const ResponseZoneInner: React.FC<ResponseZoneProps> = ({ value, onChange }) => {
  const setQuality = (v: number | undefined) => onChange({ ...value, quality: v });

  const setCleanliness = (v: Cleanliness) => {
    onChange({
      ...value,
      cleanliness: value.cleanliness === v ? undefined : v,
    });
  };

  return (
    <div role="group" aria-label="First response">
      {/* ── Quality 1–10 ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[13px] text-tea-text font-medium"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
          >
            Quality
          </span>
          <span
            className={`text-[11px] num transition-colors ${value.quality != null ? 'text-tea-gold' : 'text-tea-text-dim'}`}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {value.quality != null ? `${value.quality}/10` : '—/10'}
          </span>
        </div>

        <div className="tasting-segment-toggle" role="radiogroup" aria-label="Quality rating">
          {QUALITY_STEPS.map((v, i) => {
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

      {/* ── Cleanliness 3-card ── */}
      <div>
        <div
          className="text-[11px] uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Cleanliness
        </div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Cleanliness">
          {CLEANLINESS_OPTIONS.map((opt) => {
            const isSelected = value.cleanliness === opt.id;
            return (
              <motion.button
                key={opt.id}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setCleanliness(opt.id)}
                role="radio"
                aria-checked={isSelected}
                className={`flex flex-col items-center justify-center py-3.5 rounded-xl text-center transition-all duration-200 min-h-[60px] ${
                  isSelected
                    ? 'bg-tea-gold/20 ring-1 ring-inset ring-tea-gold/50 text-tea-gold'
                    : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'
                }`}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <span className="text-[14px] font-medium leading-tight">{opt.label}</span>
                <span className={`text-[11px] mt-0.5 leading-tight ${isSelected ? 'text-tea-gold/70' : 'text-tea-text-dim'}`}>
                  {opt.sub}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export const ResponseZone = React.memo(ResponseZoneInner);
ResponseZone.displayName = 'ResponseZone';
