import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { TastingData } from '../../types';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

export type ObservationLevel = 'Slight' | 'Moderate' | 'Strong';
const LEVELS: ObservationLevel[] = ['Slight', 'Moderate', 'Strong'];

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
  const popover = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    if (!open) { setOffset(0); return; }
    const fit = () => {
      const element = popover.current;
      if (!element) return;
      // Measure the anchor without the previous correction, then fit to the screen.
      const rect = element.getBoundingClientRect();
      const translated = Number(element.dataset.offset ?? 0);
      const left = rect.left - translated;
      const right = rect.right - translated;
      const edge = 8;
      setOffset(left < edge ? edge - left : right > window.innerWidth - edge ? window.innerWidth - edge - right : 0);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [open]);
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
  return <div ref={host} className="observation-intensity relative shrink-0">
    <button ref={trigger} type="button" className={`${TYPOGRAPHY_CLASSES.accountMeta} observation-intensity-trigger tap-target flex min-h-11 items-center justify-center gap-1 rounded-md px-2 text-tea-text-sec focus-visible:ring-2 focus-visible:ring-tea-gold`} aria-label={`Intensity for ${label}${intensity ? `: ${intensity}` : ''}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      {intensity ? <span>{intensity}</span> : <SlidersHorizontal size={13} aria-hidden="true" />}
    </button>
    {open && <div ref={popover} data-offset={offset} style={{ transform: `translateX(${offset}px)` }} id={id} className="observation-intensity-popover absolute right-0 top-full z-20 flex w-max max-w-[85vw] gap-1 rounded-xl border border-tea-border bg-tea-elevated p-1 shadow-lg" role="group" aria-label={`${label} intensity`}>
      {LEVELS.map(level => <button key={level} type="button" aria-pressed={intensity === level} className={`${TYPOGRAPHY_CLASSES.link} min-h-11 rounded-md px-2 text-tea-text hover:bg-tea-accent-sub focus-visible:ring-2 focus-visible:ring-tea-gold`} onClick={() => { onChange(level === intensity ? undefined : level); setOpen(false); trigger.current?.focus(); }}>{level}</button>)}
    </div>}
  </div>;
}
