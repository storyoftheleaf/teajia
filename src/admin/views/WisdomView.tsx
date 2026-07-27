import React, { useCallback, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { AnchoredMenu } from '../../components/shared/AnchoredMenu';
import { useProducts } from '../hooks/useAdminData';
import { WisdomBrowser } from '../components/wisdom/WisdomBrowser';
import { WISDOM_TYPE, defaultPrefs, type WisdomLink, type WisdomPrefs } from '../components/wisdom/config';
import { WISDOM_HOLDINGS } from '../components/wisdom/holdings';
import { countWisdomUsage } from '../components/wisdom/usage';

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
 * THE ADDRESS CARRIES the open tab, the open entry, and a query a link arrived
 * with:
 *   /admin/wisdom?tab=cultivars&entry=rou-gui
 *   /admin/wisdom?tab=varieties&q=Yiwu
 * so an operator can send a colleague to one cultivar or to a narrowed list, and
 * a refresh returns them to it. Writes are `replace`, because reading through a
 * holding with the arrow keys would otherwise leave one history entry per row.
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

export const WisdomView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const active = WISDOM_HOLDINGS.find(holding => holding.id === rawTab) ?? WISDOM_HOLDINGS[0];
  const entry = searchParams.get('entry');
  const linkedQuery = searchParams.get('q') ?? '';

  /**
   * How each holding was last sorted, grouped and folded, kept per holding and
   * here rather than in the browser, because the browser is remounted on every
   * tab change. Search is deliberately NOT here: a query for a cultivar means
   * nothing against the list of marks, so it resets with the remount, while
   * "regions by country, folded to its sixteen headings" is a standing choice
   * and rebuilding it on every return is a tax on the two controls that give a
   * long list its shape.
   *
   * Memoised so the object handed down keeps its identity between renders; the
   * browser resets its page count when the sort changes, and a fresh object on
   * every render would undo every page the reader had grown.
   */
  const [prefsByHolding, setPrefsByHolding] = useState<Record<string, WisdomPrefs>>({});
  const prefs = useMemo(
    () => prefsByHolding[active.id] ?? defaultPrefs(active),
    [prefsByHolding, active],
  );
  const setPrefs = useCallback(
    (next: WisdomPrefs) => setPrefsByHolding(current => ({ ...current, [active.id]: next })),
    [active.id],
  );

  /**
   * What is currently riding on each entry.
   *
   * The products are already in the query cache from the inventory screen more
   * often than not, and this is the same list, read through `resolveTea`, which
   * is the call the import editor and the shop make. It answers the question the
   * reach line never could: not "who reads this holding" but "what would move if
   * I changed this row".
   */
  const { data: products } = useProducts();
  const usage = useMemo(() => countWisdomUsage(products ?? []), [products]);

  const openEntry = useCallback(
    (id: string | null) => {
      const next: Record<string, string> = { tab: active.id };
      // A linked query survives opening a row: the narrowed list is the context
      // the entry was found in, and losing it on a click would remount the
      // browser and throw the reader back to the whole holding.
      if (linkedQuery) next.q = linkedQuery;
      if (id) next.entry = id;
      setSearchParams(next, { replace: true });
    },
    [active.id, linkedQuery, setSearchParams],
  );

  const openTab = useCallback(
    (id: string) => setSearchParams({ tab: id }, { replace: true }),
    [setSearchParams],
  );

  /**
   * Walks a held relation into another holding: a mark's producer, a producer's
   * marks, or a place's forty varieties. The tab moves with an entry to open or
   * a query to narrow by, so the jump is a place the reader can be sent back to.
   */
  const jump = useCallback(
    (link: WisdomLink) => {
      const next: Record<string, string> = { tab: link.holding };
      if (link.entry) next.entry = link.entry;
      if (link.query) next.q = link.query;
      setSearchParams(next, { replace: true });
    },
    [setSearchParams],
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
   * anything. The count drops off the trigger because the status line beside it
   * is already saying how many rows there are, and on a phone the toolbar has
   * 366px to seat four controls.
   */
  const condensedTabs = (
    <AnchoredMenu
      align="left"
      width={200}
      role="listbox"
      trigger={props => (
        <button
          {...props}
          className={`tap-target inline-flex items-center gap-1.5 ${WISDOM_TYPE.tab} text-tea-gold transition-colors hover:text-tea-gold-lt`}
          aria-label={`Wisdom holdings, showing ${active.label}`}
        >
          <span>{active.label}</span>
          <ChevronDown size={13} className="shrink-0" aria-hidden="true" />
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
          and the folded sections survive it, because they live above the
          remount. The open entry survives it too, because it lives in the
          address. */}
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
        initialQuery={linkedQuery}
        usage={usage}
      />
    </div>
  );
};

export default WisdomView;
