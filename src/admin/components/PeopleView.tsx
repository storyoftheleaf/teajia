import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Store, Shield, ShoppingBag } from 'lucide-react';
import { CustomersView } from './CustomersView';
import { SourcesView } from './SourcesView';
import { TeamView } from '../views/TeamView';
import { PurchaseOrdersPage } from '../views/PurchaseOrdersPage';
import { useAppStore } from '../store';

type PeopleTab = 'customers' | 'sources' | 'purchase-orders' | 'team';

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

  // Build available tabs based on access level
  const tabs: { id: PeopleTab; label: string; icon: React.ReactNode; visible: boolean }[] = [
    { id: 'customers', label: 'Customers', icon: <Users size={15} />, visible: true },
    { id: 'sources', label: 'Sources', icon: <Store size={15} />, visible: canSeeSources },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: <ShoppingBag size={15} />, visible: canSeeSources },
    { id: 'team', label: 'Team', icon: <Shield size={15} />, visible: canSeeTeam },
  ];

  const visibleTabs = tabs.filter(t => t.visible);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as PeopleTab | null;
  const fallback = visibleTabs[0]?.id || 'customers';
  const activeTab: PeopleTab = rawTab && visibleTabs.find(t => t.id === rawTab) ? rawTab : fallback;
  const setActiveTab = (tab: PeopleTab) => setSearchParams({ tab }, { replace: true });

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      {/* Page header */}
      <div className="px-4 md:px-6 lg:px-10 pt-6 pb-3 flex-shrink-0">
        <h1 className="text-2xl text-tea-text mb-1" style={{ fontFamily: 'var(--font-display)' }}>
          People
        </h1>
        <p className="text-xs text-tea-text-dim uppercase tracking-[0.15em]">
          Customers, suppliers, and team
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 md:px-6 py-2 border-b border-tea-border bg-tea-bg overflow-x-auto hide-scrollbar flex-shrink-0">
        <div className="flex items-center bg-tea-surface rounded-lg border border-tea-border p-0.5">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] rounded-md whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-tea-bg text-tea-text shadow-sm'
                  : 'text-tea-text-sec hover:text-tea-text'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'customers' && <CustomersView />}
        {activeTab === 'sources' && canSeeSources && <SourcesView />}
        {activeTab === 'purchase-orders' && canSeeSources && <PurchaseOrdersPage />}
        {activeTab === 'team' && canSeeTeam && <TeamView />}
      </div>
    </div>
  );
};
