import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminOverlay } from '../../hooks/useAdminOverlay';
import { Icons } from '../Icons';

export const AdminMiniDashboard: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { isAdmin, stats } = useAdminOverlay();
  const navigate = useNavigate();

  if (!isAdmin) return null;

  const goTo = (path: string) => {
    if (onClose) onClose();
    navigate(path);
  };

  return (
    <div className="space-y-3">
      <span className="text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50 block">
        Quick Overview
      </span>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => goTo('/admin/orders')}
          className="bg-white/30 dark:bg-white/5 border border-tea-charcoal/5 dark:border-white/10 p-3 flex flex-col items-center gap-1 hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
        >
          <span className={`font-mono text-xl ${stats.pendingOrders > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-tea-charcoal dark:text-white'}`}>
            {stats.pendingOrders}
          </span>
          <span className="text-[9px] uppercase tracking-widest text-tea-charcoal/40 dark:text-white/40">
            Pending
          </span>
        </button>

        <button
          onClick={() => goTo('/admin/inventory')}
          className="bg-white/30 dark:bg-white/5 border border-tea-charcoal/5 dark:border-white/10 p-3 flex flex-col items-center gap-1 hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
        >
          <span className={`font-mono text-xl ${stats.lowStockItems > 0 ? 'text-red-600 dark:text-red-400' : 'text-tea-charcoal dark:text-white'}`}>
            {stats.lowStockItems}
          </span>
          <span className="text-[9px] uppercase tracking-widest text-tea-charcoal/40 dark:text-white/40">
            Low Stock
          </span>
        </button>

        <button
          onClick={() => goTo('/admin/records')}
          className="bg-white/30 dark:bg-white/5 border border-tea-charcoal/5 dark:border-white/10 p-3 flex flex-col items-center gap-1 hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
        >
          <span className="font-mono text-xl text-tea-charcoal dark:text-white">
            ${stats.revenueThisWeek.toFixed(0)}
          </span>
          <span className="text-[9px] uppercase tracking-widest text-tea-charcoal/40 dark:text-white/40">
            This Week
          </span>
        </button>
      </div>

      {/* Low stock alerts */}
      {stats.lowStockProducts.length > 0 && (
        <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-200/30 dark:border-red-800/20 p-3">
          <span className="text-[10px] uppercase tracking-widest text-red-600/60 dark:text-red-400/60 block mb-2">
            Low Stock Alerts
          </span>
          <div className="space-y-1.5">
            {stats.lowStockProducts.slice(0, 4).map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-tea-charcoal/70 dark:text-white/70 truncate flex-1 mr-2 font-serif">
                  {p.givenName || p.productName}
                </span>
                <span className="font-mono text-red-600 dark:text-red-400 shrink-0">
                  {p.stockGrams}g
                </span>
              </div>
            ))}
            {stats.lowStockProducts.length > 4 && (
              <span className="text-[10px] text-red-500/50">
                +{stats.lowStockProducts.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Catalog summary */}
      <div className="flex items-center justify-between text-[10px] text-tea-charcoal/40 dark:text-white/30 uppercase tracking-widest px-1">
        <span>{stats.activeProducts} active / {stats.totalProducts} total</span>
      </div>
    </div>
  );
};
