import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, LayoutGroup } from 'framer-motion';
import { Icons } from './Icons';
import { LogoEmblem } from './Logos';
import { Section } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useAppStore } from '../lib/store';
import { Settings, Calendar, LayoutDashboard, Briefcase, ChevronsLeft, ChevronsRight, ChevronDown, Leaf, Coffee, Sparkles, Store, Users, FolderOpen, UserCheck } from 'lucide-react';


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
        isActive
          ? 'text-tea-gold scale-110'
          : 'text-tea-text-sec group-hover:text-tea-text group-hover:scale-110'
      }`}>
        {item.icon}
      </div>
      {!collapsed && (
        <span className={`text-sm font-semibold transition-all duration-300 ${
          isActive ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
        }`}>
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
          className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-tea-gold rounded-l-full"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
      )}
    </>
  );

  const className = `relative flex items-center ${collapsed ? 'justify-center px-2 min-h-[44px]' : 'gap-3 px-4'} py-3 rounded-md transition-all duration-300 group animate-[fadeIn_0.5s_ease-out] ${
    isActive ? 'bg-tea-gold/8' : 'hover:bg-tea-elevated/50'
  }`;

  if (item.action) {
    return (
      <button
        onClick={item.action}
        className={`w-full ${className}`}
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {content}
      </button>
    );
  }

  if (item.path) {
    return (
      <Link
        to={item.path}
        onClick={onClick}
        className={className}
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full ${className}`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
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
  topOffset = false
}) => {
  const { theme, toggleTheme } = useTheme();
  const auth = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const { sidebarCollapsed: collapsed, toggleSidebarCollapsed } = useAppStore();

  // Cart badge pulse animation
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
    { id: 'MAGAZINE', label: 'Read', icon: <Icons.Magazine className="w-5 h-5" strokeWidth={2} />, section: 'MAGAZINE' as Section },
    { id: 'LEARN', label: 'Learn', icon: <Icons.School className="w-5 h-5" strokeWidth={2} />, section: 'LEARN' as Section },
    { id: 'OFFERINGS', label: 'Consult', icon: <Icons.Sparkles className="w-5 h-5" strokeWidth={2} />, section: 'OFFERINGS' as Section },
    { id: 'SHOP', label: 'Shop', icon: <Icons.Bag className="w-5 h-5" strokeWidth={2} />, section: 'SHOP' as Section },
  ];

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (id: string) => setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  const isChildActive = (children?: SubNavItem[]) => children?.some(c => currentPath === c.path) ?? false;

  const adminItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} strokeWidth={2} />, path: '/admin/dashboard' },
    { id: 'inventory', label: 'Inventory', icon: <Settings size={20} strokeWidth={2} />, path: '/admin/inventory', children: [
      { id: 'catalog', path: '/admin/catalog', label: 'Tea Glossary', icon: <Leaf className="w-4 h-4" strokeWidth={2} /> },
      { id: 'teaware', path: '/admin/teaware', label: 'Equipment', icon: <Coffee className="w-4 h-4" strokeWidth={2} /> },
      { id: 'sources', path: '/admin/sources', label: 'Sources', icon: <Store className="w-4 h-4" strokeWidth={2} /> },
      { id: 'personal', path: '/admin/personal', label: 'Collection', icon: <UserCheck className="w-4 h-4" strokeWidth={2} /> },
    ]},
    { id: 'business', label: 'Business', icon: <Briefcase size={20} strokeWidth={2} />, path: '/admin/orders', children: [
      { id: 'customers', path: '/admin/customers', label: 'Customers', icon: <Users className="w-4 h-4" strokeWidth={2} /> },
      { id: 'records', path: '/admin/records', label: 'Records & Logs', icon: <FolderOpen className="w-4 h-4" strokeWidth={2} /> },
      { id: 'settings', path: '/admin/settings', label: 'Settings', icon: <Settings className="w-4 h-4" strokeWidth={2} /> },
    ]},
    { id: 'events', label: 'Events', icon: <Calendar size={20} strokeWidth={2} />, path: '/admin/events' },
  ];

  return (
    <LayoutGroup>
    <aside
      className={`hidden lg:flex flex-col ${collapsed ? 'w-14' : 'w-56'} text-tea-text fixed left-0 overflow-y-auto hide-scrollbar transition-all duration-300 z-sticky top-0 h-screen select-none`}
      style={{
        background: 'linear-gradient(180deg, var(--tea-surface) 0%, rgb(var(--tea-bg-rgb) / 0.95) 100%)',
        boxShadow: 'inset -1px 0 0 var(--tea-accent-sub), 1px 0 8px rgb(var(--tea-bg-rgb) / 0.15)'
      }}
    >
      {/* Logo/Brand - Home Button */}
      <button
        onClick={() => { onNavigate('HOME'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        className={`h-20 flex items-center ${collapsed ? 'justify-center px-2' : 'justify-start px-6 gap-3'} animate-[fadeIn_0.5s_ease-out] transition-all duration-300 group ${
          activeSection === 'HOME' ? 'bg-tea-gold/8' : 'hover:bg-tea-elevated/50'
        }`}
        title="Home"
        style={{ boxShadow: '0 1px 0 var(--tea-border)' }}
      >
        <LogoEmblem
          size={collapsed ? 28 : 36}
          color={theme === 'dark' ? '#c0b49a' : '#010101'}
          className={`transition-all duration-300 shrink-0 ${
            activeSection === 'HOME'
              ? 'scale-110 opacity-100'
              : 'opacity-80 group-hover:opacity-100 group-hover:scale-105'
          }`}
        />
        {!collapsed && <span className="text-lg text-tea-text tracking-wide" style={{ fontFamily: "var(--font-display)", fontWeight: 300 }}>Teajia</span>}
        {activeSection === 'HOME' && (
          <motion.div
            layoutId="sidebar-active-indicator"
            className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-tea-gold rounded-l-full"
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          />
        )}
      </button>

      {/* Search Button */}
      <div className={collapsed ? 'px-1.5 pt-4 pb-1' : 'px-3 pt-4 pb-1'}>
        <button
          onClick={onSearchClick}
          className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-2.5 rounded-md transition-all duration-300 group hover:bg-tea-elevated/50 border border-tea-border`}
          title="Search (Ctrl+K)"
        >
          <Icons.Search className="w-4 h-4 text-tea-text-sec group-hover:text-tea-text transition-colors duration-300 shrink-0" strokeWidth={2} />
          {!collapsed && <span className="text-sm text-tea-text-sec group-hover:text-tea-text transition-colors duration-300">Search...</span>}
          {!collapsed && <kbd className="ml-auto text-[10px] text-tea-text-sec border border-tea-border rounded px-1.5 py-0.5 font-mono">⌘K</kbd>}
        </button>
      </div>

      {/* Browse Navigation */}
      <nav className={`flex flex-col py-6 gap-1 ${collapsed ? 'px-1.5' : 'px-3'}`}>
        {!collapsed && <span className="text-[10px] uppercase tracking-[0.2em] text-tea-gold/70 font-sans font-semibold px-4 py-2">Browse</span>}
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

      {/* Admin Navigation — visible only for admin users */}
      {auth.isAuthenticated && auth.isAdmin && (
        <nav className={`flex flex-col gap-1 ${collapsed ? 'px-1.5' : 'px-3'} pt-2 pb-4`} style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub)' }}>
          {!collapsed && <span className="text-[10px] uppercase tracking-[0.2em] text-tea-gold/70 font-sans font-semibold px-4 py-2">Admin</span>}
          {adminItems.map((item, index) => {
            const hasChildren = !collapsed && item.children && item.children.length > 0;
            const isExpanded = expandedGroups[item.id] || isChildActive(item.children);
            return (
              <div key={item.id}>
                <div className="flex items-center">
                  <div className="flex-1">
                    <NavButton
                      item={item}
                      isActive={currentPath === item.path}
                      onClick={() => {}}
                      animationDelay={(browseItems.length + index) * 50}
                      collapsed={collapsed}
                    />
                  </div>
                  {hasChildren && (
                    <button
                      onClick={() => toggleGroup(item.id)}
                      className="p-2 text-tea-text-sec hover:text-tea-text transition-colors"
                      aria-label={isExpanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} strokeWidth={2} />
                    </button>
                  )}
                </div>
                {hasChildren && isExpanded && (
                  <div className="ml-4 flex flex-col gap-0.5 mt-0.5">
                    {item.children!.map((child) => (
                      <Link
                        key={child.id}
                        to={child.path}
                        className={`flex items-center gap-2.5 px-4 py-2 rounded-md text-xs font-medium transition-colors duration-200 group ${
                          currentPath === child.path
                            ? 'text-tea-gold bg-tea-gold/8'
                            : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated/50'
                        }`}
                      >
                        <div className={`shrink-0 transition-colors duration-200 ${currentPath === child.path ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'}`}>
                          {child.icon}
                        </div>
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      )}

      {/* Flexible spacing */}
      <div className="flex-1" />

      {/* Utility Area */}
      <div className={`relative py-4 ${collapsed ? 'px-1.5' : 'px-3'}`} style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub)' }}>
        {!collapsed && <div className="absolute top-0 left-6 w-6 h-[2px] bg-tea-gold/20"></div>}

        <button
          onClick={onCartClick}
          className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-md transition-all duration-300 group hover:bg-tea-elevated/50`}
          title="Cart"
          aria-label={cartItemCount > 0 ? `Cart, ${cartItemCount} item${cartItemCount !== 1 ? 's' : ''}` : 'Cart'}
        >
          <div className="relative shrink-0">
            <Icons.Bag
              className="transition-all duration-300 text-tea-text-sec w-5 h-5 group-hover:text-tea-text group-hover:scale-105"
              strokeWidth={2}
            />
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
            <span className="text-sm font-semibold transition-all duration-300 text-tea-text-sec group-hover:text-tea-text">
              Cart
            </span>
          )}
        </button>

        <button
          onClick={onAccountClick}
          className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-md transition-all duration-300 group hover:bg-tea-elevated/50`}
          title="Account"
        >
          <Icons.User
            className={`transition-all duration-300 shrink-0 ${
              activeSection === 'ACCOUNT'
                ? 'text-tea-gold w-5 h-5 scale-110'
                : 'text-tea-text-sec w-5 h-5 group-hover:text-tea-text group-hover:scale-105'
            }`}
            strokeWidth={2}
          />
          {!collapsed && (
            <span className={`text-sm font-semibold transition-all duration-300 ${
              activeSection === 'ACCOUNT' ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
            }`}>
              Account
            </span>
          )}
        </button>


        {/* Collapse/Expand toggle */}
        <button
          onClick={toggleSidebarCollapsed}
          className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-md transition-all duration-300 group hover:bg-tea-elevated/50 mt-1`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronsRight className="w-4 h-4 text-tea-text-sec group-hover:text-tea-text transition-colors shrink-0" strokeWidth={2} />
          ) : (
            <ChevronsLeft className="w-4 h-4 text-tea-text-sec group-hover:text-tea-text transition-colors shrink-0" strokeWidth={2} />
          )}
          {!collapsed && (
            <span className="text-sm font-semibold transition-all duration-300 text-tea-text-sec group-hover:text-tea-text">
              Collapse
            </span>
          )}
        </button>
      </div>
    </aside>
    </LayoutGroup>
  );
};
