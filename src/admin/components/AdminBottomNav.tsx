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
  Camera,
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
  { id: 'inventory', label: 'Stock', icon: Package, path: '/admin/inventory' },
  { id: 'activity', label: 'Activity', icon: ClipboardList, path: '/admin/activity' },
] as const;

const rightTabs = [
  { id: 'people', label: 'People', icon: Users, path: '/admin/people' },
  { id: 'events', label: 'Events', icon: Calendar, path: '/admin/events' },
] as const;

const moreItems = [
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
    const active = isActive(tab.path);

    return (
      <div key={tab.id} className="flex items-center h-full flex-1">
        <button
          onClick={() => navigate(tab.path)}
          aria-current={active ? 'page' : undefined}
          aria-label={tab.label}
          className="flex-1 min-w-0 h-full flex items-center justify-center relative transition-all duration-300 group focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <span
            className={`text-[15px] tracking-[0.04em] lowercase transition-all duration-300 ${
              active ? 'text-tea-gold' : 'text-tea-text-sec/80 group-hover:text-tea-text-sec'
            }`}
            style={{ fontFamily: 'var(--font-display)', fontWeight: active ? 500 : 400 }}
          >
            {tab.label.toLowerCase()}
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
        className="flex lg:hidden fixed bottom-0 left-0 right-0 backdrop-blur-2xl backdrop-saturate-150 z-[40] animate-[slideUp_0.4s_ease-out] transition-all duration-200 h-[44px] pb-[env(safe-area-inset-bottom)] md:hidden"
        style={{
          background: 'rgba(40,33,26,0.65)',
          boxShadow: '0 -1px 0 rgba(184,146,78,0.06)',
        }}
      >
        <div className="flex items-center w-full px-0 h-full">
          {/* Left tabs */}
          {leftTabs.map((tab, index) => (
            <React.Fragment key={tab.id}>
              {renderTab(tab, index)}
              <div className="w-px h-3 bg-tea-gold/10" />
            </React.Fragment>
          ))}

          {/* Center — Home logo */}
          <div className="flex items-center h-full flex-1">
            <button
              onClick={() => navigate('/')}
              className="flex-1 h-full flex items-center justify-center relative transition-all duration-300"
              title="Home"
              aria-label="Return to home"
            >
              <LogoText
                size="sm"
                color="var(--tea-text-sec)"
                className="transition-all duration-300"
              />
            </button>
          </div>

          {/* Right tabs */}
          {rightTabs.map((tab, index) => (
            <React.Fragment key={tab.id}>
              <div className="w-px h-3 bg-tea-gold/10" />
              {renderTab(tab, index + leftTabs.length + 1)}
            </React.Fragment>
          ))}
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
