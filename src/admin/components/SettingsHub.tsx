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
        <h1 className="text-2xl text-tea-text mb-1" style={{ fontFamily: 'var(--font-display)' }}>
          Settings
        </h1>
        <p className="text-xs text-tea-text-dim uppercase tracking-[0.15em]">
          Account and platform configuration
        </p>
      </div>

      {visibleTabs.length > 1 && (
        <div className="flex items-center gap-1 px-3 md:px-6 py-2 border-b border-tea-border bg-tea-bg overflow-x-auto hide-scrollbar flex-shrink-0">
          <div className="flex items-center bg-tea-surface rounded-lg border border-tea-border p-0.5">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-ui-10 uppercase tracking-[0.15em] rounded-md whitespace-nowrap transition-colors ${
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
      )}

      <div className="flex-1 overflow-auto">
        {activeTab === 'account' && <AccountSettingsView embedded />}
        {activeTab === 'platform' && isPlatform && <PlatformAdminView embedded />}
      </div>
    </div>
  );
};
