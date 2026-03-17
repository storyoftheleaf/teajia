import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
      <AnimatePresence mode="popLayout">
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        const mobileHidden = segments.length > 2 && i < segments.length - 2 ? 'hidden md:flex' : 'flex';

        return (
          <React.Fragment key={segment.label}>
            {i > 0 && (
              <Icons.ChevronRight
                className={`w-3.5 h-3.5 text-tea-text-sec shrink-0 ${
                  segments.length > 2 && i < segments.length - 1 ? 'hidden md:block' : ''
                }`}
                aria-hidden="true"
              />
            )}
            {isLast ? (
              <motion.span
                className={`${mobileHidden} items-center font-serif text-tea-text truncate`}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
              >
                {segment.label}
              </motion.span>
            ) : (
              <motion.button
                onClick={segment.onClick}
                className={`${mobileHidden} items-center font-serif text-tea-text-sec hover:text-tea-gold transition-colors truncate`}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
              >
                {segment.label}
              </motion.button>
            )}
          </React.Fragment>
        );
      })}
      </AnimatePresence>
    </nav>
  );
};
