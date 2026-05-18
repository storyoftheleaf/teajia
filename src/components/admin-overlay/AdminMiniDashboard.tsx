import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminOverlay } from '../../hooks/useAdminOverlay';
import { Icons } from '../Icons';
import { fmtDollars } from '../../utils/formatNumber';

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
      <span className="text-ui-10 uppercase tracking-widest text-tea-text-sec block">
        Quick Overview
      </span>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => goTo('/admin/orders')}
          className="bg-tea-surface/30 border border-tea-border p-3 flex flex-col items-center gap-1 hover:bg-tea-surface/50 transition-colors"
        >
          <span className={`font-mono text-xl ${stats.pendingOrders > 0 ? 'text-tea-gold dark:text-tea-gold' : 'text-tea-text'}`}>
            {stats.pendingOrders}
          </span>
          <span className="text-ui-9 uppercase tracking-widest text-tea-text-sec/60">
            Pending
          </span>
        </button>

        <button
          onClick={() => goTo('/admin/inventory')}
          className="bg-tea-surface/30 border border-tea-border p-3 flex flex-col items-center gap-1 hover:bg-tea-surface/50 transition-colors"
        >
          <span className={`font-mono text-xl ${stats.lowStockItems > 0 ? 'text-tea-error dark:text-tea-error' : 'text-tea-text'}`}>
            {stats.lowStockItems}
          </span>
          <span className="text-ui-9 uppercase tracking-widest text-tea-text-sec/60">
            Low Stock
          </span>
        </button>

        <button
          onClick={() => goTo('/admin/activity?tab=ledger')}
          className="bg-tea-surface/30 border border-tea-border p-3 flex flex-col items-center gap-1 hover:bg-tea-surface/50 transition-colors"
        >
          <span className="num text-xl text-tea-text">
            {fmtDollars(stats.revenueThisWeek)}
          </span>
          <span className="text-ui-9 uppercase tracking-widest text-tea-text-sec/60">
            This Week
          </span>
        </button>
      </div>

      {/* Low stock alerts */}
      {stats.lowStockProducts.length > 0 && (
        <div className="bg-tea-error/10 dark:bg-tea-error/10 border border-tea-error/30 dark:border-tea-error/20 p-3">
          <span className="text-ui-10 uppercase tracking-widest text-tea-error/60 dark:text-tea-error/60 block mb-2">
            Low Stock Alerts
          </span>
          <div className="space-y-1.5">
            {stats.lowStockProducts.slice(0, 4).map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-tea-text/70 truncate flex-1 mr-2 font-serif">
                  {p.givenName || p.productName}
                </span>
                <span className="font-mono text-tea-error dark:text-tea-error shrink-0">
                  {Math.round(p.stockGrams)}g
                </span>
              </div>
            ))}
            {stats.lowStockProducts.length > 4 && (
              <span className="text-ui-10 text-tea-error/50">
                +{stats.lowStockProducts.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Catalog summary */}
      <div className="flex items-center justify-between text-ui-10 text-tea-text/30 uppercase tracking-widest px-1">
        <span>{stats.activeProducts} active / {stats.totalProducts} total</span>
      </div>
    </div>
  );
};
