import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  BarChart3,
  Search,
  ShoppingCart,
  MoreHorizontal,
  UserCheck,
  History,
  FolderOpen,
  Settings,
  X,
  ExternalLink,
} from 'lucide-react';

interface AdminBottomNavProps {
  onSearchClick: () => void;
  onCartClick: () => void;
  cartItemCount: number;
  isAdmin: boolean;
}

const tabs = [
  { id: 'inventory', label: 'Inventory', icon: Package, path: '/admin/inventory' },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, path: '/admin/dashboard' },
  { id: 'search', label: 'Search', icon: Search, path: null },
  { id: 'cart', label: 'Cart', icon: ShoppingCart, path: null },
  { id: 'more', label: 'More', icon: MoreHorizontal, path: null },
] as const;

const moreItems = [
  { id: 'collection', label: 'Collection', icon: UserCheck, path: '/admin/personal' },
  { id: 'orders', label: 'Orders', icon: History, path: '/admin/orders' },
  { id: 'records', label: 'Records & Logs', icon: FolderOpen, path: '/admin/records' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings' },
  { id: 'main-site', label: 'View Main Site', icon: ExternalLink, path: '/' },
];

export const AdminBottomNav: React.FC<AdminBottomNavProps> = ({
  onSearchClick,
  onCartClick,
  cartItemCount,
  isAdmin,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const isActive = (path: string | null) => {
    if (!path) return false;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleTabClick = (tab: (typeof tabs)[number]) => {
    if (tab.id === 'search') {
      onSearchClick();
    } else if (tab.id === 'cart') {
      onCartClick();
    } else if (tab.id === 'more') {
      setIsMoreOpen(true);
    } else if (tab.path) {
      navigate(tab.path);
    }
  };

  const handleMoreItemClick = (item: (typeof moreItems)[number]) => {
    setIsMoreOpen(false);
    navigate(item.path);
  };

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-tea-surface/95 backdrop-blur-xl border-t border-tea-border pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === 'more' ? isMoreOpen : isActive(tab.path);

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] py-2 transition-colors duration-200 relative ${
                  active ? 'text-tea-accent' : 'text-tea-text-dim'
                }`}
              >
                <div className="relative">
                  <Icon size={20} strokeWidth={1.8} />
                  {tab.id === 'cart' && cartItemCount > 0 && (
                    <span className="absolute -top-2 -right-2.5 bg-tea-accent text-tea-bg font-bold text-[10px] min-w-[16px] h-4 flex items-center justify-center rounded-full shadow-lg shadow-tea-accent/20 px-1">
                      {cartItemCount}
                    </span>
                  )}
                </div>
                <span className="text-[9px] uppercase tracking-wider font-medium leading-none">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* More Bottom Sheet */}
      <AnimatePresence>
        {isMoreOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMoreOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-tea-surface rounded-t-2xl border-t border-tea-border pb-[env(safe-area-inset-bottom)]"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-tea-border" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-tea-border">
                <span className="text-sm font-medium text-tea-text">More</span>
                <button
                  onClick={() => setIsMoreOpen(false)}
                  className="p-1.5 rounded-lg text-tea-text-dim hover:text-tea-text hover:bg-tea-elevated/50 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Items */}
              <div className="py-2">
                {moreItems.map((item) => {
                  if (!isAdmin && item.id === 'settings') return null;
                  const Icon = item.icon;
                  const active = isActive(item.path);

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleMoreItemClick(item)}
                      className={`w-full flex items-center gap-4 py-4 px-6 transition-colors duration-150 ${
                        active
                          ? 'text-tea-accent bg-tea-accent/5'
                          : 'text-tea-text-dim hover:text-tea-text hover:bg-tea-elevated/50'
                      }`}
                    >
                      <Icon size={20} strokeWidth={1.8} />
                      <span className="text-sm font-medium">{item.label}</span>
                      {item.id === 'main-site' && (
                        <ExternalLink size={14} className="ml-auto opacity-40" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default AdminBottomNav;
