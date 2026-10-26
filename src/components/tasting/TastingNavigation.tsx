import React, { useEffect, useRef, useState } from 'react';
import { LogoEmblem } from '../Logos';
import { ALL_SECTIONS, type SectionId } from './TastingFlow';

interface Props {
  activeSection: SectionId | null;
  onSelect: (id: SectionId) => void;
  onClose: () => void;
}

/** The site capsule adapted for tasting; the center remains the way out. */
export function TastingNavigation({ activeSection, onSelect, onClose }: Props) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); window.dispatchEvent(new Event('teajia:tasting-closed')); }, []);
  function leave() {
    if (closing) return;
    setClosing(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = setTimeout(() => { onClose(); setClosing(false); }, reduced ? 0 : 580);
  }
  const choices = (start: number) => ALL_SECTIONS.slice(start, start + 2).map(section => (
    <button key={section.id} type="button" aria-pressed={activeSection === section.id}
      disabled={closing} onClick={() => onSelect(section.id)} className="tasting-capsule-choice">
      {section.label}
    </button>
  ));
  return <nav aria-label="Tasting sections" className={`tasting-capsule lg:hidden${closing ? ' is-closing' : ''}`}>
    <span aria-hidden="true" className="tasting-capsule-surface bottom-nav-bar" />
    <div className="tasting-capsule-wing">{choices(0)}</div>
    <button type="button" className="tasting-capsule-seal paper-surface" aria-label="Leave tasting" onClick={leave} disabled={closing}>
      <LogoEmblem size={42} color="var(--tea-text)" />
    </button>
    <div className="tasting-capsule-wing">{choices(2)}</div>
  </nav>;
}
