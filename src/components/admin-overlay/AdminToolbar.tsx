import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminOverlay } from '../../hooks/useAdminOverlay';
import { Icons } from '../Icons';
import { fmtDollars } from '../../utils/formatNumber';

interface AdminToolbarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export const AdminToolbar: React.FC<AdminToolbarProps> = ({ collapsed: controlledCollapsed, onCollapsedChange }) => {
  const { isAdmin, stats } = useAdminOverlay();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const navigate = useNavigate();

  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = (value: boolean) => {
    setInternalCollapsed(value);
    onCollapsedChange?.(value);
  };

  if (!isAdmin) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed top-2 right-2 z-modal w-8 h-8 rounded-full bg-tea-ink/80 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center text-tea-paper/60 hover:text-tea-paper transition-colors shadow-lg"
        title="Show admin bar"
      >
        <Icons.Settings className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-sticky bg-tea-ink/90 dark:bg-[#1a1a1a]/95 backdrop-blur-md border-b border-tea-border h-9 flex items-center px-3 lg:pl-24 xl:pl-60 shadow-lg">
      {/* Stats */}
      <div className="flex items-center gap-4 flex-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => navigate('/admin/orders')}
          className="flex items-center gap-1.5 shrink-0 group"
          title="Pending orders"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${stats.pendingOrders > 0 ? 'bg-amber-400 animate-pulse' : 'bg-white/20'}`} />
          <span className="text-[10px] uppercase tracking-widest text-white/50 group-hover:text-white/80 transition-colors">
            {stats.pendingOrders} pending
          </span>
        </button>

        <span className="w-px h-3 bg-white/10 shrink-0" />

        <button
          onClick={() => navigate('/admin/inventory')}
          className="flex items-center gap-1.5 shrink-0 group"
          title="Low stock items"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${stats.lowStockItems > 0 ? 'bg-red-400' : 'bg-white/20'}`} />
          <span className="text-[10px] uppercase tracking-widest text-white/50 group-hover:text-white/80 transition-colors">
            {stats.lowStockItems} low stock
          </span>
        </button>

        <span className="w-px h-3 bg-white/10 shrink-0" />

        <button
          onClick={() => navigate('/admin/records')}
          className="flex items-center gap-1.5 shrink-0 group"
          title="Revenue this week"
        >
          <span className="text-[10px] uppercase tracking-widest text-white/50 group-hover:text-white/80 transition-colors num">
            {fmtDollars(stats.revenueThisWeek)} <span className="font-sans opacity-60">this week</span>
          </span>
        </button>

        <span className="w-px h-3 bg-white/10 shrink-0" />

        <span className="text-[10px] uppercase tracking-widest text-white/30 shrink-0">
          {stats.activeProducts}/{stats.totalProducts} active
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <button
          onClick={() => navigate('/admin')}
          className="text-[10px] uppercase tracking-widest text-tea-seal hover:text-tea-seal/80 transition-colors font-medium flex items-center gap-1"
        >
          Admin
          <Icons.ChevronRight className="w-3 h-3" />
        </button>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 text-white/30 hover:text-white/60 transition-colors"
          title="Collapse admin bar"
        >
          <Icons.Close className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
