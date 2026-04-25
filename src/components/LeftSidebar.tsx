import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';
import { LogoEmblem } from './Logos';
import { Section } from '../types';
import { useTheme } from '../context/ThemeContext';
import { PREVIEW_MODE } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { useAppStore } from '../lib/store';
import {
  Calendar, LayoutDashboard, Briefcase, Leaf, Coffee, Store, Users,
  FolderOpen, Settings, ChevronLeft, ChevronRight, UserCheck, MapPin,
  BookOpen, Package, ShoppingCart, Sun, Moon,
} from 'lucide-react';
import { SampleIcon } from './Icons';
import { useSampleCartStore } from '../samples/sampleCartStore';

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

// ── NavButton ──────────────────────────────────────────────────────────────
// Mount-only fade (motion.div initial/animate fires once, not on re-renders).
// Active indicator uses shared layoutId="nav-indicator" — separate from the
// logo and account indicators so the bar never jumps between different heights.
const NavButton: React.FC<{
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  delay?: number;
  collapsed?: boolean;
}> = ({ item, isActive, onClick, delay = 0, collapsed = false }) => {
  // Icons only appear when collapsed; expanded sidebar is text-only.
  const iconEl = collapsed && (
    <div className={`shrink-0 transition-colors duration-200 ${
      isActive ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
    }`}>
      {item.icon}
    </div>
  );

  const labelEl = !collapsed && (
    <span
      className={`text-sm flex-1 transition-colors duration-200 ${
        isActive ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
      }`}
      style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '0.03em' }}
    >
      {item.label}
    </span>
  );

  const badgeEl = item.badge !== undefined && item.badge > 0 && (
    collapsed ? (
      <span className="absolute -top-1 -right-1 w-4 h-4 bg-tea-gold text-tea-bg text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
        {item.badge > 9 ? '9+' : item.badge}
      </span>
    ) : (
      <span className="ml-auto w-5 h-5 bg-tea-gold text-tea-bg text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 leading-none">
        {item.badge > 9 ? '9+' : item.badge}
      </span>
    )
  );

  const indicatorEl = isActive && (
    <motion.div
      layoutId="nav-indicator"
      className="absolute left-0 inset-y-0 w-[2px] bg-tea-gold"
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
    />
  );

  const baseClass = `relative flex items-center min-h-[44px] ${
    collapsed ? 'justify-center px-2' : 'gap-3 px-4'
  } rounded-md transition-colors duration-200 group ${
    isActive ? '' : 'hover:bg-tea-gold/6'
  }`;

  const inner = (
    <>
      {iconEl}
      {labelEl}
      {badgeEl}
      {indicatorEl}
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay / 1000, duration: 0.25, ease: 'easeOut' }}
    >
      {item.action ? (
        <button onClick={item.action} className={`w-full ${baseClass}`}>{inner}</button>
      ) : item.path ? (
        <Link to={item.path} onClick={onClick} className={baseClass}>{inner}</Link>
      ) : (
        <button onClick={onClick} className={`w-full ${baseClass}`}>{inner}</button>
      )}
    </motion.div>
  );
};

// ── LeftSidebar ────────────────────────────────────────────────────────────

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
  const { theme, toggleTheme } = useTheme();
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const isAdminRoute = currentPath.startsWith('/admin');
  const { sidebarCollapsed: collapsed, toggleSidebarCollapsed, activeAccount } = useAppStore();
  const sampleCount = useSampleCartStore(s => s.items.length);

  // Sync sidebar width to CSS variable for full-screen panel offsets
  useEffect(() => {
    document.documentElement.style.setProperty('--teajia-sidebar-w', collapsed ? '3.5rem' : '14rem');
  }, [collapsed]);

  // Cart badge pulse on item count increase
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

  // ── Nav data ──────────────────────────────────────────────────────────────

  const browseItems: NavItem[] = [
    { id: 'MAGAZINE',  label: 'Read',    icon: <Icons.Magazine  className="w-[18px] h-[18px]" strokeWidth={1.75} />, section: 'MAGAZINE'  as Section },
    { id: 'LEARN',     label: 'Learn',   icon: <Icons.School    className="w-[18px] h-[18px]" strokeWidth={1.75} />, section: 'LEARN'     as Section },
    { id: 'OFFERINGS', label: 'Advise',  icon: <Icons.Sparkles  className="w-[18px] h-[18px]" strokeWidth={1.75} />, section: 'OFFERINGS' as Section },
    { id: 'SHOP',      label: 'Shop',    icon: <Icons.Bag       className="w-[18px] h-[18px]" strokeWidth={1.75} />, section: 'SHOP'      as Section },
  ];

  const adminItems: NavItem[] = [
    {
      id: 'dashboard', label: 'Dashboard',
      icon: <LayoutDashboard size={18} strokeWidth={1.75} />,
      path: '/admin/dashboard',
    },
    {
      id: 'inventory', label: 'Inventory',
      icon: <Package size={18} strokeWidth={1.75} />,
      path: '/admin/inventory',
      children: [
        { id: 'catalog',  path: '/admin/catalog',  label: 'Tea Glossary', icon: <Leaf      className="w-3.5 h-3.5" strokeWidth={1.75} /> },
        { id: 'teaware',  path: '/admin/teaware',  label: 'Equipment',    icon: <Coffee    className="w-3.5 h-3.5" strokeWidth={1.75} /> },
        { id: 'sources',  path: '/admin/sources',  label: 'Sources',      icon: <Store     className="w-3.5 h-3.5" strokeWidth={1.75} /> },
        { id: 'personal', path: '/admin/personal', label: 'Collection',   icon: <UserCheck className="w-3.5 h-3.5" strokeWidth={1.75} /> },
      ],
    },
    {
      id: 'business', label: 'Business',
      icon: <Briefcase size={18} strokeWidth={1.75} />,
      path: '/admin/orders',
      children: [
        { id: 'customers', path: '/admin/customers', label: 'Customers',      icon: <Users      className="w-3.5 h-3.5" strokeWidth={1.75} /> },
        { id: 'records',   path: '/admin/records',   label: 'Records & Logs', icon: <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.75} /> },
        { id: 'settings',  path: '/admin/settings',  label: 'Settings',       icon: <Settings   className="w-3.5 h-3.5" strokeWidth={1.75} /> },
      ],
    },
    {
      id: 'events', label: 'Events',
      icon: <Calendar size={18} strokeWidth={1.75} />,
      path: '/admin/events',
    },
    {
      id: 'magazine', label: 'Magazine',
      icon: <BookOpen size={18} strokeWidth={1.75} />,
      path: '/admin/magazine',
    },
  ];

  // Admin sub-items auto-reveal when the parent or one of its children is active.
  // No accordion state — avoids the hidden-active-item bug where a user-collapsed
  // section would hide the highlighted child after internal navigation.

  const userName = auth.isAuthenticated
    ? (auth.user?.name || auth.user?.email?.split('@')[0] || 'Signed in')
    : null;
  const locationLine = activeAccount?.location_city || activeAccount?.location_country || null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <LayoutGroup>
      <aside
        className={`hidden lg:flex flex-col ${collapsed ? 'w-14' : 'w-56'} text-tea-text fixed left-0 overflow-y-auto hide-scrollbar border-r border-tea-border transition-all duration-300 z-sticky top-0 h-screen select-none`}
        style={{
          background: 'linear-gradient(180deg, var(--tea-surface) 0%, rgb(var(--tea-bg-rgb) / 0.96) 100%)',
          boxShadow: '2px 0 16px rgb(var(--tea-bg-rgb) / 0.18)',
        }}
      >
        {/* Grain texture — visible but subtle */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{ opacity: 0.055, backgroundImage: GRAIN, backgroundSize: '120px' }}
        />

        <div className="relative z-10 flex flex-col flex-1 min-h-0">

          {/* ── Logo zone: Brand + Collapse toggle (expanded only) ──────────── */}
          <div
            className={`flex items-center shrink-0 h-14 border-b border-tea-border ${collapsed ? 'justify-center' : ''}`}
          >
            {/* Brand button — navigates home */}
            <button
              onClick={() => { if (isAdminRoute) { navigate('/'); } else { onNavigate('HOME'); window.scrollTo({ top: 0, behavior: 'smooth' }); } }}
              className={`relative flex items-center ${collapsed ? 'justify-center w-full h-full' : 'gap-3 px-5 h-full flex-1 min-w-0'} transition-colors duration-200 group ${
                activeSection === 'HOME' && !isAdminRoute ? '' : 'hover:bg-tea-gold/6'
              }`}
              title="Home"
            >
              {activeSection === 'HOME' && !isAdminRoute && (
                <motion.div
                  layoutId="logo-indicator"
                  className="absolute left-0 inset-y-0 w-[2px] bg-tea-gold"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <LogoEmblem
                size={collapsed ? 26 : 34}
                color={theme === 'dark' ? '#c0b49a' : '#18130e'}
                className={`shrink-0 transition-opacity duration-200 ${
                  activeSection === 'HOME' && !isAdminRoute ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
                }`}
              />
              {!collapsed && (
                <span
                  className="text-[16px] text-tea-text tracking-[0.1em] transition-colors duration-200"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
                >
                  Teajia
                </span>
              )}
            </button>

            {/* Collapse trigger — expanded mode only; in collapsed mode the
                expand toggle sits directly below the logo (next block) so the
                control lives in the same top zone regardless of state. */}
            {!collapsed && (
              <button
                onClick={toggleSidebarCollapsed}
                className="shrink-0 px-3 h-full flex items-center text-tea-text-sec hover:text-tea-text transition-colors duration-200"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft size={14} strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Expand toggle — collapsed mode only, directly under the logo.
              Keeps the collapse/expand control co-located in the header zone. */}
          {collapsed && (
            <button
              onClick={toggleSidebarCollapsed}
              className="w-full h-8 flex items-center justify-center border-b border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-gold/6 transition-colors duration-200"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight size={14} strokeWidth={2} />
            </button>
          )}

          {/* ── Account Identity ──────────────────────────────────────────── */}
          <button
            onClick={onAccountClick}
            className={`relative w-full flex items-center min-h-[48px] ${
              collapsed ? 'justify-center px-2' : 'gap-3 px-5'
            } py-3 border-b border-tea-border transition-colors duration-200 group ${
              activeSection === 'YOUR_TABLE' ? '' : 'hover:bg-tea-gold/6'
            }`}
            title="Your Table"
          >
            {activeSection === 'YOUR_TABLE' && (
              <motion.div
                layoutId="account-indicator"
                className="absolute left-0 inset-y-0 w-[2px] bg-tea-gold"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            {collapsed && (
              <Icons.User
                className={`shrink-0 w-[18px] h-[18px] transition-colors duration-200 ${
                  activeSection === 'YOUR_TABLE' ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
                }`}
                strokeWidth={1.75}
              />
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1 text-left">
                <span
                  className={`text-sm block leading-tight transition-colors duration-200 ${
                    activeSection === 'YOUR_TABLE' ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
                  }`}
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '0.03em' }}
                >
                  Your Table
                </span>
                <span className="text-[11px] text-tea-text-sec leading-none block mt-0.5 tracking-[0.04em]">
                  {userName ?? 'Sign in'}
                </span>
                {locationLine && (
                  <span className="text-[11px] text-tea-text-sec leading-none block mt-0.5 tracking-[0.04em]">
                    ◉ {locationLine}
                  </span>
                )}
                {!auth.isAuthenticated && (
                  <span
                    className="text-[11px] text-tea-text-sec leading-none block mt-0.5 tracking-[0.04em] italic"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    your practice, kept
                  </span>
                )}
              </div>
            )}
          </button>

          {/* ── Search ────────────────────────────────────────────────────── */}
          <div className={`${collapsed ? 'px-1.5 py-2' : 'px-3 py-2'} border-b border-tea-border`}>
            <button
              onClick={onSearchClick}
              className={`w-full flex items-center ${
                collapsed ? 'justify-center px-2 min-h-[40px]' : 'gap-3 px-3 min-h-[36px]'
              } rounded-md transition-colors duration-200 group hover:bg-tea-gold/6`}
              title="Search (⌘K)"
            >
              <Icons.Search className="w-4 h-4 text-tea-text-sec group-hover:text-tea-text transition-colors shrink-0" strokeWidth={1.75} />
              {!collapsed && (
                <>
                  <span
                    className="text-[13px] text-tea-text-sec group-hover:text-tea-text transition-colors flex-1 text-left"
                    style={{ fontFamily: 'var(--font-sans)', fontWeight: 400 }}
                  >
                    Search
                  </span>
                  <kbd className="text-[10px] text-tea-text-sec/70 border border-tea-border rounded px-1.5 py-0.5 font-mono shrink-0">
                    ⌘K
                  </kbd>
                </>
              )}
            </button>
          </div>

          {/* ── Browse Nav ────────────────────────────────────────────────── */}
          <nav className={`flex flex-col py-3 gap-1 ${collapsed ? 'px-1.5' : 'px-3'}`}>
            {browseItems.map((item, index) => (
              <NavButton
                key={item.id}
                item={item}
                isActive={!isAdminRoute && activeSection === item.section}
                onClick={() => {
                  if (!item.section) return;
                  if (!isAdminRoute && item.section === activeSection) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                  }
                  onNavigate(item.section);
                }}
                delay={index * 40}
                collapsed={collapsed}
              />
            ))}

            {/* Cart — lives adjacent to Shop, separated by a thin rule */}
            <div className="mt-1 pt-1 border-t border-tea-border">
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: (browseItems.length * 40) / 1000, duration: 0.25, ease: 'easeOut' }}
              >
                <button
                  onClick={onCartClick}
                  className={`relative w-full flex items-center min-h-[44px] ${
                    collapsed ? 'justify-center px-2' : 'gap-3 px-4'
                  } rounded-md transition-colors duration-200 group hover:bg-tea-gold/6`}
                  title="Cart"
                  aria-label={
                    cartItemCount > 0 ? `Cart, ${cartItemCount} item${cartItemCount !== 1 ? 's' : ''}` : 'Cart'
                  }
                >
                  {collapsed ? (
                    <div className="relative shrink-0">
                      <ShoppingCart
                        className="w-[18px] h-[18px] text-tea-text-sec group-hover:text-tea-text transition-colors duration-200"
                        strokeWidth={1.75}
                      />
                      {cartItemCount > 0 && (
                        <div
                          className={`absolute -top-2 -right-2.5 w-4 h-4 bg-tea-gold text-tea-bg text-[10px] font-bold rounded-full flex items-center justify-center leading-none ${
                            badgeAnimating ? 'cart-badge-pulse' : ''
                          }`}
                          aria-hidden="true"
                        >
                          {cartItemCount > 9 ? '9+' : cartItemCount}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <span
                        className="text-sm text-tea-text-sec group-hover:text-tea-text transition-colors duration-200"
                        style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '0.03em' }}
                      >
                        Cart
                      </span>
                      {cartItemCount > 0 && (
                        <span
                          className={`ml-auto w-5 h-5 bg-tea-gold text-tea-bg text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 leading-none ${
                            badgeAnimating ? 'cart-badge-pulse' : ''
                          }`}
                          aria-hidden="true"
                        >
                          {cartItemCount > 9 ? '9+' : cartItemCount}
                        </span>
                      )}
                      {sampleCount > 0 && (
                        <span className={`${cartItemCount > 0 ? 'ml-2' : 'ml-auto'} flex items-center gap-1 text-[10px] text-tea-gold/70`}>
                          <SampleIcon className="w-[10px] h-[10px]" />
                          {sampleCount}
                        </span>
                      )}
                    </>
                  )}
                </button>
              </motion.div>
            </div>
          </nav>

          {/* ── Admin Nav ─────────────────────────────────────────────────── */}
          <AnimatePresence>
            {auth.isAuthenticated && auth.isAdmin && (
              <motion.nav
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex flex-col gap-1 ${collapsed ? 'px-1.5' : 'px-3'} pt-2 pb-3 border-t border-tea-border`}
              >
                {/* Back to storefront — only when on an admin route */}
                {isAdminRoute && !collapsed && (
                  <Link
                    to="/"
                    className="flex items-center gap-1.5 px-4 py-1.5 mb-0.5 rounded-md text-tea-text-sec hover:text-tea-text transition-colors duration-200 group"
                  >
                    <ChevronLeft size={11} strokeWidth={2} />
                    <span
                      className="text-[11px] tracking-[0.04em]"
                      style={{ fontFamily: 'var(--font-sans)', fontWeight: 400 }}
                    >
                      Storefront
                    </span>
                  </Link>
                )}

                {adminItems.map((item, index) => {
                  const hasChildren = (item.children?.length ?? 0) > 0;
                  const isAnyChildActive = item.children?.some(c => currentPath === c.path) ?? false;
                  const isParentExact = currentPath === item.path;
                  const showActive = isParentExact && !isAnyChildActive;
                  const showChildren = !collapsed && hasChildren && (isParentExact || isAnyChildActive);

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 40 / 1000, duration: 0.25, ease: 'easeOut' }}
                    >
                      {/* Parent row — single click target. Children auto-reveal
                          when parent or one of its children is active. */}
                      <Link
                        to={item.path!}
                        className={`relative flex items-center min-h-[44px] ${
                          collapsed ? 'justify-center px-2' : 'gap-3 px-4'
                        } rounded-md transition-colors duration-200 group ${
                          (showActive || isAnyChildActive) ? '' : 'hover:bg-tea-gold/6'
                        }`}
                        title={item.label}
                      >
                        {(showActive || isAnyChildActive) && (
                          <motion.div
                            layoutId="nav-indicator"
                            className="absolute left-0 inset-y-0 w-[2px] bg-tea-gold"
                            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                          />
                        )}
                        {collapsed && (
                          <div className={`shrink-0 transition-colors duration-200 ${
                            (showActive || isAnyChildActive) ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
                          }`}>
                            {item.icon}
                          </div>
                        )}
                        {!collapsed && (
                          <span
                            className={`text-sm flex-1 transition-colors duration-200 ${
                              (showActive || isAnyChildActive) ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
                            }`}
                            style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '0.03em' }}
                          >
                            {item.label}
                          </span>
                        )}
                      </Link>

                      {/* Children — reveal reactively when parent context is active */}
                      <AnimatePresence initial={false}>
                        {showChildren && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="ml-3.5 flex flex-col mt-0.5 mb-1 border-l border-tea-border pl-2.5">
                              {item.children!.map(child => (
                                <Link
                                  key={child.id}
                                  to={child.path}
                                  className={`relative flex items-center px-2 py-1.5 rounded-md transition-colors duration-150 min-h-[34px] group ${
                                    currentPath === child.path
                                      ? 'text-tea-gold bg-tea-gold/8'
                                      : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-gold/5'
                                  }`}
                                >
                                  {currentPath === child.path && (
                                    <div className="absolute -left-2.5 inset-y-0 w-[2px] bg-tea-gold/60" />
                                  )}
                                  <span
                                    className="text-[12px]"
                                    style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '0.03em' }}
                                  >
                                    {child.label}
                                  </span>
                                </Link>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.nav>
            )}
          </AnimatePresence>

          <div className="flex-1" />

          {/* ── Utility footer ────────────────────────────────────────────── */}
          <div
            className={`py-3 ${collapsed ? 'px-1.5' : 'px-3'} border-t border-tea-border shrink-0`}
          >
            {/* Our Spaces + theme toggle */}
            {!PREVIEW_MODE && (
              <div className={`flex items-center ${collapsed ? 'flex-col gap-1' : 'justify-between gap-2'}`}>
                <Link
                  to="/spaces"
                  className={`flex items-center min-h-[44px] ${
                    collapsed ? 'justify-center px-2' : 'flex-1 gap-3 px-4'
                  } rounded-md transition-colors duration-200 group hover:bg-tea-gold/6`}
                  title="Our spaces"
                >
                  {collapsed && (
                    <MapPin
                      className={`w-[18px] h-[18px] shrink-0 transition-colors duration-200 ${
                        currentPath === '/spaces' ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
                      }`}
                      strokeWidth={1.75}
                    />
                  )}
                  {!collapsed && (
                    <span
                      className={`text-sm transition-colors duration-200 ${
                        currentPath === '/spaces' ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
                      }`}
                      style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '0.03em' }}
                    >
                      Our spaces
                    </span>
                  )}
                </Link>
                <button
                  type="button"
                  onClick={(e) => toggleTheme(e)}
                  className={`flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md transition-colors duration-200 text-tea-text-sec hover:text-tea-text hover:bg-tea-gold/6 ${
                    collapsed ? 'px-2' : 'px-3'
                  }`}
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? (
                    <Sun className="w-[18px] h-[18px]" strokeWidth={1.75} />
                  ) : (
                    <Moon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                  )}
                </button>
              </div>
            )}

          </div>

        </div>
      </aside>
    </LayoutGroup>
  );
};
