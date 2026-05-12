import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ListChecks, Users, Store, Shield, ShoppingBag, Tag } from 'lucide-react';
import { CustomersView } from './CustomersView';
import { SourcesView } from './SourcesView';
import PeopleAuditView from './PeopleAuditView';
import { TeamView } from '../views/TeamView';
import { PurchaseOrdersPage } from '../views/PurchaseOrdersPage';
import { ContactTagsView } from '../views/ContactTagsView';
import { useAppStore } from '../store';
import { api } from '../../lib/api';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

type PeopleTab = 'customers' | 'sources' | 'purchase-orders' | 'audit' | 'team' | 'tags';

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

  const canSeeSources = sourcesAccess.includes(effectiveRole);
  const canSeeTeam = effectiveRole === 'owner';

  const tabs: { id: PeopleTab; label: string; icon: React.ReactNode; visible: boolean }[] = [
    { id: 'customers',       label: 'Contacts',        icon: <Users size={14} />,        visible: true },
    { id: 'sources',         label: 'Sources',         icon: <Store size={14} />,        visible: canSeeSources },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: <ShoppingBag size={14} />,  visible: canSeeSources },
    { id: 'audit',           label: 'Audit',           icon: <ListChecks size={14} />,   visible: canSeeTeam },
    { id: 'team',            label: 'Team',            icon: <Shield size={14} />,       visible: canSeeTeam },
    { id: 'tags',            label: 'Tags',            icon: <Tag size={14} />,          visible: true },
  ];

  const visibleTabs = tabs.filter(t => t.visible);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as PeopleTab | null;
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

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      <div className="px-4 md:px-6 lg:px-10 pt-6 pb-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>People</h1>
          <p className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mt-1">
            Buyers, sources, guests, contributors, and team
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
        {activeTab === 'purchase-orders' && canSeeSources && <PurchaseOrdersPage />}
        {activeTab === 'audit' && canSeeTeam && <PeopleAuditView />}
        {activeTab === 'team' && canSeeTeam && <TeamView />}
        {activeTab === 'tags' && <ContactTagsView embedded />}
      </div>
    </div>
  );
};
