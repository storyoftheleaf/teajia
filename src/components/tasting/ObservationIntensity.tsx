import React, { useEffect, useId, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { TastingData } from '../../types';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

export type ObservationLevel = NonNullable<TastingData['observationIntensity']>[string];
export function intensityPosition(level?: ObservationLevel): number {
  return typeof level === 'number' ? level : level === 'Strong' ? 5 : level === 'Moderate' ? 3 : 1;
}
export function intensityLabel(level: ObservationLevel): string {
  return typeof level === 'number' ? `${level}/5` : level;
}
export function withObservationIntensity(value: TastingData, key: string, level: ObservationLevel | undefined): TastingData {
  const observationIntensity = { ...value.observationIntensity };
  if (level) observationIntensity[key] = level;
  else delete observationIntensity[key];
  return { ...value, observationIntensity };
}

export function ObservationIntensity({ label, intensity, onChange }: {
  label: string;
  intensity?: ObservationLevel;
  onChange: (level: ObservationLevel | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const position = intensityPosition(intensity);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return <div ref={host} className="observation-intensity">
    <button ref={trigger} type="button" className={`${TYPOGRAPHY_CLASSES.accountMeta} observation-intensity-trigger tap-target flex min-h-11 items-center justify-center rounded-md px-2 text-tea-text-sec focus-visible:ring-2 focus-visible:ring-tea-gold`} aria-label={`Intensity for ${label}${intensity ? `: ${intensityLabel(intensity)}` : ''}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      {intensity ? <span>{intensityLabel(intensity)}</span> : <SlidersHorizontal size={13} aria-hidden="true" />}
    </button>
    {open && <div id={id} className="observation-intensity-panel" role="group" aria-label={`${label} intensity`}>
      <div className="observation-strength-control" style={{ '--strength-fill': `${((position - 1) / 4) * 100}%` } as React.CSSProperties}>
      <div className="observation-strength-ramp" aria-hidden="true"><i /></div>
      <input type="range" min="1" max="5" step="1" value={position} aria-label={`${label} strength`} aria-valuetext={intensity === undefined ? 'Not rated' : `${position} of 5, ${position === 1 ? 'slight' : position === 5 ? 'strong' : 'increasing strength'}`}
        onChange={event => onChange(Number(event.target.value) as ObservationLevel)}
        onPointerUp={event => { onChange(Number(event.currentTarget.value) as ObservationLevel); setOpen(false); trigger.current?.focus(); }}
      />
      </div>
      <div className="observation-strength-labels"><span>1 · Low</span><span>5 · High</span></div>
      {intensity !== undefined && <button type="button" className="observation-strength-clear" aria-label={`Clear intensity for ${label}`} onClick={() => { onChange(undefined); setOpen(false); trigger.current?.focus(); }}>Clear strength</button>}
    </div>}
  </div>;
}
