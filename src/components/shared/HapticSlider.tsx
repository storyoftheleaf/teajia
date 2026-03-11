import React, { useRef, useCallback, useEffect, useMemo } from 'react';

interface HapticSliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  snapPoints?: number[];
  size?: 'sm' | 'md';
}

export const HapticSlider: React.FC<HapticSliderProps> = ({
  min,
  max,
  step,
  value,
  onChange,
  unit = 'g',
  snapPoints,
  size = 'md',
}) => {
  const lastStepRef = useRef(value);

  const percentage = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const thumbSize = size === 'sm' ? 10 : 12;

  // Use snap points for tick marks (like Alcove), not every step
  const ticks = useMemo(() => {
    if (snapPoints) return snapPoints.filter(p => p >= min && p <= max);
    // Fallback: generate sensible ticks from step
    const points: number[] = [];
    for (let v = min; v <= max; v += step) {
      points.push(v);
    }
    return points;
  }, [min, max, step, snapPoints]);

  // Haptic feedback on step change
  useEffect(() => {
    if (value !== lastStepRef.current) {
      lastStepRef.current = value;
      if (navigator.vibrate) {
        navigator.vibrate(8);
      }
    }
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value));
  }, [onChange]);

  return (
    <div className="slider-area relative flex-1 flex flex-col select-none">
      {/* Track + Thumb */}
      <div
        className="relative w-full flex items-center group cursor-pointer"
        style={{ height: thumbSize + 8 }}
      >
        {/* Hidden native input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          className="absolute w-full h-full opacity-0 cursor-pointer z-20"
          aria-label={`Select quantity: ${value}${unit}`}
        />

        {/* Track background */}
        <div
          className="w-full relative"
          style={{
            height: 3,
            background: 'rgba(200,170,120,0.1)',
            borderRadius: 2,
          }}
        >
          {/* Gradient fill */}
          <div
            className="absolute h-full"
            style={{
              width: `${percentage}%`,
              background: 'linear-gradient(90deg, rgba(184,146,78,0.45), rgba(184,146,78,0.75))',
              borderRadius: 2,
              transition: 'width 0.075s ease',
            }}
          />

          {/* Tick marks at snap points only */}
          {ticks.map((tick) => {
            const pct = max > min ? ((tick - min) / (max - min)) * 100 : 0;
            return (
              <div
                key={tick}
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  top: -3,
                  width: 1,
                  height: 9,
                  background: value === tick
                    ? 'rgba(200,170,120,0.4)'
                    : 'var(--tea-border)',
                  transition: 'background 0.15s ease',
                  pointerEvents: 'none',
                }}
              />
            );
          })}
        </div>

        {/* Thumb */}
        <div
          className="absolute z-10 pointer-events-none"
          style={{
            left: `calc(${percentage}% - ${thumbSize / 2}px)`,
            width: thumbSize,
            height: thumbSize,
            borderRadius: '50%',
            background: '#b8924e',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            transition: 'left 0.075s ease',
          }}
        />
      </div>
    </div>
  );
};
