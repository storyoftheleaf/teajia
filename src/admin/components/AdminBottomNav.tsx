import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  BarChart3,
  Search,
  ShoppingCart,
  MoreHorizontal,
  Calendar,
  Briefcase,
  X,
  ExternalLink,
  Leaf,
  Coffee,
  Sparkles,
  Store,
  Users,
  FolderOpen,
  Settings,
  UserCheck,
  Plus,
} from 'lucide-react';

interface AdminBottomNavProps {
  onSearchClick: () => void;
  onCartClick: () => void;
  cartItemCount: number;
  isAdmin: boolean;
  onAddProduct?: () => void;
}

// Primary tabs — the 5 most essential mobile actions
const tabs = [
  { id: 'inventory', label: 'Inventory', icon: Package, path: '/admin/inventory' },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, path: '/admin/dashboard' },
  { id: 'add', label: 'Add', icon: Plus, path: null },
  { id: 'search', label: 'Search', icon: Search, path: null },
  { id: 'more', label: 'More', icon: MoreHorizontal, path: null },
] as const;

const moreItems = [
  { id: 'orders', label: 'Orders', icon: Briefcase, path: '/admin/orders', group: 'Business' },
  { id: 'customers', label: 'Customers', icon: Users, path: '/admin/customers', group: 'Business' },
  { id: 'records', label: 'Records & Logs', icon: FolderOpen, path: '/admin/records', group: 'Business' },
  { id: 'catalog', label: 'Tea Glossary', icon: Leaf, path: '/admin/catalog', group: 'Catalog' },
  { id: 'teaware', label: 'Equipment', icon: Coffee, path: '/admin/teaware', group: 'Catalog' },
  { id: 'tasting', label: 'Tasting Notes', icon: Sparkles, path: '/admin/tasting', group: 'Catalog' },
  { id: 'sources', label: 'Sources', icon: Store, path: '/admin/sources', group: 'Catalog' },
  { id: 'personal', label: 'Collection', icon: UserCheck, path: '/admin/personal', group: 'Catalog' },
  { id: 'cart', label: 'Cart / Registry', icon: ShoppingCart, path: null, group: null },
  { id: 'events', label: 'Events', icon: Calendar, path: '/admin/events', group: null },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings', group: null },
  { id: 'main-site', label: 'View Main Site', icon: ExternalLink, path: '/', group: null },
];

export const AdminBottomNav: React.FC<AdminBottomNavProps> = ({
  onSearchClick,
  onCartClick,
  cartItemCount,
  isAdmin,
  onAddProduct,
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
    } else if (tab.id === 'add') {
      onAddProduct?.();
    } else if (tab.id === 'more') {
      setIsMoreOpen(true);
    } else if (tab.path) {
      navigate(tab.path);
    }
  };

  const handleMoreItemClick = (item: (typeof moreItems)[number]) => {
    setIsMoreOpen(false);
    if (item.id === 'cart') {
      onCartClick();
    } else {
      navigate(item.path!);
    }
  };

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav aria-label="Admin navigation" className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-tea-surface/95 backdrop-blur-xl border-t border-tea-border pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === 'more' ? isMoreOpen : isActive(tab.path);
            const isAddButton = tab.id === 'add';

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                aria-current={active && tab.path ? 'page' : undefined}
                aria-label={tab.label}
                className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[52px] py-2 transition-colors duration-200 relative focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none ${
                  isAddButton
                    ? 'text-tea-gold'
                    : active ? 'text-tea-accent' : 'text-tea-text-sec'
                }`}
              >
                <div className="relative">
                  {isAddButton ? (
                    <div className="w-9 h-9 rounded-full bg-tea-gold/15 flex items-center justify-center -mt-3 shadow-lg shadow-tea-gold/10">
                      <Plus size={20} strokeWidth={2.5} className="text-tea-gold" />
                    </div>
                  ) : (
                    <Icon size={20} strokeWidth={1.8} />
                  )}
                  {tab.id === 'more' && cartItemCount > 0 && (
                    <span className="absolute -top-2 -right-2.5 bg-tea-accent text-tea-bg font-bold text-[10px] min-w-[16px] h-4 flex items-center justify-center rounded-full shadow-lg shadow-tea-accent/20 px-1">
                      {cartItemCount}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] uppercase tracking-wider font-medium leading-none ${isAddButton ? '-mt-1' : ''}`}>
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
              className="fixed inset-0 z-50 bg-tea-text/60 backdrop-blur-sm md:hidden"
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
                  className="p-2 rounded-lg text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated/50 transition-colors focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Items — grid layout for quick access */}
              <div className="py-3 max-h-[60vh] overflow-y-auto">
                {moreItems.map((item, index) => {
                  const Icon = item.icon;
                  const active = item.path ? isActive(item.path) : false;
                  const prevGroup = index > 0 ? moreItems[index - 1].group : undefined;
                  const showGroupHeader = item.group && item.group !== prevGroup;

                  return (
                    <React.Fragment key={item.id}>
                      {showGroupHeader && (
                        <div className="px-6 pt-3 pb-1">
                          <span className="text-[9px] uppercase tracking-[0.2em] text-tea-text-dim font-sans font-medium">{item.group}</span>
                        </div>
                      )}
                      {!prevGroup && item.group === null && index > 0 && moreItems[index - 1].group !== null && (
                        <div className="mx-6 my-1 border-t border-tea-border" />
                      )}
                      <button
                        onClick={() => handleMoreItemClick(item)}
                        aria-current={active ? 'page' : undefined}
                        className={`w-full flex items-center gap-4 py-3.5 px-6 min-h-[48px] transition-colors duration-150 active:bg-tea-elevated/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none ${
                          active
                            ? 'text-tea-accent bg-tea-accent/5'
                            : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated/50'
                        }`}
                      >
                        <Icon size={18} strokeWidth={1.8} />
                        <span className="text-sm font-medium">{item.label}</span>
                        {item.id === 'cart' && cartItemCount > 0 && (
                          <span className="ml-auto bg-tea-accent text-tea-bg font-bold text-[10px] min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5">
                            {cartItemCount}
                          </span>
                        )}
                        {item.id === 'main-site' && (
                          <ExternalLink size={14} className="ml-auto opacity-40" />
                        )}
                      </button>
                    </React.Fragment>
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
