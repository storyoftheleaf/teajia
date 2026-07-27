import React from 'react';
import { Modal } from '../../../components/shared/Modal';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import { authorshipLine } from '../../../wisdom/authorship';
import { WISDOM_TYPE, type WisdomDetail, type WisdomFact } from './config';

/**
 * One detail panel for every holding.
 *
 * The panel is full-screen, so the facts lay out ACROSS it rather than stacking
 * down a narrow ribbon: two columns on a phone, four on a wide screen. Prose is
 * the only thing held to a reading measure, because prose is the only thing
 * that gets harder to read as it gets wider.
 *
 * Close X sits top-left, supplied by Modal's panel variant, per the project's
 * Cancel / Back / Close rules.
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

/** A labelled prose block, used by the cultivar story sections. */
export const LabelledBlock: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <p className={`${WISDOM_TYPE.label} mb-1.5`}>{label}</p>
    {children}
  </div>
);

interface Props {
  detail: WisdomDetail;
  /** The entity id, for the authorship line. */
  id: string;
  onClose: () => void;
}

export const WisdomDetailPanel: React.FC<Props> = ({ detail, id, onClose }) => (
  <Modal isOpen onClose={onClose} variant="panel" ariaLabel={detail.name}>
    <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-nav-gap sm:px-6">
      <div className="mx-auto max-w-5xl pb-8">
        <WisdomDetailHeader detail={detail} id={id} />
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
export const WisdomDetailHeader: React.FC<{ detail: WisdomDetail; id: string }> = ({ detail, id }) => (
  <header>
    <p className={`${WISDOM_TYPE.label} mb-2`}>{detail.kind}</p>
    <h2 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>{detail.name}</h2>
    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {detail.chineseName && <p className="text-ui-15 text-tea-text-sec">{detail.chineseName}</p>}
      {detail.altNames && detail.altNames.length > 0 && (
        <p className="text-ui-12 text-tea-text-dim">Also known as {detail.altNames.join(', ')}</p>
      )}
    </div>
    <p className="text-ui-12 text-tea-text-dim mt-3">{authorshipLine(id)}</p>
  </header>
);
