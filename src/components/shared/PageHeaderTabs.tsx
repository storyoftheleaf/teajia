import React from 'react';

interface Tab {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface PageHeaderTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const PageHeaderTabs: React.FC<PageHeaderTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = ''
}) => {
  return (
    <div className={`w-full px-4 md:px-6 lg:px-10 border-y border-tea-border overflow-x-auto no-scrollbar ${className}`}>
      <div className="flex items-center gap-7 md:gap-10 min-w-max">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`text-xs uppercase tracking-[0.25em] transition-all duration-300 relative group py-4 ${
              activeTab === tab.id
                ? 'text-tea-text opacity-100 font-medium'
                : 'text-tea-text/60 hover:text-tea-text/90/90'
            }`}
          >
            <div className="flex items-center gap-2">
              {tab.icon && <span>{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.count !== undefined && !tab.icon && (
                <span className="text-xs opacity-75">({tab.count})</span>
              )}
            </div>
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 w-full h-[1.5px] bg-tea-gold transition-all duration-300"></span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
