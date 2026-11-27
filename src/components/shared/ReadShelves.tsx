import React from 'react';
import { Link } from 'react-router-dom';
import { READ_SHELVES, type ReadShelfId } from '../navSections';

const ACTIVE_GLOW: React.CSSProperties = {
  filter: 'drop-shadow(0 0 8px rgb(var(--tea-gold-rgb) / 0.75)) drop-shadow(0 0 18px rgb(var(--tea-gold-rgb) / 0.32))',
};

/**
 * Read's three shelves (slice K10): one row of three shelf names at the top of
 * /read, /read/lessons and /wisdom (Lessons took Craft's place, 2026-11-27), so a reader on one shelf steps to another in one
 * tap. The names live in navSections.ts. Shown with the bar on or off since
 * Craft left the bar: the row is the only door to Lessons from Read.
 */
export const ReadShelves: React.FC<{ here: ReadShelfId }> = ({ here }) => {
  return (
    <nav
      aria-label="Read's shelves"
      data-testid="read-shelves"
      className="relative z-[1] mx-auto max-w-[1240px] px-6 sm:px-10 pt-3 flex flex-wrap items-center gap-x-6 gap-y-1"
    >
      {READ_SHELVES.map(shelf => {
        const active = shelf.id === here;
        return (
          <Link
            key={shelf.id}
            to={shelf.path}
            aria-current={active ? 'page' : undefined}
            className={`min-h-tap inline-flex items-center font-display text-ui-14 lowercase tracking-[0.04em] transition-colors duration-200 ${
              active ? 'text-tea-gold font-semibold' : 'text-tea-text-sec hover:text-tea-text'
            }`}
            style={active ? ACTIVE_GLOW : undefined}
          >
            {shelf.label}
          </Link>
        );
      })}
    </nav>
  );
};
