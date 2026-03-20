import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  BarChart3,
  ClipboardList,
  Users,
  ShoppingCart,
  Calendar,
  Sparkles,
  X,
} from 'lucide-react';
import { LogoEmblem, LogoText } from '../../components/Logos';

interface AdminBottomNavProps {
  onSearchClick: () => void;
  onCartClick: () => void;
  cartItemCount: number;
  isAdmin: boolean;
  onAddProduct?: () => void;
}

// Left/right tabs — mirroring BottomTabBar's layout (2 left, center, 2 right)
const leftTabs = [
  { id: 'inventory', label: 'Inventory', icon: Package, path: '/admin/inventory' },
  { id: 'activity', label: 'Activity', icon: ClipboardList, path: '/admin/activity' },
] as const;

const rightTabs = [
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

  const isActive = (path: string) => {
    if (path === '/') return false;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const isHome = location.pathname === '/admin' || location.pathname === '/admin/';

  const renderTab = (tab: { id: string; label: string; icon: React.ComponentType<any>; path: string }, index: number) => {
    const Icon = tab.icon;
    const active = isActive(tab.path);

    return (
      <div key={tab.id} className="flex items-center h-full flex-1">
        <button
          onClick={() => navigate(tab.path)}
          aria-current={active ? 'page' : undefined}
          aria-label={tab.label}
          className="flex-1 min-w-0 h-full flex flex-col items-center justify-center relative transition-all duration-300 group focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="relative flex-shrink-0 w-6 h-6 flex items-center justify-center overflow-visible transition-all duration-300 group-hover:scale-105">
            <Icon
              className={`transition-all duration-300 flex-shrink-0 w-5 h-5 ${
                active
                  ? 'text-tea-gold scale-110 origin-center'
                  : 'text-tea-text/60 group-hover:text-tea-text/85'
              }`}
              strokeWidth={2}
              {...(active ? { fill: 'currentColor' } : {})}
            />
          </div>
          <span className={`text-[11px] font-sans font-normal uppercase tracking-[0.15em] mt-1 transition-all duration-300 text-center truncate px-1 relative z-10 ${
            active ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
          }`}>
            {tab.label}
          </span>
        </button>
      </div>
    );
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
      {/* Bottom Tab Bar — identical structure to home page BottomTabBar */}
      <nav
        aria-label="Admin navigation"
        className="flex lg:hidden fixed bottom-0 left-0 right-0 bg-tea-surface/92 backdrop-blur-xl z-sticky animate-[slideUp_0.4s_ease-out] transition-all duration-200 h-[56px] pb-[env(safe-area-inset-bottom)] md:hidden"
        style={{ boxShadow: '0 -8px 24px var(--tea-accent-sub)' }}
      >
        <div className="flex items-center w-full px-0 h-full">
          {/* Left tabs */}
          {leftTabs.map((tab, index) => renderTab(tab, index))}

          {/* Center — Home with Teajia logo emblem (identical to home page) */}
          <div className="flex items-center h-full flex-1">
            <button
              onClick={() => navigate('/')}
              className="flex-1 h-full flex items-center justify-center relative transition-all duration-300"
              title="Home"
              aria-label="Return to home"
            >
              <div className="absolute inset-0 flex items-end justify-center pb-1 pointer-events-none">
                <LogoEmblem
                  size={48}
                  color="var(--tea-accent-sub)"
                  className="transition-all duration-300"
                />
              </div>
              <LogoText
                size="sm"
                color="var(--tea-text-sec)"
                className="relative z-10 transition-all duration-300 scale-[1.08]"
              />
            </button>
          </div>

          {/* Right tabs */}
          {rightTabs.map((tab, index) => renderTab(tab, index + leftTabs.length + 1))}
        </div>
      </nav>

      {/* More Bottom Sheet */}
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
