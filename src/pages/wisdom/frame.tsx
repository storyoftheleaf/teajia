/**
 * The frame of the public tea reference: everything a page can paint before it
 * knows anything.
 *
 * This module deliberately imports no wisdom data. That is the whole point of
 * its existence. `App.tsx` loads it eagerly so a lazy `/wisdom/*` route can put
 * the real nav strip and the real page shell on screen in the first frame,
 * instead of a full-viewport emblem sitting on a blank page while a chunk
 * arrives. Only the genuinely async part is allowed to shimmer.
 *
 * The four type roles live here for the same reason: they are strings, they
 * cost nothing, and the fallback needs them. `wisdomShared` re-exports the
 * whole module, so every page keeps importing from one place.
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

// ─── The four type roles ─────────────────────────────────────────────────────

/**
 * Four roles, four sizes, and nothing else on any page of the reference.
 *
 *   TITLE  28px display  the one heading a page carries
 *   NAME   17px display  a row name, an entry name, the section switcher
 *   FACT   15px body     running prose, and any fact written as a phrase
 *   LABEL  11px sans     micro-caps, and ONLY for a label of three words or fewer
 *
 * CELL is the LABEL size and family with the caps taken off. It is what a value
 * inside a column is set in, because caps at 11px is unreadable for a place
 * name or a sentence. Case and colour, not size, tell a header from its values.
 *
 * That is the whole scale. Nothing on a wisdom page may introduce a fifth step.
 */
export const TITLE_CLASS = 'font-display text-ui-28 font-normal leading-[1.15] tracking-[0.01em]';
export const NAME_CLASS = 'font-display text-ui-17 font-normal leading-[1.35] tracking-[0.02em]';
export const FACT_CLASS = 'font-body text-ui-15 font-normal leading-[1.65]';
export const LABEL_CLASS = 'font-sans text-ui-11 font-normal uppercase tracking-[1.2px] leading-[1.4]';
export const CELL_CLASS = 'font-sans text-ui-11 font-normal tracking-[0.02em] leading-[1.4]';

/** A micro-caps label. Dim, always subordinate to what it labels. */
export const LABEL = `${LABEL_CLASS} text-tea-text-dim`;
/** A value in a column, or any short piece of metadata. Never caps. */
export const CELL = `${CELL_CLASS} text-tea-text-sec`;
/** A footnote: a sentence that must not compete with the record above it. */
export const FOOTNOTE = `${CELL_CLASS} text-tea-text-dim leading-relaxed`;
/** Running prose. */
export const FACT = `${FACT_CLASS} text-tea-text-sec`;

export const QUIET_LINK =
  'text-tea-readgold underline underline-offset-4 decoration-tea-gold/40 hover:decoration-tea-gold transition-colors';

/**
 * The caps rule, enforced rather than remembered. A label of three words or
 * fewer is set in micro-caps; anything longer is a phrase, and a phrase set in
 * caps at 11px cannot be read. Group labels come out of the data, so the
 * decision cannot live at the call site.
 */
export const isMicroCapsLabel = (text: string): boolean => text.trim().split(/\s+/).length <= 3;

// ─── Navigation ──────────────────────────────────────────────────────────────

/**
 * Every holding the reference covers, in the order the front door lists them.
 * The one place this list is written, so the sub-nav and the front door cannot
 * drift out of step with each other.
 */
export interface WisdomSection {
  id: string;
  label: string;
  path: string;
}

export const WISDOM_SECTIONS: WisdomSection[] = [
  { id: 'overview', label: 'Overview', path: '/wisdom' },
  { id: 'cultivars', label: 'Plants', path: '/wisdom/cultivars' },
  { id: 'regions', label: 'Regions', path: '/wisdom/regions' },
  { id: 'producers', label: 'Producers', path: '/wisdom/producers' },
  { id: 'marks', label: 'Marks', path: '/wisdom/marks' },
  { id: 'styles', label: 'Styles', path: '/wisdom/styles' },
  { id: 'named', label: 'Named', path: '/wisdom/named' },
];

/**
 * Which holding a path belongs to. Singular detail routes and plural index
 * routes answer the same, so /wisdom/cultivar/jin-xuan lights "Plants" without
 * the page having to say so.
 */
export function sectionForPath(pathname: string): WisdomSection['id'] {
  const segment = pathname.replace(/^\/wisdom\/?/, '').split('/')[0] ?? '';
  if (!segment) return 'overview';
  if (segment.startsWith('cultivar')) return 'cultivars';
  if (segment.startsWith('region')) return 'regions';
  if (segment.startsWith('producer')) return 'producers';
  if (segment.startsWith('mark')) return 'marks';
  if (segment.startsWith('style')) return 'styles';
  if (segment.startsWith('named')) return 'named';
  return 'overview';
}

/**
 * The mark the inventory's lens rail uses: gold text plus a 2px gold bar seated
 * on the strip's own rule. Colour alone was not enough to find at a glance,
 * especially outdoors where the bronze reads close to the secondary text.
 */
export const switchMark = (active: boolean): string =>
  active
    ? 'text-tea-gold after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-tea-gold after:rounded-full'
    : 'text-tea-text-sec hover:text-tea-text';

/**
 * The persistent way around, and the only serif switcher on the page. Wraps at
 * narrow widths rather than scrolling sideways: a nav you have to discover by
 * swiping is a nav half the readers never see.
 *
 * It is also the only wayfinding a detail page carries. A back link above it
 * saying "All tea plants" repeated what the lit "Plants" item already said, and
 * cost 44px at the top of every entry.
 */
export const WisdomSubNav: React.FC<{ active: WisdomSection['id'] }> = ({ active }) => (
  <nav
    aria-label="The wisdom base"
    className="flex flex-wrap items-center gap-x-5 sm:gap-x-6 border-b border-tea-border"
  >
    {WISDOM_SECTIONS.map(section => {
      const isActive = section.id === active;
      return (
        <Link
          key={section.id}
          to={section.path}
          aria-current={isActive ? 'page' : undefined}
          className={`relative inline-flex items-center min-h-[44px] ${NAME_CLASS} transition-colors ${switchMark(isActive)}`}
        >
          {section.label}
        </Link>
      );
    })}
  </nav>
);

// ─── Skeleton ────────────────────────────────────────────────────────────────

export const ProseSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="space-y-3" aria-hidden>
    {Array.from({ length: lines }).map((_, index) => (
      <div key={index} className="shimmer-warm h-3" style={{ width: `${92 - index * 11}%` }} />
    ))}
  </div>
);

/**
 * What a lazy /wisdom route shows while its chunk arrives. The strip is the
 * real strip, in its real place, already knowing which holding it is in, so
 * nothing moves when the page lands. Only the heading and the first paragraph
 * shimmer, and only for as long as the chunk takes.
 */
export const WisdomFallback: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <article className="w-full max-w-3xl mx-auto pt-4 pb-nav">
      <WisdomSubNav active={sectionForPath(pathname)} />
      <div className="mt-6" aria-hidden>
        <div className="shimmer-warm h-7 w-[13rem] max-w-full rounded-md" />
        <div className="mt-7">
          <ProseSkeleton lines={3} />
        </div>
      </div>
      <p role="status" className="sr-only">
        Opening the reference.
      </p>
    </article>
  );
};

export default WisdomFallback;
