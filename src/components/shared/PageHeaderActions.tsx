import React from 'react';
import { Icons } from '../Icons';

interface PageHeaderActionsProps {
  viewMode: 'GRID' | 'LIST';
  onViewModeChange: (mode: 'GRID' | 'LIST') => void;
  onFilter?: () => void;
  onReset?: () => void;
  showReset?: boolean;
  showFilter?: boolean;
  activeType?: string;
  activeFeeling?: string;
  itemCount?: number;
  showItemCount?: boolean;
}

export const PageHeaderActions: React.FC<PageHeaderActionsProps> = ({
  viewMode,
  onViewModeChange,
  onFilter,
  onReset,
  showReset = false,
  showFilter = false,
  activeType,
  activeFeeling,
  itemCount,
  showItemCount = false
}) => {
  return (
    <div className="flex items-center gap-4 md:gap-6">
      {/* View Mode Toggle */}
      <div className="flex items-center bg-tea-ink/5 dark:bg-white/5 rounded-[1px] p-0.5 border border-tea-ink/10 dark:border-white/10">
        <button
          onClick={() => onViewModeChange('LIST')}
          className={`p-1.5 rounded-[1px] transition-all ${
            viewMode === 'LIST'
              ? 'bg-tea-ink text-white dark:bg-tea-paper dark:text-tea-charcoal shadow-sm'
              : 'text-tea-ink/40 dark:text-tea-paper/40 hover:text-tea-ink dark:hover:text-tea-paper'
          }`}
          title="List View"
        >
          <Icons.List className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onViewModeChange('GRID')}
          className={`p-1.5 rounded-[1px] transition-all ${
            viewMode === 'GRID'
              ? 'bg-tea-ink text-white dark:bg-tea-paper dark:text-tea-charcoal shadow-sm'
              : 'text-tea-ink/40 dark:text-tea-paper/40 hover:text-tea-ink dark:hover:text-tea-paper'
          }`}
          title="Grid View"
        >
          <Icons.Grid className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Item Count */}
      {showItemCount && itemCount !== undefined && (
        <div className="pr-2 opacity-60 hidden md:block">
          <span className="text-xs uppercase tracking-[0.2em] text-tea-ink dark:text-tea-paper">
            {itemCount} Items
          </span>
        </div>
      )}

      {/* Reset Button */}
      {showReset && (activeType !== 'All' || activeFeeling !== 'All') && (
        <button
          onClick={onReset}
          className="text-xs uppercase tracking-[0.2em] text-tea-seal hover:text-tea-ink dark:hover:text-tea-paper transition-colors"
        >
          Reset
        </button>
      )}

      {/* Filter Button */}
      {showFilter && (
        <button
          onClick={onFilter}
          className="flex items-center gap-2 text-tea-ink/70 dark:text-tea-paper/70 hover:text-tea-ink dark:hover:text-tea-paper transition-colors group"
        >
          <Icons.Filter className="w-3.5 h-3.5 group-hover:text-tea-seal transition-colors" />
          <span className="text-xs uppercase tracking-[0.2em] font-medium">Filter</span>
          {(activeType !== 'All' || activeFeeling !== 'All') && (
            <div className="w-1 h-1 rounded-full bg-tea-seal"></div>
          )}
        </button>
      )}
    </div>
  );
};
