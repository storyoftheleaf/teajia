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
  /** Fit a small primary tab set inside the viewport instead of scrolling it. */
  fit?: boolean;
  /**
   * The faint rules above and below the tab row. They run the full width of the
   * bar, so on a page whose rules sit on a content edge they are the two lines
   * that cannot be made to agree with the rest. Off, the header's own rule
   * below carries the separation.
   */
  hairlines?: boolean;
  /** Extra horizontal padding, to match a page body that carries its own gutter. */
  gutter?: string;
}

export const PageHeaderTabs: React.FC<PageHeaderTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
  fit = false,
  hairlines = true,
  gutter = '',
}) => {
  return (
    <LayoutGroup>
    /* Same px as the title row above it. The fit row carried px-3 against the
       header's px-4, so the last tab ended four pixels outboard of every other
       thing in the bar: LIKED sat proud of the title, the currency chip and the
       rule under the row, and read as pushed against the edge of the screen. */
    <div className={`w-full ${fit ? 'px-4 md:px-6 lg:px-10 overflow-hidden' : 'px-4 md:px-6 lg:px-10 overflow-x-auto hide-scrollbar'} ${gutter} ${className}`} style={hairlines ? { boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' } : undefined}>
      <div className={`flex items-center ${fit ? 'w-full min-w-0 justify-between gap-1.5 md:justify-start md:gap-10' : 'gap-7 md:gap-10 min-w-max'}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`${fit ? 'tap-target text-ui-10 tracking-[0.18em] py-3' : 'text-ui-12 tracking-[0.25em] py-4'} min-w-0 uppercase transition-all duration-300 relative group ${
              activeTab === tab.id
                ? 'text-tea-gold font-medium'
                : 'text-tea-text-dim hover:text-tea-text-sec'
            }`}
          >
            <div className={`flex items-center ${fit ? 'gap-1.5' : 'gap-2'}`}>
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
