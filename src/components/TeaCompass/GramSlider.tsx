import React, { useCallback, useRef } from 'react';

/**
 * GramSlider: a stepped/snap slider indexed into a form's gram presets
 * (e.g. Loose: [50, 75, 100, 150, 300, 600]). Position is the preset's
 * INDEX in the array, not a continuous 0-N range, because presets are
 * non-linear (Cake jumps 100 → 357 → 400).
 *
 * Fully controlled: derives thumb position from `value` + `presets` on
 * every render, so it reacts automatically when the caller resets grams
 * on a form change (see CaptureCard.handleFormSelect).
 *
 * When `value` doesn't match any preset (typed manually in the paired
 * number input), no stop is highlighted; the fill/thumb render at the
 * nearest stop but muted. The slider never calls onChange on its own in
 * this state; it only fires on explicit drag/tap/keyboard interaction.
 *
 * Built as a standalone component so the upcoming quick-sale sheet can
 * reuse it.
 */

export interface GramSliderProps {
  presets: number[];
  value: number | undefined;
  onChange: (grams: number) => void;
  className?: string;
}

function nearestPresetIndex(value: number | undefined, presets: number[]): number {
  if (value == null || presets.length === 0) return 0;
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < presets.length; i++) {
    const diff = Math.abs(presets[i] - value);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

export const GramSlider: React.FC<GramSliderProps> = ({ presets, value, onChange, className = '' }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  // Tracks the last committed index during a drag so we only call
  // onChange when the pointer actually crosses into a new stop.
  const dragIndexRef = useRef<number | null>(null);

  if (presets.length === 0) return null;

  const lastIndex = presets.length - 1;
  const exactIndex = value != null ? presets.indexOf(value) : -1;
  const isExact = exactIndex !== -1;
  const activeIndex = isExact ? exactIndex : nearestPresetIndex(value, presets);
  const fraction = lastIndex > 0 ? activeIndex / lastIndex : 0;

  const indexFromClientX = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track || lastIndex <= 0) return 0;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return Math.round(ratio * lastIndex);
    },
    [lastIndex]
  );

  const commitIndex = useCallback(
    (idx: number) => {
      const clamped = Math.min(lastIndex, Math.max(0, idx));
      if (dragIndexRef.current === clamped) return;
      dragIndexRef.current = clamped;
      onChange(presets[clamped]);
    },
    [presets, lastIndex, onChange]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragIndexRef.current = null;
    commitIndex(indexFromClientX(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return;
    commitIndex(indexFromClientX(e.clientX));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragIndexRef.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next = activeIndex;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = activeIndex - 1;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = activeIndex + 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = lastIndex;
    else return;
    e.preventDefault();
    const clamped = Math.min(lastIndex, Math.max(0, next));
    onChange(presets[clamped]);
  };

  const valueText = value != null ? `${value} grams` : `${presets[activeIndex]} grams (default)`;

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Grams"
      aria-orientation="horizontal"
      aria-valuemin={presets[0]}
      aria-valuemax={presets[lastIndex]}
      aria-valuenow={value ?? presets[activeIndex]}
      aria-valuetext={valueText}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      className={`gram-slider-track touch-none ${className}`}
    >
      <div
        className={`gram-slider-fill ${isExact ? 'bg-tea-gold/14' : 'bg-tea-gold/6'}`}
        style={{ width: `${fraction * 100}%` }}
        aria-hidden
      />
      <div
        className={`gram-slider-thumb ${isExact ? 'bg-tea-gold' : 'bg-tea-text-dim opacity-60'}`}
        style={{ left: `${fraction * 100}%` }}
        aria-hidden
      />
      <div className="gram-slider-labels">
        {presets.map((g, i) => (
          <span
            key={g}
            className={`gram-slider-label text-ui-10 ${
              i === exactIndex ? 'text-tea-gold font-medium' : 'text-tea-text-sec'
            }`}
            style={{
              left: lastIndex > 0 ? `${(i / lastIndex) * 100}%` : '50%',
              transform: i === 0 ? 'translateX(2px)' : i === lastIndex ? 'translateX(calc(-100% - 2px))' : 'translateX(-50%)',
            }}
            aria-hidden
          >
            {g}
          </span>
        ))}
      </div>
    </div>
  );
};

export default GramSlider;
