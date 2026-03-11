import React from 'react';
import { Icons } from '../Icons';

export interface BreadcrumbSegment {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
  className?: string;
}

/**
 * Simple breadcrumb navigation.
 * On mobile (< md), shows only the last 2 segments.
 */
export const Breadcrumb: React.FC<BreadcrumbProps> = ({ segments, className = '' }) => {
  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1 text-sm mb-6 ${className}`}>
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        // On mobile, hide all but last 2 segments
        const mobileHidden = segments.length > 2 && i < segments.length - 2 ? 'hidden md:flex' : 'flex';

        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <Icons.ChevronRight
                className={`w-3.5 h-3.5 text-tea-text-dim shrink-0 ${
                  segments.length > 2 && i < segments.length - 1 ? 'hidden md:block' : ''
                }`}
                aria-hidden="true"
              />
            )}
            {isLast ? (
              <span className={`${mobileHidden} items-center font-serif text-tea-text truncate`}>
                {segment.label}
              </span>
            ) : (
              <button
                onClick={segment.onClick}
                className={`${mobileHidden} items-center font-serif text-tea-text-dim hover:text-tea-gold transition-colors truncate`}
              >
                {segment.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
