import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { AccountSettingsView } from '../views/AccountSettingsView';
import { PlatformAdminView } from '../views/PlatformAdminView';

type SettingsTab = 'account' | 'platform';

interface SettingsHubProps {
  isPlatform: boolean;
}

export const SettingsHub: React.FC<SettingsHubProps> = ({ isPlatform }) => {
  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode; visible: boolean }[] = [
    { id: 'account',  label: 'Account',  icon: <SettingsIcon size={15} />, visible: true },
    { id: 'platform', label: 'Platform', icon: <ShieldCheck size={15} />, visible: isPlatform },
  ];

  const visibleTabs = tabs.filter(t => t.visible);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as SettingsTab | null;
  const activeTab: SettingsTab = rawTab && visibleTabs.find(t => t.id === rawTab) ? rawTab : 'account';
  const setActiveTab = (tab: SettingsTab) => setSearchParams({ tab }, { replace: true });

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      <div className="px-4 md:px-6 lg:px-10 pt-6 pb-3 flex-shrink-0">
        <h1 className="h2 text-tea-text">Settings</h1>
        <p className="label-caps text-tea-text-dim mt-1">
          Account and platform configuration
        </p>
      </div>

      {visibleTabs.length > 1 && (
        <div className="flex items-center gap-6 px-4 md:px-6 lg:px-10 border-b border-tea-border bg-tea-bg flex-shrink-0 overflow-x-auto scrollbar-hide">
          {visibleTabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 py-2.5 text-ui-12 uppercase tracking-caps font-sans border-b transition-colors whitespace-nowrap shrink-0 ${
                  isActive ? 'text-tea-text border-tea-gold' : 'text-tea-text-sec hover:text-tea-text border-transparent'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {activeTab === 'account' && <AccountSettingsView embedded />}
        {activeTab === 'platform' && isPlatform && <PlatformAdminView embedded />}
      </div>
    </div>
  );
};
