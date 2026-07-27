import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { WisdomBrowser } from '../components/wisdom/WisdomBrowser';
import { WISDOM_TYPE } from '../components/wisdom/config';
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
      {/* Remounting on tab change resets search and sort, which is right: a
          query for a cultivar means nothing against the list of marks. */}
      <WisdomBrowser key={active.id} holding={active} tabs={tabs} />
    </div>
  );
};

export default WisdomView;
