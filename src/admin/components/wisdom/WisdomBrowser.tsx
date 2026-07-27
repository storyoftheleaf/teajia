import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { AnchoredMenu } from '../../../components/shared/AnchoredMenu';
import { RungTag, rungSummary } from './Rung';
import { SearchBox } from './SearchBox';
import { PublicLink, WisdomDetailPanel, WisdomPanelNav } from './WisdomDetailPanel';
import {
  AT_BLOCK,
  AT_FLEX,
  UNGROUPED,
  WISDOM_CHROME_BTN,
  WISDOM_HEADER_ROW,
  WISDOM_ROW,
  WISDOM_TYPE,
  compareWisdom,
  defaultPrefs,
  recogniseQuery,
  wisdomMatches,
  wisdomQueryTokens,
  wisdomStartsWith,
  type AnyWisdomHolding,
  type WisdomColumn,
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
 * What the keyboard does, said once where the keyboard is.
 *
 * Same shape as the product edit panel's hint bar, deliberately: quiet, one
 * line, micro-caps, dot separated. A second pattern for the same job would be a
 * second thing to learn.
 */
const KEY_HINTS = ['↑ ↓ move', 'Home End jump', 'Enter open', 'Type to jump'] as const;

interface Props {
  holding: AnyWisdomHolding;
  /**
   * The tab strip, rendered inside this component's sticky chrome block. It
   * lives here rather than in the view so that the tabs, the toolbar, the count
   * line and the column header stick as one unit at one offset. A wrapping tab
   * strip has no fixed height, so a second sticky element below it could not
   * know what offset to use.
   */
  tabs: React.ReactNode;
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
   * Sort and grouping, owned by the view so they survive a tab change. Search
   * is not here, and must not be: it stays local and resets on every switch.
   * Optional, so the engine still works with no one holding its preferences.
   */
  prefs?: WisdomPrefs;
  onPrefsChange?: (prefs: WisdomPrefs) => void;
}

interface Section {
  key: string;
  /** Null when nothing is grouped: one nameless section holding every row. */
  label: string | null;
  rows: unknown[];
}

const textAlign = (column: WisdomColumn<unknown>) => (column.align === 'right' ? 'text-right' : 'text-left');
const justify = (column: WisdomColumn<unknown>) => (column.align === 'right' ? 'justify-end' : 'justify-start');

export const WisdomBrowser: React.FC<Props> = ({
  holding, tabs, selectedId, onSelect, onJump, siblings, prefs, onPrefsChange,
}) => {
  const [query, setQuery] = useState('');
  const nameColumn = holding.columns[0];

  // Preferences live with whoever holds them across tab changes; when nobody
  // does, the engine keeps its own copy so it still runs on its own.
  const [ownPrefs, setOwnPrefs] = useState<WisdomPrefs>(() => defaultPrefs(holding));
  const { sort, groupKey } = prefs ?? ownPrefs;
  const setPrefs = onPrefsChange ?? setOwnPrefs;

  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [focusIndex, setFocusIndex] = useState(0);
  /** What has been typed at the list, shown back so the jump is not a mystery. */
  const [typed, setTyped] = useState('');

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

  const filtered = useMemo(() => {
    const rows = tokens.length
      ? holding.rows.filter(row => wisdomMatches(holding.searchText(row), tokens))
      : [...holding.rows];

    const column = holding.columns.find(entry => entry.key === sort.key) ?? nameColumn;
    rows.sort((left, right) => {
      const order = compareWisdom(column.value(left), column.value(right), sort.direction);
      // Name is the tiebreaker everywhere, so equal values never shuffle.
      return order !== 0 ? order : compareWisdom(nameColumn.value(left), nameColumn.value(right), 'asc');
    });

    // When the base itself recognises the query as one of its entries, that
    // entry leads. Typing a recipe mark should land on the mark, not on the
    // fourth row that happens to mention it.
    const recognised = recognition?.own ? recognition.row : null;
    if (recognised) {
      const id = holding.idOf(recognised);
      const at = rows.findIndex(row => holding.idOf(row) === id);
      if (at > 0) rows.unshift(...rows.splice(at, 1));
      else if (at < 0) rows.unshift(recognised);
    }
    return rows;
  }, [holding, nameColumn, recognition, sort, tokens]);

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
    () => sections.filter(section => !collapsed.has(section.key)).flatMap(section => section.rows),
    [sections, collapsed],
  );

  /** The rows actually mounted: one page at a time, spent across the sections. */
  const paged = useMemo(() => {
    let budget = limit;
    return sections.map(section => {
      if (collapsed.has(section.key)) return { ...section, shown: [] as unknown[] };
      const shown = section.rows.slice(0, Math.max(0, budget));
      budget -= shown.length;
      return { ...section, shown };
    });
  }, [sections, collapsed, limit]);

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

  // A new question deserves a fresh first page and a fresh cursor. Depends on
  // the primitives, not on the sort object: `prefs` arrives as a prop now, and
  // an identity change on every render would silently undo every page grown.
  useEffect(() => {
    setLimit(PAGE);
    setFocusIndex(0);
  }, [query, sort.key, sort.direction, groupKey]);

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

  const toggleSort = (key: string) =>
    setPrefs({
      sort:
        sort.key === key
          ? { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
          : { key, direction: 'asc' },
      groupKey,
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
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { step(-1); event.preventDefault(); }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { step(1); event.preventDefault(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, step]);

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
      ordered.findIndex(row => wisdomStartsWith(nameColumn.value(row), typed_));
    const extended = typed + key;
    let word = extended;
    let at = first(extended);
    if (at < 0) { word = key; at = first(key); }
    if (typeTimer.current) clearTimeout(typeTimer.current);
    typeTimer.current = setTimeout(() => setTyped(''), TYPE_AHEAD_MS);
    setTyped(word);
    if (at >= 0) moveFocus(at);
  }, [moveFocus, nameColumn, ordered, typed]);

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
                setPrefs({ sort, groupKey: option.key });
                setCollapsed(new Set());
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
   * because with none there is one nameless section and nothing to fold.
   */
  const allCollapsed = sections.length > 0 && sections.every(section => collapsed.has(section.key));

  const foldAll = group && (
    <button
      type="button"
      onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(sections.map(section => section.key)))}
      className={WISDOM_CHROME_BTN}
    >
      {allCollapsed ? 'Expand all' : 'Collapse all'}
    </button>
  );

  /**
   * The count, and the shape of the authorship rungs, said once. This is what
   * replaces a column that read "DRAFTED" on all 79 rows. It is a sentence, so
   * it never wears micro-caps.
   */
  const countLine = (
    <>
      {filtered.length === holding.rows.length
        ? `${holding.rows.length} ${holding.noun}`
        : `${filtered.length} of ${holding.rows.length} ${holding.noun}`}
      {group && (
        <>
          <span className="px-1.5 text-tea-border" aria-hidden="true">·</span>
          {`${sections.length} by ${group.label.toLowerCase()}`}
        </>
      )}
      <span className="px-1.5 text-tea-border" aria-hidden="true">·</span>
      {summary}
    </>
  );

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
    <div>
      {/* All chrome sticks as one block: tabs, toolbar, the count-or-keys band,
          column header. About 129px before the first entry, and the same 129px
          on a phone as on a desktop, because the band those two sizes need is
          one band carrying a different thing at each. */}
      <div className="sticky top-0 z-sticky bg-tea-bg">
        {tabs}

        {/* Toolbar: find on the left, utilities as micro-caps on the right.
            From md the count rides here in the space the toolbar was wasting,
            which buys the whole screen a line back. */}
        <div className="flex h-10 items-center gap-4 px-3 md:px-4">
          <SearchBox value={query} onChange={setQuery} placeholder={holding.placeholder} />
          <p className="hidden shrink-0 text-ui-11 text-tea-text-dim md:block">{countLine}</p>
          <div className="flex shrink-0 items-center gap-3">{foldAll}{sortMenu}{groupMenu}</div>
        </div>

        {/* One band, two jobs at two sizes. A phone has no keyboard to hint at
            and does need the count; a desktop carries the count up in the
            toolbar and has the room here for what the keys do. So the chrome
            costs the same 24px on both, instead of one more line on desktop. */}
        <div className="flex h-6 items-center gap-3 px-3 md:px-4">
          <p className="min-w-0 truncate text-ui-11 text-tea-text-dim md:hidden">{countLine}</p>
          <div className="hidden min-w-0 items-center gap-3 md:flex" data-testid="wisdom-key-hints">
            {typed ? (
              <span className="font-mono text-ui-11 text-tea-gold">Jumping to {typed}</span>
            ) : (
              KEY_HINTS.map((hint, index) => (
                <React.Fragment key={hint}>
                  {index > 0 && <span className="text-ui-10 text-tea-border" aria-hidden="true">·</span>}
                  <span className={WISDOM_TYPE.label}>{hint}</span>
                </React.Fragment>
              ))
            )}
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
                onClick={() =>
                  setCollapsed(current => {
                    const next = new Set(current);
                    if (next.has(section.key)) next.delete(section.key);
                    else next.add(section.key);
                    return next;
                  })
                }
                aria-expanded={!collapsed.has(section.key)}
                className="flex w-full items-center gap-2 border-y border-tea-border bg-tea-accent-sub px-3 py-1.5 text-left transition-colors hover:bg-tea-gold/6 md:px-4"
              >
                {collapsed.has(section.key)
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

        {filtered.length === 0 && (
          <p className="py-8 text-center text-ui-13 text-tea-text-dim">
            No {holding.noun} match &quot;{query}&quot;.
          </p>
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

      {/* Where this holding is read, and the fact that it is read only. Kept
          under the content rather than in front of it. The public address
          inside the sentence is the link to it: an operator checking how a
          correction reads to a customer was retyping it by hand. */}
      <p className="max-w-3xl px-3 pb-6 pt-3 text-ui-11 leading-[1.6] text-tea-text-dim md:px-4">
        {reachLine} Read only. Entries change by re-running the build from the source data.
      </p>

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
        return holding.renderDetail
          ? holding.renderDetail(selected, {
              onClose: () => onSelect(null),
              onSelect,
              jump: onJump,
              nav,
              section: selectedSection,
              publicHref,
            })
          : (
            <WisdomDetailPanel
              detail={holding.detail(selected, linkCtx)}
              id={holding.idOf(selected)}
              onClose={() => onSelect(null)}
              nav={nav}
              section={selectedSection}
              publicHref={publicHref}
            />
          );
      })()}
    </div>
  );
};
