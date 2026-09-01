import React from 'react';

interface AlcoveSectionHeadingProps {
  /** Section word rendered between the two hairlines (e.g. "Character"). */
  label: string;
  /** Extra classes on the wrapper, used for margins per placement. */
  className?: string;
  /**
   * 'sm' is the quiet card's heading, where the word is a whisper beside a
   * 21px term line. 'lg' is the page's, where the same device has to name a
   * chapter you are about to read several paragraphs of: at 9px it was not
   * legible as a word at arm's length, which is the whole job it has here.
   */
  size?: 'sm' | 'lg';
}

/**
 * Centered section word between two hairlines. The quiet card's only
 * section-heading device. Word is tracked uppercase sans in gold-lt.
 */
export const AlcoveSectionHeading: React.FC<AlcoveSectionHeadingProps> = ({
  label,
  className = '',
  size = 'sm',
}) => (
  <div
    className={`flex items-center ${size === 'lg' ? 'gap-4 lg:gap-[18px]' : 'gap-3.5'} ${className}`}
    role="heading"
    aria-level={2}
  >
    <span aria-hidden="true" className="block h-px flex-1 bg-tea-border" />
    <span
      className={`shrink-0 font-sans uppercase tracking-[0.24em] indent-[0.24em] text-tea-gold-lt ${
        size === 'lg' ? 'text-ui-12 font-medium lg:text-ui-13' : 'text-ui-9'
      }`}
    >
      {label}
    </span>
    <span aria-hidden="true" className="block h-px flex-1 bg-tea-border" />
  </div>
);
