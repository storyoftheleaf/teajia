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

  const percentage = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const thumbSize = size === 'sm' ? 10 : 12;
  const trackHeight = size === 'sm' ? 4 : 5;

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
    <div className="slider-area relative flex-1 flex flex-col gap-1.5 select-none">
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
          className="w-full bg-tea-gold/25 relative rounded-full overflow-hidden"
          style={{ height: trackHeight }}
        >
          {/* Fill */}
          <div
            className={`absolute h-full ${accentColor} opacity-60 rounded-full transition-[width] duration-75`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Thumb */}
        <div
          className="absolute z-10 pointer-events-none transition-transform duration-75 group-active:scale-[1.3]"
          style={{
            left: `calc(${percentage}% - ${thumbSize / 2}px)`,
            width: thumbSize,
            height: thumbSize,
          }}
        >
          <div
            className="w-full h-full bg-tea-gold rounded-full shadow-sm transition-shadow group-active:shadow-md"
          />
        </div>
      </div>

      {/* Min and max labels */}
      <div className="flex justify-between px-0.5">
        <span className="text-[9px] font-mono text-tea-text/30">{min}{unit}</span>
        <span className="text-[9px] font-mono text-tea-text/30">{max}{unit}</span>
      </div>
    </div>
  );
};
