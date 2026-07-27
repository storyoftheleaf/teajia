import React from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Modal } from '../../../components/shared/Modal';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import { authorshipLine } from '../../../wisdom/authorship';
import { WISDOM_TYPE, type WisdomDetail, type WisdomFact, type WisdomSection } from './config';

/**
 * One detail panel for every holding.
 *
 * The panel is full-screen, so the facts lay out ACROSS it rather than stacking
 * down a narrow ribbon: two columns on a phone, four on a wide screen. Prose is
 * the only thing held to a reading measure, because prose is the only thing
 * that gets harder to read as it gets wider.
 *
 * Close X sits top-left, supplied by Modal's panel variant, per the project's
 * Cancel / Back / Close rules. Prev/next ride in Modal's `headerActions`, which
 * is the right-hand toolbar slot, matching ProductEditPanel: the close control
 * keeps the left, the clustered toolbar keeps the right.
 */

/** Facts read across the width. Missing values drop out rather than show blank. */
export const FactGrid: React.FC<{ facts: WisdomFact[]; className?: string }> = ({ facts, className = '' }) => {
  const present = facts.filter(fact => fact.value !== null && fact.value !== undefined && fact.value !== '');
  if (present.length === 0) return null;
  return (
    <dl className={`grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 ${className}`}>
      {present.map(fact => (
        <div key={fact.label} className="min-w-0">
          <dt className={`${WISDOM_TYPE.label} mb-1`}>{fact.label}</dt>
          <dd className="text-ui-13 text-tea-text leading-[1.5]">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
};

/**
 * A held relation as a chip: gold and pressable where there is somewhere to go,
 * plain where the record only names a thing the base does not hold. Background
 * tint only, never a border, per the project rule on pills.
 */
export const WisdomChip: React.FC<{ label: string; onClick?: () => void }> = ({ label, onClick }) =>
  onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="tap-target rounded-md bg-tea-accent-sub px-2 py-1 text-ui-12 text-tea-gold transition-colors hover:text-tea-gold-lt"
    >
      {label}
    </button>
  ) : (
    <span className="rounded-md bg-tea-surface px-2 py-1 text-ui-12 text-tea-text-sec">{label}</span>
  );

/**
 * The public page for what is on screen, opened in its own tab.
 *
 * Used both for a whole holding, under the list, and for one entry, in the
 * panel. A new tab rather than a navigation: the operator is checking how a
 * correction reads, not leaving the admin.
 */
export const PublicLink: React.FC<{ href: string; children: React.ReactNode; className?: string }> = ({
  href, children, className = '',
}) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className={`inline-flex items-center gap-1.5 text-tea-gold transition-colors hover:text-tea-gold-lt ${className}`}
  >
    {children}
    <ExternalLink size={11} className="shrink-0" aria-hidden="true" />
  </a>
);

/** A labelled prose block, used by the cultivar story sections. */
export const LabelledBlock: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <p className={`${WISDOM_TYPE.label} mb-1.5`}>{label}</p>
    {children}
  </div>
);

interface NavProps {
  /** One-based position of the open entry within the list behind the panel. */
  position: number;
  total: number;
  onPrev?: () => void;
  onNext?: () => void;
}

/**
 * Reading through a holding used to mean closing and reopening for every entry.
 * The position rides beside the arrows so a reader knows how far in they are,
 * the same way the product panel says it.
 */
export const WisdomPanelNav: React.FC<NavProps> = ({ position, total, onPrev, onNext }) => (
  <div className="flex items-center gap-1">
    <span className="font-mono text-ui-11 tabular-nums text-tea-text-dim">
      {position} / {total}
    </span>
    <button
      type="button"
      onClick={onPrev}
      disabled={!onPrev}
      aria-label="Previous entry"
      title="Previous (left arrow)"
      className="tap-target rounded-md p-2 text-tea-text-sec transition-colors hover:text-tea-text disabled:opacity-30"
    >
      <ChevronLeft size={17} aria-hidden="true" />
    </button>
    <button
      type="button"
      onClick={onNext}
      disabled={!onNext}
      aria-label="Next entry"
      title="Next (right arrow)"
      className="tap-target rounded-md p-2 text-tea-text-sec transition-colors hover:text-tea-text disabled:opacity-30"
    >
      <ChevronRight size={17} aria-hidden="true" />
    </button>
  </div>
);

interface Props {
  detail: WisdomDetail;
  /** The entity id, for the authorship line. */
  id: string;
  onClose: () => void;
  /** The prev/next toolbar, supplied by the browser that owns the list. */
  nav?: React.ReactNode;
  /** Which grouped section this entry sits in, when the list behind is grouped. */
  section?: WisdomSection;
  /** This entry's page on the public reference, when it has one. */
  publicHref?: string;
}

export const WisdomDetailPanel: React.FC<Props> = ({ detail, id, onClose, nav, section, publicHref }) => (
  <Modal isOpen onClose={onClose} variant="panel" ariaLabel={detail.name} headerActions={nav}>
    <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-nav-gap sm:px-6">
      <div className="mx-auto max-w-5xl pb-8">
        <WisdomDetailHeader detail={detail} id={id} section={section} publicHref={publicHref} />
        <FactGrid facts={detail.facts} className="mt-5 border-t border-tea-border pt-5" />
        {detail.prose && (
          <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text mt-6 max-w-2xl`}>{detail.prose}</p>
        )}
        {detail.extra}
      </div>
    </div>
  </Modal>
);

/** Split out so the cultivar panel can reuse the exact same head. */
export const WisdomDetailHeader: React.FC<{
  detail: WisdomDetail;
  id: string;
  section?: WisdomSection;
  publicHref?: string;
}> = ({ detail, id, section, publicHref }) => (
  <header>
    {/* The eyebrow says what this is, and, when prev/next is walking a grouped
        holding, which heading it is currently under. Crossing from the last
        Menghai mark to the first Xiaguan one used to be silent. The section
        value is not micro-caps: it is a value, and some of them are sentences
        of three words that would read as shouting in caps. */}
    <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <p className={WISDOM_TYPE.label}>{detail.kind}</p>
      {section && (
        <p className="text-ui-11 text-tea-text-dim">
          <span aria-hidden="true">· </span>
          {section.group}: {section.name}
        </p>
      )}
    </div>
    <h2 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>{detail.name}</h2>
    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {detail.chineseName && <p className="text-ui-15 text-tea-text-sec">{detail.chineseName}</p>}
      {detail.altNames && detail.altNames.length > 0 && (
        <p className="text-ui-12 text-tea-text-dim">Also known as {detail.altNames.join(', ')}</p>
      )}
    </div>
    {/* Says what kind of entry this is BEFORE the facts, so a short panel reads
        as a short record rather than as a screen that failed to load. */}
    {detail.note && <p className="mt-3 max-w-2xl text-ui-12 text-tea-text-sec leading-[1.6]">{detail.note}</p>}
    <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-ui-12">
      <p className="text-tea-text-dim">{authorshipLine(id)}</p>
      {publicHref && <PublicLink href={publicHref}>How this reads in public</PublicLink>}
    </div>
  </header>
);
