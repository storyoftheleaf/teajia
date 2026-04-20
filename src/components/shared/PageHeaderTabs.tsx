import React from 'react';
import { motion, LayoutGroup } from 'framer-motion';

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
    <LayoutGroup>
    <div className={`w-full px-4 md:px-6 lg:px-10 overflow-x-auto hide-scrollbar ${className}`} style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' }}>
      <div className="flex items-center gap-7 md:gap-10 min-w-max">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`text-xs uppercase tracking-[0.25em] transition-all duration-300 relative group py-4 ${
              activeTab === tab.id
                ? 'text-tea-gold font-medium'
                : 'text-tea-text-dim hover:text-tea-text-sec'
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
              <motion.span
                layoutId="tab-underline"
                className="absolute bottom-0 left-0 w-full h-[1.5px] bg-tea-gold"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
    </LayoutGroup>
  );
};
