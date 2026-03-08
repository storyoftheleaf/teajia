import React, { useRef, useCallback, useEffect } from 'react';

interface HapticSliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  accentColor?: string;
  size?: 'sm' | 'md';
}

export const HapticSlider: React.FC<HapticSliderProps> = ({
  min,
  max,
  step,
  value,
  onChange,
  unit = 'g',
  accentColor = 'bg-tea-gold',
  size = 'md',
}) => {
  const lastStepRef = useRef(value);
  const trackRef = useRef<HTMLDivElement>(null);

  const steps = Math.floor((max - min) / step) + 1;
  const percentage = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const thumbSize = size === 'sm' ? 10 : 14;
  const trackHeight = size === 'sm' ? 2 : 3;

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

  // Generate tick positions — show at most 10 ticks to avoid clutter
  const tickInterval = steps > 10 ? Math.ceil(steps / 8) : 1;
  const ticks: number[] = [];
  for (let i = 0; i < steps; i++) {
    if (i % tickInterval === 0 || i === steps - 1) {
      ticks.push(min + i * step);
    }
  }

  return (
    <div className="slider-area relative flex-1 flex flex-col gap-1 select-none">
      {/* Track + Thumb */}
      <div
        ref={trackRef}
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
          className="w-full bg-tea-text/15 relative rounded-full overflow-hidden"
          style={{ height: trackHeight }}
        >
          {/* Fill */}
          <div
            className={`absolute h-full ${accentColor} rounded-full transition-[width] duration-75`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Tick marks */}
        <div className="absolute w-full pointer-events-none" style={{ top: '50%' }}>
          {ticks.map((tickValue) => {
            const tickPercent = ((tickValue - min) / (max - min)) * 100;
            const isActive = tickValue <= value;
            return (
              <div
                key={tickValue}
                className={`absolute transition-all duration-100 rounded-full ${
                  isActive ? 'bg-tea-text/50' : 'bg-tea-text/15'
                }`}
                style={{
                  left: `${tickPercent}%`,
                  width: 2,
                  height: isActive ? 6 : 4,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            );
          })}
        </div>

        {/* Thumb */}
        <div
          className="absolute z-10 pointer-events-none transition-transform duration-75 group-active:scale-[1.4]"
          style={{
            left: `calc(${percentage}% - ${thumbSize / 2}px)`,
            width: thumbSize,
            height: thumbSize,
          }}
        >
          <div
            className="w-full h-full bg-tea-bg rounded-full shadow-lg ring-2 ring-tea-text/20 transition-shadow group-active:shadow-xl group-active:ring-tea-gold/40"
          />
          {/* Pulse animation on step */}
          <div
            key={value}
            className="absolute inset-0 rounded-full bg-tea-bg/30 animate-[scaleIn_0.15s_ease-out]"
          />
        </div>
      </div>

      {/* Step labels (min and max) */}
      <div className="flex justify-between px-0.5">
        <span className="text-[9px] font-mono text-tea-text/30">{min}{unit}</span>
        <span className="text-[9px] font-mono text-tea-text/30">{max}{unit}</span>
      </div>
    </div>
  );
};
