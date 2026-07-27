import React, { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WisdomBrowser } from '../components/wisdom/WisdomBrowser';
import { WISDOM_TYPE, defaultPrefs, type WisdomLink, type WisdomPrefs } from '../components/wisdom/config';
import { WISDOM_HOLDINGS } from '../components/wisdom/holdings';

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
 * the shape of the base is legible before a single click.
 *
 * THE ADDRESS CARRIES BOTH the open tab and the open entry:
 *   /admin/wisdom?tab=cultivars&entry=rou-gui
 * so an operator can send a colleague to one cultivar, and a refresh returns
 * them to it. Writes are `replace`, because reading through a holding with the
 * arrow keys would otherwise leave one history entry per row.
 *
 * SCROLLING: this view deliberately does NOT own a scroll container. The admin
 * routes wrapper (AdminApp.tsx, around line 478) is `flex-1 min-h-0
 * overflow-y-auto` for every non-inventory route and already carries the mobile
 * nav clearance, so the chrome sticks and the page scrolls in that ancestor.
 * Nothing here has to pass a definite height down, which is exactly the failure
 * mode CLAUDE.md warns about on the inventory height chain. Do not put
 * `h-full overflow-y-auto` back on this root.
 */

export const WisdomView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const active = WISDOM_HOLDINGS.find(holding => holding.id === rawTab) ?? WISDOM_HOLDINGS[0];
  const entry = searchParams.get('entry');

  /**
   * How each holding was last sorted and grouped, kept per holding and here
   * rather than in the browser, because the browser is remounted on every tab
   * change. Search is deliberately NOT here: a query for a cultivar means
   * nothing against the list of marks, so it resets with the remount, while
   * "regions by country" is a standing choice and re-picking it every visit was
   * a tax on the one control that gives a long list its shape.
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

  const openEntry = useCallback(
    (id: string | null) => {
      setSearchParams(
        id ? { tab: active.id, entry: id } : { tab: active.id },
        { replace: true },
      );
    },
    [active.id, setSearchParams],
  );

  /**
   * Walks a held relation into another holding: a mark's producer, a producer's
   * marks. Both the tab and the entry move together, so the jump is a place the
   * reader can be sent back to.
   */
  const jump = useCallback(
    (link: WisdomLink) => setSearchParams({ tab: link.holding, entry: link.entry }, { replace: true }),
    [setSearchParams],
  );

  // Wraps rather than scrolls. At 390px the seven tabs fall onto two or three
  // lines; a sideways-scrolling strip would hide the holdings a reader has not
  // met yet, which is the opposite of what a switcher is for.
  const tabs = (
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
            onClick={() => setSearchParams({ tab: holding.id }, { replace: true })}
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

  return (
    <div className="min-h-full bg-tea-bg">
      <h1 className="sr-only">Wisdom</h1>
      {/* Remounting on tab change resets the find field, which is right: a query
          for a cultivar means nothing against the list of marks. Sort and
          grouping survive it, because they live above the remount. The open
          entry survives it too, because it lives in the address. */}
      <WisdomBrowser
        key={active.id}
        holding={active}
        siblings={WISDOM_HOLDINGS}
        tabs={tabs}
        selectedId={entry}
        onSelect={openEntry}
        onJump={jump}
        prefs={prefs}
        onPrefsChange={setPrefs}
      />
    </div>
  );
};

export default WisdomView;
