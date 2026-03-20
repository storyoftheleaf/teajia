import React, { useState } from 'react';
import { Users, Store, Shield } from 'lucide-react';
import { CustomersView } from './CustomersView';
import { SourcesView } from './SourcesView';
import { UserManagement } from './UserManagement';
import { useAppStore } from '../store';
import { getTokenClaims } from '../../lib/api';

type PeopleTab = 'customers' | 'sources' | 'team';

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
    { id: 'team', label: 'Team', icon: <Shield size={15} />, visible: canSeeTeam },
  ];

  const visibleTabs = tabs.filter(t => t.visible);
  const [activeTab, setActiveTab] = useState<PeopleTab>(visibleTabs[0]?.id || 'customers');

  // Ensure activeTab is valid when access changes
  if (!visibleTabs.find(t => t.id === activeTab) && visibleTabs.length > 0) {
    setActiveTab(visibleTabs[0].id);
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-tea-bg">
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
        {activeTab === 'team' && canSeeTeam && (
          <div className="p-6 max-w-4xl mx-auto">
            <UserManagement currentUserRole={effectiveRole} />
          </div>
        )}
      </div>
    </div>
  );
};
