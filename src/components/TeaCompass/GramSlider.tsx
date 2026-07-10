import React, { useCallback, useRef, useState } from 'react';

/**
 * GramSlider: a stepped slider indexed into a form's gram presets
 * (e.g. Loose: [50, 75, 100, 150, 300, 600]). The committed VALUE always
 * lands on a preset (positions are non-linear — Cake jumps 100 → 357 → 400),
 * but the thumb moves with a *soft snap*: while dragging it follows the finger
 * continuously, and on release it eases to the nearest stop rather than
 * jumping there instantly.
 *
 * Fully controlled: derives the settled thumb position from `value` + `presets`
 * on every render, so it reacts when the caller resets grams on a form change
 * (see CaptureCard.handleFormSelect).
 *
 * When `value` doesn't match any preset (typed manually in the paired number
 * input), the thumb rests at the nearest stop, muted, and no stop is
 * highlighted. The slider only fires onChange on explicit interaction.
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
  // Last committed index during a drag, so onChange only fires when the pointer
  // actually crosses into a new stop (not on every sub-pixel move).
  const dragIndexRef = useRef<number | null>(null);
  // Raw 0..1 pointer position while dragging. null = not dragging, so the thumb
  // sits at the settled stop and the release transition eases it there.
  const [dragFraction, setDragFraction] = useState<number | null>(null);

  if (presets.length === 0) return null;

  const lastIndex = presets.length - 1;
  const exactIndex = value != null ? presets.indexOf(value) : -1;
  const isExact = exactIndex !== -1;
  const activeIndex = isExact ? exactIndex : nearestPresetIndex(value, presets);
  const settledFraction = lastIndex > 0 ? activeIndex / lastIndex : 0;

  const isDragging = dragFraction != null;
  const posFraction = isDragging ? dragFraction : settledFraction;
  const pct = posFraction * 100;

  const rawFractionFromClientX = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  const commitFromFraction = useCallback(
    (frac: number) => {
      if (lastIndex <= 0) return;
      const clamped = Math.min(lastIndex, Math.max(0, Math.round(frac * lastIndex)));
      if (dragIndexRef.current === clamped) return;
      dragIndexRef.current = clamped;
      onChange(presets[clamped]);
    },
    [presets, lastIndex, onChange]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragIndexRef.current = null;
    const frac = rawFractionFromClientX(e.clientX);
    setDragFraction(frac);
    commitFromFraction(frac);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0 || dragFraction == null) return;
    const frac = rawFractionFromClientX(e.clientX);
    setDragFraction(frac);
    commitFromFraction(frac);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragIndexRef.current = null;
    setDragFraction(null); // soft snap: thumb eases from here to the settled stop
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next = activeIndex;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = activeIndex - 1;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = activeIndex + 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = lastIndex;
    else return;
    e.preventDefault();
    onChange(presets[Math.min(lastIndex, Math.max(0, next))]);
  };

  const valueText = value != null ? `${value} grams` : `${presets[activeIndex]} grams (default)`;
  // Follow the finger 1:1 while dragging; ease softly to the stop on release.
  const settleTransition = isDragging ? 'none' : 'left 260ms cubic-bezier(0.22, 1, 0.36, 1)';
  const fillTransition = isDragging ? 'none' : 'width 260ms cubic-bezier(0.22, 1, 0.36, 1)';

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
      className={`gram-slider-track touch-none ${className}`}
    >
      <div
        className={`gram-slider-fill ${isExact || isDragging ? 'gram-slider-fill-on' : 'gram-slider-fill-off'}`}
        style={{ width: `${pct}%`, transition: fillTransition }}
        aria-hidden
      />
      <div
        className={`gram-slider-thumb ${isExact || isDragging ? 'gram-slider-thumb-on' : 'gram-slider-thumb-off'}`}
        style={{ left: `${pct}%`, transition: settleTransition }}
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
