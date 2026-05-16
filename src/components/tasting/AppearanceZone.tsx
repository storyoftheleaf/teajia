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

const VESSEL_OPTIONS = [
  { id: 'Gaiwan', label: 'Gaiwan' },
  { id: 'Yixing', label: 'Yixing' },
  { id: 'Glass', label: 'Glass' },
  { id: 'Teapot', label: 'Teapot' },
  { id: 'Mug', label: 'Mug' },
];

const AppearanceZoneInner: React.FC<AppearanceZoneProps> = ({ flow, value, onChange }) => {
  return (
    <div role="group" aria-label="Appearance: color and clarity">
      {/* Color swatches */}
      <div className="mb-4">
        <ColorSwatches flow={flow} compact />
      </div>

      <div className="divider-warm mb-4" />

      {/* Clarity */}
      <div className="mb-4">
        <div
          className="text-ui-13 text-tea-text font-medium mb-2"
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

      <div className="divider-warm mb-4" />

      {/* Vessel — primary brewing field */}
      <div>
        <div
          className="text-ui-13 text-tea-text font-medium mb-2"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
        >
          Vessel
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {VESSEL_OPTIONS.map(opt => {
            const isSelected = value.brewingVessel === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange({ ...value, brewingVessel: isSelected ? undefined : opt.id })}
                className={`tag-selectable ${isSelected ? 'tag-selectable-active' : ''}`}
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
          {/* Custom vessel — show only if current value isn't one of the presets */}
          {value.brewingVessel && !VESSEL_OPTIONS.find(o => o.id === value.brewingVessel) && (
            <button
              type="button"
              onClick={() => onChange({ ...value, brewingVessel: undefined })}
              className="tag-selectable tag-selectable-active"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                background: 'rgb(var(--tea-gold-rgb) / 0.22)',
                color: 'var(--tea-gold)',
                fontWeight: 600,
              }}
              aria-pressed
            >
              {value.brewingVessel}
            </button>
          )}
        </div>

        {/* Temperature + steep time as compact secondary row */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <span
              className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Temp
            </span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="°C"
              value={value.brewingTemp ?? ''}
              onChange={(e) => onChange({ ...value, brewingTemp: e.target.value ? Number(e.target.value) : undefined })}
              className="w-14 bg-tea-elevated text-tea-text text-ui-12 px-2 py-1.5 rounded-xl border border-tea-border outline-none focus:border-tea-gold/40 tabular-nums placeholder:text-tea-text-dim [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <span
              className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Time
            </span>
            <input
              type="text"
              placeholder="30s"
              value={value.brewingTime ?? ''}
              onChange={(e) => onChange({ ...value, brewingTime: e.target.value || undefined })}
              className="w-16 bg-tea-elevated text-tea-text text-ui-12 px-2 py-1.5 rounded-xl border border-tea-border outline-none focus:border-tea-gold/40 placeholder:text-tea-text-dim"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const AppearanceZone = React.memo(AppearanceZoneInner);
AppearanceZone.displayName = 'AppearanceZone';
