import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';
import { LogoEmblem } from './Logos';
import { Section } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useAppStore, selectHasBundle, selectIsOwnerTier } from '../lib/store';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
// Phosphor (Light weight), refined hairlines, replaces the generic lucide
// stock icons in the admin nav. Browse keeps its hand-drawn brand icons.
import {
  CalendarBlank, SquaresFour, Briefcase, Leaf, Coffee, Storefront, UsersThree,
  FolderOpen, CaretLeft, CaretRight, UserCheck, MapPin,
  BookOpen, Package, ShoppingCart, Sun, Moon, Stack, Camera, Compass,
  GearSix, Globe,
} from '@phosphor-icons/react';
import { SampleIcon } from './Icons';
import { useSampleCartStore } from '../samples/sampleCartStore';
import { ADMIN_CONNECTION_ROUTES, getVisibleAdminItemIds } from './navigationConnections';

const PHOSPHOR_WEIGHT = 'light' as const;

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
// Active indicator uses shared layoutId="nav-indicator", separate from the
// logo and account indicators so the bar never jumps between different heights.
const NavButton: React.FC<{
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  delay?: number;
  collapsed?: boolean;
}> = ({ item, isActive, onClick, delay = 0, collapsed = false }) => {
  // Icons appear in both modes, muted gold anchor in expanded mode so the
  // eye has a landmark per row without losing the editorial text-first feel.
  const iconEl = (
    <div className={`shrink-0 transition-colors duration-200 ${
      isActive
        ? 'text-tea-gold'
        : collapsed
          ? 'text-tea-text-sec group-hover:text-tea-text'
          : 'text-tea-text-sec group-hover:text-tea-text'
    }`}>
      {item.icon}
    </div>
  );

  const labelEl = !collapsed && (
    <span
      className={`${TYPOGRAPHY_CLASSES.navSidebar} text-left transition-colors duration-200 ${
        isActive ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
      }`}
    >
      {item.label}
    </span>
  );

  const badgeEl = item.badge !== undefined && item.badge > 0 && (
    collapsed ? (
      <span className="absolute -top-1 -right-1 w-4 h-4 cta-solid text-ui-10 font-bold rounded-full flex items-center justify-center leading-none">
        {item.badge > 9 ? '9+' : item.badge}
      </span>
    ) : (
      <span className="ml-auto w-5 h-5 cta-solid text-ui-10 font-bold rounded-full flex items-center justify-center shrink-0 leading-none">
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
  // Bundle gates for the network destinations (Step 2-6 of NETWORK_ROLLOUT_PLAN).
  // Reactive subscriptions so they update when memberships hydrate post-mount.
  const hasCatalog = useAppStore(s => selectHasBundle(s, 'catalog'));
  const hasSell = useAppStore(s => selectHasBundle(s, 'sell'));
  const hasPublish = useAppStore(s => selectHasBundle(s, 'publish'));
  const platformRole = useAppStore(s => s.platformRole);
  const isOwnerTier = useAppStore(selectIsOwnerTier);
  const canCreateCollections = auth.user?.canCreateCollections ?? false;
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
    // Read lands on the unified /read section. `path` overrides the
    // section→view routing exactly like the BottomTabBar "Read" tab; it still
    // highlights as MAGAZINE so the active state matches the tab bar.
    { id: 'MAGAZINE',  label: 'Read',    icon: <Icons.Magazine  className="w-[18px] h-[18px]" strokeWidth={1.75} />, section: 'MAGAZINE'  as Section, path: '/read' },
    { id: 'LEARN',     label: 'Craft',   icon: <Icons.School    className="w-[18px] h-[18px]" strokeWidth={1.75} />, section: 'LEARN'     as Section },
    { id: 'OFFERINGS', label: 'Advise',  icon: <Icons.Sparkles  className="w-[18px] h-[18px]" strokeWidth={1.75} />, section: 'OFFERINGS' as Section },
    { id: 'SHOP',      label: 'Shop',    icon: <Icons.Bag       className="w-[18px] h-[18px]" strokeWidth={1.75} />, section: 'SHOP'      as Section },
  ];

  const adminItems: NavItem[] = [
    {
      id: 'dashboard', label: 'Dashboard',
      icon: <SquaresFour size={18} weight={PHOSPHOR_WEIGHT} />,
      path: '/admin/dashboard',
    },
    {
      id: 'inventory', label: 'Stock',
      icon: <Package size={18} weight={PHOSPHOR_WEIGHT} />,
      path: '/admin/stock',
      children: [
        { id: 'catalog',  path: '/admin/catalog',  label: 'Tea Glossary', icon: <Leaf       size={14} weight={PHOSPHOR_WEIGHT} /> },
        { id: 'teaware',  path: '/admin/teaware',  label: 'Equipment',    icon: <Coffee     size={14} weight={PHOSPHOR_WEIGHT} /> },
        { id: 'sources',  path: '/admin/sources',  label: 'Sources',      icon: <Storefront size={14} weight={PHOSPHOR_WEIGHT} /> },
        { id: 'personal', path: '/admin/personal', label: 'Collection',   icon: <UserCheck  size={14} weight={PHOSPHOR_WEIGHT} /> },
        { id: 'capture',  path: '/admin/capture',  label: 'Quick Capture', icon: <Camera    size={14} weight={PHOSPHOR_WEIGHT} /> },
        { id: 'compass',  path: '/admin/compass',  label: 'Curate',       icon: <Compass    size={14} weight={PHOSPHOR_WEIGHT} /> },
        // Carry from the network catalog into your own store. Gated by the
        // Catalog bundle, admins who can populate their own store. Moved here
        // from the inventory toolbar so it lives next to the stock destinations.
        ...(hasCatalog ? [{ id: 'carry', path: '/admin/network?tab=catalog', label: 'Carry from network', icon: <Globe size={14} weight={PHOSPHOR_WEIGHT} /> }] : []),
      ],
    },
    {
      id: 'collections', label: 'Collections',
      icon: <Stack size={18} weight={PHOSPHOR_WEIGHT} />,
      path: '/admin/collections',
    },
    {
      id: 'business', label: 'Business',
      icon: <Briefcase size={18} weight={PHOSPHOR_WEIGHT} />,
      path: '/admin/activity',
      children: [
        { id: 'activity', path: '/admin/activity', label: 'Activity', icon: <FolderOpen  size={14} weight={PHOSPHOR_WEIGHT} /> },
        { id: 'people',   path: '/admin/people',   label: 'People',   icon: <UsersThree  size={14} weight={PHOSPHOR_WEIGHT} /> },
        ...(isOwnerTier ? [{ id: 'contributors', path: ADMIN_CONNECTION_ROUTES.teaMasters, label: 'Tea Masters', icon: <UserCheck size={14} weight={PHOSPHOR_WEIGHT} /> }] : []),
      ],
    },
    {
      id: 'events', label: 'Events',
      icon: <CalendarBlank size={18} weight={PHOSPHOR_WEIGHT} />,
      path: '/admin/events',
    },
    {
      id: 'magazine', label: 'Magazine',
      icon: <BookOpen size={18} weight={PHOSPHOR_WEIGHT} />,
      path: '/admin/magazine',
    },
    ...(auth.isAdmin || hasPublish ? [{
      id: 'wisdom', label: 'Wisdom',
      icon: <Compass size={18} weight={PHOSPHOR_WEIGHT} />,
      path: ADMIN_CONNECTION_ROUTES.wisdom,
    }] : []),
    // Network, single hub entry. Catalog, suggestions, wholesale, adoptions
    // live inside as tabs. Render only if caller has at least one capability.
    ...(hasCatalog || hasSell || platformRole ? [{
      id: 'network', label: 'Network',
      icon: <Globe size={18} weight={PHOSPHOR_WEIGHT} />,
      path: '/admin/network',
    }] : []),
    {
      id: 'settings', label: 'Settings',
      icon: <GearSix size={18} weight={PHOSPHOR_WEIGHT} />,
      path: '/admin/settings',
    },
  ];
  const visibleAdminItemIds = new Set(getVisibleAdminItemIds(
    auth.isAdmin,
    hasPublish,
    adminItems.map(item => item.id),
  ));
  const visibleAdminItems = adminItems.filter(item => visibleAdminItemIds.has(item.id));

  // Admin sub-items auto-reveal when the parent or one of its children is active.
  // No accordion state, avoids the hidden-active-item bug where a user-collapsed
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
          background: theme === 'dark' ? '#13100a' : 'var(--tea-surface)',
          boxShadow: '2px 0 16px rgb(var(--tea-bg-rgb) / 0.22)',
        }}
      >
        {/* Grain texture, minimal in dark mode (narrow surface, pixel-noise risk) */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{ opacity: 0.025, backgroundImage: GRAIN, backgroundSize: '120px' }}
        />

        <div className="relative z-10 flex flex-col flex-1 min-h-0">

          {/* ── Logo zone: Brand + Collapse toggle (expanded only) ──────────── */}
          <div
            className={`flex items-center shrink-0 h-14 border-b border-tea-border ${collapsed ? 'justify-center' : ''}`}
          >
            {/* Brand button, navigates home */}
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
                  className="text-ui-20 text-tea-text tracking-[0.1em] transition-colors duration-200"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
                >
                  Teajia
                </span>
              )}
            </button>

            {/* Collapse trigger, expanded mode only; in collapsed mode the
                expand toggle sits directly below the logo (next block) so the
                control lives in the same top zone regardless of state. */}
            {!collapsed && (
              <button
                onClick={toggleSidebarCollapsed}
                className="shrink-0 px-3 h-full flex items-center text-tea-text-sec hover:text-tea-text transition-colors duration-200"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <CaretLeft size={14} weight="bold" />
              </button>
            )}
          </div>

          {/* Expand toggle, collapsed mode only, directly under the logo.
              Keeps the collapse/expand control co-located in the header zone. */}
          {collapsed && (
            <button
              onClick={toggleSidebarCollapsed}
              className="w-full h-8 flex items-center justify-center border-b border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-gold/6 transition-colors duration-200"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <CaretRight size={14} weight="bold" />
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
                  className={`${TYPOGRAPHY_CLASSES.navSidebar} block transition-colors duration-200 ${
                    activeSection === 'YOUR_TABLE' ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
                  }`}
                >
                  Your Table
                </span>
                <span className={`${TYPOGRAPHY_CLASSES.accountMeta} text-tea-text-sec block mt-1`}>
                  {userName ?? 'Sign in'}
                </span>
                {locationLine && (
                  <span className={`${TYPOGRAPHY_CLASSES.accountMeta} text-tea-text-sec block mt-0.5`}>
                    ◉ {locationLine}
                  </span>
                )}
                {!auth.isAuthenticated && (
                  <span className="font-display text-ui-13 italic tracking-[0.02em] leading-[1.3] text-tea-text-sec block mt-1">
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
                  <span className={`${TYPOGRAPHY_CLASSES.accountMeta} text-tea-text-sec group-hover:text-tea-text transition-colors flex-1 text-left`}>
                    Search
                  </span>
                  <kbd className="text-ui-11 text-tea-text-sec border border-tea-border rounded px-1.5 py-0.5 font-mono shrink-0">
                    ⌘K
                  </kbd>
                </>
              )}
            </button>
          </div>

          {/* ── Browse Nav ────────────────────────────────────────────────── */}
          {!collapsed && (
            <div className="px-5 pt-4 pb-1.5">
              <span className={`${TYPOGRAPHY_CLASSES.navSidebarGroup} text-tea-text-dim`}>
                Browse
              </span>
            </div>
          )}
          <nav className={`flex flex-col ${collapsed ? 'pt-3 pb-3 px-1.5' : 'pb-3 px-3'} gap-0.5`}>
            {browseItems.map((item, index) => {
              // A path-override item (Read → /read) is active when on that path
              // and navigates there; section items switch the section view.
              const isActive = !isAdminRoute && (
                item.path ? currentPath.startsWith(item.path) : activeSection === item.section
              );
              return (
                <NavButton
                  key={item.id}
                  item={item}
                  isActive={isActive}
                  onClick={() => {
                    if (item.path) {
                      // Only scroll-in-place when already on the index page
                      // itself (e.g. /read). On a sub-path article (/read/...
                      // or /article/...) let the <Link> navigate back to the
                      // index so "Read" returns to the Read homepage.
                      if (currentPath === item.path) {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                      return; // <Link> handles navigation when not already there
                    }
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
              );
            })}

            {/* Cart, lives adjacent to Shop, separated by a thin rule */}
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
                        size={18}
                        weight={PHOSPHOR_WEIGHT}
                        className="text-tea-text-sec group-hover:text-tea-text transition-colors duration-200"
                      />
                      {cartItemCount > 0 && (
                        <div
                          className={`absolute -top-2 -right-2.5 w-4 h-4 cta-solid text-ui-10 font-bold rounded-full flex items-center justify-center leading-none ${
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
                      <ShoppingCart
                        size={18}
                        weight={PHOSPHOR_WEIGHT}
                        className="text-tea-text-sec group-hover:text-tea-text transition-colors duration-200 shrink-0"
                      />
                      <span className={`${TYPOGRAPHY_CLASSES.navSidebar} text-tea-text-sec group-hover:text-tea-text transition-colors duration-200`}>
                        Cart
                      </span>
                      {cartItemCount > 0 && (
                        <span
                          className={`ml-auto w-5 h-5 cta-solid text-ui-10 font-bold rounded-full flex items-center justify-center shrink-0 leading-none ${
                            badgeAnimating ? 'cart-badge-pulse' : ''
                          }`}
                          aria-hidden="true"
                        >
                          {cartItemCount > 9 ? '9+' : cartItemCount}
                        </span>
                      )}
                      {sampleCount > 0 && (
                        <span className={`${cartItemCount > 0 ? 'ml-2' : 'ml-auto'} flex items-center gap-1 text-ui-10 text-tea-gold/70`}>
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
            {auth.isAuthenticated && visibleAdminItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {!collapsed && (
                  <div className="px-5 pt-5 pb-1.5">
                    <span className={`${TYPOGRAPHY_CLASSES.navSidebarGroup} text-tea-text-dim`}>
                      Manage
                    </span>
                  </div>
                )}
                <nav
                  className={`flex flex-col gap-0.5 ${collapsed ? 'px-1.5 pt-3 pb-3' : 'px-3 pb-3'}`}
                >
                {visibleAdminItems.map((item, index) => {
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
                      {/* Parent row, single click target. Children auto-reveal
                          when parent or one of its children is active. */}
                      <Link
                        to={item.path!}
                        className={`relative flex items-center min-h-[36px] ${
                          collapsed ? 'justify-center px-2' : 'gap-2.5 px-4'
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
                        <div className={`shrink-0 transition-colors duration-200 ${
                          (showActive || isAnyChildActive)
                            ? 'text-tea-gold'
                            : 'text-tea-text-sec group-hover:text-tea-text'
                        }`}>
                          {React.cloneElement(item.icon as React.ReactElement<{ size?: number }>, { size: 16 })}
                        </div>
                        {!collapsed && (
                          <span
                            className={`${TYPOGRAPHY_CLASSES.navSidebarChild} text-left transition-colors duration-200 ${
                              (showActive || isAnyChildActive) ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
                            }`}
                          >
                            {item.label}
                          </span>
                        )}
                      </Link>

                      {/* Children, reveal reactively when parent context is active */}
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
                                  className={`relative flex items-center px-2 py-1 rounded-md transition-colors duration-150 min-h-[30px] group ${
                                    currentPath === child.path
                                      ? 'text-tea-gold bg-tea-gold/8'
                                      : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-gold/5'
                                  }`}
                                >
                                  {currentPath === child.path && (
                                    <div className="absolute -left-2.5 inset-y-0 w-[2px] bg-tea-gold/60" />
                                  )}
                                  <span className={TYPOGRAPHY_CLASSES.navSidebarChild}>
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
                </nav>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Curator Nav (Collections only, for Members with curator capability) ── */}
          <AnimatePresence>
            {auth.isAuthenticated && !auth.isAdmin && canCreateCollections && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {!collapsed && (
                  <div className="px-5 pt-5 pb-1.5">
                    <span className={`${TYPOGRAPHY_CLASSES.navSidebarGroup} text-tea-text-dim`}>
                      Curate
                    </span>
                  </div>
                )}
                <nav className={`flex flex-col gap-0.5 ${collapsed ? 'px-1.5 pt-3 pb-3' : 'px-3 pb-3'}`}>
                  <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0, duration: 0.25, ease: 'easeOut' }}
                  >
                    <Link
                      to="/admin/collections"
                      className={`relative flex items-center min-h-[36px] ${
                        collapsed ? 'justify-center px-2' : 'gap-2.5 px-4'
                      } rounded-md transition-colors duration-200 group ${
                        currentPath.startsWith('/admin/collections') ? '' : 'hover:bg-tea-gold/6'
                      }`}
                      title="Collections"
                    >
                      {currentPath.startsWith('/admin/collections') && (
                        <motion.div
                          layoutId="nav-indicator"
                          className="absolute left-0 inset-y-0 w-[2px] bg-tea-gold"
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                      )}
                      <div className={`shrink-0 transition-colors duration-200 ${
                        currentPath.startsWith('/admin/collections')
                          ? 'text-tea-gold'
                          : 'text-tea-text-sec group-hover:text-tea-text'
                      }`}>
                        <Stack size={16} weight={PHOSPHOR_WEIGHT} />
                      </div>
                      {!collapsed && (
                        <span className={`${TYPOGRAPHY_CLASSES.navSidebarChild} text-left transition-colors duration-200 ${
                          currentPath.startsWith('/admin/collections') ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
                        }`}>
                          Collections
                        </span>
                      )}
                    </Link>
                  </motion.div>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1" />

          {/* ── Utility footer ────────────────────────────────────────────── */}
          <div
            className={`py-3 ${collapsed ? 'px-1.5' : 'px-3'} border-t border-tea-border shrink-0`}
          >
            {/* Our Spaces + theme toggle */}
            <div className={`flex items-center ${collapsed ? 'flex-col gap-1' : 'justify-between gap-2'}`}>
                <Link
                  to="/spaces"
                  className={`flex items-center min-h-[44px] ${
                    collapsed ? 'justify-center px-2' : 'flex-1 gap-3 px-4'
                  } rounded-md transition-colors duration-200 group hover:bg-tea-gold/6`}
                  title="Our spaces"
                >
                  <MapPin
                    size={18}
                    weight={PHOSPHOR_WEIGHT}
                    className={`shrink-0 transition-colors duration-200 ${
                      currentPath === '/spaces'
                        ? 'text-tea-gold'
                        : 'text-tea-text-sec group-hover:text-tea-text'
                    }`}
                  />
                  {!collapsed && (
                    <span
                      className={`${TYPOGRAPHY_CLASSES.navSidebar} transition-colors duration-200 ${
                        currentPath === '/spaces' ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
                      }`}
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
                    <Sun size={18} weight={PHOSPHOR_WEIGHT} />
                  ) : (
                    <Moon size={18} weight={PHOSPHOR_WEIGHT} />
                  )}
                </button>
            </div>

          </div>

        </div>
      </aside>
    </LayoutGroup>
  );
};
