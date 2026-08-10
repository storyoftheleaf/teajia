/**
 * Shared parts of the public tea reference (/wisdom).
 *
 * The reference reads the wisdom base and nothing else. It holds no copy of a
 * tea-type list, no local region table, and no prose of its own about a plant.
 * Everything here is either presentation or a read helper over `src/wisdom`.
 *
 * Presentation follows the admin inventory browser's restraint: no page title
 * block competing with the content, a labelled column header row, utilities on
 * one toolbar line, and serif reserved for the primary switcher. It is not a
 * spreadsheet. It is a contents page that knows what its columns are.
 *
 * The type roles, the nav strip and the loading frame live in `./frame`, which
 * imports no data so `App.tsx` can render it in the first frame. This module
 * re-exports the lot, so a page still imports from one place.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronDown, Search } from 'lucide-react';
import {
  CULTIVARS,
  MARKS,
  NAMED_TEAS,
  PRODUCERS,
  REGIONS,
  STYLES,
  TEA_TYPES,
  findRegion,
  loadCultivarStory,
  normalizeTeaType,
  type Cultivar,
  type CultivarStory,
  type Region,
  type TeaType,
} from '../../wisdom';
import { AUTHORSHIP, authorshipLine, getAuthorship, type AuthorshipRung } from '../../wisdom/authorship';
import {
  AXIS,
  AXIS_INDENT,
  CELL,
  CELL_CLASS,
  FACT,
  FACT_CLASS,
  FOOTNOTE,
  GROUND,
  LABEL,
  LABEL_CLASS,
  MEASURE,
  NAME_CLASS,
  PAGE,
  QUIET_LINK,
  ROW_AXIS,
  ROW_RULE,
  RULE_FULL,
  RULE_SHORT,
  RULE_UNDER,
  SPACE,
  TITLE_CLASS,
  WISDOM_SECTIONS,
  WisdomSubNav,
  isMicroCapsLabel,
  switchMark,
  type WisdomSection,
} from './frame';
export * from './frame';
export * from './catalogue';

/** The one address corrections arrive at. Governance is one editor with an inbox. */
export const WISDOM_INBOX = 'hello@teajia.com';

export const mailtoWisdom = (subject?: string): string =>
  `mailto:${WISDOM_INBOX}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;

// ─── Section head ────────────────────────────────────────────────────────────

/**
 * A tracked-capitals label, and 40px of bronze under it that stops dead.
 *
 * What went was a serif glyph, a full-measure hairline running out to the right
 * of the label, and the panel the section's content used to sit in. The
 * hairline was the defect: a rule that runs the full measure is a divider, and
 * a divider drawn directly under a heading tells the reader the heading has
 * been cut off from what follows it. The short rule cannot be read as a
 * divider, so it reads as what it is, a mark belonging to the head above it.
 *
 * The 3:1 space does the rest. 48px above the head, 16px under it, which is
 * why this carries `SPACE.head` and the caller carries `SPACE.section`.
 */
export const SectionHead: React.FC<{
  label: string;
  count?: number;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  id?: string;
}> = ({ label, count, headingLevel = 2, id }) => {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return (
    <div className={SPACE.head}>
      <Heading id={id} className="flex items-baseline gap-2.5">
        <span className={`${LABEL} whitespace-nowrap`}>{label}</span>
        {count != null && <span className={`${CELL_CLASS} text-tea-text-dim figures-tab`}>{count}</span>}
      </Heading>
      <span aria-hidden className={`${RULE_SHORT} mt-2`} />
    </div>
  );
};

// ─── The page head ───────────────────────────────────────────────────────────

/**
 * The rung an entry sits on, in one word, in its header.
 *
 * A reader walking the reference meets the authorship sentence on the index
 * they came through, which is why it is not repeated three hundred times at the
 * foot. A reader arriving cold on a single entry from a search engine walks
 * through no index at all, and used to be shown no rung anywhere on the page.
 *
 * One micro-caps word is the whole repair. It costs nothing on a line the
 * header already occupies, it is honest on a cold arrival, and it is not the
 * four-line footnote block this loop removed.
 *
 * The word carries no tooltip. A `title` holding the full sentence would put
 * "Drafted from research. Not yet read by a human." back into the markup of all
 * three hundred entries, which is the thing that was removed, and it would be
 * invisible on the phone most of these are read on. The sentence lives on the
 * holding's index and on the front door, and every record in the download
 * carries the same value as `authorshipRung`. Here it is one word, with its
 * subject said before it for a screen reader.
 */
const RUNG_WORD: Record<AuthorshipRung, string> = {
  drafted: 'Drafted',
  reviewed: 'Reviewed',
  authored: 'Authored',
};

export const RungMark: React.FC<{ id: string }> = ({ id }) => (
  <span className={`${LABEL} shrink-0`}>
    <span className="sr-only">Authorship: </span>
    {RUNG_WORD[getAuthorship(id).rung]}
  </span>
);

/**
 * The headword. Every page of the reference opens like a dictionary entry.
 *
 * A small tracked label naming the kind of record, then the name itself very
 * large in the display serif at normal weight, and nothing else at that scale
 * anywhere on the page. That is the whole hierarchy: a reader landing cold from
 * a search engine knows in one glance what they are looking at and what it is
 * called, before they have read a word of the record.
 *
 * `optical-left` pulls the letterform rather than the box onto the axis. At
 * 44px Cormorant's side bearing is enough to make a naively aligned headword
 * read as indented against the labels and rules under it.
 *
 * `kind` is the record type, three words at most. `rungFor` is an entry id, and
 * an index passes none, because a holding states its rung once for all of its
 * entries at the foot of the list.
 */
export const PageHead: React.FC<{
  kind: string;
  title: string;
  chineseName?: string;
  /** A deck. Prose, in the measure, under the headword. */
  note?: string;
  /** Alternative spellings. Metadata, not a deck. */
  aka?: string;
  rungFor?: string;
}> = ({ kind, title, chineseName, note, aka, rungFor }) => (
  <header>
    <div className="flex items-baseline gap-2.5">
      <span className={`${LABEL} whitespace-nowrap`}>{kind}</span>
      {rungFor && (
        <>
          <span aria-hidden className={`${LABEL} shrink-0`}>
            ·
          </span>
          <RungMark id={rungFor} />
        </>
      )}
    </div>
    {/* min-w-0 and break-words together: a flex item's default min-width is its
        longest word, so at 390px a name like "Huangshan Qunti Zhong" set at
        32px would otherwise widen the header past the viewport rather than
        wrap. Every long string in the head is treated the same way. */}
    <div className="mt-2">
      <h1 className={`${TITLE_CLASS} optical-left text-tea-text min-w-0 break-words`}>{title}</h1>
    </div>
    {chineseName && (
      <p className={`${NAME_CLASS} text-tea-text-sec mt-1.5 min-w-0 break-words`}>{chineseName}</p>
    )}
    {aka && <p className={`${CELL_CLASS} text-tea-text-dim mt-2 min-w-0 break-words`}>{aka}</p>}
    {note && <p className={`${FACT} ${MEASURE} ${AXIS_INDENT} mt-4 min-w-0 break-words`}>{note}</p>}
  </header>
);

// ─── Authorship ──────────────────────────────────────────────────────────────

/**
 * The rung this entry sits on, said plainly, in one line. Most of the corpus
 * was AI-drafted from research and published before a human read it line by
 * line. That is stated, not hidden and not apologised for.
 *
 * One line is the whole budget. The foot of an entry used to run four lines of
 * 11px text: this note in two, then a scope footnote in two more, repeating on
 * every page of the reference what is true of the reference as a whole. The
 * scope is now said once, on the front door.
 */
export const AuthorshipNote: React.FC<{ id?: string | null; className?: string }> = ({ id = null, className = '' }) => (
  <p className={`${FOOTNOTE} ${className}`}>{authorshipLine(id)}</p>
);

/**
 * Has anything in the base actually been read by a human yet.
 *
 * Read fresh rather than captured at module load, because the day a rung is
 * added it must change what the pages say without anyone remembering to move a
 * component. It walks an object that is empty today and will hold tens of keys
 * at its largest, so the cost is nothing.
 */
export const someEntryIsVerified = (): boolean =>
  Object.values(AUTHORSHIP).some(entry => entry.rung !== 'drafted');

/**
 * Where the authorship line belongs, and why it moved.
 *
 * It used to print on all three hundred entries, saying the identical sentence
 * on every one of them, because every one of them is on the identical rung.
 * A sentence that cannot vary is not provenance, it is wallpaper: a reader
 * learns it once and stops seeing it, which is the opposite of what a
 * disclosure is for.
 *
 * So while the base is uniform, the holding says it once, on its index, in the
 * plural, and an entry says nothing. The moment a single record is reviewed or
 * authored, `someEntryIsVerified` turns true and every entry starts carrying
 * its own line again, because from then on the sentence distinguishes one
 * entry from the next and the reader needs it at the point of citation. An
 * entry that has itself been reviewed always says so, uniform base or not,
 * since a credit is owed to a person by name.
 *
 * Nothing was deleted. The claim is still on the page a reader reaches the
 * entries through, still in the export on every record as `authorshipRung`,
 * and still on the front door. What went is three hundred copies of it.
 */
export const EntryAuthorship: React.FC<{ id: string }> = ({ id }) => {
  if (getAuthorship(id).rung === 'drafted' && !someEntryIsVerified()) return null;
  return (
    <div className={`${SPACE.section} pt-6 ${RULE_FULL}`}>
      <AuthorshipNote id={id} className={`${MEASURE} ${AXIS_INDENT}`} />
    </div>
  );
};

/**
 * The same claim, made once for a whole holding, in the plural. This is the
 * line that carries the disclosure while the base is uniform.
 */
export const HoldingAuthorship: React.FC<{ noun: string; className?: string }> = ({ noun, className = '' }) => (
  <p className={`${FOOTNOTE} ${className}`}>
    {someEntryIsVerified()
      ? `Each of these ${noun} states its own authorship at the foot of its page.`
      : `Every one of these ${noun} was drafted from research. None has been read by a human yet, and each says so in the download as its authorship rung.`}
  </p>
);

/**
 * The scope of the whole reference, said once on the front door. Nothing here
 * is a shop's, and a reader who has read that sentence on /wisdom does not need
 * it again at the foot of all 300-odd entries.
 */
export const ScopeNote: React.FC<{ className?: string }> = ({ className = '' }) => (
  <p className={`${FOOTNOTE} ${className}`}>
    Nothing in the reference is account scoped. Every entry is true of the tea, not of any shop.
  </p>
);

// ─── The invitation ──────────────────────────────────────────────────────────

/**
 * Adrian's standard, stated as a direction rather than a claim.
 *
 * It used to take the surface tone, on the argument that it is the one block on
 * a reference page that is not the reference. The argument was sound and the
 * device was not: surface on the page background measures 1.21:1 in dark mode
 * and 1.15:1 in light, and a step is only perceptible from about 1.4, so the
 * fill was invisible and all it ever contributed was padding. What separates
 * this block now is a full-measure rule and 48px of air, which are the two
 * devices the whole reference uses for a major division.
 *
 * It keeps its own left position: the label hangs in the margin like every
 * other label, and the address sits on the value axis with everything else.
 */
export const Invitation: React.FC<{ subject?: string }> = ({ subject }) => (
  <aside className={`${SPACE.section} pt-6 ${RULE_FULL} ${AXIS}`}>
    <p className={`${LABEL} mb-1 sm:mb-0`}>Corrections</p>
    <p className={`${FACT_CLASS} text-tea-text ${MEASURE}`}>
      This is not everything. The goal is to be everything. If you know something that isn&rsquo;t here,{' '}
      <a href={mailtoWisdom(subject)} className={QUIET_LINK}>
        send it
      </a>
      . One editor reads it, and every correction is credited.
    </p>
  </aside>
);

// ─── The toolbar ─────────────────────────────────────────────────────────────

/**
 * How a list is ordered. Sans micro-caps, not serif: the sub-nav above is the
 * primary switcher and only one switcher on a page gets to be display type.
 */
export const ViewSwitch = <T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
  label: string;
}): React.ReactElement => (
  /* flex-wrap, because the panel's own inset costs the toolbar 32px of line.
     At 320px "By country", "A to Z" and the jump control together want more
     than is left, and a switch that does not wrap takes the page sideways. */
  <div role="group" aria-label={label} className="flex flex-wrap items-center gap-x-5 min-w-0">
    {options.map(option => {
      const active = option.id === value;
      return (
        <button
          key={option.id}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(option.id)}
          className={`relative inline-flex items-center min-h-[44px] ${LABEL_CLASS} transition-colors ${switchMark(active)}`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

/**
 * The way out of a holding you guessed wrong.
 *
 * The search that reaches every holding at once lived only on the front door,
 * so a reader who typed "Menghai" into Plants was told no plant answers to it
 * and left to work out for themselves that the reference does hold the name,
 * one holding over. One line carries the typed words across.
 *
 * That line used to print directly under the toolbar, which on two holdings put
 * it immediately above a second dim 11px line, so a reader met a stack of
 * footnotes before they met a single record. It prints at the foot now, with
 * the other notes about the holding, where an escape hatch belongs: a reader
 * looks for one after the list has failed them, not before they have read it.
 */
export const everywhereTo = (query: string): string =>
  query.trim() ? `/wisdom?q=${encodeURIComponent(query.trim())}` : '/wisdom';

export const SearchEverywhere: React.FC<{ query: string; className?: string }> = ({ query, className = '' }) => (
  <p className={`${FOOTNOTE} ${className}`}>
    {query.trim() ? (
      <>
        Wrong holding?{' '}
        <Link to={everywhereTo(query)} className={QUIET_LINK}>
          Search every holding for &ldquo;{query.trim()}&rdquo;
        </Link>
        .
      </>
    ) : (
      <>
        Not sure this is the right holding?{' '}
        <Link to={everywhereTo('')} className={QUIET_LINK}>
          Search every holding at once
        </Link>
        .
      </>
    )}
  </p>
);

/**
 * How a holding is ordered and searched: one line, with a full-measure rule
 * under it.
 *
 * The panel this used to be the head of is gone. It was a `bg-tea-surface`
 * fill on a `bg-tea-bg` page, which measures 1.21:1 in dark mode and 1.15:1 in
 * light, and a surface step is only perceptible from about 1.4. It was not a
 * quiet container; it was an invisible one, contributing padding, a radius, an
 * edge nobody could see, and no structure at all. What told a reader where the
 * list began was always the space and the rule, so those are what is left.
 *
 * The search field keeps a fill, because it is a control rather than a
 * container: `bg-tea-elevated` on the page background is 1.53:1, which is
 * perceptible, and a field a reader cannot find is worse than a flat page.
 *
 * The cross-holding escape line prints once, at the foot, with the rest of the
 * notes about the holding. See `SearchEverywhere`.
 */
export const WisdomToolbar: React.FC<{
  query: string;
  onQueryChange: (value: string) => void;
  /** Short enough to read inside the field. The full sentence goes on the label. */
  placeholder: string;
  searchLabel: string;
  visible: number;
  total: number;
  noun: string;
  children?: React.ReactNode;
}> = ({ query, onQueryChange, placeholder, searchLabel, visible, total, noun, children }) => (
  <div className={`pb-2 flex flex-wrap items-center gap-x-6 gap-y-1 ${RULE_UNDER}`}>
    {children}
    <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-x-4 min-w-0">
      <div className="relative flex-1 sm:flex-none sm:w-[188px] min-w-0">
        <Search size={14} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim" />
        <input
          type="search"
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          placeholder={placeholder}
          aria-label={searchLabel}
          /* The placeholder sits at tea-text-sec, not tea-text-dim: dim on the
             elevated fill measures 4.26:1, which is under AA at 11px. On the
             page's own background it was 6.55:1 and fine. A tone costs a
             contrast recheck every time. */
          className={`${CELL_CLASS} w-full h-11 bg-tea-elevated pl-8 pr-3 rounded-md text-tea-text placeholder:text-tea-text-sec focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50`}
        />
      </div>
      {/* CELL, not LABEL. Tracked capitals are the reference's second colour
          of text and they do exactly one job, field labels and section heads.
          A live count is neither: it is a value, and set in caps it competed
          with the column labels it sat beside. */}
      <span className={`${CELL_CLASS} text-tea-text-dim shrink-0 figures-tab whitespace-nowrap`}>
        {visible === total ? `${total} ${noun}` : `${visible} / ${total}`}
      </span>
    </div>
  </div>
);

/**
 * Somewhere to land inside a long list.
 *
 * The places index runs 182 rows, 98 of them under China, and the only way to
 * reach the bottom of it was the scroll bar. A rail of chips would have cost
 * three wrapped rows on a phone to save scrolling on one; a select costs one
 * control on a line the toolbar was already spending, and opens as the
 * platform's own list, over everything, at any width.
 *
 * The open list stays the platform's, because a hand-built popup over 182 rows
 * is a scroll trap on a phone and the OS one is not. The closed control is
 * ours: `appearance-none` takes the browser's chrome off, the chevron is drawn
 * here in the same lucide glyph the compact nav uses, and the type is CELL like
 * every other value in the toolbar. Left native it inherited the platform's
 * font, its border and its arrow, and matched the toolbar in neither theme.
 *
 * The options carry the page's own tokens too. A browser that honours colour on
 * an option (Chromium, and Firefox on Windows) then draws its popup in the
 * theme the reader is actually in; one that ignores it falls back to the
 * platform default, which is the pre-existing behaviour and still legible.
 */
export const GroupJump: React.FC<{
  groups: Array<{ id: string; label: string; count: number }>;
  /** Rows in the whole list. A jump is for a list you cannot reasonably scroll. */
  rows: number;
  label: string;
}> = ({ groups, rows, label }) => {
  // Both thresholds matter. Under four groups there is nothing to choose
  // between, and under a hundred rows the scroll bar is already the answer:
  // 79 plants do not need a control that would cost a phone a second toolbar
  // row. The places index, at 182, does. Neither number is typed anywhere
  // else, so a holding that grows into needing this gets it on its own.
  if (groups.length < 4 || rows < 100) return null;
  return (
    /* The width is capped so a long group name cannot push the toolbar onto a
       second row at 390px. The chevron sits inside that cap, in the pr-5 the
       select leaves for it, and is pointer-events-none so the whole control is
       still one hit. */
    <div className="relative inline-flex items-center shrink-0 min-w-0 max-w-[136px]">
      <select
        aria-label={label}
        value=""
        onChange={event => {
          document.getElementById(event.target.value)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        /* bg-tea-elevated, the same fill the search field takes: the two
           controls on this line are one kind of thing and now look like it,
           and a browser that draws its popup from the select's own background
           still gets an opaque colour to draw the options on. */
        className={`${CELL_CLASS} appearance-none w-full min-h-[44px] min-w-0 bg-tea-elevated text-tea-text-sec hover:text-tea-text cursor-pointer rounded-md pl-3 pr-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50`}
      >
        {/* The placeholder is the label. A separate micro-caps "Jump to" beside
            it said the same word twice and cost 60px of a 358px line. */}
        <option value="" className="bg-tea-elevated text-tea-text-sec">
          Jump to
        </option>
        {groups.map(group => (
          <option key={group.id} value={group.id} className="bg-tea-elevated text-tea-text">
            {group.label} ({group.count})
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-tea-text-dim"
      />
    </div>
  );
};

// ─── One holding, set like a dictionary ──────────────────────────────────────

/**
 * A group inside an index, marked the way a dictionary marks a break.
 *
 * The guide mark half-hangs into the label margin: it starts halfway across the
 * 7.5rem column, so it sits neither on the label axis nor on the value axis and
 * cannot be mistaken for either. That is what a guide letter does on a printed
 * page, and it is why it can be large and dim rather than small and loud.
 *
 * This is the one deliberate exception to the three-size rule, and it is worth
 * stating why it is not the noise that rule exists to remove. The noise was 17
 * against 15: two sizes close enough that the eye reads them as a mistake. 26
 * against 44 and 17 is not close, it is dim, and it does exactly one job on the
 * page. A group label at body size with no other signal was tried and vanished
 * into the rows it was meant to break.
 *
 * `sub` is a group inside a group: the same mark, at body size and indented, so
 * a province reads as belonging to the country above it.
 *
 * It no longer sticks. What sticks is one thin running head at the top of the
 * list, the way guide words sit at the top of a dictionary page, so a reader
 * scrolling the 98 places under China always knows where they are without
 * every group heading being a second bar. See `RunningHead`.
 */
export const GroupHead: React.FC<{ label: string; count: number; id?: string; sub?: boolean }> = ({
  label,
  count,
  id,
  sub = false,
}) => (
  <div
    id={id}
    /* scroll-mt clears the running head, which is 33px of line plus its rule.
       Without it the jump control lands a group underneath the very bar that
       is meant to name it. */
    className={`scroll-mt-12 ${sub ? 'pt-6 sm:pl-[5.25rem]' : 'pt-10 sm:pl-[3.75rem]'} ${SPACE.label} flex items-baseline gap-3`}
  >
    <h2
      className={
        sub
          ? `${NAME_CLASS} text-tea-text-dim min-w-0 break-words`
          : 'font-display text-ui-26 font-normal leading-[1.1] tracking-[-0.01em] text-tea-text-dim min-w-0 break-words'
      }
    >
      {label}
    </h2>
    {/* The count sits a step brighter than the mark. A group of eleven and a
        group of one used to read as identical weight, and the only thing that
        told them apart was the number nobody could see. */}
    <span className={`${CELL_CLASS} text-tea-text-sec figures-tab shrink-0`}>{count}</span>
  </div>
);

/**
 * Guide words. The thin running head that says which group the reader is in.
 *
 * A dictionary puts the first and last headword of the spread at the top of
 * every page, because a reader scanning a long list needs to know where they
 * are without reading a heading that scrolled off four screens ago. This is
 * that, for a list of 182 places where 98 of them are under one country.
 *
 * It replaces the sticky group heading, which had become a second bar under the
 * toolbar and forced every group head to carry an opaque fill and an edge so
 * rows would not appear to be clipped by it. One bar, at the top of the list,
 * on the page's own background.
 *
 * Read by scroll position rather than an observer: the question is not which
 * groups are visible but which one the top of the list is currently inside,
 * and that is a comparison, not an intersection. Throttled to a frame.
 */
export const RunningHead: React.FC<{ groups: Array<{ id: string; label: string; count: number }> }> = ({ groups }) => {
  /** -1 until a group break has actually passed under the bar. */
  const [current, setCurrent] = useState(-1);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (groups.length < 2) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const edge = (bar.current?.getBoundingClientRect().bottom ?? 0) + 1;
      let found = -1;
      for (let index = 0; index < groups.length; index += 1) {
        const mark = document.getElementById(groups[index].id);
        // `bottom`, not `top`. A group head carries 40px of space above its
        // word, so measured from its top the bar lit while the word it was
        // naming was still on screen underneath it, and a reader at the head of
        // China read "China" twice, 40px apart, one of them at guide-mark size.
        // Guide words are for a heading that has left, so the bar waits until
        // the heading has actually passed under it.
        if (mark && mark.getBoundingClientRect().bottom <= edge) found = index;
      }
      setCurrent(value => (value === found ? value : found));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [groups]);

  if (groups.length < 2) return null;
  const showing = current >= 0;
  const here = groups[Math.min(Math.max(current, 0), groups.length - 1)];
  return (
    /* `-mb-8` against `h-8`: the bar costs no layout at all, so at the top of a
       list a reader meets the first guide mark where they would have anyway,
       not 32px lower. It is invisible until a break has passed under it, which
       is also what stops it printing the first group's name directly above the
       same name set large. Two rules 32px apart, one under the toolbar and one
       under a bar saying what the heading below it already says, is the exact
       table header this pass took out. */
    <div
      ref={bar}
      aria-hidden
      className={`sticky top-0 z-10 -mb-8 h-8 bg-tea-bg flex items-end gap-2.5 pb-1.5 ${RULE_UNDER} transition-opacity duration-200 ${
        showing ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <span className={isMicroCapsLabel(here.label) ? LABEL : `${CELL_CLASS} text-tea-text-dim`}>{here.label}</span>
      <span className={`${CELL_CLASS} text-tea-text-dim figures-tab`}>{here.count}</span>
    </div>
  );
};

/**
 * A piece of metadata that is itself somewhere to go. Used where the base holds
 * a real relation and the reader is entitled to follow it: a mark's producer,
 * for instance. A name the base does not hold is a plain string and stays one.
 */
export interface CellLink {
  text: string;
  to: string;
}

/**
 * Something the base has nothing for. Seven of the fifteen marks have no
 * producer recorded, and silence says nothing about why: a reader cannot tell
 * an unknown producer from a field that failed to render. The entry page has
 * always said "Not recorded" in that position, so the row says it too.
 *
 * This is for a scarce absence, not a structural one. Seven of fifteen is worth
 * naming; ninety-four of a hundred and eighty-two is not, because at that
 * density the words stop being information and become the column. Where a whole
 * class of record simply has no such field (the working-list places carry
 * neither a province nor an altitude, by construction), nothing is printed and
 * the reason is stated once above the list. See RegionIndexPage.
 */
export interface CellAbsent {
  absent: string;
}

export type RowCell = string | CellLink | CellAbsent | undefined;

const isLink = (cell: RowCell): cell is CellLink => typeof cell === 'object' && cell !== null && 'to' in cell;
const isAbsent = (cell: RowCell): cell is CellAbsent => typeof cell === 'object' && cell !== null && 'absent' in cell;

const cellText = (cell: RowCell): string => (typeof cell === 'string' ? cell : '');
const hasContent = (cell: RowCell): boolean => isLink(cell) || isAbsent(cell) || Boolean(cellText(cell));

/**
 * tea-accent-sub, not tea-gold/6. Tailwind's opacity scale has no 6 step, so
 * `bg-tea-gold/6` compiles to nothing: every row that used it had no hover at
 * all. tea-accent-sub is the token COLOR_RULES names for exactly this.
 */
const ROW_HOVER = 'hover:bg-tea-accent-sub';

/**
 * One entry, set as a dictionary entry rather than as a row of a table.
 *
 * The catalogue number hangs right-aligned and dim in the label margin. The
 * name follows in the display serif at body size, with the Chinese name beside
 * it. The facts sit small and dim, separated by middots: under the name up to
 * lg, and from lg in a track of their own on the name's baseline.
 *
 * Two things that were true of this row are no longer true, and both were
 * reversed on Adrian's instruction rather than on a fresh argument.
 *
 * It had no separation between one row and the next, on the fine-bookwork
 * reading that a clustered block of entries in an open field is already a list.
 * It carries a hairline now. See `ROW_RULE` for why the page is not the printed
 * page that reasoning came from.
 *
 * And it kept everything inside a 46rem column with the rest of the screen left
 * empty, which meant one fact per row and the others pushed onto a second line.
 * From lg the metadata takes a column, on a single x for the whole list. It is
 * still not a table: no header strip, no fixed cell borders, no zebra, and the
 * name is still display type rather than a field. It is a contents page that
 * knows what its columns are, which is what this surface always said it was.
 *
 * The whole row is one click but not one anchor: the name link stretches over
 * the row with `after:inset-0`, which leaves a piece of metadata free to be its
 * own link without an anchor ever nesting inside another.
 *
 * `note` exists for the front door only, where a handful of rows each need a
 * sentence saying what a holding is. It is set as prose, in sentence case, and
 * stays under the name rather than moving out to the metadata track: it is a
 * sentence, and a sentence in a column of two-word facts is not a fact.
 */
export const HoldingRow: React.FC<{
  to: string;
  name: string;
  chineseName?: string;
  cells?: RowCell[];
  note?: string;
}> = ({ to, name, chineseName, cells = [], note }) => {
  const runIn = cells.filter(hasContent);
  return (
    /* The rule and the hover field are the same width, and both bleed 12px past
       the text on each side. Getting that wrong is what makes a ruled list look
       cheap: a fill wider than the rule above it reads as a misprint. The bleed
       lives on the li so the border draws at the full width, and the padding
       lives on the row so the content still starts on the axis. */
    <li className={`${ROW_RULE} -mx-3`}>
      <div className={`group relative ${ROW_AXIS} ${ROW_HOVER} min-h-[44px] py-2.5 px-3 transition-colors`}>
        <span className="min-w-0 block">
          {/* gap-3, not gap-2. Two scripts set side by side need more air
              between them than two words of one script do, and this pair had
              the least on the page at the moment it needed the most. */}
          <span className="inline-flex items-baseline gap-3 flex-wrap min-w-0">
            <Link
              to={to}
              className={`${NAME_CLASS} text-tea-text group-hover:text-tea-gold-lt transition-colors break-words after:absolute after:inset-0 after:content-['']`}
            >
              {name}
            </Link>
            {chineseName && <span className={`${NAME_CLASS} text-tea-text-dim break-words`}>{chineseName}</span>}
          </span>
          {note && <span className={`${FACT} ${MEASURE} block mt-1.5`}>{note}</span>}
        </span>
        {runIn.length > 0 && (
          /* `lg:row-start-1` lifts the facts onto the name's own baseline once
             there is a second track to put them in. */
          <span
            className={`${CELL_CLASS} text-tea-text-dim block mt-0.5 break-words min-w-0 lg:col-start-2 lg:row-start-1 lg:mt-0 lg:text-right`}
          >
            {runIn.map((cell, index) => (
              <React.Fragment key={index}>
                {index > 0 && (
                  <span aria-hidden className="px-1.5">
                    ·
                  </span>
                )}
                {isLink(cell) ? (
                  /* `relative` lifts it above the name link's stretched
                     ::after so it is its own destination. No block padding:
                     it sits on the run-in line and the row is already 44px. */
                  <Link to={cell.to} className={`relative ${QUIET_LINK}`}>
                    {cell.text}
                  </Link>
                ) : isAbsent(cell) ? (
                  cell.absent
                ) : (
                  <span className="figures-tab">{cellText(cell)}</span>
                )}
              </React.Fragment>
            ))}
          </span>
        )}
      </div>
    </li>
  );
};

/**
 * The list itself. Ruled between rows, never striped, and with no header strip.
 *
 * Each row bleeds 12px past the text on both sides, which lands inside the
 * page's own padding at every width, so nothing here needs clipping and nothing
 * here can take the page sideways.
 */
export const IndexList: React.FC<{ children: React.ReactNode; plain?: boolean }> = ({ children, plain = false }) => (
  <ul className={`list-none m-0 p-0 ${plain ? '' : `${GROUND} py-2`}`}>{children}</ul>
);

/**
 * Nothing matched the filter. Names what was searched, so a reader who mistypes
 * can see the mistake instead of wondering whether the page broke. The count in
 * the toolbar reading zero is not an answer.
 */
export const NoMatch: React.FC<{ noun: string; query?: string }> = ({ noun, query }) => (
  /* On the value axis, where every record would have been. A message centred
     in the void the list left reads as the page having failed; a paragraph
     starting exactly where the first entry would have started reads as the
     reference having answered. */
  <div className={`py-10 ${AXIS_INDENT}`}>
    <p className={`${FACT} max-w-[46ch]`}>
      {query?.trim() ? (
        <>
          No {noun} here answers to &ldquo;{query.trim()}&rdquo;.{' '}
          {/* The likeliest reason a holding has no answer is that the name
              lives in a different holding, so the way across comes before the
              invitation to send a correction. */}
          <Link to={everywhereTo(query)} className={QUIET_LINK}>
            Look in every holding
          </Link>
          , or send it and it will be added.
        </>
      ) : (
        <>No {noun} here answers to that name. If one should, send it and it will be added.</>
      )}
    </p>
  </div>
);

/** A holding's id did not resolve. Same shape on every detail page in the reference. */
export const HoldingNotFound: React.FC<{
  section: WisdomSection['id'];
  heading: string;
  backTo: string;
  backLabel: string;
  subject: string;
}> = ({ section, heading, backTo, backLabel, subject }) => (
  <article className={PAGE}>
    <Helmet>
      <title>Not found · Teajia</title>
    </Helmet>
    <WisdomSubNav active={section} />
    <div className="mt-7">
      <p className={LABEL}>Not held</p>
      <h1 className={`${TITLE_CLASS} optical-left text-tea-text mt-2 break-words`}>{heading}</h1>
    </div>
    <p className={`${FACT} ${MEASURE} ${AXIS_INDENT} mt-6`}>
      Nothing in the reference answers to that name yet.{' '}
      <Link to={backTo} className={QUIET_LINK}>
        {backLabel}
      </Link>
      , or send the one you were looking for.
    </p>
    <Invitation subject={subject} />
  </article>
);

// ─── Facts ───────────────────────────────────────────────────────────────────

/**
 * A labelled line on a detail page. The label hangs in the margin, the value
 * starts on the one axis every value in the reference starts on.
 *
 * No panel, no rule between rows, and no rule under the last one. All three
 * were doing the job space does better: a run of `Fact` rows 8px apart, sitting
 * 48px below whatever came before them, reads as a block without a single
 * pixel of ink drawn around it. The panel they used to sit in was a
 * `bg-tea-surface` fill measuring 1.21:1 on the page background, which is under
 * the 1.4 where a surface step becomes perceptible at all.
 *
 * A `Fact` with no value renders nothing, so a record shows only what it holds.
 */
export const Fact: React.FC<{ label: string; children?: React.ReactNode }> = ({ label, children }) => {
  if (!children) return null;
  return (
    /* py-1.5 below sm, py-1 from sm up. With the label above the value on a
       phone, 8px between rows against 4px between a label and its own value is
       only two to one and the pairs run together; 12px against 4px is the three
       to one the rest of the page holds. From sm up the label is beside the
       value, so 8px between rows is already unambiguous. */
    <div className={`${SPACE.row} sm:py-1 ${AXIS}`}>
      <span className={`${LABEL} block`}>{label}</span>
      <span className={`${FACT_CLASS} text-tea-text ${MEASURE} block min-w-0 break-words mt-1 sm:mt-0`}>
        {children}
      </span>
    </div>
  );
};

/**
 * A paragraph, under its own quiet heading. What a `Fact` is not.
 *
 * A fact is a phrase that answers a label: a country, an altitude, a year, and
 * it sits on one line beside its label. Research prose does not. A region's
 * climate runs to 240 characters, and set on a value line it became a paragraph
 * wearing a field's clothes, breaking the baseline the rows above it agree on.
 *
 * So prose keeps the label hung in the margin, exactly like a fact, but drops
 * its own first line clear of it and takes the full measure. Same axis, second
 * rank, and the reader is told by the shape of the block which kind of thing
 * they are about to read before they read a word of it.
 */
export const Passage: React.FC<{ label: string; text?: string | null; className?: string }> = ({
  label,
  text,
  // The caller owns the spacing outright rather than adding to a hardcoded
  // margin: two competing margin classes on one element are settled by
  // stylesheet order, which is not somewhere a layout decision should live.
  className = 'mt-5 first:mt-0',
}) => {
  if (!text) return null;
  return (
    <div className={`${className} ${AXIS}`}>
      <p className={`${LABEL} mb-1.5 sm:mb-0`}>{label}</p>
      <p className={`${FACT} ${MEASURE}`}>{text}</p>
    </div>
  );
};

// ─── Searching every holding at once ─────────────────────────────────────────

/**
 * One hit from the front door's search, carrying which holding it came out of.
 * A reader who knows "Rou Gui" but not that it is a plant should not have to
 * guess a holding before they are allowed to look.
 */
export interface HoldingHit {
  name: string;
  chineseName?: string;
  /** The holding's nav label, so the reader learns where the name lives. */
  holding: string;
  to: string;
  /** One fact that tells two similarly named things apart. */
  where?: string;
}

const searchKey = (value: string) => value.normalize('NFKD').toLowerCase();

const sectionLabel = (id: string): string => WISDOM_SECTIONS.find(section => section.id === id)?.label ?? id;
const sectionOrder = (label: string): number => WISDOM_SECTIONS.findIndex(section => section.label === label);

/**
 * Names first, then the short fields that place a record.
 *
 * It was names only, and that was too narrow to be honest. A reader who types
 * "Fujian" into Plants is told no plant answers to it and sent here, where the
 * base answered with the province itself and nothing else, as if it held one
 * fact about Fujian instead of the thirty-odd records that name it. The
 * reference looked smaller than it is at the one moment a reader was asking it
 * to be bigger.
 *
 * What is searched is still deliberately not everything. Prose is excluded, and
 * has to stay excluded: climate and description run to paragraphs, and matching
 * inside them would answer a place name with a hundred essays and bury the
 * plant somebody asked for. What is searched instead is exactly the handful of
 * short fields that say where a record belongs, all of which are already
 * printed in the `Where` column of the results, so a hit that matched on
 * context shows the reader why it is there.
 *
 * Ranking keeps the widening from costing anything. Every name match, of any
 * kind, sorts above every context match, so "Wuyi" still opens with the place
 * called Wuyi and the plants grown there follow it rather than displace it.
 *
 *   0  exact name       1  name starts with      2  name contains
 *   4  exact context    5  context starts with   6  context contains
 */
const NAME_RANKS = [0, 1, 2] as const;
const CONTEXT_RANKS = [4, 5, 6] as const;
const MISS = 9;

const rankAgainst = (fields: Array<string | undefined>, needle: string, ranks: readonly number[]): number => {
  let rank = MISS;
  for (const field of fields) {
    if (!field) continue;
    const key = searchKey(field);
    if (key === needle) rank = Math.min(rank, ranks[0]);
    else if (key.startsWith(needle)) rank = Math.min(rank, ranks[1]);
    else if (key.includes(needle)) rank = Math.min(rank, ranks[2]);
  }
  return rank;
};

export function searchHoldings(query: string, limit = 40): HoldingHit[] {
  const needle = searchKey(query.trim());
  if (!needle) return [];

  const hits: Array<HoldingHit & { rank: number }> = [];
  const consider = (
    holding: string,
    to: string,
    name: string,
    chineseName: string | undefined,
    altNames: Array<string | undefined>,
    /** Short fields that place the record. Never prose. */
    context: Array<string | undefined>,
    where?: string,
  ) => {
    const rank = Math.min(
      rankAgainst([name, chineseName, ...altNames], needle, NAME_RANKS),
      rankAgainst(context, needle, CONTEXT_RANKS),
    );
    if (rank < MISS) hits.push({ name, chineseName, holding, to, where, rank });
  };

  for (const cultivar of CULTIVARS) {
    consider(
      sectionLabel('cultivars'),
      `/wisdom/cultivar/${cultivar.id}`,
      cultivar.name,
      cultivar.chineseName,
      cultivar.altNames,
      [cultivar.originRegion, cultivar.originCountry],
      cultivar.originRegion || cultivar.originCountry,
    );
  }
  for (const region of REGIONS) {
    consider(
      sectionLabel('regions'),
      `/wisdom/region/${region.id}`,
      region.name,
      undefined,
      [],
      [region.province, region.country],
      [region.province, region.country].filter(Boolean).join(', ') || undefined,
    );
  }
  for (const producer of PRODUCERS) {
    consider(
      sectionLabel('producers'),
      `/wisdom/producer/${producer.id}`,
      producer.name,
      producer.chineseName,
      producer.altNames,
      [producer.region, producer.country],
      [producer.region, producer.country].filter(Boolean).join(', ') || undefined,
    );
  }
  for (const mark of MARKS) {
    // A mark's producer is a relation the base holds, so "Menghai" reaches the
    // marks that factory made and not only the factory itself.
    const producer = PRODUCERS.find(entry => entry.id === mark.producerId);
    consider(
      sectionLabel('marks'),
      `/wisdom/mark/${mark.id}`,
      mark.name,
      mark.chineseName,
      mark.altNames,
      [mark.era, producer?.name, producer?.chineseName, ...mark.appliesToTypes],
      mark.era || producer?.name,
    );
  }
  for (const style of STYLES) {
    consider(
      sectionLabel('styles'),
      `/wisdom/style/${style.id}`,
      style.name,
      style.chineseName,
      style.altNames,
      [style.region, ...style.appliesToTypes],
      style.region,
    );
  }
  for (const tea of NAMED_TEAS) {
    consider(
      sectionLabel('named'),
      `/wisdom/named/${tea.id}`,
      tea.name,
      tea.chineseName,
      tea.altNames,
      [tea.type, tea.form, tea.region, tea.country],
      tea.region || tea.type,
    );
  }

  return hits
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        sectionOrder(left.holding) - sectionOrder(right.holding) ||
        left.name.localeCompare(right.name),
    )
    .slice(0, limit)
    .map(({ rank: _rank, ...hit }) => hit);
}

// ─── Reading the wisdom base ─────────────────────────────────────────────────

/**
 * Loads the prose for one plant. The 128 KB corpus is code-split, so the header
 * and the lineage tree render from the lean index while this is still in flight.
 */
export function useCultivarStory(id: string | undefined): { story: CultivarStory | null; loading: boolean } {
  const [story, setStory] = useState<CultivarStory | null>(null);
  const [loading, setLoading] = useState(Boolean(id));

  useEffect(() => {
    if (!id) {
      setStory(null);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    loadCultivarStory(id).then(result => {
      if (!live) return;
      setStory(result);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [id]);

  return { story, loading };
}

/**
 * Tea type is not a field on a cultivar, and correctly so: a plant is not a
 * type of tea, it is a plant several types get made from. It is read back out
 * of the named expressions in the story, which is why the type facet waits for
 * the corpus while the origin facet is instant.
 */
export function useCultivarTypes(): { byId: Map<string, TeaType[]> | null; loading: boolean } {
  const [byId, setById] = useState<Map<string, TeaType[]> | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all(CULTIVARS.map(async cultivar => [cultivar.id, teaTypesOf(await loadCultivarStory(cultivar.id))] as const))
      .then(entries => {
        if (live) setById(new Map(entries));
      })
      .catch(() => {
        if (live) setById(new Map());
      });
    return () => {
      live = false;
    };
  }, []);

  return { byId, loading: byId === null };
}

/**
 * Reads canonical tea types out of an expression family name such as
 * "Wuyi Rock Oolong (Yancha)" or "Japanese Black/Oolong".
 *
 * Rules, in order:
 *   1. Conjunctions ("/" and "&") name genuinely separate teas, so each side is read.
 *   2. Within a side, the LAST resolvable word wins, because "Modern Green Style
 *      Oolong" is an oolong made in a green style, not a green tea.
 *   3. A parenthetical is only consulted when the head resolves to nothing, so
 *      "Anxi Oolong (Green Style)" stays an oolong but "Kamairicha (Pan-Fired
 *      Green Tea)" is still found.
 *
 * Every word is resolved through `normalizeTeaType`. No list lives here.
 */
export function teaTypesOf(story: CultivarStory | null | undefined): TeaType[] {
  if (!story?.expressions) return [];
  const found = new Set<TeaType>();

  for (const family of Object.keys(story.expressions)) {
    const head = family.split('(')[0] ?? '';
    const parenthetical = family.slice(head.length);
    const before = found.size;
    readSides(head, found);
    if (found.size === before) readSides(parenthetical, found);
  }

  return TEA_TYPES.filter(type => found.has(type));
}

function readSides(text: string, into: Set<TeaType>): void {
  for (const side of text.split(/[/&]/)) {
    let last: TeaType | null = null;
    for (const word of side.split(/[^A-Za-z']+/)) {
      last = normalizeTeaType(word) ?? last;
    }
    if (last) into.add(last);
  }
}

// ─── Places ──────────────────────────────────────────────────────────────────

const placeKey = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * A cultivar records its origin the way a grower writes it ("Anji (Zhejiang)"),
 * while altitude and climate are held against the researched county name ("Anji
 * County, Zhejiang"). This walks the written form back to the researched place
 * on an exact or leading match only. It never falls through to a containment
 * match, because that would file every Yunnan plant under one prefecture.
 */
export function growingPlace(originRegion: string | null | undefined): Region | null {
  if (!originRegion) return null;

  const direct = findRegion(originRegion);
  if (direct?.altitude || direct?.climate) return direct;

  for (const token of originRegion.split(/[(),/]+/).map(part => part.trim()).filter(Boolean)) {
    const key = placeKey(token);
    if (key.length < 3) continue;
    const exact = REGIONS.find(region => placeKey(region.name) === key && (region.altitude || region.climate));
    if (exact) return exact;
    const leading = REGIONS.find(region => placeKey(region.name).startsWith(key) && (region.altitude || region.climate));
    if (leading) return leading;
  }

  return direct;
}

/**
 * The plants whose recorded origin walks back to this place. The reverse of
 * `growingPlace`, and the only reason a region page is worth opening: 182
 * places with an altitude are a table, but "thirteen plants come from here" is
 * a reason to read one.
 */
export function plantsGrownIn(region: Region): Cultivar[] {
  return CULTIVARS.filter(cultivar => growingPlace(cultivar.originRegion)?.id === region.id).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}
