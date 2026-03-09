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
      <div className="flex items-center bg-tea-text/[0.06] rounded-lg p-0.5">
        <button
          onClick={() => onViewModeChange('LIST')}
          className={`p-1.5 rounded-lg transition-all ${
            viewMode === 'LIST'
              ? 'bg-tea-elevated text-tea-text shadow-sm'
              : 'text-tea-text/40 hover:text-tea-text'
          }`}
          title="List View"
        >
          <Icons.List className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Item Count */}
      {showItemCount && itemCount !== undefined && (
        <div className="pr-2 opacity-60 hidden md:block">
          <span className="text-xs uppercase tracking-[0.2em] text-tea-text">
            {itemCount} Items
          </span>
        </div>
      )}

      {/* Reset Button */}
      {showReset && (activeType !== 'All' || activeFeeling !== 'All') && (
        <button
          onClick={onReset}
          className="text-xs uppercase tracking-[0.2em] text-tea-gold hover:text-tea-text transition-colors"
        >
          Reset
        </button>
      )}

      {/* Filter Button */}
      {showFilter && (
        <button
          onClick={onFilter}
          className="flex items-center gap-2 text-tea-text/70 hover:text-tea-text transition-colors group"
        >
          <Icons.Filter className="w-3.5 h-3.5 group-hover:text-tea-gold transition-colors" />
          <span className="text-xs uppercase tracking-[0.2em] font-medium">Filter</span>
          {(activeType !== 'All' || activeFeeling !== 'All') && (
            <div className="w-1 h-1 rounded-full bg-tea-gold"></div>
          )}
        </button>
      )}
    </div>
  );
};
