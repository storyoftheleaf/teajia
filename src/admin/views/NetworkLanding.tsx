import React, { useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { useAppStore, selectHasBundle } from '../../lib/store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { CatalogBrowse } from './CatalogBrowse';
import { SuggestionsInbox } from './SuggestionsInbox';
import { AdoptionQueue } from './AdoptionQueue';

// ─────────────────────────────────────────────────────────────────────────────
// Network hub, single page that holds the four working surfaces as tabs.
//
// One sidebar entry, one URL, one place. Catalog / Suggestions / Wholesale /
// Adoptions live here as text-link tabs. Deep sub-pages (an open wholesale
// order, a listing edit) remain on their own routes and link back here.
// ─────────────────────────────────────────────────────────────────────────────

// Wholesale moved to Sales on 2026-09-29 (todo/plans/manage-regroup.md); an
// old ?tab=wholesale link forwards there.
type NetworkTab = 'catalog' | 'suggestions' | 'adoptions';

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
    { id: 'adoptions',   label: 'Adoptions',   visible: isPlatform },
  ], [hasCatalog, hasSell, isPlatform]);

  const visibleTabs = tabs.filter(t => t.visible);
  const fallback: NetworkTab = visibleTabs[0]?.id ?? 'catalog';

  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as NetworkTab | null;
  const activeTab: NetworkTab =
    rawTab && visibleTabs.find(t => t.id === rawTab) ? rawTab : fallback;

  if (rawTab === ('wholesale' as NetworkTab)) return <Navigate to="/admin/activity?tab=wholesale" replace />;

  const setActiveTab = (tab: NetworkTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <div className="pt-8 pb-nav-gap-lg">

      {/* One line of orientation. The two-paragraph essay that framed four tabs
          went with the regroup; how carrying works is shown on the cards. */}
      <header className="px-4 md:px-8 max-w-3xl mx-auto mb-6">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Network</h1>
        <p className="font-body italic text-ui-15 text-tea-text-sec mt-2">
          Teas other houses keep, which you can carry in your own shop.
        </p>
      </header>

      {/* Tab strip, text-link tabs in the editorial register */}
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
                className={`font-display text-ui-16 tracking-[0.02em] transition-colors ${
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

      {/* Active tab content, each surface rendered embedded so its own header
          padding doesn't double up with the hub container's. */}
      <div>
        {visibleTabs.length === 0 && (
          <p className="px-4 md:px-8 max-w-2xl mx-auto font-body italic text-ui-15 text-tea-text-sec leading-[1.7]">
            Your account doesn't yet have the bundles that open the network's
            working surfaces. Ask your owner about Catalog or Sell.
          </p>
        )}
        {activeTab === 'catalog'     && hasCatalog && <CatalogBrowse embedded />}
        {activeTab === 'suggestions' && hasCatalog && <SuggestionsInbox embedded />}
        {activeTab === 'adoptions'   && isPlatform && <AdoptionQueue embedded />}
      </div>
    </div>
  );
};

export default NetworkLanding;
