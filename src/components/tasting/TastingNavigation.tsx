import React from 'react';
import { LogoEmblem } from '../Logos';
import { ALL_SECTIONS, type SectionId } from './TastingFlow';

interface Props {
  activeSection: SectionId | null;
  onSelect: (id: SectionId) => void;
  onClose: () => void;
}

/** The site capsule adapted for tasting; the center remains the way out. */
export function TastingNavigation({ activeSection, onSelect, onClose }: Props) {
  const choices = (start: number) => ALL_SECTIONS.slice(start, start + 2).map(section => (
    <button key={section.id} type="button" aria-pressed={activeSection === section.id}
      onClick={() => onSelect(section.id)} className="tasting-capsule-choice">
      {section.label}
    </button>
  ));
  return <nav aria-label="Tasting sections" className="tasting-capsule lg:hidden">
    <span aria-hidden="true" className="tasting-capsule-surface bottom-nav-bar" />
    <div className="tasting-capsule-wing">{choices(0)}</div>
    <button type="button" className="tasting-capsule-seal paper-surface" aria-label="Leave tasting" onClick={onClose}>
      <LogoEmblem size={42} color="var(--tea-text)" />
    </button>
    <div className="tasting-capsule-wing">{choices(2)}</div>
  </nav>;
}
