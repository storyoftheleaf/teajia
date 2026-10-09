import React, { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Users, Store, Tag } from 'lucide-react';
import { CustomersView } from './CustomersView';
import { SourcesView } from './SourcesView';
import { ContactTagsView } from '../views/ContactTagsView';
import { useAppStore } from '../store';
import { useAppStore as useMainStore, selectHasBundle, selectIsOwnerTier } from '../../lib/store';
import { api } from '../../lib/api';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

// Customers, Suppliers and Tags since 2026-09-29 (todo/plans/archive/manage-regroup.md).
// Team was a deprecated copy of Members; Audit moved to Settings; Purchase
// Orders moved to Curate. Their old tab links forward to where they live now.
type PeopleTab = 'customers' | 'sources' | 'tags';
const MOVED_TABS: Record<string, string> = {
  team: '/admin/access',
  audit: '/admin/audit',
  'purchase-orders': '/admin/purchase-orders',
};

interface PeopleViewProps {
  userRole: string;
  /** List of roles that can see the Sources tab */
  sourcesAccess?: string[];
}

export const PeopleView: React.FC<PeopleViewProps> = ({
  userRole,
  sourcesAccess = ['owner'],
}) => {
  const { isDevAdmin } = useAppStore();
  const effectiveRole = userRole || (isDevAdmin ? 'owner' : 'user');
  // The role handed down here is the global account type, and everyone invited
  // to run a shop carries the ordinary one, so four of these six tabs went
  // missing for the very people who own the shop. Their standing in this shop
  // is the question that belongs here.
  const ownsThisShop = useMainStore(selectIsOwnerTier);
  const hasStockAccess = useMainStore(s => selectHasBundle(s, 'stock'));

  const canSeeSources = ownsThisShop || hasStockAccess || sourcesAccess.includes(effectiveRole);

  const tabs: { id: PeopleTab; label: string; icon: React.ReactNode; visible: boolean }[] = [
    { id: 'customers', label: 'Customers', icon: <Users size={14} />, visible: true },
    { id: 'sources',   label: 'Suppliers', icon: <Store size={14} />, visible: canSeeSources },
    { id: 'tags',      label: 'Tags',      icon: <Tag size={14} />,   visible: true },
  ];

  const visibleTabs = tabs.filter(t => t.visible);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTabParam = searchParams.get('tab');
  const movedTo = rawTabParam ? MOVED_TABS[rawTabParam] : undefined;
  const rawTab = rawTabParam as PeopleTab | null;
  const fallback = visibleTabs[0]?.id || 'customers';
  const activeTab: PeopleTab = rawTab && visibleTabs.find(t => t.id === rawTab) ? rawTab : fallback;
  const setActiveTab = (tab: PeopleTab) => setSearchParams({ tab }, { replace: true });

  const queryClient = useQueryClient();
  useEffect(() => {
    if (canSeeSources) {
      queryClient.prefetchQuery({
        queryKey: ['purchase_orders'],
        queryFn: () => api.purchaseOrders.list(),
        staleTime: 1000 * 60 * 5,
      });
    }
  }, [canSeeSources, queryClient]);

  if (movedTo) return <Navigate to={movedTo} replace />;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      <div className="px-4 md:px-6 lg:px-10 pt-6 pb-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>People</h1>
          <p className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mt-1">
            Customers, suppliers and the tags that group them
          </p>
        </div>
      </div>

      <nav className="border-b border-tea-border flex-shrink-0">
        <div className="flex items-center gap-6 px-4 md:px-6 lg:px-10 max-w-7xl mx-auto overflow-x-auto scrollbar-hide">
        {visibleTabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 py-2.5 text-ui-12 uppercase tracking-[0.15em] whitespace-nowrap border-b transition-colors ${
                isActive
                  ? 'text-tea-text border-tea-gold'
                  : 'text-tea-text-sec hover:text-tea-text border-transparent'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
        </div>
      </nav>

      <div className="flex-1 overflow-auto min-h-0">
        {activeTab === 'customers' && <CustomersView />}
        {activeTab === 'sources' && canSeeSources && <SourcesView />}
        {activeTab === 'tags' && <ContactTagsView embedded />}
      </div>
    </div>
  );
};
