import React from 'react';
import { ColorSwatches } from './ColorSwatches';
import type { TastingFlowState } from './useTastingFlow';
import type { TastingData } from '../../types';

interface AppearanceZoneProps {
  flow: TastingFlowState;
  value: TastingData;
  onChange: (data: TastingData) => void;
}

const CLARITY_OPTIONS = [
  { id: 'clear' as const, label: 'Clear' },
  { id: 'bright' as const, label: 'Bright' },
  { id: 'hazy' as const, label: 'Hazy' },
  { id: 'cloudy' as const, label: 'Cloudy' },
] as const;

const AppearanceZoneInner: React.FC<AppearanceZoneProps> = ({ flow, value, onChange }) => {
  return (
    <div role="group" aria-label="Appearance: color and clarity">
      {/* Color swatches */}
      <div className="mb-4">
        <ColorSwatches flow={flow} compact />
      </div>

      <div className="divider-warm mb-4" />

      {/* Clarity */}
      <div>
        <div
          className="text-[13px] text-tea-text font-medium mb-2"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
        >
          Clarity
        </div>
        <div className="flex gap-1.5">
          {CLARITY_OPTIONS.map(opt => {
            const isSelected = value.clarity === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange({ ...value, clarity: isSelected ? undefined : opt.id as TastingData['clarity'] })}
                className={`tag-selectable flex-1 justify-center ${isSelected ? 'tag-selectable-active' : ''}`}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  ...(isSelected && {
                    background: 'rgb(var(--tea-gold-rgb) / 0.22)',
                    color: 'var(--tea-gold)',
                    fontWeight: 600,
                  }),
                }}
                aria-pressed={isSelected}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="divider-warm my-4" />

      {/* Brewing context */}
      <div>
        <div
          className="text-[13px] text-tea-text font-medium mb-2"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
        >
          Brewing
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder="°C"
            value={value.brewingTemp ?? ''}
            onChange={(e) => onChange({ ...value, brewingTemp: e.target.value ? Number(e.target.value) : undefined })}
            className="w-14 bg-tea-elevated text-tea-text text-[12px] px-2 py-1.5 rounded-lg border border-tea-border outline-none focus:border-tea-gold/40 tabular-nums placeholder:text-tea-text-dim [&::-webkit-inner-spin-button]:appearance-none"
          />
          <input
            type="text"
            placeholder="time"
            value={value.brewingTime ?? ''}
            onChange={(e) => onChange({ ...value, brewingTime: e.target.value || undefined })}
            className="w-16 bg-tea-elevated text-tea-text text-[12px] px-2 py-1.5 rounded-lg border border-tea-border outline-none focus:border-tea-gold/40 placeholder:text-tea-text-dim"
          />
          <input
            type="text"
            placeholder="vessel"
            value={value.brewingVessel ?? ''}
            onChange={(e) => onChange({ ...value, brewingVessel: e.target.value || undefined })}
            className="flex-1 min-w-0 bg-tea-elevated text-tea-text text-[12px] px-2 py-1.5 rounded-lg border border-tea-border outline-none focus:border-tea-gold/40 placeholder:text-tea-text-dim"
          />
        </div>
      </div>
    </div>
  );
};

export const AppearanceZone = React.memo(AppearanceZoneInner);
AppearanceZone.displayName = 'AppearanceZone';
