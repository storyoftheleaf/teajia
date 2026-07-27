import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { CultivarBrowser } from '../components/wisdom/CultivarBrowser';
import { RegionBrowser } from '../components/wisdom/RegionBrowser';
import { VarietyBrowser } from '../components/wisdom/VarietyBrowser';

// Wisdom: browse the shared tea wisdom base (src/wisdom). Cultivars,
// growing regions, and named tea varieties. Read-only. The base is edited by
// re-running scripts/build-wisdom.mjs from the source CSVs, not from here;
// in-app editing is Phase "Wisdom admin (next)" per docs/TEA_WISDOM_BASE.md
// and has no server-side home yet.

type WisdomTab = 'cultivars' | 'regions' | 'varieties';

const TABS: { id: WisdomTab; label: string }[] = [
  { id: 'cultivars', label: 'Cultivars' },
  { id: 'regions', label: 'Regions' },
  { id: 'varieties', label: 'Varieties' },
];

export const WisdomView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as WisdomTab | null;
  const activeTab: WisdomTab = rawTab && TABS.some(tab => tab.id === rawTab) ? rawTab : 'cultivars';

  const setActiveTab = (tab: WisdomTab) => setSearchParams({ tab }, { replace: true });

  return (
    <main className="h-full min-h-0 overflow-y-auto bg-tea-bg pb-nav-gap">
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
        <header className="mb-6">
          <p className="text-ui-11 text-tea-text-sec uppercase tracking-[0.1em]">Tea wisdom base</p>
          <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mt-1`}>Wisdom</h1>
          <p className="text-ui-12 text-tea-text-dim italic mt-3 max-w-lg leading-[1.6]">
            Entries are edited by re-running the build from the source data. In-app editing is coming.
          </p>
        </header>

        <nav
          className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-tea-border pb-3 mb-6"
          aria-label="Wisdom sections"
        >
          {TABS.map(tab => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`font-display text-ui-16 tracking-[0.02em] transition-colors ${
                  isActive ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {activeTab === 'cultivars' && <CultivarBrowser />}
        {activeTab === 'regions' && <RegionBrowser />}
        {activeTab === 'varieties' && <VarietyBrowser />}
      </div>
    </main>
  );
};

export default WisdomView;
