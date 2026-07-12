import React, { useCallback, useRef, useState } from 'react';

/**
 * GramSlider: a CONTINUOUS grams slider styled as a precision gauge. The value
 * can be any amount between the smallest and largest preset — you slide freely
 * and can rest between the marked amounts. The presets are magnetic *guides*:
 * drag near one and it gently snaps (soft snap); drag away and you keep the
 * in-between value (rounded to 5g).
 *
 * Fully controlled off `value`. Visuals: a fine engraved rail with an aged-
 * bronze fill, preset notches, the preset numbers on a scale beneath, and a
 * polished bronze knob that lifts and haloes on grab with a live value bubble.
 * All craft lives in the `.gram-slider-*` CSS; this file owns the interaction.
 */

export interface GramSliderProps {
  presets: number[];
  value: number | undefined;
  onChange: (grams: number) => void;
  className?: string;
}

const FREE_STEP = 5; // in-between values round to the nearest 5g

export const GramSlider: React.FC<GramSliderProps> = ({ presets, value, onChange, className = '' }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  if (presets.length === 0) return null;

  const min = presets[0];
  const max = presets[presets.length - 1];
  const range = Math.max(1, max - min);

  const current = value != null ? Math.min(max, Math.max(min, value)) : min;
  const fraction = (current - min) / range;
  const isPreset = value != null && presets.includes(value);
  const isSet = value != null;

  const valueFromClientX = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track) return min;
      const rect = track.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const raw = min + f * range;
      // Soft snap: magnetize to a preset only within a small window; otherwise
      // keep the free value rounded to 5g so any in-between amount is reachable.
      const snapWindow = range * 0.035;
      let best = presets[0];
      let bestDiff = Infinity;
      for (const p of presets) {
        const d = Math.abs(p - raw);
        if (d < bestDiff) {
          bestDiff = d;
          best = p;
        }
      }
      if (bestDiff <= snapWindow) return best;
      return Math.min(max, Math.max(min, Math.round(raw / FREE_STEP) * FREE_STEP));
    },
    [presets, min, max, range]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    onChange(valueFromClientX(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || e.buttons === 0) return;
    onChange(valueFromClientX(e.clientX));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Arrows nudge by 5g; Home/End jump to the ends. Fine control, not preset-locked.
    let next = current;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = current - FREE_STEP;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = current + FREE_STEP;
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else return;
    e.preventDefault();
    onChange(Math.min(max, Math.max(min, next)));
  };

  // Guide labels inside the bar, positioned by value. Drop any that would
  // crowd the previous one so they stay legible even when presets bunch up.
  const labels: { p: number; pct: number }[] = [];
  let lastPct = -Infinity;
  presets.forEach((p, i) => {
    const pct = ((p - min) / range) * 100;
    const isEnd = i === 0 || i === presets.length - 1;
    if (isEnd || pct - lastPct >= 11) {
      labels.push({ p, pct });
      lastPct = pct;
    }
  });

  const pct = fraction * 100;
  const fillSettle = dragging ? 'none' : 'width 200ms cubic-bezier(0.22, 1, 0.36, 1)';
  // While dragging the knob follows the finger (no left transition); on release
  // it eases to the settled value. Transform/shadow always transition so the
  // grab "lift" is smooth.
  const knobTransition = dragging
    ? 'transform 160ms ease, box-shadow 160ms ease'
    : 'left 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 160ms ease, box-shadow 160ms ease';

  return (
    <div className={className}>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Grams"
        aria-orientation="horizontal"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current}
        aria-valuetext={`${current} grams`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        className="gram-slider"
      >
        <div ref={trackRef} className="gram-slider-inner">
          {/* Engraved rail with the aged-bronze fill and preset notches. */}
          <div className="gram-slider-rail">
            <div
              className="gram-slider-rail-fill"
              style={{ width: `${pct}%`, transition: fillSettle }}
              aria-hidden
            />
            {presets.map((p) => (
              <span
                key={`tick-${p}`}
                className="gram-slider-tick"
                style={{ left: `${((p - min) / range) * 100}%` }}
                aria-hidden
              />
            ))}
          </div>

          {/* Live value bubble — fades in above the knob while dragging. */}
          <div
            className={`gram-slider-bubble ${dragging ? 'is-shown' : ''}`}
            style={{ left: `${pct}%` }}
            aria-hidden
          >
            {current}
            <span className="gram-slider-bubble-unit">g</span>
          </div>

          {/* Polished bronze knob (grey until a value is set). */}
          <div
            className={`gram-slider-knob ${dragging ? 'is-dragging' : ''} ${isSet ? '' : 'is-unset'}`}
            style={{ left: `${pct}%`, transition: knobTransition }}
            aria-hidden
          />

          {/* Preset numbers on a clean scale beneath the rail. */}
          <div className="gram-slider-scale">
            {labels.map(({ p, pct: lpct }, i) => (
              <span
                key={p}
                className={`gram-slider-num font-sans text-ui-11 tabular-nums ${
                  isPreset && value === p ? 'text-tea-gold font-medium' : 'text-tea-text-sec'
                }`}
                style={{
                  left: `${lpct}%`,
                  transform:
                    i === 0
                      ? 'translateX(0)'
                      : i === labels.length - 1
                      ? 'translateX(-100%)'
                      : 'translateX(-50%)',
                }}
                aria-hidden
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GramSlider;
