import React from 'react';

interface AlcoveSectionHeadingProps {
  /** Section word rendered between the two hairlines (e.g. "Character"). */
  label: string;
  /** Extra classes on the wrapper, used for margins per placement. */
  className?: string;
}

/**
 * Centered section word between two hairlines. The quiet card's only
 * section-heading device. Word is tracked uppercase sans in gold-lt.
 */
export const AlcoveSectionHeading: React.FC<AlcoveSectionHeadingProps> = ({
  label,
  className = '',
}) => (
  <div className={`flex items-center gap-3.5 ${className}`} role="heading" aria-level={2}>
    <span aria-hidden="true" className="block h-px flex-1 bg-tea-border" />
    <span className="shrink-0 font-sans text-ui-9 uppercase tracking-[0.24em] indent-[0.24em] text-tea-gold-lt">
      {label}
    </span>
    <span aria-hidden="true" className="block h-px flex-1 bg-tea-border" />
  </div>
);
