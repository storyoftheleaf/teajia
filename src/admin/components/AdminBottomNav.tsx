import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  BarChart3,
  Home,
  ClipboardList,
  Users,
  ShoppingCart,
  Calendar,
  Sparkles,
  X,
  ExternalLink,
} from 'lucide-react';

interface AdminBottomNavProps {
  onSearchClick: () => void;
  onCartClick: () => void;
  cartItemCount: number;
  isAdmin: boolean;
  onAddProduct?: () => void;
}

// Primary tabs — 5 most essential mobile actions
// Center button is Home (main site)
const tabs = [
  { id: 'inventory', label: 'Inventory', icon: Package, path: '/admin/inventory' },
  { id: 'activity', label: 'Activity', icon: ClipboardList, path: '/admin/activity' },
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'people', label: 'People', icon: Users, path: '/admin/people' },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, path: '/admin/dashboard' },
] as const;

const moreItems = [
  { id: 'events', label: 'Events', icon: Calendar, path: '/admin/events' },
  { id: 'tasting', label: 'Tasting Notes', icon: Sparkles, path: '/admin/tasting' },
  { id: 'cart', label: 'Cart / Registry', icon: ShoppingCart, path: null },
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
    if (!path || path === '/') return false;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleTabClick = (tab: (typeof tabs)[number]) => {
    if (tab.path) {
      navigate(tab.path);
    }
  };

  const handleMoreItemClick = (item: (typeof moreItems)[number]) => {
    setIsMoreOpen(false);
    if (item.id === 'cart') {
      onCartClick();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav aria-label="Admin navigation" className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-tea-surface/95 backdrop-blur-xl border-t border-tea-border pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.path);
            const isHomeButton = tab.id === 'home';

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                aria-current={active && tab.path !== '/' ? 'page' : undefined}
                aria-label={tab.label}
                className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[52px] py-2 transition-colors duration-200 relative focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none ${
                  isHomeButton
                    ? 'text-tea-gold'
                    : active ? 'text-tea-accent' : 'text-tea-text-sec'
                }`}
              >
                <div className="relative">
                  {isHomeButton ? (
                    <div className="w-9 h-9 rounded-full bg-tea-gold/15 flex items-center justify-center -mt-3 shadow-lg shadow-tea-gold/10">
                      <Home size={20} strokeWidth={2.5} className="text-tea-gold" />
                    </div>
                  ) : (
                    <Icon size={20} strokeWidth={1.8} />
                  )}
                </div>
                <span className={`text-[9px] uppercase tracking-wider font-medium leading-none ${isHomeButton ? '-mt-1' : ''}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* More Bottom Sheet (for overflow items — triggered from long-press or swipe-up in future) */}
      <AnimatePresence>
        {isMoreOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-tea-text/60 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMoreOpen(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-tea-surface rounded-t-2xl border-t border-tea-border pb-[env(safe-area-inset-bottom)]"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-tea-border" />
              </div>
              <div className="flex items-center justify-between px-6 py-3 border-b border-tea-border">
                <span className="text-sm font-medium text-tea-text">More</span>
                <button
                  onClick={() => setIsMoreOpen(false)}
                  className="p-2 rounded-lg text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated/50 transition-colors"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="py-3">
                {moreItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.path ? isActive(item.path) : false;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleMoreItemClick(item)}
                      className={`w-full flex items-center gap-4 py-3.5 px-6 min-h-[48px] transition-colors duration-150 active:bg-tea-elevated/30 ${
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
