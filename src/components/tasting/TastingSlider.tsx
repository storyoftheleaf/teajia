import React, { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

interface TastingSliderProps {
  label: string;
  sublabel?: string;
  value?: number;
  min?: number;
  max?: number;
  onChange: (value: number | undefined) => void;
}

/**
 * Step-node quality scale 1–10.
 * Numbered nodes connected by a line — tap any node to select,
 * tap the active node again to deselect. Drag across nodes to scrub.
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
  const lastEmitted = useRef<number | null>(null);
  const range = max - min;
  const steps = Array.from({ length: range + 1 }, (_, i) => min + i);

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
      lastEmitted.current = null;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const v = valueFromClientX(e.clientX);
      onChange(v);
      lastEmitted.current = v;
      if (navigator.vibrate) navigator.vibrate(8);
    },
    [valueFromClientX, onChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const v = valueFromClientX(e.clientX);
      if (v !== lastEmitted.current) {
        onChange(v);
        lastEmitted.current = v;
        if (navigator.vibrate) navigator.vibrate(6);
      }
    },
    [valueFromClientX, onChange],
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
    lastEmitted.current = null;
  }, []);

  // How many nodes are "filled" (at or below selected value)
  const filledUpTo = value ?? 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Label row */}
      <div className="flex items-baseline gap-2">
        <span className="tasting-capture-label">{label}</span>
        {sublabel && (
          <span className="text-[10px] text-tea-text-dim tracking-normal lowercase" style={{ fontFamily: 'var(--font-body)' }}>
            {sublabel}
          </span>
        )}
      </div>

      {/* Node track — stop touch propagation so parent swipe handler doesn't intercept drags */}
      <div
        ref={trackRef}
        className="tasting-step-track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value ?? undefined}
        tabIndex={0}
      >
        {/* Connecting line */}
        <div className="tasting-step-line" />

        {/* Nodes — number lives inside */}
        {steps.map((step) => {
          const isFilled = step <= filledUpTo;
          const isActive = step === value;
          const pct = ((step - min) / range) * 100;
          return (
            <motion.div
              key={step}
              className={`tasting-step-node ${isFilled ? 'tasting-step-node-filled' : ''} ${isActive ? 'tasting-step-node-active' : ''}`}
              style={{ left: `${pct}%` }}
              animate={isActive ? { scale: 1 } : { scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <span className="tasting-step-number">{step}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export const TastingSlider = React.memo(TastingSliderInner);
TastingSlider.displayName = 'TastingSlider';
