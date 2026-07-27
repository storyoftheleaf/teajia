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
import { Search } from 'lucide-react';
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
import { authorshipLine } from '../../wisdom/authorship';
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
 * One line of heading, and no eyebrow. The sub-nav strip above already says
 * which holding a reader is in, so repeating it cost 60px and told nobody
 * anything. Where a page carries a deck it sits inline with the title rather
 * than owning a line of its own.
 */
export const PageHead: React.FC<{ title: string; chineseName?: string; note?: string }> = ({
  title,
  chineseName,
  note,
}) => (
  <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
    <h1 className={`${TITLE_CLASS} text-tea-text`}>{title}</h1>
    {chineseName && <span className={`${NAME_CLASS} text-tea-text-sec`}>{chineseName}</span>}
    {note && <p className={`${FACT} max-w-[56ch]`}>{note}</p>}
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

/** Adrian's standard, stated as a direction rather than a claim. */
export const Invitation: React.FC<{ subject?: string }> = ({ subject }) => (
  <aside className="mt-14 pt-8 border-t border-tea-border">
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
  <div role="group" aria-label={label} className="flex items-center gap-x-5 min-w-0">
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
 * One row carrying everything functional: how the list is ordered on the left,
 * the search field and the live count on the right. The reference used to spend
 * a 68px band on the field alone and another on the count line beneath it.
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
  <div className="flex flex-wrap items-center gap-x-6 border-b border-tea-border">
    {children}
    <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-x-4 min-w-0">
      <div className="relative flex-1 sm:flex-none sm:w-[188px] min-w-0">
        <Search size={14} aria-hidden className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-tea-text-dim" />
        <input
          type="search"
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          placeholder={placeholder}
          aria-label={searchLabel}
          className={`${CELL_CLASS} w-full h-11 bg-transparent pl-5 pr-1 rounded-md text-tea-text placeholder:text-tea-text-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50`}
        />
      </div>
      <span className={`${LABEL} shrink-0 tabular-nums whitespace-nowrap`}>
        {visible === total ? `${total} ${noun}` : `${visible} / ${total}`}
      </span>
    </div>
  </div>
);

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
      <div
        aria-hidden
        className="hidden sm:grid sm:grid-cols-[var(--wisdom-cols)] items-baseline gap-x-4 pb-1.5 border-b border-tea-border"
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
 */
export const GroupHead: React.FC<{ label: string; count: number }> = ({ label, count }) => (
  <div className="flex items-baseline gap-2 pt-5 pb-1">
    <span className={isMicroCapsLabel(label) ? LABEL : `${CELL_CLASS} text-tea-text-dim`}>{label}</span>
    <span className={`${CELL_CLASS} text-tea-text-dim tabular-nums`}>{count}</span>
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

export type RowCell = string | CellLink | undefined;

const cellText = (cell: RowCell): string => (typeof cell === 'string' ? cell : (cell?.text ?? ''));

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
      <div
        className={`group relative ${ROW_LAYOUT} ${ROW_HOVER} min-h-[44px] py-2.5 -mx-2 px-2 rounded-md transition-colors`}
        style={columns ? columnStyle(columns) : undefined}
      >
        <span className="basis-full sm:basis-auto min-w-0 inline-flex items-baseline gap-2 flex-wrap">
          <Link
            to={to}
            className={`${NAME_CLASS} text-tea-text group-hover:text-tea-gold-lt transition-colors break-words after:absolute after:inset-0 after:content-['']`}
          >
            {name}
          </Link>
          {chineseName && <span className="font-display text-ui-15 text-tea-text-dim">{chineseName}</span>}
        </span>
        {cells.map((cell, index) =>
          typeof cell === 'object' && cell ? (
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
  <p className={`${FACT} py-10 text-center max-w-[46ch] mx-auto`}>
    {query?.trim() ? (
      <>
        No {noun} here answers to &ldquo;{query.trim()}&rdquo;. If one should, send it and it will be added.
      </>
    ) : (
      <>No {noun} here answers to that name. If one should, send it and it will be added.</>
    )}
  </p>
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
 * A labelled line on a detail page. The label sits in a fixed track so every
 * value starts at the same x down the page, the same reason the index columns
 * are fixed rather than right aligned.
 */
export const Fact: React.FC<{ label: string; children?: React.ReactNode }> = ({ label, children }) => {
  if (!children) return null;
  return (
    <div className="py-2.5 border-t border-tea-border sm:grid sm:grid-cols-[152px_minmax(0,1fr)] sm:gap-x-6">
      <span className={`${LABEL} block sm:pt-1`}>{label}</span>
      <span className={`${FACT_CLASS} text-tea-text max-w-[60ch] block`}>{children}</span>
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
 * Names only, across every holding. Deliberately not a full-text search: the
 * base carries paragraphs of climate and description, and matching inside them
 * would answer "Fujian" with a hundred rows and bury the plant someone asked
 * for. An exact name sorts above a leading match, which sorts above a partial.
 */
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
    where?: string,
  ) => {
    let rank = 3;
    for (const field of [name, chineseName, ...altNames]) {
      if (!field) continue;
      const key = searchKey(field);
      if (key === needle) rank = Math.min(rank, 0);
      else if (key.startsWith(needle)) rank = Math.min(rank, 1);
      else if (key.includes(needle)) rank = Math.min(rank, 2);
    }
    if (rank < 3) hits.push({ name, chineseName, holding, to, where, rank });
  };

  for (const cultivar of CULTIVARS) {
    consider(
      sectionLabel('cultivars'),
      `/wisdom/cultivar/${cultivar.id}`,
      cultivar.name,
      cultivar.chineseName,
      cultivar.altNames,
      cultivar.originRegion || cultivar.originCountry,
    );
  }
  for (const region of REGIONS) {
    consider(sectionLabel('regions'), `/wisdom/region/${region.id}`, region.name, undefined, [], region.country);
  }
  for (const producer of PRODUCERS) {
    consider(
      sectionLabel('producers'),
      `/wisdom/producer/${producer.id}`,
      producer.name,
      producer.chineseName,
      producer.altNames,
      [producer.region, producer.country].filter(Boolean).join(', ') || undefined,
    );
  }
  for (const mark of MARKS) {
    consider(sectionLabel('marks'), `/wisdom/mark/${mark.id}`, mark.name, mark.chineseName, mark.altNames, mark.era);
  }
  for (const style of STYLES) {
    consider(sectionLabel('styles'), `/wisdom/style/${style.id}`, style.name, style.chineseName, style.altNames, style.region);
  }
  for (const tea of NAMED_TEAS) {
    consider(sectionLabel('named'), `/wisdom/named/${tea.id}`, tea.name, tea.chineseName, tea.altNames, tea.type);
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
