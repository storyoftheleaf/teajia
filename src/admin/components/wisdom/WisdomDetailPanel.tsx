import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal } from '../../../components/shared/Modal';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import { authorshipLine } from '../../../wisdom/authorship';
import {
  WISDOM_TYPE,
  type WisdomDetail,
  type WisdomEntryUsage,
  type WisdomFact,
  type WisdomRun,
  type WisdomSection,
} from './config';

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
 * One keyboard stop for a row of chips, with the arrows owning movement inside
 * it. The same contract the list itself uses, for the same reason.
 *
 * The panel used to be a keyboard cul-de-sac: prev and next worked, and then the
 * lineage links and fact chips inside it were a flat tab walk of up to twenty
 * stops, so arriving by keyboard meant leaving by mouse. Roving makes a group of
 * chips cost one Tab and read with the arrows.
 *
 * `data-wisdom-roving` is also what tells the browser's panel-level arrow
 * handler to keep its hands off: inside a chip group the arrows move between
 * chips, everywhere else in the panel they step to the next entry.
 */
export const WisdomRoving: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children, className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  /** True while the keyboard is inside this group, which is when the hint is due. */
  const [reading, setReading] = useState(false);

  const items = useCallback(
    (): HTMLElement[] =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]') ?? []),
    [],
  );

  /** How many chips are actually in the group. Only known after a render. */
  const [size, setSize] = useState(0);

  // Only one member of the group is ever tabbable. Re-applied on every render
  // because the members themselves are supplied by whoever built the chips.
  useEffect(() => {
    const list = items();
    setSize(list.length);
    if (list.length === 0) return;
    const at = Math.min(active, list.length - 1);
    list.forEach((node, index) => { node.tabIndex = index === at ? 0 : -1; });
  });

  const move = (next: number) => {
    const list = items();
    if (list.length === 0) return;
    const at = (next + list.length) % list.length;
    setActive(at);
    list[at].focus();
  };

  return (
    <div
      ref={ref}
      data-wisdom-roving=""
      role="group"
      aria-keyshortcuts="ArrowLeft ArrowRight Home End"
      className={className}
      onFocus={event => {
        const at = items().indexOf(event.target as HTMLElement);
        if (at >= 0) setActive(at);
        setReading(true);
      }}
      onBlur={event => {
        // Only when the keyboard has actually left the group. Moving between two
        // chips fires blur on the first before focus on the second.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setReading(false);
      }}
      onKeyDown={event => {
        const list = items();
        const at = list.indexOf(event.target as HTMLElement);
        if (at < 0) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') move(at + 1);
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') move(at - 1);
        else if (event.key === 'Home') move(0);
        else if (event.key === 'End') move(list.length - 1);
        else return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {children}
      {/* The list says what its keys do in a permanent band; the panel could not
          afford one per chip group and so said nothing at all, which made the
          keyboard discoverable in one half of the screen and not the other.
          It is due at exactly one moment: when the keyboard is in the group and
          the reader is about to press something. Not reserved when it is not,
          because a fact grid cell is a quarter of the panel wide and a line held
          empty in every one of them all day is a worse tax than a reflow the one
          time a keyboard arrives. Nothing above it moves when it appears; the
          chips are earlier in the wrap. */}
      {size > 1 && reading && (
        <span
          data-testid="wisdom-roving-hint"
          className={`${WISDOM_TYPE.label} self-center whitespace-nowrap`}
          aria-hidden="true"
        >
          ← → move
        </span>
      )}
    </div>
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
  /** True when the run is narrower than the holding and the header says why. */
  narrowed?: boolean;
}

/** The fraction, in one treatment, so the toolbar and the run sentence match. */
export const RunFraction: React.FC<{
  position: number;
  total: number;
  className?: string;
  hidden?: boolean;
}> = ({ position, total, className = 'text-tea-text-dim', hidden }) => (
  <span className={`font-mono text-ui-11 tabular-nums ${className}`} aria-hidden={hidden || undefined}>
    {position} / {total}
  </span>
);

/**
 * Reading through a holding used to mean closing and reopening for every entry.
 * The position rides beside the arrows so a reader knows how far in they are,
 * the same way the product panel says it.
 *
 * When the run is narrower than the holding the denominator is not the size of
 * the holding, and the header says which run it is. The two sat at opposite ends
 * of the header with nothing between them; the label carries the reader across
 * now, and the sentence repeats the fraction in this same mono.
 */
export const WisdomPanelNav: React.FC<NavProps> = ({ position, total, onPrev, onNext, narrowed }) => (
  <div className="flex items-center gap-1">
    <RunFraction
      position={position}
      total={total}
      className={narrowed ? 'text-tea-text-sec' : 'text-tea-text-dim'}
      hidden
    />
    <span className="sr-only">
      {narrowed
        ? `Entry ${position} of the ${total} this run walks, described below the title`
        : `Entry ${position} of ${total}`}
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

/**
 * What an edit here would move, said in products.
 *
 * Silent while the account's products are still loading, because a confident
 * "no products" that later turns into eleven is worse than saying nothing.
 */
export const UsageLine: React.FC<{ usage?: WisdomEntryUsage }> = ({ usage }) => {
  if (!usage || usage.total === 0) return null;
  return (
    <p className={usage.count > 0 ? 'text-tea-text-sec' : 'text-tea-text-dim'}>
      {usage.count === 0
        ? `No product resolves through this entry yet, of ${usage.total} in the account.`
        : `${usage.count} of ${usage.total} products resolve through this entry today.`}
    </p>
  );
};

/** How many products a blast radius names before it offers to name the rest. */
const FIRST_PRODUCTS = 8;

/**
 * Which products, not just how many.
 *
 * The count above this was a number an operator could not act on: reading
 * "eleven products resolve through this entry" and then having to leave for the
 * inventory and rebuild the question there, at exactly the moment they were
 * deciding whether to touch the record. The eleven are named here, each one the
 * way back to it, and the tail opens in place rather than sending anyone away.
 *
 * One keyboard stop, like every other chip group on this screen.
 */
export const UsageProducts: React.FC<{ usage?: WisdomEntryUsage }> = ({ usage }) => {
  const [all, setAll] = useState(false);
  // A sixty-product entry that has been opened once must not stay sixty chips
  // tall for the rest of the panel's life; a new entry is a new question.
  useEffect(() => { setAll(false); }, [usage?.href]);
  if (!usage || usage.count === 0 || usage.products.length === 0) return null;

  const shown = all ? usage.products : usage.products.slice(0, FIRST_PRODUCTS);
  const rest = usage.products.length - shown.length;

  return (
    <div className="mt-3" data-testid="wisdom-usage-products">
      <p className={`${WISDOM_TYPE.label} mb-1.5`}>What moves</p>
      <WisdomRoving className="flex flex-wrap items-baseline gap-1.5">
        {shown.map(product => (
          <Link
            key={product.id}
            to={`/admin/inventory?panel=${encodeURIComponent(product.id)}`}
            className="tap-target rounded-md bg-tea-accent-sub px-2 py-1 text-ui-12 text-tea-gold transition-colors hover:text-tea-gold-lt"
          >
            {product.name}
          </Link>
        ))}
        {/* Expanding in place was the only way to see the rest, and it was a one
            way door: sixty chips, open forever. The way back is the same press
            reversed, and the way FORWARD is now the inventory itself, filtered
            to exactly these products, which is where the work would happen
            anyway. Naming sixty teas in a panel is a list to read; the same
            sixty in the inventory is a list to act on. */}
        {rest > 0 && (
          <button
            type="button"
            onClick={() => setAll(true)}
            className="tap-target self-center rounded-md px-2 py-1 text-ui-12 text-tea-gold transition-colors hover:text-tea-gold-lt"
          >
            and {rest} more
          </button>
        )}
        {all && usage.products.length > FIRST_PRODUCTS && (
          <button
            type="button"
            onClick={() => setAll(false)}
            data-testid="wisdom-usage-fewer"
            className="tap-target self-center rounded-md px-2 py-1 text-ui-12 text-tea-text-sec transition-colors hover:text-tea-text"
          >
            Show fewer
          </button>
        )}
        <Link
          to={usage.href}
          data-testid="wisdom-usage-inventory"
          className="tap-target self-center rounded-md px-2 py-1 text-ui-12 text-tea-gold transition-colors hover:text-tea-gold-lt"
        >
          Open all {usage.count} in the inventory
        </Link>
      </WisdomRoving>
    </div>
  );
};

interface Props {
  detail: WisdomDetail;
  /** The entity id, for the authorship line. */
  id: string;
  onClose: () => void;
  /** The prev/next toolbar, supplied by the browser that owns the list. */
  nav?: React.ReactNode;
  /** Which grouped section this entry sits in, when the list behind is grouped. */
  section?: WisdomSection;
  /** Where in the run this entry sits, when the run is narrower than the holding. */
  run?: WisdomRun;
  /** This entry's page on the public reference, when it has one. */
  publicHref?: string;
  /** How many products resolve through this entry right now. */
  usage?: WisdomEntryUsage;
}

export const WisdomDetailPanel: React.FC<Props> = ({
  detail, id, onClose, nav, section, run, publicHref, usage,
}) => (
  <Modal isOpen onClose={onClose} variant="panel" ariaLabel={detail.name} headerActions={nav}>
    <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-nav-gap sm:px-6">
      <div className="mx-auto max-w-5xl pb-8">
        <WisdomDetailHeader
          detail={detail}
          id={id}
          section={section}
          run={run}
          publicHref={publicHref}
          usage={usage}
        />
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
  run?: WisdomRun;
  publicHref?: string;
  usage?: WisdomEntryUsage;
}> = ({ detail, id, section, run, publicHref, usage }) => (
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
    {/* Provenance, load and public face on one line: who wrote it, what would
        move if it changed, and where a customer meets it. Wraps rather than
        truncates, because all three are sentences. */}
    {/* What the toolbar's position is a position IN.
        Prev and next walk the list behind this panel, and three things narrow
        that list: the gap filter, the find field and a folded section. The gap
        one re-tests on its own, the moment the account's products resolve, so
        "3 of 15" could become "3 of 9" with the panel open and nothing said.
        The run says what it is, and changes when it changes.

        The fraction leads the sentence, in the toolbar's own mono and tabular
        figures. It is deliberately the same glyphs in the same treatment at both
        ends of the header: the toolbar's "3 / 9" was a number with no stated
        denominator and this was a sentence about a run with no stated position,
        and a reader had to notice that the 9 in each was the same 9. */}
    {run && (
      <p
        className="mt-2 flex flex-wrap items-baseline gap-x-2 text-ui-12 text-tea-text-dim"
        data-testid="wisdom-run-note"
        aria-live="polite"
      >
        <RunFraction position={run.position} total={run.total} className="text-tea-text-sec" />
        <span className="min-w-0">{run.note}</span>
      </p>
    )}
    <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-ui-12">
      <p className="text-tea-text-dim">{authorshipLine(id)}</p>
      <UsageLine usage={usage} />
      {publicHref && <PublicLink href={publicHref}>How this reads in public</PublicLink>}
    </div>
    {/* And which products they are. Under the count, because the count is the
        decision and the list is the work that follows from it. */}
    <UsageProducts usage={usage} />
  </header>
);
