import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ProgressTrack } from '../../pages/read/immersive';

// The Read section's design and interaction, for the people pages.
//
// src/pages/read/immersive.tsx is the source of the shapes here: the sticky
// nav with the gold reading-progress line, reveal-on-scroll sections, the
// index row (Cormorant title, italic dek, caps rubric on the right), the
// section divider (spaced caps word, hairline) and the cover with its thin
// gold border and fade. That module is an always-dark editorial system by
// decision (its own header says why), so its palette is scoped to it. The
// people pages are part of the site: they follow the site's light and dark
// tokens. So the two hooks the reader owns (useReveals, useReadingProgress)
// and the ProgressTrack are reused as they are, and every drawn surface here
// is the same shape in tokens.
//
// Adrian's refinements, 2026-09-20: the sticky block is the nav alone, and
// the hub is a row of bordered cells under the cover; dividers carry no
// glyph and no count; rows have no number column and no hover indent; the
// pay sheets use gold outline controls, never solid gold.

export { useReveals, useReadingProgress } from '../../pages/read/immersive';

const GOLD_LINE = 'rgb(var(--tea-gold-rgb) / 0.24)';
const GOLD_LINE_HOVER = 'rgb(var(--tea-gold-rgb) / 0.5)';
const WASH: CSSProperties = { background: 'rgb(var(--tea-bg-rgb) / 0.72)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' };

/** Styles the row and cover hover states need; class names, not React state. */
const PEOPLE_STYLES = `
  .tj-people-row { transition: color 240ms; }
  .tj-people-row:hover .tj-people-title { color: var(--tea-gold-lt); }
  .tj-people-cover { transition: border-color 240ms; }
  .tj-people-cover:hover { border-color: ${GOLD_LINE_HOVER}; }
  .tj-people-tab:hover { color: var(--tea-text); }
`;

export function PeopleRoot({ children, rootRef, testId }: { children: ReactNode; rootRef?: React.Ref<HTMLDivElement>; testId?: string }) {
  return (
    <div ref={rootRef} className="relative min-h-screen bg-tea-bg font-body text-tea-text [overflow-x:clip]" data-testid={testId}>
      <style>{PEOPLE_STYLES}</style>
      {children}
    </div>
  );
}

/** The one sticky block at the top of the page: the nav with its progress line. */
export function StickyChrome({ children }: { children: ReactNode }) {
  return <div className="sticky top-0 z-20">{children}</div>;
}

/** The nav: back chevron and wordmark on the left, the eyebrow on the right, the gold progress line under it. */
export function PeopleNav({ eyebrow, progress, backTo, chevron = true, eyebrowTone = 'dim' }: { eyebrow: string; progress: number; backTo: string; chevron?: boolean; /** 'sec' when the eyebrow is a person's name (canvas version 28). */ eyebrowTone?: 'dim' | 'sec' }) {
  return (
    <nav
      aria-label="Site"
      className="relative flex h-12 items-center justify-between gap-4 border-b border-tea-border px-5"
      style={WASH}
    >
      <Link to={backTo} className="flex items-center gap-2 text-tea-text" aria-label={chevron ? 'Back to all people' : 'Teajia'}>
        {chevron && (
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path d="M9.5 3.5L5 7.5l4.5 4" stroke="var(--tea-gold)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <span className="font-display text-ui-17 font-semibold uppercase tracking-[0.14em]">Teajia</span>
      </Link>
      <span className={`whitespace-nowrap font-sans text-ui-10 uppercase tracking-[0.2em] ${eyebrowTone === 'sec' ? 'text-tea-text-sec' : 'text-tea-text-dim'}`}>{eyebrow}</span>
      <ProgressTrack progress={progress} />
    </nav>
  );
}

export interface HubCell {
  id: string;
  label: string;
  href: string;
  /** A route rather than an anchor on this page (the Pay sheet). */
  route?: boolean;
}

/**
 * The hub under the portrait: a row of equal bordered cells in the Cinema
 * manner. Hairline top and left on the row, each cell a hairline right and
 * bottom, spaced caps, 48px tall, flex 1 1 33% so three share a row and the
 * row wraps. Only the sections the tea master has render a cell, so two
 * cells take half the width each and a sparse profile still reads finished.
 */
export function HubCells({ cells, testId }: { cells: HubCell[]; testId?: string }) {
  if (cells.length === 0) return null;
  return (
    <nav aria-label="On this page" data-testid={testId} className="mt-4 flex flex-wrap border-l border-t border-tea-border">
      {cells.map(cell => {
        const className = 'tj-people-tab flex h-12 flex-[1_1_33%] items-center justify-center border-b border-r border-tea-border font-sans text-ui-10 font-medium uppercase tracking-[0.18em] text-tea-text-dim transition-colors';
        return cell.route ? (
          <Link key={cell.id} to={cell.href} className={className} data-testid={`hub-${cell.id}`}>{cell.label}</Link>
        ) : (
          <a key={cell.id} href={cell.href} className={className} data-testid={`hub-${cell.id}`}>{cell.label}</a>
        );
      })}
    </nav>
  );
}

/** The section divider: a spaced caps word on the left and a hairline. */
export function GroupHead({ label }: { label: string }) {
  return (
    <div className="mb-1.5 mt-[38px] flex items-center gap-3.5">
      <h2 className="font-sans text-[9.5px] font-medium uppercase tracking-[0.24em] text-tea-text-dim">{label}</h2>
      <span aria-hidden="true" className="h-px flex-1 bg-tea-border" />
    </div>
  );
}

export function Kicker({ children, className = '', size = 10, dim = false }: { children: ReactNode; className?: string; size?: number; dim?: boolean }) {
  return <span className={`block font-sans uppercase tracking-[0.26em] ${dim ? 'text-tea-text-dim' : 'text-tea-readgold'} ${className}`} style={{ fontSize: size, letterSpacing: size < 10 ? '0.22em' : undefined }}>{children}</span>;
}

export function Dek({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <span className={`block font-body text-ui-13 italic leading-[1.45] text-tea-text-sec ${className}`} style={style}>{children}</span>;
}

/** "Kenji Tanaka" set as "Kenji" plus an italic gold "Tanaka". A single name stays plain. */
export function SplitName({ name, className = '' }: { name: string; className?: string }) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? name;
  const rest = parts.slice(1).join(' ');
  return (
    <span className={className}>
      {first}
      {rest && <> <span className="italic text-tea-readgold">{rest}</span></>}
    </span>
  );
}

const ROW_CLASS = 'tj-people-row grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-b border-tea-border py-[15px] text-left text-tea-text';

export function RowBody({ title, dek, rubric }: { title: ReactNode; dek?: ReactNode; rubric?: ReactNode }) {
  return (
    <>
      <span className="min-w-0">
        <span className="tj-people-title block font-display text-[24px] leading-[1.08] transition-colors">{title}</span>
        {dek && <Dek className="mt-1">{dek}</Dek>}
      </span>
      {rubric ? <span className="whitespace-nowrap pt-1.5 text-right font-sans text-ui-9 font-medium uppercase tracking-[0.18em] text-tea-text-dim">{rubric}</span> : <span />}
    </>
  );
}

interface IndexRowProps {
  to: string;
  external?: boolean;
  title: ReactNode;
  dek?: ReactNode;
  /** Optional caps rubric on the right. */
  rubric?: ReactNode;
  testId?: string;
  ariaLabel?: string;
}

/** The index row: title over an italic dek, an optional caps rubric on the right. */
export function IndexRow({ to, external, title, dek, rubric, testId, ariaLabel }: IndexRowProps) {
  const body = <RowBody title={title} dek={dek} rubric={rubric} />;
  return external ? (
    <a href={to} target="_blank" rel="noopener noreferrer" className={ROW_CLASS} data-testid={testId} aria-label={ariaLabel}>{body}</a>
  ) : (
    <Link to={to} className={ROW_CLASS} data-testid={testId} aria-label={ariaLabel}>{body}</Link>
  );
}

/** The same row as a button, for a row that acts (copy a WeChat id) rather than opens. */
export function IndexRowButton({ onClick, title, dek, rubric, testId, ariaLabel }: Omit<IndexRowProps, 'to' | 'external'> & { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={ROW_CLASS} data-testid={testId} aria-label={ariaLabel}>
      <RowBody title={title} dek={dek} rubric={rubric} />
    </button>
  );
}

interface CoverProps {
  to: string;
  image?: string | null;
  imageAlt?: string;
  imageOpacity?: number;
  /** When there is no image, what fills the box (the identity mark). */
  fallback?: ReactNode;
  height: number;
  /** The fade covers the whole image (secondary cover) or the lower half (lead). */
  fadeFull?: boolean;
  children: ReactNode;
  className?: string;
  testId?: string;
  ariaLabel?: string;
}

/** A cover: image behind, fade into the page ground, words at the foot, a thin gold border that brightens on hover. */
export function Cover({ to, image, imageAlt = '', imageOpacity = 1, fallback, height, fadeFull, children, className = '', testId, ariaLabel }: CoverProps) {
  return (
    <Link
      to={to}
      className={`tj-people-cover relative flex flex-col justify-end overflow-hidden bg-tea-surface text-tea-text ${className}`}
      style={{ height, border: `1px solid ${GOLD_LINE}` }}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      {image ? (
        <img src={image} alt={imageAlt} className="absolute inset-0 h-full w-full object-cover" style={{ opacity: imageOpacity }} />
      ) : fallback ? (
        <span className="absolute inset-0">{fallback}</span>
      ) : null}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0"
        style={{ height: fadeFull ? '100%' : '56%', background: 'linear-gradient(to top, rgb(var(--tea-bg-rgb) / 1), rgb(var(--tea-bg-rgb) / 0))' }}
      />
      <span className="relative block p-6">{children}</span>
    </Link>
  );
}

/**
 * The sheets' actions (canvas version 27): plain Cormorant in the reading
 * gold with a 1px gold line under, no box, no fill, no caps. Real buttons and
 * links; only the look is a line of text. Three sizes:
 * ROW is a full-width action, 22px, 52px tall, the hairline under the whole
 * row (Ask, Send on WhatsApp, Copy link, Make a pay link). ACTION is the same
 * type at the right of its row (Approve). INLINE sits beside a fact at 17px,
 * 44px tall so the tap target holds (Copy, Open).
 */
const GOLD_TEXT_BASE = 'border-b bg-transparent font-display leading-none text-tea-readgold transition-colors hover:text-tea-gold-lt disabled:opacity-60';
export const GOLD_TEXT_ROW = `flex min-h-[52px] w-full items-center justify-start text-left text-[22px] ${GOLD_TEXT_BASE}`;
export const GOLD_TEXT_ACTION = `inline-flex min-h-[52px] shrink-0 items-center text-[22px] ${GOLD_TEXT_BASE}`;
export const GOLD_TEXT_INLINE = `inline-flex min-h-[44px] shrink-0 items-center text-ui-17 ${GOLD_TEXT_BASE}`;
export const GOLD_TEXT_STYLE: CSSProperties = { borderColor: GOLD_LINE_HOVER };
/** The sheet's top edge, and a cover's border: the thin gold line. */
export const GOLD_LINE_STYLE: CSSProperties = { borderColor: GOLD_LINE };
