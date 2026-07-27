import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { AnchoredMenu } from '../../components/shared/AnchoredMenu';
import { useProducts } from '../hooks/useAdminData';
import { WisdomBrowser } from '../components/wisdom/WisdomBrowser';
import {
  WISDOM_PARAM,
  WISDOM_TYPE,
  defaultPrefs,
  wisdomPrefsFromParams,
  wisdomPrefsToParams,
  type AnyWisdomHolding,
  type WisdomLink,
  type WisdomPrefs,
} from '../components/wisdom/config';
import { WISDOM_HOLDINGS, findHolding } from '../components/wisdom/holdings';
import { useWisdomUsage } from '../components/wisdom/usage';

/**
 * Wisdom: browse the shared tea wisdom base (src/wisdom).
 *
 * Read-only. The base is edited by re-running scripts/build-wisdom.mjs from the
 * source CSVs, not from here; in-app editing has no server-side home yet. That
 * fact is stated once, quietly, under the list, rather than in a title block
 * standing between the reader and the content on every single visit.
 *
 * There is no page heading. The tab strip IS the heading, the way the inventory
 * screen's corpus switcher is: seven serif labels each carrying its count, so
 * the shape of the base is legible before a single click. Once the reader has
 * scrolled, the same strip answers as one label with a menu behind it, because a
 * switcher that has done its job is furniture until it is wanted again.
 *
 * THE ADDRESS CARRIES THE WHOLE SCREEN: the open tab, the open entry, the query
 * as it is typed, and the shape the list has been given.
 *   /admin/wisdom?tab=cultivars&entry=rou-gui
 *   /admin/wisdom?tab=varieties&q=Yiwu
 *   /admin/wisdom?tab=regions&group=country&sort=-altitude&fold=*~!China
 *   /admin/wisdom?tab=marks&group=producer&gap=1&borrow=era
 * so an operator can send a colleague to one cultivar, to a narrowed list, to
 * 182 regions folded to their sixteen countries with China left open, or to the
 * seven marks that name no producer the base holds, and a refresh returns them
 * to it. The last of those carries `borrow`, which says the grouping is one the
 * gap filter took rather than one the reader chose, so Show all can hand it back
 * on a screen that never made the loan. Writes are `replace`, because reading through a holding with the arrow
 * keys would otherwise leave one history entry per row.
 *
 * Two things were wrong before and are the reason this is now the whole screen.
 * The find field did not write back, so the address and the field disagreed from
 * the first character typed and a link copied after typing was simply wrong.
 * And the folded shape lived in React state, so the one press that gives a long
 * list its shape did not survive a refresh.
 *
 * SCROLLING: this view deliberately does NOT own a scroll container. The admin
 * routes wrapper (AdminApp.tsx, around line 478) is `flex-1 min-h-0
 * overflow-y-auto` for every non-inventory route and already carries the mobile
 * nav clearance, so the chrome sticks and the page scrolls in that ancestor.
 * Nothing here has to pass a definite height down, which is exactly the failure
 * mode CLAUDE.md warns about on the inventory height chain. Do not put
 * `h-full overflow-y-auto` back on this root, and note that the browser's
 * shrink-on-scroll works off an IntersectionObserver for the same reason: it
 * measures nothing and owns no scroll of its own.
 */

/** One address, built in one place, so no caller can forget half of it. */
const wisdomAddress = (
  holding: AnyWisdomHolding,
  state: { entry?: string | null; query?: string; prefs: WisdomPrefs },
): Record<string, string> => {
  const next: Record<string, string> = { [WISDOM_PARAM.tab]: holding.id };
  if (state.query) next[WISDOM_PARAM.query] = state.query;
  if (state.entry) next[WISDOM_PARAM.entry] = state.entry;
  return { ...next, ...wisdomPrefsToParams(state.prefs, holding) };
};

export const WisdomView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get(WISDOM_PARAM.tab);
  const active = WISDOM_HOLDINGS.find(holding => holding.id === rawTab) ?? WISDOM_HOLDINGS[0];
  const entry = searchParams.get(WISDOM_PARAM.entry);
  const query = searchParams.get(WISDOM_PARAM.query) ?? '';

  /**
   * The shape of the open holding, read out of the address and checked against
   * the holding, so a stale or hand-edited link degrades to the default rather
   * than ordering the list by a column that no longer exists.
   *
   * Memoised on the three raw values rather than on `searchParams`, which now
   * changes on every keystroke: the browser rebuilds its sections and its folded
   * set from this object's identity, and typing must not make it re-bucket 316
   * rows it has not been asked to re-bucket.
   */
  const grouping = searchParams.get(WISDOM_PARAM.group);
  const ordering = searchParams.get(WISDOM_PARAM.sort);
  const folding = searchParams.get(WISDOM_PARAM.fold);
  const gapping = searchParams.get(WISDOM_PARAM.gap);
  // What the gap filter took on loan. It used to live in a ref inside the
  // browser, so a link carrying "the seven marks with no held producer" arrived
  // grouped by producer with nothing marked as borrowed, and Show all kept a
  // grouping the reader had never chosen.
  const borrowing = searchParams.get(WISDOM_PARAM.borrow);
  const borrowedFolding = searchParams.get(WISDOM_PARAM.borrowFold);
  const prefs = useMemo(
    () =>
      wisdomPrefsFromParams(key => {
        if (key === WISDOM_PARAM.group) return grouping;
        if (key === WISDOM_PARAM.sort) return ordering;
        if (key === WISDOM_PARAM.gap) return gapping;
        if (key === WISDOM_PARAM.borrow) return borrowing;
        if (key === WISDOM_PARAM.borrowFold) return borrowedFolding;
        return key === WISDOM_PARAM.fold ? folding : null;
      }, active),
    [grouping, ordering, folding, gapping, borrowing, borrowedFolding, active],
  );

  /**
   * How the OTHER holdings were last shaped.
   *
   * The address can only describe the tab that is open, and a shape is a
   * standing choice: an operator who reads regions by country reads them by
   * country every visit. So the address is the truth for the holding on screen
   * and this remembers the six that are not, to be written back into the address
   * when one of them is opened again. Search deliberately does not survive a tab
   * change at all: a query for a cultivar means nothing against the list of
   * marks.
   */
  const [prefsByHolding, setPrefsByHolding] = useState<Record<string, WisdomPrefs>>({});
  const shapeOf = useCallback(
    (holding: AnyWisdomHolding) => prefsByHolding[holding.id] ?? defaultPrefs(holding),
    [prefsByHolding],
  );

  const setPrefs = useCallback(
    (next: WisdomPrefs) => {
      setPrefsByHolding(current => ({ ...current, [active.id]: next }));
      setSearchParams(wisdomAddress(active, { entry, query, prefs: next }), { replace: true });
    },
    [active, entry, query, setSearchParams],
  );

  // A shape that arrived in a shared link is a shape this session has been
  // given, so it goes into the memory on arrival. Without this, following a link
  // to folded regions, stepping into marks and coming back would quietly throw
  // away the thing the link was sent to show.
  const greeted = useRef<string | null>(null);
  useEffect(() => {
    if (greeted.current === active.id) return;
    greeted.current = active.id;
    setPrefsByHolding(current => (current[active.id] ? current : { ...current, [active.id]: prefs }));
  }, [active.id, prefs]);

  /**
   * What is currently riding on each entry.
   *
   * The products are already in the query cache from the inventory screen more
   * often than not, and this is the same list, read through `resolveTea`, which
   * is the call the import editor and the shop make. It answers the question the
   * reach line never could: not "who reads this holding" but "what would move if
   * I changed this row".
   *
   * Computed in idle time and cached against the product list itself, because it
   * is one `resolveTea` per product and the reader came here to read rows. See
   * `useWisdomUsage`.
   */
  const { data: products } = useProducts();
  const usage = useWisdomUsage(products);

  const openEntry = useCallback(
    (id: string | null) => {
      // The query survives opening a row: the narrowed list is the context the
      // entry was found in, and losing it on a click would remount the browser
      // and throw the reader back to the whole holding.
      setSearchParams(wisdomAddress(active, { entry: id, query, prefs }), { replace: true });
    },
    [active, prefs, query, setSearchParams],
  );

  /** Every keystroke, straight into the address, so a copied link is never stale. */
  const changeQuery = useCallback(
    (next: string) => {
      setSearchParams(wisdomAddress(active, { entry, query: next, prefs }), { replace: true });
    },
    [active, entry, prefs, setSearchParams],
  );

  const openTab = useCallback(
    (id: string) => {
      const holding = findHolding(id) ?? active;
      setSearchParams(wisdomAddress(holding, { prefs: shapeOf(holding) }), { replace: true });
    },
    [active, setSearchParams, shapeOf],
  );

  /**
   * Walks a held relation into another holding: a mark's producer, a producer's
   * marks, or a place's forty varieties. The tab moves with an entry to open or
   * a query to narrow by, so the jump is a place the reader can be sent back to.
   */
  const jump = useCallback(
    (link: WisdomLink) => {
      const holding = findHolding(link.holding) ?? active;
      setSearchParams(
        wisdomAddress(holding, { entry: link.entry, query: link.query, prefs: shapeOf(holding) }),
        { replace: true },
      );
    },
    [active, setSearchParams, shapeOf],
  );

  // Wraps rather than scrolls. At 390px the seven tabs fall onto three lines; a
  // sideways-scrolling strip would hide the holdings a reader has not met yet,
  // which is the opposite of what a switcher is for. Those three lines are also
  // why the strip condenses once the reader has scrolled: 76px of switcher above
  // a 36px row is two rows of the list spent on a decision already made.
  const fullTabs = (
    <nav
      className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-tea-border px-3 py-1.5 md:px-4"
      aria-label="Wisdom holdings"
    >
      {WISDOM_HOLDINGS.map(holding => {
        const isActive = holding.id === active.id;
        return (
          <button
            key={holding.id}
            type="button"
            onClick={() => openTab(holding.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`tap-target relative inline-flex items-baseline gap-1.5 ${WISDOM_TYPE.tab} transition-colors ${
              isActive
                ? 'text-tea-gold after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:bg-tea-gold'
                : 'text-tea-text-sec hover:text-tea-text'
            }`}
          >
            <span>{holding.label}</span>
            <span
              className={`rounded-full px-1.5 font-mono text-ui-10 leading-[16px] ${
                isActive ? 'bg-tea-gold/10 text-tea-gold' : 'bg-tea-accent-sub text-tea-text-dim'
              }`}
            >
              {holding.rows.length}
            </span>
          </button>
        );
      })}
    </nav>
  );

  /**
   * The same switcher once the reader has moved: the active label, and the other
   * six behind a menu. Not a second navigation pattern, the same AnchoredMenu the
   * Sort and Group controls use, so it sits in the toolbar row without inventing
   * anything.
   *
   * The counts come with it. They were dropped from the trigger on the argument
   * that the status line beside it already says how many rows there are, which
   * confuses two different facts: the status line says how many rows the current
   * question returned, while the count says how much the base holds. The whole
   * reason the expanded strip carries seven counts is that the shape of the base
   * is legible before a click, and losing that for as long as a reader is
   * scrolled loses it for most of the time they are here. The badge steps out
   * below `sm` only, where the toolbar genuinely has 366px for four controls.
   */
  const condensedTabs = (
    <AnchoredMenu
      align="left"
      width={200}
      role="listbox"
      trigger={props => (
        <button
          {...props}
          className={`tap-target inline-flex items-baseline gap-1.5 ${WISDOM_TYPE.tab} text-tea-gold transition-colors hover:text-tea-gold-lt`}
          aria-label={`Wisdom holdings, showing ${active.label}, ${active.rows.length} ${active.noun}`}
        >
          <span>{active.label}</span>
          <span
            className="hidden rounded-full bg-tea-gold/10 px-1.5 font-mono text-ui-10 leading-[16px] text-tea-gold sm:inline"
            aria-hidden="true"
          >
            {active.rows.length}
          </span>
          <ChevronDown size={13} className="shrink-0 self-center" aria-hidden="true" />
        </button>
      )}
    >
      {close =>
        WISDOM_HOLDINGS.map(holding => {
          const isActive = holding.id === active.id;
          return (
            <button
              key={holding.id}
              role="option"
              aria-selected={isActive}
              onClick={() => {
                openTab(holding.id);
                close();
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-ui-12 ${
                isActive ? 'text-tea-gold' : 'text-tea-text-sec'
              }`}
            >
              <span>{holding.label}</span>
              <span className="font-mono text-ui-10 tabular-nums text-tea-text-dim">{holding.rows.length}</span>
            </button>
          );
        })
      }
    </AnchoredMenu>
  );

  return (
    <div className="min-h-full bg-tea-bg">
      <h1 className="sr-only">Wisdom</h1>
      {/* Remounting on tab change resets the find field, which is right: a query
          for a cultivar means nothing against the list of marks. Sort, grouping
          and the folded sections survive it, because they are written into the
          address and remembered here for the tabs the address cannot describe.
          The open entry survives it too, for the same reason. */}
      <WisdomBrowser
        key={active.id}
        holding={active}
        siblings={WISDOM_HOLDINGS}
        tabs={condensed => (condensed ? condensedTabs : fullTabs)}
        selectedId={entry}
        onSelect={openEntry}
        onJump={jump}
        prefs={prefs}
        onPrefsChange={setPrefs}
        initialQuery={query}
        onQueryChange={changeQuery}
        usage={usage}
      />
    </div>
  );
};

export default WisdomView;
