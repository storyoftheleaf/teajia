import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, LayoutGroup } from 'framer-motion';
import { Icons } from './Icons';
import { LogoEmblem } from './Logos';
import { Section } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useAppStore } from '../lib/store';
import { Calendar, LayoutDashboard, Briefcase, Leaf, Coffee, Store, Users, FolderOpen, Settings, ChevronsLeft, ChevronsRight, UserCheck } from 'lucide-react';

const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

interface SubNavItem {
  id: string;
  path: string;
  label: string;
  icon: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  section?: Section;
  path?: string;
  badge?: number;
  action?: () => void;
  children?: SubNavItem[];
}

const NavButton: React.FC<{
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  animationDelay?: number;
  collapsed?: boolean;
}> = ({ item, isActive, onClick, animationDelay = 0, collapsed = false }) => {
  const content = (
    <>
      <div className={`transition-all duration-300 shrink-0 ${
        isActive ? 'text-tea-gold scale-110' : 'text-tea-text-sec group-hover:text-tea-text group-hover:scale-105'
      }`}>
        {item.icon}
      </div>
      {!collapsed && (
        <span
          className={`text-sm transition-all duration-300 ${
            isActive ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
          }`}
          style={{ fontFamily: 'var(--font-display)', fontWeight: 300, letterSpacing: '0.03em' }}
        >
          {item.label}
        </span>
      )}
      {!collapsed && item.badge !== undefined && item.badge > 0 && (
        <span className="ml-auto w-4 h-4 bg-tea-gold text-white text-[9px] font-bold rounded-full flex items-center justify-center shrink-0 mr-2">
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      )}
      {collapsed && item.badge !== undefined && item.badge > 0 && (
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-tea-gold text-white text-[8px] font-bold rounded-full flex items-center justify-center">
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      )}
      {isActive && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-tea-gold rounded-r-full"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
      )}
    </>
  );

  const className = `relative flex items-center ${collapsed ? 'justify-center px-2 min-h-[44px]' : 'gap-3 px-4'} py-2.5 rounded-md transition-all duration-200 group animate-[fadeIn_0.5s_ease-out] ${
    isActive ? 'bg-tea-gold/8' : 'hover:bg-tea-gold/5'
  }`;

  if (item.action) {
    return (
      <button onClick={item.action} className={`w-full ${className}`} style={{ animationDelay: `${animationDelay}ms` }}>
        {content}
      </button>
    );
  }

  if (item.path) {
    return (
      <Link to={item.path} onClick={onClick} className={className} style={{ animationDelay: `${animationDelay}ms` }}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={`w-full ${className}`} style={{ animationDelay: `${animationDelay}ms` }}>
      {content}
    </button>
  );
};

interface LeftSidebarProps {
  activeSection: Section;
  onNavigate: (section: Section) => void;
  onAccountClick?: () => void;
  onCartClick?: () => void;
  onSearchClick?: () => void;
  cartItemCount?: number;
  topOffset?: boolean;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeSection,
  onNavigate,
  onAccountClick,
  onCartClick,
  onSearchClick,
  cartItemCount = 0,
}) => {
  const { theme } = useTheme();
  const auth = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const { sidebarCollapsed: collapsed, toggleSidebarCollapsed, activeAccount } = useAppStore();

  // Sync sidebar width to CSS variable so fixed full-screen panels can offset themselves
  useEffect(() => {
    document.documentElement.style.setProperty('--teajia-sidebar-w', collapsed ? '3.5rem' : '14rem');
  }, [collapsed]);

  const [badgeAnimating, setBadgeAnimating] = useState(false);
  const prevCountRef = useRef(cartItemCount);
  useEffect(() => {
    if (cartItemCount > prevCountRef.current) {
      setBadgeAnimating(true);
      const t = setTimeout(() => setBadgeAnimating(false), 400);
      return () => clearTimeout(t);
    }
    prevCountRef.current = cartItemCount;
  }, [cartItemCount]);

  const browseItems: NavItem[] = [
    { id: 'MAGAZINE', label: 'Read',    icon: <Icons.Magazine className="w-5 h-5" strokeWidth={2} />, section: 'MAGAZINE' as Section },
    { id: 'LEARN',    label: 'Learn',   icon: <Icons.School   className="w-5 h-5" strokeWidth={2} />, section: 'LEARN'    as Section },
    { id: 'OFFERINGS',label: 'Consult', icon: <Icons.Sparkles className="w-5 h-5" strokeWidth={2} />, section: 'OFFERINGS'as Section },
    { id: 'SHOP',     label: 'Shop',    icon: <Icons.Bag      className="w-5 h-5" strokeWidth={2} />, section: 'SHOP'     as Section },
  ];

  const isChildActive = (children?: SubNavItem[]) => children?.some(c => currentPath === c.path) ?? false;

  const adminItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} strokeWidth={1.75} />, path: '/admin/dashboard' },
    { id: 'inventory',  label: 'Inventory',  icon: <Settings size={18} strokeWidth={1.75} />, path: '/admin/inventory', children: [
      { id: 'catalog',  path: '/admin/catalog',  label: 'Tea Glossary', icon: <Leaf      className="w-3.5 h-3.5" strokeWidth={1.75} /> },
      { id: 'teaware',  path: '/admin/teaware',  label: 'Equipment',    icon: <Coffee    className="w-3.5 h-3.5" strokeWidth={1.75} /> },
      { id: 'sources',  path: '/admin/sources',  label: 'Sources',      icon: <Store     className="w-3.5 h-3.5" strokeWidth={1.75} /> },
      { id: 'personal', path: '/admin/personal', label: 'Collection',   icon: <UserCheck className="w-3.5 h-3.5" strokeWidth={1.75} /> },
    ]},
    { id: 'business', label: 'Business', icon: <Briefcase size={18} strokeWidth={1.75} />, path: '/admin/orders', children: [
      { id: 'customers', path: '/admin/customers', label: 'Customers',     icon: <Users      className="w-3.5 h-3.5" strokeWidth={1.75} /> },
      { id: 'records',   path: '/admin/records',   label: 'Records & Logs',icon: <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.75} /> },
      { id: 'settings',  path: '/admin/settings',  label: 'Settings',      icon: <Settings   className="w-3.5 h-3.5" strokeWidth={1.75} /> },
    ]},
    { id: 'events', label: 'Events', icon: <Calendar size={18} strokeWidth={1.75} />, path: '/admin/events' },
  ];

  const userName = auth.isAuthenticated ? (auth.user?.name || auth.user?.email?.split('@')[0] || 'Account') : null;
  const locationLine = activeAccount?.location_city || activeAccount?.location_country || null;

  return (
    <LayoutGroup>
    <aside
      className={`hidden lg:flex flex-col ${collapsed ? 'w-14' : 'w-56'} text-tea-text fixed left-0 overflow-y-auto hide-scrollbar transition-all duration-300 z-sticky top-0 h-screen select-none`}
      style={{
        background: 'linear-gradient(180deg, var(--tea-surface) 0%, rgb(var(--tea-bg-rgb) / 0.96) 100%)',
        boxShadow: 'inset -1px 0 0 var(--tea-accent-sub), 1px 0 12px rgb(var(--tea-bg-rgb) / 0.2)',
      }}
    >
      {/* Grain texture */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{ opacity: 0.035, backgroundImage: GRAIN, backgroundSize: '120px' }}
      />

      {/* All content above grain */}
      <div className="relative z-10 flex flex-col flex-1 min-h-0">

        {/* ── Brand / Logo ── */}
        <button
          onClick={() => { onNavigate('HOME'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className={`flex items-center ${collapsed ? 'justify-center px-2 h-16' : 'px-5 gap-3 h-16'} transition-all duration-300 group ${
            activeSection === 'HOME' ? 'bg-tea-gold/8' : 'hover:bg-tea-gold/5'
          }`}
          style={{ boxShadow: '0 1px 0 var(--tea-border)' }}
          title="Home"
        >
          <LogoEmblem
            size={collapsed ? 28 : 42}
            color={theme === 'dark' ? '#c0b49a' : '#010101'}
            className={`transition-all duration-300 shrink-0 ${
              activeSection === 'HOME' ? 'scale-110 opacity-100' : 'opacity-75 group-hover:opacity-100 group-hover:scale-105'
            }`}
          />
          {!collapsed && (
            <span
              className="text-[17px] text-tea-text tracking-[0.08em] transition-all duration-300 group-hover:text-tea-text"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 200, letterSpacing: '0.1em' }}
            >
              Teajia
            </span>
          )}
          {activeSection === 'HOME' && (
            <motion.div
              layoutId="sidebar-active-indicator"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-tea-gold rounded-r-full"
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            />
          )}
        </button>

        {/* ── Account Identity ── */}
        <button
          onClick={onAccountClick}
          className={`w-full flex items-center ${collapsed ? 'justify-center px-2 min-h-[52px]' : 'gap-3 px-5'} py-3.5 transition-all duration-200 group ${
            activeSection === 'ACCOUNT' ? 'bg-tea-gold/8' : 'hover:bg-tea-gold/5'
          }`}
          style={{ boxShadow: '0 1px 0 var(--tea-accent-sub)' }}
          title="Account"
        >
          <Icons.User
            className={`transition-all duration-300 shrink-0 ${
              activeSection === 'ACCOUNT' ? 'text-tea-gold w-5 h-5 scale-110' : 'text-tea-text-sec w-5 h-5 group-hover:text-tea-text group-hover:scale-105'
            }`}
            strokeWidth={2}
          />
          {!collapsed && (
            <div className="min-w-0 flex-1 text-left">
              <span
                className={`text-sm block leading-tight transition-all duration-300 ${
                  activeSection === 'ACCOUNT' ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
                }`}
                style={{ fontFamily: 'var(--font-display)', fontWeight: 300, letterSpacing: '0.03em' }}
              >
                {userName ?? 'Sign in'}
              </span>
              {locationLine && (
                <span className="text-[10px] text-tea-text-sec/50 leading-none block mt-0.5 tracking-[0.05em]">
                  ◉ {locationLine}
                </span>
              )}
              {!auth.isAuthenticated && (
                <span className="text-[10px] text-tea-text-sec/40 leading-none block mt-0.5 tracking-[0.05em]">
                  journal · collection · compass
                </span>
              )}
            </div>
          )}
          {activeSection === 'ACCOUNT' && (
            <motion.div
              layoutId="sidebar-active-indicator"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-tea-gold rounded-r-full"
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            />
          )}
        </button>

        {/* ── Search ── */}
        <div className={`${collapsed ? 'px-1.5 pt-3 pb-1' : 'px-3 pt-3 pb-1'}`}>
          <button
            onClick={onSearchClick}
            className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-2 rounded-md transition-all duration-200 group hover:bg-tea-gold/5 border border-tea-border`}
            title="Search (⌘K)"
          >
            <Icons.Search className="w-4 h-4 text-tea-text-sec group-hover:text-tea-text transition-colors shrink-0" strokeWidth={2} />
            {!collapsed && (
              <>
                <span
                  className="text-sm text-tea-text-sec group-hover:text-tea-text transition-colors"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
                >
                  Search...
                </span>
                <kbd className="ml-auto text-[10px] text-tea-text-sec border border-tea-border rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
              </>
            )}
          </button>
        </div>

        {/* ── Browse Nav ── */}
        <nav className={`flex flex-col py-4 gap-0.5 ${collapsed ? 'px-1.5' : 'px-3'}`}>
          {browseItems.map((item, index) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeSection === item.section}
              onClick={() => item.section && onNavigate(item.section)}
              animationDelay={index * 50}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* ── Admin Nav ── */}
        {auth.isAuthenticated && auth.isAdmin && (
          <nav
            className={`flex flex-col gap-0.5 ${collapsed ? 'px-1.5' : 'px-3'} pt-3 pb-4`}
            style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub)' }}
          >
            {adminItems.map((item, index) => {
              const isParentActive = currentPath === item.path && !isChildActive(item.children);
              return (
                <div key={item.id}>
                  <NavButton
                    item={item}
                    isActive={isParentActive}
                    onClick={() => {}}
                    animationDelay={(browseItems.length + index) * 50}
                    collapsed={collapsed}
                  />
                  {!collapsed && item.children && item.children.length > 0 && (
                    <div className="ml-3 flex flex-col gap-0 mt-0.5 mb-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.id}
                          to={child.path}
                          className={`relative flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors duration-150 group ${
                            currentPath === child.path
                              ? 'text-tea-gold bg-tea-gold/8'
                              : 'text-tea-text-sec/60 hover:text-tea-text hover:bg-tea-gold/5'
                          }`}
                        >
                          {currentPath === child.path && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3.5 bg-tea-gold rounded-r-full" />
                          )}
                          <div className={`shrink-0 transition-colors duration-150 ${currentPath === child.path ? 'text-tea-gold' : 'text-tea-text-sec/50 group-hover:text-tea-text-sec'}`}>
                            {child.icon}
                          </div>
                          <span
                            className="text-[11px] tracking-[0.02em]"
                            style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
                          >
                            {child.label}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        )}

        <div className="flex-1" />

        {/* ── Utility: Cart + Collapse ── */}
        <div
          className={`py-3 ${collapsed ? 'px-1.5' : 'px-3'}`}
          style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub)' }}
        >
          {/* Cart */}
          <button
            onClick={onCartClick}
            className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-2.5 rounded-md transition-all duration-200 group hover:bg-tea-gold/5`}
            title="Cart"
            aria-label={cartItemCount > 0 ? `Cart, ${cartItemCount} item${cartItemCount !== 1 ? 's' : ''}` : 'Cart'}
          >
            <div className="relative shrink-0">
              <Icons.Bag className="transition-all duration-300 text-tea-text-sec w-5 h-5 group-hover:text-tea-text group-hover:scale-105" strokeWidth={2} />
              {cartItemCount > 0 && (
                <div
                  className={`absolute -top-2 -right-3 w-4 h-4 bg-tea-gold text-white text-[9px] font-bold rounded-full flex items-center justify-center ${badgeAnimating ? 'cart-badge-pulse' : ''}`}
                  aria-hidden="true"
                >
                  {cartItemCount > 9 ? '9+' : cartItemCount}
                </div>
              )}
            </div>
            {!collapsed && (
              <span
                className="text-sm text-tea-text-sec group-hover:text-tea-text transition-all duration-300"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 300, letterSpacing: '0.03em' }}
              >
                Cart
              </span>
            )}
          </button>

          {/* Collapse toggle — icon only, no label */}
          <button
            onClick={toggleSidebarCollapsed}
            className={`w-full flex items-center cursor-pointer ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-2.5 rounded-md transition-all duration-200 group hover:bg-tea-gold/5 mt-0.5`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronsRight className="w-4 h-4 text-tea-text-sec group-hover:text-tea-text transition-colors shrink-0" strokeWidth={1.75} />
            ) : (
              <ChevronsLeft className="w-4 h-4 text-tea-text-sec group-hover:text-tea-text transition-colors shrink-0" strokeWidth={1.75} />
            )}
          </button>
        </div>

      </div>
    </aside>
    </LayoutGroup>
  );
};
