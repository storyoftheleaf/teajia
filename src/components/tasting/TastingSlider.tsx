import React, { useCallback, useRef } from 'react';

interface TastingSliderProps {
  label: string;
  sublabel?: string;
  value?: number;
  min?: number;
  max?: number;
  onChange: (value: number | undefined) => void;
}

/**
 * Horizontal 1-10 slider with tick marks.
 * Tap a tick to jump, or drag the thumb.
 * Tap the current value again to deselect.
 */
const TastingSliderInner: React.FC<TastingSliderProps> = ({
  label,
  sublabel,
  value,
  min = 1,
  max = 10,
  onChange,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const range = max - min;

  const valueFromClientX = useCallback(
    (clientX: number): number => {
      const rect = trackRef.current!.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(min + ratio * range);
    },
    [min, range],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const v = valueFromClientX(e.clientX);
      // Tap same value to deselect
      if (v === value) {
        onChange(undefined);
      } else {
        onChange(v);
      }
      // Haptic
      if (navigator.vibrate) navigator.vibrate(8);
    },
    [value, valueFromClientX, onChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const v = valueFromClientX(e.clientX);
      if (v !== value) {
        onChange(v);
        if (navigator.vibrate) navigator.vibrate(6);
      }
    },
    [value, valueFromClientX, onChange],
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const fillPercent = value != null ? ((value - min) / range) * 100 : 0;
  const thumbPercent = value != null ? ((value - min) / range) * 100 : -10;

  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label row */}
      <div className="flex items-baseline justify-between">
        <div>
          <span className="tasting-capture-label">{label}</span>
          {sublabel && (
            <span className="text-[10px] text-tea-text-dim ml-2 tracking-normal lowercase" style={{ fontFamily: 'var(--font-body)' }}>
              {sublabel}
            </span>
          )}
        </div>
        {value != null && (
          <span
            className="text-tea-gold text-sm font-semibold num"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {value}
          </span>
        )}
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="tasting-slider-track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value ?? undefined}
        tabIndex={0}
      >
        {value != null && (
          <>
            <div className="tasting-slider-fill" style={{ width: `${fillPercent}%` }} />
            <div className="tasting-slider-thumb" style={{ left: `${thumbPercent}%` }} />
          </>
        )}
      </div>

      {/* Tick labels */}
      <div className="tasting-slider-ticks">
        {ticks.map((t) => (
          <span
            key={t}
            className={`tasting-slider-tick ${t === value ? 'tasting-slider-tick-active' : ''}`}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
};

export const TastingSlider = React.memo(TastingSliderInner);
TastingSlider.displayName = 'TastingSlider';
