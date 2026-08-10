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
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

// ─── Three type sizes, and nothing else ──────────────────────────────────────

/**
 * Three sizes on any page of the reference. Not four, and not the five this
 * once ran.
 *
 *   HEADWORD  44px display (32 on a phone)  the one heading a page carries
 *   BODY      17px                          prose, entry names, row names
 *   SMALL     11px                          labels, metadata, catalogue numbers
 *
 * What went was the 15px step. Body prose at 15 and a row name at 17 are two
 * sizes a reader cannot tell apart and can only feel as noise, so they are one
 * size now and the difference between them is carried where it belongs: family
 * (Cormorant against Lora), case, tracking, and the tone steps that already
 * exist. That is the whole point of the rule. Everything that is not one of
 * these three has to differentiate itself without a new number.
 *
 * The headword takes slightly negative tracking and a tight leading, because a
 * Garamond set at 44px on the browser's defaults goes airy and loses its
 * weight exactly where it is meant to carry the page.
 *
 * CELL is the LABEL size and family with the caps taken off. Caps at 11px is
 * unreadable for a place name, so case and colour, not size, tell a label from
 * a value.
 *
 * Nothing on a wisdom page may introduce a fourth step. The one deliberate
 * exception is the guide mark at a group break in an index (`GroupHead`),
 * which is documented where it is set.
 */
export const TITLE_CLASS =
  'font-display text-[32px] sm:text-[44px] font-normal leading-[1.04] tracking-[-0.015em]';
export const NAME_CLASS = 'font-display text-ui-17 font-normal leading-[1.35] tracking-[0.01em]';
export const FACT_CLASS = 'font-body text-ui-17 font-normal leading-[1.6]';
export const LABEL_CLASS = 'font-sans text-ui-11 font-normal uppercase tracking-[1.2px] leading-[1.4]';
export const CELL_CLASS = 'font-sans text-ui-11 font-normal tracking-[0.02em] leading-[1.5]';

/**
 * A micro-caps label. Dim, always subordinate to what it labels.
 *
 * Letterspaced capitals at 11px read as a different colour of text from roman
 * lowercase, which is what lets the reference carry a second voice without a
 * second hue. 1.2px on 11px is 10.9 percent, inside the 8 to 12 that makes caps
 * legible rather than cramped. It does exactly two jobs: a field label, and a
 * section head. Anything else in caps is a third job and is wrong.
 */
export const LABEL = `${LABEL_CLASS} text-tea-text-dim`;
/** A value in a column, or any short piece of metadata. Never caps. */
export const CELL = `${CELL_CLASS} text-tea-text-sec`;
/** A footnote: a sentence that must not compete with the record above it. */
export const FOOTNOTE = `${CELL_CLASS} text-tea-text-dim leading-relaxed`;
/** Running prose. */
export const FACT = `${FACT_CLASS} text-tea-text-sec`;

export const QUIET_LINK =
  'text-tea-readgold underline underline-offset-4 decoration-tea-gold/40 hover:decoration-tea-gold transition-colors';

// ─── The setting: space, axis, measure, rules ────────────────────────────────

/**
 * The spacing grammar, on a strict ratio, written once so it cannot drift.
 *
 * The page background is rgb(34,32,28) and the panel fill the reference used to
 * reach for is rgb(50,46,41). That is 1.21:1 in dark mode and 1.15:1 in light,
 * and a surface step is only perceptible from about 1.4. Every rounded panel
 * and every one-pixel edge on these pages was therefore doing nothing but
 * adding padding: the grouping a reader could see was never coming from the
 * tone, it was coming from the space inside the panel. So the panels are gone
 * and the space does the job on its own, on a ratio tight enough that a
 * 630-entry reference does not inflate:
 *
 *   ROW      8 to 12px  between rows inside one group
 *   LABEL    12px  from a label to the thing it labels
 *   SECTION  48px  from one section to the next
 *   HEAD     16px  under a section head, a third of the 48 above it
 *
 * The 3:1 above and below a head is the load-bearing number. A head with equal
 * air on both sides belongs to neither side; at three to one the eye reads it
 * as attached to what follows before it has read a word.
 */
export const SPACE = {
  /** One section to the next. */
  section: 'mt-12',
  /** Under a section head. A third of the space above it. */
  head: 'mb-4',
  /** A label to its group. */
  label: 'mb-3',
  /** Rows inside a group. Half above and half below, so 12px between two rows. */
  row: 'py-1.5',
} as const;

/**
 * The one left axis.
 *
 * Small tracked labels hang in a 7.5rem margin column and every value in the
 * reference starts at the same x to its right. The shared gutter is a
 * structural line made of nothing, and it is what makes seven different record
 * types read as one system rather than seven layouts.
 *
 * `sm:items-baseline` rather than a hand-tuned top padding on the label: a
 * grid row aligns its items' first baselines, so an 11px label and a 17px value
 * sit on one line without anybody guessing at a pixel offset.
 *
 * Below sm it collapses to label above value. That is a real loss and it is
 * accepted: a 90px column at 390px leaves the value 200px of line, which is a
 * column of two-word fragments.
 */
export const AXIS = 'sm:grid sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-x-6 sm:items-baseline';

/**
 * The same axis, with a third track for an index row's metadata.
 *
 * Up to lg it is `AXIS` exactly: catalogue number in the margin, name on the
 * value edge, and the facts running in on a second line beneath the name. That
 * is the only shape a 390px phone or a 900px tablet has room for.
 *
 * From lg the row opens out. The name takes the free space and the facts move up
 * onto its baseline in a 24rem track of their own, set flush to the far edge of
 * the row. That is what the extra width is for, and the right edge is where the
 * facts have to land: a fixed track anywhere short of it leaves a few hundred
 * pixels of rule running out to nothing, which is the same empty fore-edge in a
 * different place. Flush right, the rule ends where the last fact ends.
 *
 * The lineage rail already sets its origin and its year this way, on the same
 * surface, and reads well doing it. Ragged left is the price and it is small:
 * these are one or two words apiece, and the rule under each row is what carries
 * the eye from a name to its facts, the job leader dots do in print.
 */
export const ROW_AXIS =
  'sm:grid sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-x-6 sm:items-baseline lg:grid-cols-[7.5rem_minmax(0,1fr)_minmax(0,24rem)]';

/**
 * A hairline between one row of a list and the next.
 *
 * The reference ran with no row separation at all, taken from fine bookwork,
 * where a clustered block of entries in an open field reads as a list without a
 * single rule being drawn. Adrian looked at 630 entries set that way and asked
 * for the lines back, and on a screen he is right: a printed page holds a fixed
 * block in the hand at a fixed size, and a scrolling list of names of wildly
 * different lengths does not, so the eye loses which fact belongs to which name
 * the moment a row wraps.
 *
 * It is scored, not drawn. The rule was the border tone first, which is bronze
 * at 14 percent, and a run of forty of them down a list is a wash of warm lines
 * reading as ornament while doing a separator's job. `.wisdom-rule` is a dark
 * score with a hair of light under it, the mark a press leaves, and at a glance
 * it is simply where one row stops. It is set with an adjacent-sibling selector
 * rather than a first-child reset, so a rule can never land above the first row
 * of a block: a rule directly under a head reads as a divider cutting the head
 * off from what it heads.
 *
 * Lives in card-utilities.css, per the house rule that a reusable style is not
 * a string of utilities repeated at call sites.
 */
export const ROW_RULE = 'wisdom-rule';

/**
 * The tone step, and the measurement that decides which token carries it.
 *
 * Three attempts, and the first two were the two obvious ones.
 *
 * Flat, with space and hairlines carrying the grouping, because `tea-surface` on
 * `tea-bg` measures 1.21:1 and a fill is only perceptible from about 1.4. Adrian
 * read that as one blank page, and he was right.
 *
 * Then a filled block in `tea-elevated`, which at 1.51:1 does clear the
 * threshold. It is seen, and it is seen as exactly what it is: a lighter
 * rectangle laid on a darker one. Adrian's word for it was that it is not the
 * right colour, which it is not, because no colour on this ramp is. A fill big
 * enough to be perceived on its own is a slab, and a slab is what a shop's app
 * chrome looks like, not a page of a reference.
 *
 * The mistake in both was assuming a fill is the only thing that can say
 * "plane". The house card has never assumed that. `.card-grid-item` sits on
 * `tea-surface`, the whisper, and what a reader actually sees is the 1px bronze
 * edge-light along its top and the shadow it casts. Value does not carry it,
 * edges do, and an edge can be quiet in a way a field cannot. `.wisdom-ground`
 * is that idiom at the reference's scale, and the visual work is done by a
 * hairline of bronze at 6 percent and a soft shadow, both of which are as close
 * to nothing as a device can be and still be read.
 *
 * Where it goes is one rule: the record is raised, and the apparatus around the
 * record is not. On an index the list of entries lifts, and the group mark above
 * it, the toolbar, the headword and the notes at the foot stay on the page. On
 * an entry each section of the record lifts and the headword, the authorship
 * line and the invitation stay down. A band boundary then means the same thing
 * wherever a reader meets it.
 *
 * Alternating rows were built and taken out. Banding every second row of a
 * 630-entry reference reads as a spreadsheet, and it puts a second separator on
 * a list the scored rule had already separated.
 *
 * The negative margin is matched to the app's own page padding at each
 * breakpoint, so the block reaches the edge of the reading area and no further,
 * and everything inside it stays on the same left axis as everything outside it.
 * Vertical padding is the caller's, because a section of prose and a list of
 * rows do not want the same amount of it.
 */
export const GROUND = 'wisdom-ground -mx-4 px-4 md:-mx-6 md:px-6';

/** Content that sits on the value edge with nothing hung in the margin beside it. */
export const AXIS_INDENT = 'sm:ml-[9rem]';

/**
 * 66 characters. A measure is a property of the text, not of the window, so it
 * is capped here and never allowed to follow the viewport out to a dashboard
 * width.
 */
export const MEASURE = 'max-w-[66ch]';

/**
 * The page shell every wisdom route uses.
 *
 * This ran at 46rem, held hard against the left edge with the rest of a wide
 * screen deliberately left empty, on the argument that a fore-edge is what tells
 * a book from a dashboard. Adrian looked at it and said the opposite: a narrow
 * column on the left where you cannot see much. He is right about what it costs.
 * A 630-entry reference read at 736px shows one fact per row and hides the rest
 * on a second line, and the width that would have carried them sits empty beside
 * it. A fore-edge is a printer's constraint, not a virtue, and a reference is
 * the one kind of book that has always been set wide.
 *
 * So the shell takes the width, and the width is used: `MEASURE` still caps
 * every paragraph at 66 characters, so nothing that is prose gets longer, and
 * what spreads is the index row, which gains a third column for the metadata it
 * used to run in under the name. `mx-auto` only does anything past 78rem of
 * usable width, where holding left would put a third of a monitor in the margin.
 *
 * `hang-punct` is inherited, so one class here hangs punctuation in every
 * paragraph below it.
 */
export const PAGE = 'w-full max-w-[78rem] mx-auto pt-4 pb-nav hang-punct';

/**
 * A grammar of exactly two rules, and length is what says which is which.
 *
 * RULE_FULL is a full-measure hairline in the border tone, and marks a major
 * division: the foot of a list, the start of the notes about a holding.
 *
 * RULE_SHORT is 40px of bronze at low opacity, sitting under a section head and
 * stopping dead. A rule that does not run the full measure cannot be read as a
 * divider, so the eye takes it as a typographic gesture belonging to the head
 * above it, which is exactly the job.
 *
 * Never a third weight, and never these two doing each other's job within a
 * screenful.
 */
export const RULE_FULL = 'border-t border-tea-border';
/** The same rule, drawn under the block instead of over it. Same weight, same tone. */
export const RULE_UNDER = 'border-b border-tea-border';
export const RULE_SHORT = 'block w-10 h-px bg-tea-gold/40';

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

export function wisdomSections(previewEnabled: boolean): WisdomSection[] {
  return [
    { id: 'overview', label: 'Overview', path: '/wisdom' },
    { id: 'cultivars', label: 'Plants', path: '/wisdom/cultivars' },
    ...(previewEnabled ? [{ id: 'types', label: 'Types', path: '/wisdom/types' }] : []),
    { id: 'regions', label: previewEnabled ? 'Origins' : 'Regions', path: '/wisdom/regions' },
    { id: 'producers', label: 'Producers', path: '/wisdom/producers' },
    { id: 'marks', label: 'Marks', path: '/wisdom/marks' },
    { id: 'styles', label: 'Styles', path: '/wisdom/styles' },
    { id: 'named', label: 'Named', path: '/wisdom/named' },
  ];
}

/** The active build's holdings. Normal development, tests and production retain the established seven. */
export const WISDOM_SECTIONS: WisdomSection[] = wisdomSections(
  import.meta.env.MODE === 'tea-reference-preview',
);

/**
 * Which holding a path belongs to. Singular detail routes and plural index
 * routes answer the same, so /wisdom/cultivar/jin-xuan lights "Plants" without
 * the page having to say so.
 */
export function sectionForPath(pathname: string): WisdomSection['id'] {
  const segment = pathname.replace(/^\/wisdom\/?/, '').split('/')[0] ?? '';
  if (!segment) return 'overview';
  if (segment === 'types' || segment === 'type' || segment === 'family') return 'types';
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
 * The strip as it is meant to be read: all seven holdings at once, in the order
 * the front door lists them. Wraps rather than scrolling sideways, because a nav
 * you have to discover by swiping is a nav half the readers never see.
 *
 * It is also the only wayfinding a detail page carries. A back link above it
 * saying "All tea plants" repeated what the lit "Plants" item already said, and
 * cost 44px at the top of every entry.
 */
const WisdomStrip: React.FC<{ active: WisdomSection['id'] }> = ({ active }) => (
  <nav aria-label="The wisdom base" className="flex flex-wrap items-center gap-x-6 border-b border-tea-border">
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

/**
 * The same seven holdings on a phone, where they do not fit on one line.
 *
 * Seven serif items need about 495px of line. At 390px, inside 16px of page
 * padding, there are 358px, so the strip wrapped to two 44px rows: 88px of
 * navigation above the title of every page, a tenth of the viewport, before a
 * reader had read a word. Shrinking the type to fit would have cost the strip
 * its one job, which is to be legible at a glance outdoors.
 *
 * So below sm it collapses to the holding you are in, and opens in place. Six
 * labels are hidden until asked for; nothing is unreachable, nothing scrolls
 * sideways, and the closed state still names where you are. The panel pushes
 * the page down rather than floating over it: this is a contents list, not a
 * menu that has to clear the app chrome.
 *
 * REFERENCE ONLY. DO NOT COPY THIS PATTERN INTO THE REST OF THE APP.
 *
 * Nothing else on Teajia collapses a nav this way, and that is deliberate
 * rather than an oversight nobody got to. The app's navigation is the sidebar
 * on desktop and the bottom tab bar on a phone, both of which are permanent,
 * both of which carry four items, and neither of which is ever allowed to
 * change without asking (see CLAUDE.md, "NEVER change without explicit
 * confirmation"). This is a seventh-level contents list inside one section of
 * one page, not app navigation, and it collapses because seven serif labels
 * genuinely do not fit on a 358px line.
 *
 * Three things have to be true before this earns promotion to a shared
 * primitive in src/components:
 *
 *   1. A second surface needs it. One caller is not a pattern, and a primitive
 *      built for one caller is a worse version of the caller.
 *   2. The second caller is also a contents list, not app navigation. The tab
 *      bar and the sidebar are locked surfaces and must not adopt this.
 *   3. The open state is still a push, not an overlay. A menu that floats has
 *      to clear the app chrome and obey the AnchoredMenu rules; this one does
 *      not float, which is what keeps it this small.
 *
 * Until all three hold, the right move for a new surface is to make its labels
 * fit, not to collapse them.
 */
const WisdomCompactNav: React.FC<{ active: WisdomSection['id'] }> = ({ active }) => {
  const [open, setOpen] = useState(false);
  const current = WISDOM_SECTIONS.find(section => section.id === active) ?? WISDOM_SECTIONS[0];

  return (
    <nav aria-label="The wisdom base" className="border-b border-tea-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="wisdom-holdings"
        onClick={() => setOpen(value => !value)}
        className="w-full min-h-[44px] flex items-center gap-2 text-left"
      >
        <span className={`${NAME_CLASS} text-tea-gold min-w-0 break-words`}>{current.label}</span>
        <ChevronDown
          size={15}
          aria-hidden
          className={`shrink-0 text-tea-text-sec transition-transform ${open ? 'rotate-180' : ''}`}
        />
        <span className={`${CELL_CLASS} text-tea-text-dim ml-auto shrink-0`}>
          {open ? 'Close' : `${WISDOM_SECTIONS.length} holdings`}
        </span>
      </button>

      {/* No fill on the open panel. It used to take the surface tone on the
          argument that a reader should be able to see which of the two states
          they are in without reading a word, which is right, but surface on the
          page background is 1.21:1 in dark mode and 1.15:1 in light, and a step
          is only perceptible from about 1.4. The state was being carried the
          whole time by the six rows appearing, each on its own hairline, and by
          the button's own label changing to Close. */}
      {open && (
        <ul id="wisdom-holdings" className="list-none m-0 p-0 pb-1 mb-2">
          {WISDOM_SECTIONS.filter(section => section.id !== active).map(section => (
            <li key={section.id} className="border-t border-tea-border first:border-t-0">
              <Link
                to={section.path}
                onClick={() => setOpen(false)}
                className={`flex items-center min-h-[44px] px-3 ${NAME_CLASS} text-tea-text-sec hover:text-tea-text transition-colors`}
              >
                {section.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
};

/**
 * One switcher, two shapes. `hidden` is display:none, so exactly one of them is
 * in the accessibility tree at any width and a screen reader never hears the
 * holdings twice.
 */
export const WisdomSubNav: React.FC<{ active: WisdomSection['id'] }> = ({ active }) => (
  <>
    <div className="sm:hidden">
      <WisdomCompactNav active={active} />
    </div>
    <div className="hidden sm:block">
      <WisdomStrip active={active} />
    </div>
  </>
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
    <article className={PAGE}>
      <WisdomSubNav active={sectionForPath(pathname)} />
      {/* The block reserved is the headword's, at its real height, so the page
          does not jump a line when the chunk lands. */}
      <div className="mt-7" aria-hidden>
        <div className="shimmer-warm h-3 w-[7rem] rounded-md" />
        <div className="shimmer-warm mt-3 h-9 sm:h-12 w-[17rem] max-w-full rounded-md" />
        <div className={`mt-10 ${AXIS_INDENT}`}>
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
