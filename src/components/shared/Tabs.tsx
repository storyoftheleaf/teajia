import React, { useId, useRef } from 'react';

export interface TabItem {
  /** Stable key, also used to derive the tab/panel element ids. */
  id: string;
  label: React.ReactNode;
  /** Optional trailing count or badge. */
  badge?: React.ReactNode;
  icon?: React.ReactNode;
}

interface TabListProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  /** Accessible name for the tablist. */
  ariaLabel: string;
  /** Shared id base, pass the value returned by `useTabsIds()`. */
  baseId: string;
  className?: string;
  tabClassName?: string;
}

/** Stable id base shared between `<TabList>` and `<TabPanel>`. */
export function useTabsIds(): string {
  return useId();
}

export const tabElementId = (baseId: string, id: string) => `${baseId}-tab-${id}`;
export const panelElementId = (baseId: string, id: string) => `${baseId}-panel-${id}`;

/**
 * Accessible tab strip, `role="tablist"` with arrow-key roving focus.
 * Project underline-on-active visual style (no filled pills).
 * Pair with `<TabPanel>` using the same `baseId` from `useTabsIds()`.
 */
export const TabList: React.FC<TabListProps> = ({
  tabs,
  activeId,
  onChange,
  ariaLabel,
  baseId,
  className = '',
  tabClassName = '',
}) => {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex items-end gap-0.5 overflow-x-auto hide-scrollbar border-b border-tea-border ${className}`}
    >
      {tabs.map((tab, i) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={tabElementId(baseId, tab.id)}
            aria-selected={isActive}
            aria-controls={panelElementId(baseId, tab.id)}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`tap-target relative flex items-center gap-1.5 px-3 py-3 whitespace-nowrap text-ui-12 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tea-gold/50 ${
              isActive
                ? 'text-tea-text font-medium'
                : 'text-tea-text-sec hover:text-tea-text'
            } ${tabClassName}`}
          >
            {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null && (
              <span className="text-tea-gold">{tab.badge}</span>
            )}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute bottom-[-1px] left-0 right-0 h-[1.5px] bg-tea-gold"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

interface TabPanelProps {
  /** Must match the `id` of the owning tab. */
  tabId: string;
  /** Same `baseId` the `<TabList>` consumes. */
  baseId: string;
  isActive: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Companion panel for `<TabList>`. Renders only when active. */
export const TabPanel: React.FC<TabPanelProps> = ({
  tabId,
  baseId,
  isActive,
  className = '',
  children,
}) => {
  if (!isActive) return null;
  return (
    <div
      role="tabpanel"
      id={panelElementId(baseId, tabId)}
      aria-labelledby={tabElementId(baseId, tabId)}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
};
