import React from 'react';
import { AdviseProject } from '../../types/advise';

const TYPE_LABEL: Record<AdviseProject['type'], string> = {
  space: 'Space',
  event: 'Event',
  journey: 'Journey',
};

interface ProjectPlaceholderProps {
  project: Pick<AdviseProject, 'name' | 'type'>;
  variant?: 'card' | 'hero';
  className?: string;
}

/**
 * Minimal SVG placeholder used when an advise project has no heroImage.
 * Two warm tea-bg layers, a single hairline rule, the project's first
 * letter, and the type label. No photography, no faux-detail.
 *
 * Swap to real imagery by populating `heroImage` on the AdviseProject.
 */
export const ProjectPlaceholder: React.FC<ProjectPlaceholderProps> = ({ project, variant = 'card', className }) => {
  const initial = project.name.trim().charAt(0).toUpperCase() || '·';
  const label = TYPE_LABEL[project.type];
  const isHero = variant === 'hero';

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${className ?? ''}`}
      role="img"
      aria-label={`${project.name} — ${label}`}
      style={{ aspectRatio: isHero ? undefined : '16 / 10' }}
    >
      <div className="absolute inset-0 bg-tea-elevated" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 30% 20%, rgb(var(--tea-gold-rgb) / 0.06), transparent 60%)',
        }}
      />
      <div className="absolute inset-x-8 top-1/2 h-px bg-tea-border/60" />
      <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
        <span
          className={`font-light text-tea-gold/70 leading-none ${isHero ? 'text-[18vw] md:text-[140px]' : 'text-[64px] md:text-[88px]'}`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {initial}
        </span>
        <span
          className={`mt-3 uppercase tracking-[0.35em] text-tea-text-dim ${isHero ? 'text-xs md:text-sm' : 'text-[10px]'}`}
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {label}
        </span>
      </div>
    </div>
  );
};
