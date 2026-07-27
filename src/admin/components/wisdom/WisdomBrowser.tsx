import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { AnchoredMenu } from '../../../components/shared/AnchoredMenu';
import { RungTag, rungSummary } from './Rung';
import { SearchBox } from './SearchBox';
import { PublicLink, WisdomDetailPanel, WisdomPanelNav, WisdomRoving } from './WisdomDetailPanel';
import type { WisdomUsage } from './usage';
import {
  ALL_FOLDED,
  AT_BLOCK,
  AT_FLEX,
  UNGROUPED,
  WISDOM_CHROME_BTN,
  WISDOM_HEADER_ROW,
  WISDOM_ROW,
  WISDOM_TYPE,
  compareWisdom,
  defaultPrefs,
  nearestWisdom,
  recogniseQuery,
  wisdomMatches,
  wisdomQueryTokens,
  wisdomStartsWith,
  type AnyWisdomHolding,
  type WisdomColumn,
  type WisdomEntryUsage,
  type WisdomGapCtx,
  type WisdomLink,
  type WisdomLinkCtx,
  type WisdomPrefs,
  type WisdomSection,
} from './config';

/**
 * One list engine for all seven holdings.
 *
 * Layout is a flex row, not a table, because the project forbids horizontal
 * scroll: a column that will not fit a 390px phone drops out at its breakpoint
 * and the name column absorbs the space, instead of the row growing sideways.
 * The column header row carries the same widths and breakpoints, so it degrades
 * with the columns it labels rather than drifting out of alignment.
 *
 * A row is a `div` with `role="button"`, not a `<button>`. Two things need that:
 * a held relation inside a row (a mark's producer) is its own control, and
 * nesting a button inside a button is invalid; and roving `tabIndex` gives the
 * list one tab stop instead of 316, so arrow keys can own movement.
 */

/** How many rows enter the DOM at once. Varieties is 316 and still growing. */
const PAGE = 150;

/** How long a type-ahead burst stays one word before the next key starts over. */
const TYPE_AHEAD_MS = 900;

/**
 * How far the reader has to travel before the chrome gives its room back.
 *
 * A band rather than a line, so the state has hysteresis: the strip does not
 * flicker on a one-pixel scroll, and shrinking the chrome can never pull the
 * sentinel back into view and start the whole thing oscillating.
 */
const CONDENSE_AT = 48;

/**
 * What the keyboard does, said once where the keyboard is.
 *
 * Same shape as the product edit panel's hint bar, deliberately: quiet, one
 * line, micro-caps, dot separated. A second pattern for the same job would be a
 * second thing to learn. The last hint names the axis the keys jump by, because
 * that axis follows the sort and the grouping and is no longer always the name.
 */
const keyHints = (jumpLabel: string) =>
  ['↑ ↓ move', 'Home End jump', 'Enter open', `Type → ${jumpLabel}`] as const;

interface Props {
  holding: AnyWisdomHolding;
  /**
   * The tab strip, rendered inside this component's sticky chrome block. It
   * lives here rather than in the view so that the tabs, the toolbar, the count
   * line and the column header stick as one unit at one offset. A wrapping tab
   * strip has no fixed height, so a second sticky element below it could not
   * know what offset to use.
   *
   * Called with `condensed`, which is true once the reader has scrolled past the
   * top: the strip is expected to answer with a single-line switcher then, which
   * this component seats inside the toolbar row instead of above it.
   */
  tabs: (condensed: boolean) => React.ReactNode;
  /** The open entry. Owned by the address, so an entry can be linked to. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Walks a held relation into another holding. */
  onJump: (link: WisdomLink) => void;
  /**
   * The other holdings, so a query the base recognises SOMEWHERE can say so
   * even when it is not held here. Optional: the engine runs standalone.
   */
  siblings?: readonly AnyWisdomHolding[];
  /**
   * Sort, grouping and folded sections, owned by the view so they survive a tab
   * change. Search is not here, and must not be: it stays local and resets on
   * every switch. Optional, so the engine still works with no one holding its
   * preferences.
   */
  prefs?: WisdomPrefs;
  onPrefsChange?: (prefs: WisdomPrefs) => void;
  /**
   * A query carried in by a link, which is how a count in another holding's
   * panel ("and 30 more") becomes somewhere to go. Read on arrival only; what
   * the reader types afterwards is theirs.
   */
  initialQuery?: string;
  /**
   * Reports every keystroke back to whoever owns the address.
   *
   * Without this the address and the field disagreed from the first character
   * typed: the address still carried the query the screen was opened with, the
   * field carried what had been typed since, and a link copied at that moment
   * sent a colleague to a different list than the one on screen. That is a wrong
   * answer, not a missing feature, so the field writes back.
   *
   * Optional, because the engine still runs standalone with nobody listening.
   */
  onQueryChange?: (query: string) => void;
  /** How many products resolve through each entry. Absent until they load. */
  usage?: WisdomUsage;
}

interface Section {
  key: string;
  /** Null when nothing is grouped: one nameless section holding every row. */
  label: string | null;
  rows: unknown[];
}

const textAlign = (column: WisdomColumn<unknown>) => (column.align === 'right' ? 'text-right' : 'text-left');
const justify = (column: WisdomColumn<unknown>) => (column.align === 'right' ? 'justify-end' : 'justify-start');

/** The chrome's one connective: a dot between statements, never a word. */
const joinDots = (parts: React.ReactNode[]): React.ReactNode =>
  parts
    .filter(part => part !== null && part !== false && part !== undefined)
    .map((part, index) => (
      <React.Fragment key={index}>
        {index > 0 && <span className="px-1.5 text-tea-border" aria-hidden="true">·</span>}
        {part}
      </React.Fragment>
    ));

export const WisdomBrowser: React.FC<Props> = ({
  holding, tabs, selectedId, onSelect, onJump, siblings, prefs, onPrefsChange,
  initialQuery = '', onQueryChange, usage,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const nameColumn = holding.columns[0];

  /**
   * The field is held here and mirrored into the address, rather than read out
   * of it, so a keystroke never waits on a router round trip. `seeded` is what
   * the address last said: an arriving query that differs from it is a link
   * being followed and takes the field; one that matches is the echo of what was
   * just typed and is ignored.
   */
  const seeded = useRef(initialQuery);
  useEffect(() => {
    if (initialQuery === seeded.current) return;
    seeded.current = initialQuery;
    setQuery(initialQuery);
  }, [initialQuery]);

  const changeQuery = useCallback((next: string) => {
    seeded.current = next;
    setQuery(next);
    onQueryChange?.(next);
  }, [onQueryChange]);

  // Preferences live with whoever holds them across tab changes; when nobody
  // does, the engine keeps its own copy so it still runs on its own.
  const [ownPrefs, setOwnPrefs] = useState<WisdomPrefs>(() => defaultPrefs(holding));
  const held = prefs ?? ownPrefs;
  const { sort, groupKey } = held;
  const setPrefs = onPrefsChange ?? setOwnPrefs;

  /**
   * Folded sections travel as an array and are used as a set, with one
   * sentinel: `ALL_FOLDED` means the whole shape, whatever it currently is.
   * That is both what the reader pressed and three characters in the address
   * instead of the sixteen country names it would otherwise have to list.
   */
  const foldedAll = held.collapsed.length === 1 && held.collapsed[0] === ALL_FOLDED;
  const collapsed = useMemo(() => new Set(held.collapsed), [held.collapsed]);
  /**
   * Takes the section rather than its key, because the ungrouped case is one
   * nameless section holding every row, and "fold the whole shape" must never
   * mean "hide the list". Absence of a heading is absence of a thing to fold.
   */
  const isFolded = useCallback(
    (section: { key: string; label: string | null }) =>
      section.label !== null && (foldedAll || collapsed.has(section.key)),
    [foldedAll, collapsed],
  );
  const setCollapsed = useCallback(
    (next: readonly string[]) => setPrefs({ sort, groupKey, collapsed: next }),
    [groupKey, setPrefs, sort],
  );

  /** Showing only the rows that are missing the thing the gap line names. */
  const [gapOnly, setGapOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [focusIndex, setFocusIndex] = useState(0);
  /** What has been typed at the list, shown back so the jump is not a mystery. */
  const [typed, setTyped] = useState('');
  /** True once the reader is past the top and the chrome should give room back. */
  const [condensed, setCondensed] = useState(false);

  const rowNodes = useRef(new Map<string, HTMLDivElement>());
  const wantFocus = useRef(false);
  const typeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const linkCtx: WisdomLinkCtx = useMemo(() => ({ jump: onJump }), [onJump]);

  /**
   * Find, using the wisdom base's own rule rather than `String.includes`.
   *
   * Two things change. Punctuation and spacing fold away, so "dahongpao" finds
   * "Da Hong Pao" the way the import editor already does. And a number is never
   * cut in half, so a search for 7572 does not report 75720 as a hit.
   */
  const tokens = useMemo(() => wisdomQueryTokens(query), [query]);

  /**
   * What the BASE makes of the query, as opposed to what a substring search
   * makes of it. Pinning a recognised entry to the top used to look exactly like
   * a lucky substring hit, so the recognition now says itself, above the rows.
   */
  const recognition = useMemo(
    () => recogniseQuery(query, holding, siblings),
    [query, holding, siblings],
  );

  /**
   * What a gap test may ask about the account, as opposed to about the base.
   *
   * Regions is the holding that needs it: a place is a hole when nothing names
   * it, and the account's own products are part of "nothing". Absent until they
   * load, which every gap test handles by answering from the base alone, so the
   * count starts as an over-count and narrows rather than jumping.
   */
  const gapCtx = useMemo<WisdomGapCtx | undefined>(() => {
    if (!usage || usage.total === 0) return undefined;
    const bucket = usage.byHolding.get(holding.id);
    return { used: (id: string) => bucket?.get(id)?.count ?? 0 };
  }, [usage, holding]);

  /** The rows the gap line is counting. Computed once, and it is also the filter. */
  const gapRows = useMemo(
    () => (holding.gap ? holding.rows.filter(row => holding.gap!.test(row, gapCtx)) : []),
    [holding, gapCtx],
  );

  const filtered = useMemo(() => {
    const base = gapOnly ? gapRows : holding.rows;
    const rows = tokens.length
      ? base.filter(row => wisdomMatches(holding.searchText(row), tokens))
      : [...base];

    const column = holding.columns.find(entry => entry.key === sort.key) ?? nameColumn;
    rows.sort((left, right) => {
      const order = compareWisdom(column.value(left), column.value(right), sort.direction);
      // Name is the tiebreaker everywhere, so equal values never shuffle.
      return order !== 0 ? order : compareWisdom(nameColumn.value(left), nameColumn.value(right), 'asc');
    });

    // When the base itself recognises the query as one of its entries, that
    // entry leads. Typing a recipe mark should land on the mark, not on the
    // fourth row that happens to mention it. It is never pinned into a filtered
    // view it does not belong to: a gap list that grew a row without the gap
    // would be a lie about the count above it.
    const recognised = recognition?.own ? recognition.row : null;
    if (recognised) {
      const id = holding.idOf(recognised);
      const at = rows.findIndex(row => holding.idOf(row) === id);
      if (at > 0) rows.unshift(...rows.splice(at, 1));
      else if (at < 0 && !gapOnly) rows.unshift(recognised);
    }
    return rows;
  }, [gapOnly, gapRows, holding, nameColumn, recognition, sort, tokens]);

  /**
   * The entries the query nearly asked for. Only ever computed on an empty list,
   * which is the one moment a matcher earns its keep and the screen would
   * otherwise say nothing at all.
   *
   * A list, not a winner. One candidate chosen silently is right only when there
   * is one, and a query sitting two edits from three different entries is
   * exactly the case where the reader, not the edit distance, knows which word
   * they meant.
   */
  const nearMisses = useMemo(
    () => (filtered.length === 0 && !recognition ? nearestWisdom(query, holding, siblings) : []),
    [filtered.length, holding, query, recognition, siblings],
  );

  const group = useMemo(
    () => holding.groups?.find(entry => entry.key === groupKey) ?? null,
    [holding, groupKey],
  );

  const sections = useMemo<Section[]>(() => {
    if (!group) return [{ key: '', label: null, rows: filtered }];
    const buckets = new Map<string, unknown[]>();
    for (const row of filtered) {
      const key = group.of(row) || UNGROUPED;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(row);
      else buckets.set(key, [row]);
    }
    // Rows with no answer collect at the end. Absence is not a heading.
    return [...buckets.entries()]
      .sort(([left], [right]) =>
        left === UNGROUPED ? 1 : right === UNGROUPED ? -1 : left.localeCompare(right))
      .map(([key, rows]) => ({ key, label: key, rows }));
  }, [filtered, group]);

  /** Every row a reader can currently reach, in the order it appears. */
  const ordered = useMemo(
    () => sections.filter(section => !isFolded(section)).flatMap(section => section.rows),
    [sections, isFolded],
  );

  /** The rows actually mounted: one page at a time, spent across the sections. */
  const paged = useMemo(() => {
    let budget = limit;
    return sections.map(section => {
      if (isFolded(section)) return { ...section, shown: [] as unknown[] };
      const shown = section.rows.slice(0, Math.max(0, budget));
      budget -= shown.length;
      return { ...section, shown };
    });
  }, [sections, isFolded, limit]);

  const shownCount = Math.min(limit, ordered.length);

  /**
   * Grow the list as the reader approaches its end, rather than on a press.
   *
   * The sentinel is the paging strip itself, which only exists while there is
   * more to show and unmounts the moment there is not, so the observer cannot
   * run away with itself. `rootMargin` fires it a screen early, so the rows are
   * already mounted by the time they are wanted. Root is the viewport on
   * purpose: this view does not own a scroll container, its admin ancestor does.
   */
  const growObserver = useRef<IntersectionObserver | null>(null);

  const growNode = useCallback((node: HTMLDivElement | null) => {
    growObserver.current?.disconnect();
    growObserver.current = null;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) setLimit(current => current + PAGE);
      },
      { rootMargin: '600px' },
    );
    observer.observe(node);
    growObserver.current = observer;
  }, []);

  useEffect(() => () => growObserver.current?.disconnect(), []);

  /**
   * The same trick, pointed the other way, to answer one question: has the
   * reader left the top of the list?
   *
   * A 48px band pinned to the very top of the content, absolutely positioned so
   * it occupies no space of its own. While any of it is in view the chrome shows
   * everything; once it is gone the tab strip collapses to its active label and
   * the keyboard hint band steps out, which is 53px of desktop and 76px of phone
   * handed back to the rows. Root is the viewport again, and the admin scroll
   * container clips it exactly as it clips the paging sentinel.
   */
  const topObserver = useRef<IntersectionObserver | null>(null);

  const topNode = useCallback((node: HTMLDivElement | null) => {
    topObserver.current?.disconnect();
    topObserver.current = null;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      const entry = entries[entries.length - 1];
      if (entry) setCondensed(!entry.isIntersecting);
    });
    observer.observe(node);
    topObserver.current = observer;
  }, []);

  useEffect(() => () => topObserver.current?.disconnect(), []);

  // A new question deserves a fresh first page and a fresh cursor. Depends on
  // the primitives, not on the sort object: `prefs` arrives as a prop now, and
  // an identity change on every render would silently undo every page grown.
  useEffect(() => {
    setLimit(PAGE);
    setFocusIndex(0);
  }, [query, sort.key, sort.direction, groupKey, gapOnly]);

  const summary = useMemo(() => rungSummary(holding.rows.map(row => holding.idOf(row))), [holding]);
  const selected = selectedId ? holding.rows.find(row => holding.idOf(row) === selectedId) ?? null : null;
  const selectedIndex = selectedId ? ordered.findIndex(row => holding.idOf(row) === selectedId) : -1;

  /**
   * Which heading the open entry sits under. Prev and next walk straight across
   * a section boundary, and without this the panel changed its subject in
   * silence: the last Menghai mark and the first Xiaguan one looked alike.
   */
  const selectedSection = useMemo<WisdomSection | undefined>(() => {
    if (!group || !selectedId) return undefined;
    const section = sections.find(entry => entry.rows.some(row => holding.idOf(row) === selectedId));
    return section?.label ? { group: group.label, name: section.label } : undefined;
  }, [group, sections, selectedId, holding]);

  /** What an edit to one entry would move, in products, right now, and which ones. */
  const entryUsage = (id: string): WisdomEntryUsage | undefined => {
    if (!usage || usage.total === 0) return undefined;
    const held = usage.byHolding.get(holding.id)?.get(id);
    return { count: held?.count ?? 0, total: usage.total, products: held?.products ?? [] };
  };

  /**
   * The gap and the grouping, made one gesture.
   *
   * Marks stated the same fact twice and joined them nowhere: the line counted
   * the marks naming no held producer, and grouping by producer piled those
   * exact rows under one heading. A reader had to know both controls and think
   * to use them together. Showing the gap now sets the grouping that reveals it,
   * so the heading names the reason the rows are here; putting the gap away
   * gives the reader back the grouping they had, because the grouping was
   * borrowed, not chosen.
   */
  const borrowedGroup = useRef<string | null>(null);

  const toggleGapOnly = () => {
    const next = !gapOnly;
    setGapOnly(next);
    const reveal = holding.gap?.revealBy;
    if (!reveal || !holding.groups?.some(option => option.key === reveal)) return;
    if (next) {
      if (groupKey === reveal) return;
      borrowedGroup.current = groupKey;
      setPrefs({ sort, groupKey: reveal, collapsed: [] });
    } else if (borrowedGroup.current !== null) {
      setPrefs({ sort, groupKey: borrowedGroup.current, collapsed: [] });
      borrowedGroup.current = null;
    }
  };

  const toggleSort = (key: string) =>
    setPrefs({
      sort:
        sort.key === key
          ? { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
          : { key, direction: 'asc' },
      groupKey,
      collapsed: held.collapsed,
    });

  /** Moves the cursor, growing the page when it walks off the end of it. */
  const moveFocus = useCallback((next: number) => {
    if (next < 0 || next >= ordered.length) return;
    setLimit(current => (next < current ? current : Math.ceil((next + 1) / PAGE) * PAGE));
    wantFocus.current = true;
    setFocusIndex(next);
  }, [ordered.length]);

  useEffect(() => {
    if (!wantFocus.current) return;
    const row = ordered[focusIndex];
    if (!row) return;
    const node = rowNodes.current.get(holding.idOf(row));
    if (!node) return;
    wantFocus.current = false;
    node.focus({ preventScroll: true });
    node.scrollIntoView({ block: 'nearest' });
  }, [focusIndex, ordered, holding, limit]);

  /**
   * With the panel open the arrows read THROUGH the holding, the way they move
   * the product panel through the inventory. Left and right do the same thing as
   * up and down, because the panel's own toolbar is a left/right pair.
   *
   * Inside a chip group they do not: `data-wisdom-roving` marks a group that
   * owns its own arrows, so lineage links and fact chips can be walked without
   * the whole panel changing subject underneath them.
   */
  const step = useCallback((delta: number) => {
    if (selectedIndex < 0) return;
    const next = ordered[selectedIndex + delta];
    if (!next) return;
    setLimit(current => {
      const wanted = selectedIndex + delta + 1;
      return wanted <= current ? current : Math.ceil(wanted / PAGE) * PAGE;
    });
    setFocusIndex(selectedIndex + delta);
    onSelect(holding.idOf(next));
  }, [holding, onSelect, ordered, selectedIndex]);

  useEffect(() => {
    if (!selected) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (typing) return;
      if (target?.closest('[data-wisdom-roving]')) return;
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { step(-1); event.preventDefault(); }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { step(1); event.preventDefault(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, step]);

  /**
   * The axis the list is currently ordered on, which is what type-ahead has to
   * jump by.
   *
   * Pressing M in Marks used to jump by mark number even when the screen was
   * grouped by producer and the reader was plainly looking at "Menghai". The
   * grouping wins where there is one, because it is the coarsest thing on
   * screen; failing that the sort column; failing that the name.
   */
  const jumpBy = useMemo(() => {
    if (group) return { label: group.label, value: (row: unknown) => group.of(row) };
    const column = holding.columns.find(entry => entry.key === sort.key);
    if (column && column.key !== nameColumn.key) return { label: column.label, value: column.value };
    return { label: nameColumn.label, value: nameColumn.value };
  }, [group, holding, nameColumn, sort.key]);

  /**
   * Type-ahead, the way a native list does it: press L and land on the first L.
   *
   * It cannot fight the find field, because this handler is bound to the rows
   * container and returns immediately unless a ROW has focus; the find input is
   * outside that container entirely. A burst is one word for 900ms, and a key
   * that matches nothing against the burst is treated as the start of a new one
   * rather than jamming the buffer.
   */
  const typeAhead = useCallback((key: string) => {
    const first = (typed_: string) =>
      ordered.findIndex(row => wisdomStartsWith(jumpBy.value(row), typed_));
    const extended = typed + key;
    let word = extended;
    let at = first(extended);
    if (at < 0) { word = key; at = first(key); }
    if (typeTimer.current) clearTimeout(typeTimer.current);
    typeTimer.current = setTimeout(() => setTyped(''), TYPE_AHEAD_MS);
    setTyped(word);
    if (at >= 0) moveFocus(at);
  }, [jumpBy, moveFocus, ordered, typed]);

  useEffect(() => () => { if (typeTimer.current) clearTimeout(typeTimer.current); }, []);

  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Only a row drives the cursor. A group header lives in this container too,
    // and Enter on it must collapse the group, not open the row behind it.
    if (!(event.target as HTMLElement).closest('[data-wisdom-id]')) return;
    if (event.key === 'ArrowDown') { moveFocus(focusIndex + 1); event.preventDefault(); }
    else if (event.key === 'ArrowUp') { moveFocus(focusIndex - 1); event.preventDefault(); }
    else if (event.key === 'Home') { moveFocus(0); event.preventDefault(); }
    else if (event.key === 'End') { moveFocus(ordered.length - 1); event.preventDefault(); }
    else if (event.key === 'Enter' || event.key === ' ') {
      const row = ordered[focusIndex];
      if (row) { onSelect(holding.idOf(row)); event.preventDefault(); }
    }
    // Space is already Enter here, so it stays out of the buffer.
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      typeAhead(event.key);
      event.preventDefault();
    }
  };

  const sortable = holding.columns.filter(column => column.sortable !== false);

  const sortColumn = holding.columns.find(column => column.key === sort.key) ?? nameColumn;
  /** The current sort, in words. The header arrow is not readable on a phone. */
  const sortText = `sorted by ${sortColumn.label} ${sort.direction === 'asc' ? '↑' : '↓'}`;

  const sortMenu = (
    <AnchoredMenu
      align="right"
      width={176}
      role="listbox"
      trigger={props => (
        <button {...props} className={WISDOM_CHROME_BTN} aria-label={`Sort ${holding.noun}`}>
          Sort
        </button>
      )}
    >
      {close =>
        sortable.map(column => {
          const isCurrent = sort.key === column.key;
          return (
            <button
              key={column.key}
              role="option"
              aria-selected={isCurrent}
              onClick={() => {
                toggleSort(column.key);
                close();
              }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-ui-12 ${
                isCurrent ? 'text-tea-gold' : 'text-tea-text-sec'
              }`}
            >
              <span>{column.label}</span>
              {isCurrent &&
                (sort.direction === 'asc' ? (
                  <ArrowUp size={13} aria-hidden="true" />
                ) : (
                  <ArrowDown size={13} aria-hidden="true" />
                ))}
            </button>
          );
        })
      }
    </AnchoredMenu>
  );

  /**
   * The inventory's own Group control, not a second one invented here: same
   * AnchoredMenu, same listbox role, same None-first option list, same check.
   */
  const groupMenu = holding.groups && holding.groups.length > 0 && (
    <AnchoredMenu
      align="right"
      width={176}
      role="listbox"
      trigger={props => (
        <button {...props} className={WISDOM_CHROME_BTN} aria-label={`Group ${holding.noun}`}>
          Group
        </button>
      )}
    >
      {close =>
        [{ key: '', label: 'None' }, ...holding.groups!].map(option => {
          const isCurrent = groupKey === option.key;
          return (
            <button
              key={option.key || 'none'}
              role="option"
              aria-selected={isCurrent}
              onClick={() => {
                // A new grouping produces new headings, so the folded set from
                // the old one means nothing and is dropped rather than kept.
                // It is also a grouping the reader chose, so the gap toggle no
                // longer has one on loan to give back.
                borrowedGroup.current = null;
                setPrefs({ sort, groupKey: option.key, collapsed: [] });
                close();
              }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-ui-12 ${
                isCurrent ? 'text-tea-gold' : 'text-tea-text-sec'
              }`}
            >
              <span>{option.label}</span>
              {isCurrent && <Check size={13} aria-hidden="true" />}
            </button>
          );
        })
      }
    </AnchoredMenu>
  );

  /**
   * Fold the whole shape, or open it, in one press.
   *
   * Sixteen country sections is sixteen presses to see the shape of the list,
   * which is the whole reason to group it. Only appears with a grouping on,
   * because with none there is one nameless section and nothing to fold. The
   * word shortens on a phone, where the toolbar has 366px to seat four controls
   * and "Collapse all" is a third of it.
   */
  const allCollapsed = foldedAll || (sections.length > 0 && sections.every(section => collapsed.has(section.key)));

  const foldAll = group && (
    <button
      type="button"
      onClick={() => setCollapsed(allCollapsed ? [] : [ALL_FOLDED])}
      className={WISDOM_CHROME_BTN}
      aria-label={allCollapsed ? `Expand all ${holding.noun}` : `Collapse all ${holding.noun}`}
    >
      <span className="hidden md:inline">{allCollapsed ? 'Expand all' : 'Collapse all'}</span>
      <span className="md:hidden">{allCollapsed ? 'Open' : 'Fold'}</span>
    </button>
  );

  /**
   * The count, the sort, the shape of the grouping and the shape of the
   * authorship rungs. This is what replaces a column that read "DRAFTED" on all
   * 79 rows. It is a sentence, so it never wears micro-caps.
   *
   * The rung summary is the one part a phone drops. Everything before it changes
   * with what the reader just did; the rungs are the same all day.
   */
  const statusLine = (withRung: boolean) =>
    joinDots([
      filtered.length === holding.rows.length
        ? `${holding.rows.length} ${holding.noun}`
        : `${filtered.length} of ${holding.rows.length} ${holding.noun}`,
      gapOnly ? 'gaps only' : null,
      sortText,
      group ? `${sections.length} by ${group.label.toLowerCase()}` : null,
      withRung ? summary : null,
    ]);

  /**
   * The reach sentence with its public address turned into the link it was
   * always describing. Split rather than appended, so the sentence still reads
   * as one sentence and the address stays where it makes sense.
   */
  const reachLine = useMemo<React.ReactNode>(() => {
    const index = holding.publicRef?.index;
    const at = index ? holding.reach.indexOf(index) : -1;
    if (!index || at < 0) return holding.reach;
    return (
      <>
        {holding.reach.slice(0, at)}
        <PublicLink href={index}>
          <span className="underline underline-offset-2">{index}</span>
        </PublicLink>
        {holding.reach.slice(at + index.length)}
      </>
    );
  }, [holding]);

  /**
   * The load on the whole holding, under the sentence that says where it is
   * read. Reach is the wiring; this is the traffic on it.
   */
  const holdingUsage = usage && usage.total > 0 ? (usage.byHoldingTotal.get(holding.id) ?? 0) : null;

  const renderRow = (row: unknown, index: number) => {
    const id = holding.idOf(row);
    const isFocused = index === focusIndex;
    return (
      <div
        key={id}
        role="button"
        tabIndex={isFocused ? 0 : -1}
        data-wisdom-id={id}
        aria-current={id === selectedId ? 'true' : undefined}
        ref={node => {
          if (node) rowNodes.current.set(id, node);
          else rowNodes.current.delete(id);
        }}
        onClick={event => {
          // Safari does not focus a clicked div, so the cursor would stay where
          // it was and the panel would have nowhere to hand focus back to.
          event.currentTarget.focus({ preventScroll: true });
          onSelect(id);
        }}
        onFocus={() => setFocusIndex(index)}
        className={`${WISDOM_ROW} cursor-pointer transition-colors hover:bg-tea-accent-sub focus:outline-none focus-visible:bg-tea-accent-sub ${
          id === selectedId ? 'bg-tea-accent-sub' : ''
        }`}
      >
        {holding.columns.map((column, columnIndex) => {
          const content = column.render ? column.render(row, linkCtx) : (column.value(row) ?? null);
          if (columnIndex === 0) {
            return (
              <span key={column.key} className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
                {content}
                <RungTag id={id} />
              </span>
            );
          }
          return (
            <span
              key={column.key}
              className={`${column.width} shrink-0 truncate ${AT_BLOCK[column.at ?? 'always']} ${textAlign(column)} ${WISDOM_TYPE.fact}`}
            >
              {content}
            </span>
          );
        })}
      </div>
    );
  };

  let cursor = 0;

  return (
    <div className="relative">
      {/* Occupies no space and answers one question: is the reader still at the
          top? Absolutely positioned so measuring the scroll costs no layout, and
          transparent to the pointer so it can never swallow a press meant for
          the chrome it sits under. */}
      <div
        ref={topNode}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{ height: CONDENSE_AT }}
      />

      {/* All chrome sticks as one block: tabs, toolbar, the count-or-keys band,
          column header.
          At the top of the list that is 57 + 44 + 24 + 23 = 148px on a desktop,
          and on a 390px phone the seven tabs wrap to three 44px tap targets, so
          153 + 44 + 24 + 23 = 244px, which is nearly six rows of furniture.
          Once the reader has moved it is 44 + 23 = 67px on a desktop and
          44 + 24 + 23 = 91px on a phone: the tab strip becomes its active label
          seated in the toolbar, and the keyboard hints step out. The phone keeps
          its band, because that is where the count and the sort direction are
          legible and a phone has no column arrow it can read.
          Nothing is skipped when it happens. The height comes out of the flow
          ABOVE the rows at the same moment it comes off the sticky block, so the
          first row under the chrome stays exactly where it was and the list
          simply grows upward into the room. */}
      <div className="sticky top-0 z-sticky bg-tea-bg">
        {!condensed && tabs(false)}

        {/* Toolbar: find on the left, utilities as micro-caps on the right.
            From md the count rides here in the space the toolbar was wasting,
            which buys the whole screen a line back.
            It wraps rather than scrolls, per the project rule. In practice it
            will not need to: the find field is the only elastic thing in the row
            and it shrinks, so at 390px the row seats the condensed switcher, the
            field and three 44px tap targets on one line with about 100px of
            field left. The wrap is there for the phone narrower than any we
            support, where a second row is right and a sideways scroll never is.
            `min-h-[40px]` rather than `h-10`: the utilities carry `tap-target`,
            which is a 44px floor, and a fixed 40px row was quietly letting them
            overflow it by two pixels at each end. */}
        <div className="flex min-h-[40px] flex-wrap items-center gap-x-3 gap-y-1 px-3 md:gap-x-4 md:px-4">
          {condensed && <div className="shrink-0">{tabs(true)}</div>}
          <SearchBox value={query} onChange={changeQuery} placeholder={holding.placeholder} />
          <p className="hidden min-w-0 shrink truncate text-ui-11 text-tea-text-dim md:block">
            {typed ? (
              <span className="font-mono text-tea-gold">
                Jumping to {typed} by {jumpBy.label.toLowerCase()}
              </span>
            ) : (
              statusLine(true)
            )}
          </p>
          <div className="flex shrink-0 items-center gap-3">{foldAll}{sortMenu}{groupMenu}</div>
        </div>

        {/* One band, two jobs at two sizes. A phone has no keyboard to hint at
            and does need the count and the sort; a desktop carries both up in
            the toolbar and has the room here for what the keys do. Once the
            reader has scrolled, the desktop half steps out entirely: the hints
            have been read by then, and 24px of permanent furniture above a 36px
            row is a line of the list. */}
        <div
          className={`flex h-6 items-center gap-3 px-3 md:px-4 ${condensed ? 'md:hidden' : ''}`}
          data-testid="wisdom-status-band"
        >
          <p className="min-w-0 truncate text-ui-11 text-tea-text-dim md:hidden">{statusLine(false)}</p>
          <div className="hidden min-w-0 items-center gap-3 md:flex" data-testid="wisdom-key-hints">
            {keyHints(jumpBy.label).map((hint, index) => (
              <React.Fragment key={hint}>
                {index > 0 && <span className="text-ui-10 text-tea-border" aria-hidden="true">·</span>}
                <span className={WISDOM_TYPE.label}>{hint}</span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* No ARIA table roles: the rows below are buttons, not grid cells, and
            `aria-sort` only carries meaning inside a real table or grid. The
            sort state rides in each button's label instead, where a screen
            reader will actually read it. */}
        <div
          className={`${WISDOM_HEADER_ROW} border-y border-tea-border`}
          data-testid="wisdom-column-row"
        >
          {holding.columns.map((column, index) => {
            const canSort = column.sortable !== false;
            const isCurrent = sort.key === column.key;
            const width = index === 0 ? 'flex-1 min-w-0' : `${column.width} shrink-0`;
            return (
              <div
                key={column.key}
                className={`${width} ${AT_FLEX[column.at ?? 'always']} ${justify(column)} ${textAlign(column)} ${WISDOM_TYPE.label} items-center`}
              >
                {canSort ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    aria-label={
                      isCurrent
                        ? `Sort by ${column.label}, currently ${sort.direction === 'asc' ? 'ascending' : 'descending'}`
                        : `Sort by ${column.label}`
                    }
                    className="group inline-flex min-h-[24px] min-w-0 select-none items-center gap-1 transition-colors hover:text-tea-text"
                  >
                    <span className="truncate">{column.label}</span>
                    {isCurrent ? (
                      sort.direction === 'asc'
                        ? <ArrowUp size={10} className="shrink-0 text-tea-gold" />
                        : <ArrowDown size={10} className="shrink-0 text-tea-gold" />
                    ) : (
                      <ArrowUpDown size={10} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </button>
                ) : (
                  <span className="truncate">{column.label}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Where this holding is read, what is currently riding on it, and the
          fact that it is read only.
          It used to sit under the rows, which on Varieties is under 316 of them
          and is the one place on the screen nobody arrives at. It is orientation:
          what this holding answers for, and what an edit to it would move. That
          is worth reading BEFORE the rows and worthless after them, so it reads
          first and then scrolls away for good. It sits outside the sticky block
          on purpose, so it costs the list nothing but its first 55 pixels.
          The public address inside the sentence is the link to it: an operator
          checking how a correction reads to a customer was retyping it by hand. */}
      <div className="border-b border-tea-border px-3 py-1.5 md:px-4" data-testid="wisdom-reach">
        <p className="max-w-3xl text-ui-11 leading-[1.6] text-tea-text-dim">
          {reachLine}{' '}
          {holdingUsage !== null && (
            <span data-testid="wisdom-holding-usage">
              {holdingUsage === 0
                ? `None of the ${usage!.total} products in this account resolve through it today.`
                : `${holdingUsage} of the ${usage!.total} products in this account resolve through it today.`}{' '}
            </span>
          )}
          Read only. Entries change by re-running the build from the source data.
        </p>
      </div>

      {/* A hole in the data, counted. Forty-five cultivars naming a place the
          base does not hold is a work queue; the same forty-five met one row at
          a time is a shrug. Stated only when there is something to state, and
          the count is also the way to see exactly those rows. */}
      {holding.gap && gapRows.length > 0 && (
        <div
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-tea-border px-3 py-1.5 md:px-4"
          data-testid="wisdom-gap"
        >
          <p className="min-w-0 text-ui-11 leading-[1.5] text-tea-text-dim">
            {holding.gap.sentence(gapRows.length, holding.rows.length)}
          </p>
          <button
            type="button"
            onClick={toggleGapOnly}
            aria-pressed={gapOnly}
            className="shrink-0 text-ui-11 text-tea-gold transition-colors hover:text-tea-gold-lt"
          >
            {gapOnly ? 'Show all' : 'Show only these'}
          </button>
          {/* Said, not done silently. The reader pressed one control and two
              things moved, and a grouping that changes without a word is the
              kind of thing that reads as a bug the first time it happens. */}
          {gapOnly && borrowedGroup.current !== null && group && (
            <p className="min-w-0 text-ui-11 text-tea-text-dim" data-testid="wisdom-gap-grouped">
              Grouped by {group.label.toLowerCase()} to show them. Show all gives your grouping back.
            </p>
          )}
        </div>
      )}

      {/* Why the first row is the first row. A recognised entry has been pinned
          there since round two, and it looked identical to a lucky substring
          hit. It says so now, in one line, naming the holding it belongs to,
          which is what makes the cross-holding case worth anything: a recipe
          mark typed while reading varieties is held, just not here. */}
      {recognition && (
        <p
          className="flex flex-wrap items-baseline gap-x-2 border-b border-tea-border px-3 py-1.5 text-ui-11 text-tea-text-dim md:px-4"
          data-testid="wisdom-recognition"
        >
          <span>
            The base reads &quot;{query.trim()}&quot; as a held{' '}
            {recognition.holding.detail(recognition.row).kind.toLowerCase()}
            {recognition.own
              ? `, so that entry leads the list.`
              : `, kept under ${recognition.holding.label}.`}
          </span>
          {!recognition.own && (
            <button
              type="button"
              onClick={() =>
                onJump({
                  holding: recognition.holding.id,
                  entry: recognition.holding.idOf(recognition.row),
                })
              }
              className="text-tea-gold transition-colors hover:text-tea-gold-lt"
            >
              Open it
            </button>
          )}
        </p>
      )}

      {/* One tab stop for the whole list; the arrows own movement inside it. */}
      <div onKeyDown={onListKeyDown} data-testid="wisdom-rows">
        {paged.map(section => (
          <div key={section.key || 'all'}>
            {section.label !== null && (
              <button
                type="button"
                onClick={() => {
                  // Opening one heading out of a wholly folded shape has to spell
                  // the shape out first: the sentinel cannot express "all but one".
                  const next = new Set(foldedAll ? sections.map(entry => entry.key) : collapsed);
                  if (next.has(section.key)) next.delete(section.key);
                  else next.add(section.key);
                  setCollapsed([...next]);
                }}
                aria-expanded={!isFolded(section)}
                className="flex w-full items-center gap-2 border-y border-tea-border bg-tea-accent-sub px-3 py-1.5 text-left transition-colors hover:bg-tea-gold/6 md:px-4"
              >
                {isFolded(section)
                  ? <ChevronRight size={13} className="shrink-0 text-tea-text-sec" aria-hidden="true" />
                  : <ChevronDown size={13} className="shrink-0 text-tea-text-sec" aria-hidden="true" />}
                <span className={`${WISDOM_TYPE.rowName} min-w-0 truncate`}>{section.label}</span>
                <span className={`${WISDOM_TYPE.fact} ml-auto shrink-0 tabular-nums`}>{section.rows.length}</span>
              </button>
            )}
            <div className="divide-y divide-tea-border">
              {section.shown.map(row => renderRow(row, cursor++))}
            </div>
          </div>
        ))}

        {/* An empty result is the one moment a base that holds a matcher should
            prove it. A query one character off a held entry used to return
            nothing and say nothing, which reads as "not held" when the finger
            simply slipped. */}
        {filtered.length === 0 && (
          <div className="px-3 py-8 text-center md:px-4" data-testid="wisdom-empty">
            <p className="text-ui-13 text-tea-text-dim">
              No {holding.noun} match &quot;{query}&quot;.
            </p>
            {/* One candidate is a statement; several are a choice, and only the
                reader can make it. A query two edits from three held entries used
                to be answered with one of them, picked by edit distance and
                offered as though it were the answer. */}
            {nearMisses.length === 1 && (
              <p className="mt-2 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-ui-12 text-tea-text-sec">
                <span>
                  The nearest entry the base holds is {nearMisses[0].name}
                  {nearMisses[0].own ? '.' : `, kept under ${nearMisses[0].holding.label}.`}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onJump({
                      holding: nearMisses[0].holding.id,
                      entry: nearMisses[0].holding.idOf(nearMisses[0].row),
                    })
                  }
                  className="text-tea-gold transition-colors hover:text-tea-gold-lt"
                >
                  Open it
                </button>
              </p>
            )}
            {nearMisses.length > 1 && (
              <div className="mt-2" data-testid="wisdom-near-misses">
                <p className="text-ui-12 text-tea-text-sec">
                  The base holds {nearMisses.length} entries within an edit or two of that.
                </p>
                <WisdomRoving className="mt-2 flex flex-wrap items-baseline justify-center gap-1.5">
                  {nearMisses.map(miss => (
                    <button
                      key={`${miss.holding.id}:${miss.holding.idOf(miss.row)}`}
                      type="button"
                      onClick={() => onJump({ holding: miss.holding.id, entry: miss.holding.idOf(miss.row) })}
                      className="tap-target rounded-md bg-tea-accent-sub px-2 py-1 text-ui-12 text-tea-gold transition-colors hover:text-tea-gold-lt"
                    >
                      {miss.name}
                      {!miss.own && <span className="text-tea-text-dim"> in {miss.holding.label}</span>}
                    </button>
                  ))}
                </WisdomRoving>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Paging, in the inventory's own shape: a restated total on the left, the
          way to see more on the right. Only appears when there IS more.
          The strip is also the sentinel: reaching within 600px of it grows the
          list by a page on its own, so a thousand rows is a scroll rather than
          seven presses. A letter rail was the alternative and was dropped,
          because it only means anything sorted by name and ungrouped, while
          growing on approach works in every sort and every grouping. The button
          stays for the reader who has no IntersectionObserver, and for anyone
          who would rather press than scroll. */}
      {shownCount < ordered.length && (
        <div
          ref={growNode}
          className="flex items-center justify-between gap-3 border-t border-tea-border px-3 py-2.5 md:px-4"
        >
          <span className="font-mono text-ui-11 tabular-nums text-tea-text-dim">
            {shownCount} of {ordered.length}
          </span>
          <button type="button" onClick={() => setLimit(current => current + PAGE)} className={WISDOM_CHROME_BTN}>
            Show more
          </button>
        </div>
      )}

      {/* The list ends where the rows end. What used to live down here now reads
          above them, where it is met rather than scrolled past. */}
      <div className="pb-6" />

      {selected && (() => {
        const nav = selectedIndex >= 0 ? (
          <WisdomPanelNav
            position={selectedIndex + 1}
            total={ordered.length}
            onPrev={selectedIndex > 0 ? () => step(-1) : undefined}
            onNext={selectedIndex < ordered.length - 1 ? () => step(1) : undefined}
          />
        ) : undefined;
        const publicHref = holding.publicRef?.entry?.(selected);
        const entryLoad = entryUsage(holding.idOf(selected));
        return holding.renderDetail
          ? holding.renderDetail(selected, {
              onClose: () => onSelect(null),
              onSelect,
              jump: onJump,
              nav,
              section: selectedSection,
              publicHref,
              usage: entryLoad,
            })
          : (
            <WisdomDetailPanel
              detail={holding.detail(selected, linkCtx)}
              id={holding.idOf(selected)}
              onClose={() => onSelect(null)}
              nav={nav}
              section={selectedSection}
              publicHref={publicHref}
              usage={entryLoad}
            />
          );
      })()}
    </div>
  );
};
