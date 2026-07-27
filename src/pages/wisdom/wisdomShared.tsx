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
import React, { createContext, useContext, useEffect, useState } from 'react';
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
  CELL,
  CELL_CLASS,
  FACT,
  FACT_CLASS,
  FOOTNOTE,
  LABEL,
  LABEL_CLASS,
  NAME_CLASS,
  QUIET_LINK,
  TITLE_CLASS,
  WISDOM_SECTIONS,
  WisdomSubNav,
  isMicroCapsLabel,
  switchMark,
  type WisdomSection,
} from './frame';

export * from './frame';

/** The one address corrections arrive at. Governance is one editor with an inbox. */
export const WISDOM_INBOX = 'hello@teajia.com';

export const mailtoWisdom = (subject?: string): string =>
  `mailto:${WISDOM_INBOX}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;

// ─── Section head ────────────────────────────────────────────────────────────

/** A marker, a hairline, a name. The section device the detail pages use. */
export const SectionHead: React.FC<{ glyph: string; label: string; count?: number }> = ({ glyph, label, count }) => (
  <div className="flex items-center gap-3 mb-4">
    <span className="font-display italic text-ui-17 text-tea-readgold leading-none">{glyph}</span>
    <span className={`${LABEL} whitespace-nowrap`}>{label}</span>
    <span aria-hidden className="flex-1 h-px bg-tea-border" />
    {count != null && <span className={`${CELL_CLASS} text-tea-text-dim tabular-nums`}>{count}</span>}
  </div>
);

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
 * One line of heading, and no eyebrow. The sub-nav strip above already says
 * which holding a reader is in, so repeating it cost 60px and told nobody
 * anything. Where a page carries a deck it sits inline with the title rather
 * than owning a line of its own.
 *
 * `rungFor` is an entry id. An index passes nothing, because a holding states
 * its rung once for all of its entries at the foot of the list.
 */
export const PageHead: React.FC<{ title: string; chineseName?: string; note?: string; rungFor?: string }> = ({
  title,
  chineseName,
  note,
  rungFor,
}) => (
  <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
    {/* min-w-0 and break-words together: a flex item's default min-width is its
        longest word, so at 390px a name like "Huangshan Qunti Zhong" set at
        28px would otherwise widen the header past the viewport rather than
        wrap. Every long string in the head is treated the same way. */}
    <h1 className={`${TITLE_CLASS} text-tea-text min-w-0 break-words`}>{title}</h1>
    {chineseName && <span className={`${NAME_CLASS} text-tea-text-sec min-w-0 break-words`}>{chineseName}</span>}
    {rungFor && <RungMark id={rungFor} />}
    {note && <p className={`${FACT} min-w-0 break-words max-w-[56ch]`}>{note}</p>}
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
    <div className="mt-12 pt-8 border-t border-tea-border">
      <AuthorshipNote id={id} className="max-w-[64ch]" />
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
 * It takes the surface tone rather than a hairline, because it is the one block
 * on a reference page that is not the reference: it is an address, standing at
 * the foot of every page, asking for something back. A rule above it made it
 * read as one more paragraph of the entry.
 */
export const Invitation: React.FC<{ subject?: string }> = ({ subject }) => (
  /* The panel's shape, written out rather than composed, so this stays an
     <aside> and keeps its landmark. */
  <aside className="mt-14 bg-tea-surface border border-tea-border rounded-xl px-4 sm:px-5 py-4 sm:py-5">
    <p className={`${FACT_CLASS} text-tea-text max-w-[52ch]`}>
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
 * The one container an index puts everything in.
 *
 * The reference used to be text on the page background with no panel and no
 * edge: a toolbar floating above a rule, a rule floating above a list, nothing
 * telling a reader where the holding started or stopped. Tone alone did not fix
 * that, and tone applied to the headings alone made it worse, because a filled
 * heading band is what a spreadsheet looks like.
 *
 * So the holding gets a shape. The toolbar is its head, the column labels its
 * second line, the list its body. Everything inside shares one horizontal
 * inset, which is what makes the search field, the count, the column labels and
 * every row line up down a single pair of edges. The page title, the section
 * prose and the closing note stay outside it, on the page's own background,
 * because they are about the holding rather than in it.
 */
export const IndexPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`bg-tea-surface border border-tea-border rounded-xl px-4 sm:px-5 pt-1 pb-2 ${className}`.trimEnd()}>{children}</div>
);

/**
 * The head of the panel: how the list is ordered on the left, the search field
 * and the live count on the right.
 *
 * It sits inside `IndexPanel` and bleeds to the panel's own padding, so its
 * bottom rule runs the full width of the container and its two ends align with
 * the first and last column beneath it. Floating on the page it was three
 * alignments on a 24px line with nothing under them to agree with.
 *
 * The cross-holding escape line used to print here, directly above a second
 * dim line on some holdings, so a reader met two footnotes before they met one
 * tea. It now prints once, at the foot, with the rest of the notes about the
 * holding. See `SearchEverywhere`.
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
  <div className="-mx-4 sm:-mx-5 px-4 sm:px-5 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-tea-border">
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
      <span className={`${LABEL} shrink-0 tabular-nums whitespace-nowrap`}>
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

// ─── One holding, as a list with real columns ────────────────────────────────

/**
 * The columns a holding's index reads down. Fixed widths, left aligned, so the
 * second and third facts form an axis the eye can track instead of ragging off
 * the right edge at whatever length the string happened to be.
 */
export interface IndexColumns {
  /** grid-template-columns, applied at sm and up. First track is the name. */
  template: string;
  /** Header for the name column. Three words or fewer. */
  nameLabel: string;
  /** Headers for the data columns, in order. Three words or fewer each. */
  labels: string[];
}

const IndexColumnsContext = createContext<IndexColumns | null>(null);

const columnStyle = (columns: IndexColumns): React.CSSProperties =>
  ({ '--wisdom-cols': columns.template }) as React.CSSProperties;

/**
 * Below sm there is no room for three tracks without either a horizontal
 * scroll or a column of two-character fragments, so the grid drops to a wrap:
 * the name takes the first line and the facts sit under it on the second,
 * still in reading order. The header row goes with the columns it labels.
 */
const ROW_LAYOUT =
  'flex flex-wrap items-baseline gap-x-4 gap-y-0.5 sm:grid sm:gap-y-0 sm:grid-cols-[var(--wisdom-cols)]';

/**
 * tea-accent-sub, not tea-gold/6. Tailwind's opacity scale has no 6 step, so
 * `bg-tea-gold/6` compiles to nothing: every row that used it had no hover at
 * all. tea-accent-sub is the token COLOR_RULES names for exactly this.
 */
const ROW_HOVER = 'hover:bg-tea-accent-sub';

export const IndexTable: React.FC<{ columns: IndexColumns; children: React.ReactNode; className?: string }> = ({
  columns,
  children,
  className = '',
}) => (
  <IndexColumnsContext.Provider value={columns}>
    <div className={className} style={columnStyle(columns)}>
      {/* No fill. Inside the panel the column labels are a line of the page's
          furniture, not a grey bar: a filled header strip over a ruled list is
          the exact shape of a spreadsheet, which is the one thing the reference
          is not. It bleeds to the panel's padding so its rule agrees with the
          toolbar's above it. */}
      <div
        aria-hidden
        className="hidden sm:grid sm:grid-cols-[var(--wisdom-cols)] items-baseline gap-x-4 -mx-4 sm:-mx-5 px-4 sm:px-5 pt-3.5 pb-2 border-b border-tea-border"
      >
        <span className={LABEL}>{columns.nameLabel}</span>
        {columns.labels.map(label => (
          <span key={label} className={LABEL}>
            {label}
          </span>
        ))}
      </div>
      {children}
    </div>
  </IndexColumnsContext.Provider>
);

/**
 * A group inside an index. A quiet label and a count, no rule and no glyph:
 * the old head was a full-width hairline with a serif marker, which read louder
 * than the plant names underneath it.
 *
 * It sticks to the top of the viewport for as long as its own group is on
 * screen. Ninety-eight Chinese places scrolled past under a heading that left
 * with the first screenful, so from the second screenful on a reader had no way
 * of knowing which country they were inside. The background is the page's own,
 * so rows pass behind it rather than through it.
 *
 * `sub` is a group inside a group: same device, indented and dimmer, and it
 * sticks below the head above it rather than replacing it.
 *
 * The hairline under it is not decoration. Stuck to the top of the viewport the
 * head has an opaque background and rows pass behind it, so at scrolling speed
 * a name half-eaten by an invisible boundary reads as a clipping fault rather
 * than as a fixed heading. `border-b` draws the boundary the eye was already
 * looking for. It costs nothing when the head is not stuck, because the first
 * row of a group carries no top border of its own (`first:border-t-0`), so this
 * is the same single rule that was always between a head and its list.
 *
 * It carries the panel's own fill and no other, which is the point. A tone of
 * its own would make it a filled band over a ruled list, and that is a table
 * header, which is the one thing a reader must not think they are looking at.
 * What separates a group from the rows above it is air: `pt-7` against the
 * `py-2.5` of a row, so the break is felt before it is read. The three bands
 * that used to run twenty pixels apart (labels, head, first row) now have a
 * clear parent and child.
 */
export const GroupHead: React.FC<{ label: string; count: number; id?: string; sub?: boolean }> = ({
  label,
  count,
  id,
  sub = false,
}) => (
  <div
    id={id}
    /* 50px is the head above it: pt-7 (28), an 11px line at 1.4 (15.4), pb-1.5
       (6) and the rule (1). It seats the sub head flush under the country head
       rather than leaving a hairline gap for a scrolling row to show through.

       The sub head indents with pl-8/pl-9 rather than pl-3, because Tailwind
       emits pl-* after px-*: a bare pl-3 alongside px-4 sm:px-5 would have set
       the left padding to the panel's own padding on a phone (no indent at all)
       and to less than it from sm up (an outdent). */
    className={`sticky ${sub ? 'top-[50px] pl-8 sm:pl-9 pt-4' : 'top-0 pt-7'} z-10 bg-tea-surface border-b border-tea-border flex items-baseline gap-2.5 -mx-4 sm:-mx-5 px-4 sm:px-5 pb-1.5`}
  >
    <span className={isMicroCapsLabel(label) ? LABEL : `${CELL_CLASS} text-tea-text-dim`}>{label}</span>
    {/* The count sits a step brighter than the label. A group of eleven and a
        group of one used to read as identical weight, and the only thing that
        told them apart was the number nobody could see. */}
    <span className={`${CELL_CLASS} text-tea-text-sec tabular-nums`}>{count}</span>
  </div>
);

/**
 * A cell that is itself somewhere to go. Used where the base holds a real
 * relation and the reader is entitled to follow it: a mark's producer, for
 * instance. A name the base does not hold is a plain string and stays one.
 */
export interface CellLink {
  text: string;
  to: string;
}

/**
 * A cell the base has nothing for. Seven of the fifteen marks have no producer
 * recorded, and an empty cell says nothing about why: a reader cannot tell an
 * unknown producer from a column that failed to render. The entry page has
 * always said "Not recorded" in that position, so the row says it too, in the
 * dim tone the value would not have used, which keeps absence from reading as
 * a fact at a glance.
 *
 * This is for a scarce absence, not a structural one. Seven of fifteen is worth
 * naming; ninety-nine of a hundred and eighty-two is not, because at that
 * density the words stop being information and become the column. Where a whole
 * class of record simply has no such field (the working-list places carry
 * neither a province nor an altitude, by construction), the cell is left
 * genuinely empty and the reason is stated once above the list. See
 * RegionIndexPage.
 */
export interface CellAbsent {
  absent: string;
}

export type RowCell = string | CellLink | CellAbsent | undefined;

const isLink = (cell: RowCell): cell is CellLink => typeof cell === 'object' && cell !== null && 'to' in cell;
const isAbsent = (cell: RowCell): cell is CellAbsent => typeof cell === 'object' && cell !== null && 'absent' in cell;

const cellText = (cell: RowCell): string => (typeof cell === 'string' ? cell : '');

/**
 * One line of record. A serif name (plus the Chinese name when the record has
 * one), then one value per column. No description line: a 90-character sentence
 * under every row triples the ink and halves how many rows reach the screen,
 * and everything it said is on the entry's own page one click away.
 *
 * The whole row is still one click, but it is not one anchor: the name link
 * stretches over the row with `after:inset-0`, which leaves a cell free to be
 * its own link without nesting anchors. That is what lets a mark's row reach
 * its producer directly.
 *
 * `note` exists for the front door only, where a handful of rows each need a
 * sentence saying what the holding is. It is set as prose, in sentence case.
 */
export const HoldingRow: React.FC<{
  to: string;
  name: string;
  chineseName?: string;
  cells?: RowCell[];
  note?: string;
}> = ({ to, name, chineseName, cells = [], note }) => {
  const columns = useContext(IndexColumnsContext);
  return (
    <li className="border-t border-tea-border first:border-t-0">
      {/* The hover band bleeds to the panel's own padding rather than stopping
          8px short of it. Inset, it read as a floating pill; full width it reads
          as the row being lit. */}
      <div
        className={`group relative ${ROW_LAYOUT} ${ROW_HOVER} min-h-[44px] py-2.5 -mx-4 sm:-mx-5 px-4 sm:px-5 transition-colors`}
        style={columns ? columnStyle(columns) : undefined}
      >
        {/* gap-3, not gap-2. Two scripts set side by side need more air between
            them than two words of one script do, and this pair had the least on
            the page at the moment it needed the most. */}
        <span className="basis-full sm:basis-auto min-w-0 inline-flex items-baseline gap-3 flex-wrap">
          <Link
            to={to}
            className={`${NAME_CLASS} text-tea-text group-hover:text-tea-gold-lt transition-colors break-words after:absolute after:inset-0 after:content-['']`}
          >
            {name}
          </Link>
          {chineseName && <span className="font-display text-ui-15 text-tea-text-dim">{chineseName}</span>}
        </span>
        {cells.map((cell, index) =>
          // An empty cell keeps its grid track at sm and up, because the column
          // it sits in is an axis the eye runs down and a missing track would
          // shift every value after it. Below sm the row is a flex wrap with no
          // columns to hold, so an empty cell renders nothing at all rather
          // than a stray 16px gap after the name.
          !isLink(cell) && !isAbsent(cell) && !cellText(cell) ? (
            <span key={index} aria-hidden className="hidden sm:block" />
          ) : isLink(cell) ? (
            <span key={index} className={`${CELL} min-w-0 break-words`}>
              {/* `relative` lifts it above the name link's stretched ::after so
                  the cell is its own destination. `py-2` grows the hit box on an
                  inline element without touching the line box, so the column
                  baseline the header sets is unaffected. No `truncate` here:
                  overflow-hidden would clip that padding straight off again. */}
              <Link to={cell.to} className={`relative py-2 ${QUIET_LINK}`}>
                {cell.text}
              </Link>
            </span>
          ) : isAbsent(cell) ? (
            <span key={index} className={`${CELL_CLASS} text-tea-text-dim min-w-0 truncate`}>{cell.absent}</span>
          ) : (
            <span key={index} className={`${CELL} min-w-0 truncate tabular-nums`}>
              {cellText(cell)}
            </span>
          ),
        )}
        {note && <span className={`${FACT} basis-full sm:col-span-full sm:mt-1 max-w-[68ch]`}>{note}</span>}
      </div>
    </li>
  );
};

/**
 * Nothing matched the filter. Names what was searched, so a reader who mistypes
 * can see the mistake instead of wondering whether the page broke. The count in
 * the toolbar reading zero is not an answer.
 */
export const NoMatch: React.FC<{ noun: string; query?: string }> = ({ noun, query }) => (
  /* No tone of its own: this renders inside the index panel, which already
     holds it. Left on the page's own background it was a hole where the list
     had been, which read as the page having failed rather than as the
     reference having answered. */
  <div className="py-12">
    <p className={`${FACT} text-center max-w-[46ch] mx-auto`}>
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
  <article className="w-full max-w-3xl mx-auto pt-4 pb-nav">
    <Helmet>
      <title>Not found · Teajia</title>
    </Helmet>
    <WisdomSubNav active={section} />
    <h1 className={`${TITLE_CLASS} text-tea-text mt-6`}>{heading}</h1>
    <p className={`${FACT} mt-3 max-w-[56ch]`}>
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
 * One section of a detail page, as one object.
 *
 * A detail page used to be nine sections down a single flat wall, each of them
 * a marker, a hairline and some text, with nothing but a 48px margin telling
 * one from the next. The repair is the same one the index panel makes: the
 * heading stays outside on the page, and what the section actually holds sits
 * in a shape with edges and real internal padding.
 *
 * Surface and not elevated, for the measured reason `GroupHead` gives: `LABEL`
 * is `tea-text-dim`, which is 5.40:1 on surface and 4.26:1 on elevated, and the
 * label track is the axis the whole section is read down.
 *
 * `FactPanel` is the same shape with the vertical padding taken off, because a
 * run of `Fact` rows brings its own: each carries `py-2.5` and its own rule.
 */
export const Panel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-tea-surface border border-tea-border rounded-xl px-4 sm:px-5 py-4 sm:py-5 ${className}`.trimEnd()}>
    {children}
  </div>
);

export const FactPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-tea-surface border border-tea-border rounded-xl px-4 sm:px-5 py-1 ${className}`.trimEnd()}>{children}</div>
);

/**
 * A labelled line on a detail page. The label sits in a fixed track so every
 * value starts at the same x down the page, the same reason the index columns
 * are fixed rather than right aligned.
 *
 * `first:border-t-0` because inside a `FactPanel` the panel's own top edge is
 * already the boundary, and a rule drawn on it reads as a seam. A `Fact` with
 * no value renders nothing at all, so the first rule lands on whichever fact
 * the record actually carries.
 */
export const Fact: React.FC<{ label: string; children?: React.ReactNode }> = ({ label, children }) => {
  if (!children) return null;
  return (
    <div className="py-2.5 border-t border-tea-border first:border-t-0 sm:grid sm:grid-cols-[152px_minmax(0,1fr)] sm:gap-x-6">
      <span className={`${LABEL} block sm:pt-1`}>{label}</span>
      <span className={`${FACT_CLASS} text-tea-text max-w-[60ch] block min-w-0 break-words`}>{children}</span>
    </div>
  );
};

/**
 * A paragraph, under its own quiet heading. What a `Fact` is not.
 *
 * A fact is a phrase that answers a label: a country, an altitude, a year. Set
 * in a 152px label track, it forms an axis the eye runs down. Research prose
 * does not belong in that axis. A region's climate runs to 240 characters, and
 * inside a value cell it became a paragraph wearing a field's clothes: four
 * lines of body type hanging off a micro-caps label, breaking the axis for
 * every row below it.
 *
 * So prose gets the full measure, the label sits above it rather than beside
 * it, and the reader is told by the shape of the block which kind of thing they
 * are about to read before they read a word of it.
 */
export const Passage: React.FC<{ label: string; text?: string | null; className?: string }> = ({
  label,
  text,
  // The caller owns the spacing outright rather than adding to a hardcoded
  // margin: two competing margin classes on one element are settled by
  // stylesheet order, which is not somewhere a layout decision should live.
  className = 'mt-6 first:mt-0',
}) => {
  if (!text) return null;
  return (
    <div className={className}>
      <p className={`${LABEL} mb-1.5`}>{label}</p>
      <p className={`${FACT} max-w-[68ch]`}>{text}</p>
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
