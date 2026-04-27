import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { useAppStore, selectHasBundle } from '../../lib/store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { CatalogBrowse } from './CatalogBrowse';
import { SuggestionsInbox } from './SuggestionsInbox';
import { WholesaleOrdersList } from './WholesaleOrdersList';
import { AdoptionQueue } from './AdoptionQueue';

// ─────────────────────────────────────────────────────────────────────────────
// Network hub — single page that holds the four working surfaces as tabs.
//
// One sidebar entry, one URL, one place. Catalog / Suggestions / Wholesale /
// Adoptions live here as text-link tabs. Deep sub-pages (an open wholesale
// order, a listing edit) remain on their own routes and link back here.
// ─────────────────────────────────────────────────────────────────────────────

type NetworkTab = 'catalog' | 'suggestions' | 'wholesale' | 'adoptions';

interface TabSpec {
  id: NetworkTab;
  label: string;
  visible: boolean;
}

export const NetworkLanding: React.FC = () => {
  const { memberships, activeAccountId, platformRole } = useAppStore(
    useShallow(s => ({
      memberships: s.memberships,
      activeAccountId: s.activeAccountId,
      platformRole: s.platformRole,
    })),
  );

  const hasCatalog = selectHasBundle({ memberships, activeAccountId, platformRole }, 'catalog');
  const hasSell = selectHasBundle({ memberships, activeAccountId, platformRole }, 'sell');
  const isPlatform = !!platformRole;

  const tabs: TabSpec[] = useMemo(() => [
    { id: 'catalog',     label: 'Catalog',     visible: hasCatalog },
    { id: 'suggestions', label: 'Suggestions', visible: hasCatalog },
    { id: 'wholesale',   label: 'Wholesale',   visible: hasSell },
    { id: 'adoptions',   label: 'Adoptions',   visible: isPlatform },
  ], [hasCatalog, hasSell, isPlatform]);

  const visibleTabs = tabs.filter(t => t.visible);
  const fallback: NetworkTab = visibleTabs[0]?.id ?? 'catalog';

  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as NetworkTab | null;
  const activeTab: NetworkTab =
    rawTab && visibleTabs.find(t => t.id === rawTab) ? rawTab : fallback;

  const setActiveTab = (tab: NetworkTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <div className="pt-8 pb-nav-gap-lg">

      {/* Orientation header — page-level intro that frames all four tabs at once */}
      <header className="px-4 md:px-8 max-w-2xl mx-auto mb-8">
        <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec mb-3`}>
          The network
        </p>
        <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text mb-5`}>
          One catalog, many houses.
        </h1>
        <p className="font-body italic text-[17px] text-tea-text-sec leading-[1.6] mb-6">
          Teajia is the shared root. Each house carries the teas it knows.
        </p>

        <div className="space-y-4 font-body text-[15px] text-tea-text leading-[1.75]">
          <p>
            Each tea has one original record (origin, varietal, harvest
            year, description, photos), kept by the curator who sources
            it. Other houses can <em>carry</em> the tea, setting their own
            stock, retail price, and store note. The original stays
            anchored to the curator.
          </p>
          <p>
            When a partner sees a typo or a clearer way to describe a tea,
            they edit the curator's text in place on the card. The change
            goes to the curator's queue. The curator decides, field by
            field. Accepted changes update everywhere immediately.
          </p>
        </div>
      </header>

      {/* Tab strip — text-link tabs in the editorial register */}
      {visibleTabs.length > 0 && (
        <nav
          className="px-4 md:px-8 max-w-3xl mx-auto mb-8 border-b border-tea-border pb-3 flex flex-wrap items-baseline gap-x-6 gap-y-2"
          aria-label="Network sections"
        >
          {visibleTabs.map(tab => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`font-display text-[16px] tracking-[0.02em] transition-colors ${
                  isActive
                    ? 'text-tea-gold'
                    : 'text-tea-text-sec hover:text-tea-text'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* Active tab content — each surface rendered embedded so its own header
          padding doesn't double up with the hub container's. */}
      <div>
        {visibleTabs.length === 0 && (
          <p className="px-4 md:px-8 max-w-2xl mx-auto font-body italic text-[15px] text-tea-text-sec leading-[1.7]">
            Your account doesn't yet have the bundles that open the network's
            working surfaces. Ask your owner about Catalog or Sell.
          </p>
        )}
        {activeTab === 'catalog'     && hasCatalog && <CatalogBrowse embedded />}
        {activeTab === 'suggestions' && hasCatalog && <SuggestionsInbox embedded />}
        {activeTab === 'wholesale'   && hasSell    && <WholesaleOrdersList embedded />}
        {activeTab === 'adoptions'   && isPlatform && <AdoptionQueue embedded />}
      </div>
    </div>
  );
};

export default NetworkLanding;
