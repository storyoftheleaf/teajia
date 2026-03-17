import React from 'react';
import { useSectionReveal } from '../../hooks/useSectionReveal';

interface AnimatedDividerProps {
  ornament?: boolean;
  className?: string;
}

export const AnimatedDivider: React.FC<AnimatedDividerProps> = ({ ornament = false, className = '' }) => {
  const reveal = useSectionReveal();

  return (
    <div
      ref={reveal.ref as React.RefObject<HTMLDivElement>}
      className={`my-8 md:my-12 ${className}`}
    >
      <div
        className={`divider-animated ${ornament ? 'divider-ornament' : ''} ${
          reveal.className.includes('opacity-100') ? 'revealed' : ''
        }`}
      />
    </div>
  );
};
