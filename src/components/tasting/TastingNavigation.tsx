import React, { useEffect, useRef, useState } from 'react';
import { LogoEmblem } from '../Logos';
import { ALL_SECTIONS, type SectionId } from './TastingFlow';

interface Props {
  activeSection: SectionId | null;
  onSelect: (id: SectionId) => void;
  onClose: () => void;
  confirmBeforeClose?: boolean;
}

/** The site capsule adapted for tasting; the center remains the way out. */
export function TastingNavigation({ activeSection, onSelect, onClose, confirmBeforeClose }: Props) {
  const [closing, setClosing] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function leave() {
    if (closing) return;
    if (confirmBeforeClose) { onClose(); return; }
    const surface = nav.current?.querySelector('.tasting-capsule-surface');
    if (surface) nav.current?.style.setProperty('--tasting-closing-clip', getComputedStyle(surface).clipPath);
    setClosing(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = setTimeout(() => { onClose(); setClosing(false); }, reduced ? 0 : 660);
  }
  const choices = (start: number) => ALL_SECTIONS.slice(start, start + 2).map(section => (
    <button key={section.id} type="button" aria-pressed={activeSection === section.id}
      disabled={closing} onClick={() => onSelect(section.id)} className="tasting-capsule-choice">
      {section.label}
    </button>
  ));
  return <nav ref={nav} aria-label="Tasting sections" className={`tasting-capsule lg:hidden${closing ? ' is-closing' : ''}`}>
    <span aria-hidden="true" className="tasting-capsule-surface bottom-nav-bar" />
    <div className="tasting-capsule-wing">{choices(0)}</div>
    <button type="button" className="tasting-capsule-seal paper-surface" aria-label="Leave tasting" onClick={leave} disabled={closing}>
      <LogoEmblem size={42} color="var(--tea-text)" />
    </button>
    <div className="tasting-capsule-wing">{choices(2)}</div>
  </nav>;
}
