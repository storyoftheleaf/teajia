import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';
import { LogoEmblem, LogoText } from './Logos';
import { Section } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useAppStore, selectHasBundle, selectIsOwnerTier } from '../lib/store';
import type { SidebarRoom } from '../lib/store';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
// Phosphor (Light weight), refined hairlines, replaces the generic lucide
// stock icons in the admin nav. Browse keeps its hand-drawn brand icons.
import {
  CalendarBlank, SquaresFour, Briefcase, Leaf, Coffee, Storefront, UsersThree,
  FolderOpen, CaretLeft, CaretRight, UserCheck,
  BookOpen, Package, ShoppingCart, Sun, Moon, Stack, Camera, Compass,
  GearSix, Globe,
} from '@phosphor-icons/react';
import { SampleIcon } from './Icons';
import { useSampleCartStore } from '../samples/sampleCartStore';
import { ADMIN_CONNECTION_ROUTES, getVisibleAdminItemIds } from './navigationConnections';

const PHOSPHOR_WEIGHT = 'light' as const;

// The two rooms of the column. Only one hierarchy is visible at a time; the
// switch sits centred at the top of the middle pod (a marked button on the
// collapsed rail).
const ROOMS: { id: SidebarRoom; label: string }[] = [
  { id: 'browse', label: 'Browse' },
  { id: 'manage', label: 'Manage' },
];

// Both pods and the collapsed rail capsule share the `.nav-pod` recipe in
// card-utilities.css, the same material as BottomTabBar's floating capsule:
// same translucent wash, same blur, same keyline, same paper + grain, same
// shadow. Desktop and mobile navigation read as one object family because
// they are cut from the same sheet.

const Hairline: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`h-px bg-tea-border mx-[22px] shrink-0 ${className}`} />
);

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

// ── NavRow ─────────────────────────────────────────────────────────────────
// A single browse/manage row inside the middle pod. Expanded rows are words
// only (icons stay in the collapsed rail, where words don't fit); the active
// state is the same gold + glow treatment BottomTabBar uses for its tabs, so
// desktop and mobile read as one navigation system rather than two designs.
const NavRow: React.FC<{
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  minHeight: number;
  textClass: string;
}> = ({ item, isActive, onClick, minHeight, textClass }) => {
  const labelClass = `${textClass} text-left lowercase transition-colors duration-200 ${
    isActive ? 'text-tea-gold font-semibold' : 'text-tea-text-sec group-hover:text-tea-text'
  }`;
  const labelStyle: React.CSSProperties = isActive
    ? { filter: 'drop-shadow(0 0 8px rgb(var(--tea-gold-rgb) / 0.75)) drop-shadow(0 0 18px rgb(var(--tea-gold-rgb) / 0.32))' }
    : {};

  const badgeEl = item.badge !== undefined && item.badge > 0 && (
    <span className="ml-auto text-ui-11 font-semibold text-tea-gold shrink-0">
      {item.badge > 9 ? '9+' : item.badge}
    </span>
  );

  const baseClass = `w-full flex items-center justify-between gap-3 px-[28px] group`;
  const inner = (
    <>
      <span className={labelClass} style={labelStyle}>{item.label}</span>
      {badgeEl}
    </>
  );

  return item.action ? (
    <button onClick={item.action} className={baseClass} style={{ minHeight }}>{inner}</button>
  ) : item.path ? (
    <Link to={item.path} onClick={onClick} className={baseClass} style={{ minHeight }}>{inner}</Link>
  ) : (
    <button onClick={onClick} className={baseClass} style={{ minHeight }}>{inner}</button>
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
  const { sidebarCollapsed: collapsed, toggleSidebarCollapsed, activeAccount, sidebarRoom, setSidebarRoom } = useAppStore();
  // Bundle gates for the network destinations (Step 2-6 of NETWORK_ROLLOUT_PLAN).
  // Reactive subscriptions so they update when memberships hydrate post-mount.
  const hasCatalog = useAppStore(s => selectHasBundle(s, 'catalog'));
  const hasSell = useAppStore(s => selectHasBundle(s, 'sell'));
  const hasPublish = useAppStore(s => selectHasBundle(s, 'publish'));
  const hasStock = useAppStore(s => selectHasBundle(s, 'stock'));
  const hasGather = useAppStore(s => selectHasBundle(s, 'gather'));
  const hasMembers = useAppStore(s => selectHasBundle(s, 'members'));
  const platformRole = useAppStore(s => s.platformRole);
  const isOwnerTier = useAppStore(selectIsOwnerTier);
  const canCreateCollections = auth.user?.canCreateCollections ?? false;
  const sampleCount = useSampleCartStore(s => s.items.length);

  // Sync sidebar width to CSS variable for full-screen panel offsets. The
  // capsule column's own width IS the aside's width (pod + 12px insets each
  // side), so this one value is both the aside width and the gap a panel or
  // the mobile commerce dock needs to clear.
  useEffect(() => {
    document.documentElement.style.setProperty('--teajia-sidebar-w', collapsed ? '5rem' : '14.5rem');
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
    {
      isAdmin: auth.isAdmin,
      isOwnerTier,
      hasCatalog,
      hasStock,
      hasSell,
      hasGather,
      hasPublish,
      hasMembers,
    },
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

  // ── Rooms ─────────────────────────────────────────────────────────────────
  // The column shows one hierarchy at a time. `manage` is the workshop; the
  // browse room is the storefront, which on desktop is served by the floating
  // tab bar, so browse here is the way back out to it rather than a second
  // permanent list stacked under the admin one.
  const curatorItems: NavItem[] = canCreateCollections
    ? [{ id: 'collections', label: 'Collections', icon: <Stack size={18} weight={PHOSPHOR_WEIGHT} />, path: '/admin/collections' }]
    : [];
  // Settings leaves the list for the footer strip; it is a destination you
  // reach a few times a month, not one you scan past twenty times a day.
  const manageItems = visibleAdminItems.length > 0
    ? visibleAdminItems.filter(item => item.id !== 'settings')
    : curatorItems;
  const hasSettingsRoute = visibleAdminItems.some(item => item.id === 'settings');
  const hasManageRoom = auth.isAuthenticated && manageItems.length > 0;
  const room: SidebarRoom = hasManageRoom ? sidebarRoom : 'browse';

  // Landing on an admin route puts you in the workshop. Picking a room by hand
  // does not navigate, so it survives until the next navigation, at which point
  // the room and the route agree again.
  useEffect(() => {
    if (isAdminRoute) setSidebarRoom('manage');
  }, [currentPath, isAdminRoute, setSidebarRoom]);

  const accountInitial = (userName?.trim()?.[0] ?? '').toUpperCase();
  const accountMetaLine = auth.isAuthenticated
    ? [userName, locationLine].filter(Boolean).join(' · ')
    : 'Sign in';

  const railIconClass = (active: boolean) =>
    `tap-target flex items-center justify-center w-full transition-colors duration-200 ${
      active ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
    }`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <aside
      data-testid="left-sidebar"
      aria-label="Main navigation"
      className={`hidden lg:flex flex-col fixed left-0 top-0 h-screen z-sticky select-none transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-[14.5rem]'
      }`}
    >
      <div className="flex flex-col h-full w-full p-3 gap-[10px]">

        {collapsed ? (
          // ── Collapsed: one capsule pod, the whole rail ──────────────────
          <div className="nav-pod rounded-[28px] flex-1 min-h-0 flex flex-col items-center">
            {/* Brand */}
            <button
              onClick={() => { if (isAdminRoute) { navigate('/'); } else { onNavigate('HOME'); window.scrollTo({ top: 0, behavior: 'smooth' }); } }}
              className="w-full flex items-center justify-center h-[72px] shrink-0 group"
              title="Home"
            >
              <LogoEmblem
                size={26}
                color={theme === 'dark' ? '#c0b49a' : '#18130e'}
                className={`shrink-0 transition-opacity duration-200 ${
                  activeSection === 'HOME' && !isAdminRoute ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
                }`}
              />
            </button>

            {/* Search */}
            <button
              onClick={onSearchClick}
              className={railIconClass(false)}
              style={{ minHeight: 44 }}
              title="Search (⌘K)"
              aria-label="Search"
            >
              <Icons.Search className="w-[18px] h-[18px]" strokeWidth={1.5} />
            </button>

            {hasManageRoom && (
              <>
                <Hairline className="w-6 mx-0 my-2" />
                <button
                  onClick={() => setSidebarRoom(room === 'manage' ? 'browse' : 'manage')}
                  className={railIconClass(true)}
                  style={{ minHeight: 44 }}
                  title={room === 'manage' ? 'In Manage, switch to Browse' : 'In Browse, switch to Manage'}
                  aria-label={room === 'manage' ? 'In Manage, switch to Browse' : 'In Browse, switch to Manage'}
                >
                  {room === 'manage'
                    ? <Briefcase size={18} weight={PHOSPHOR_WEIGHT} />
                    : <Storefront size={18} weight={PHOSPHOR_WEIGHT} />}
                </button>
              </>
            )}

            <Hairline className="w-6 mx-0 my-2" />

            {/* Room content, icons only */}
            <div className="flex-1 min-h-0 w-full overflow-y-auto hide-scrollbar flex flex-col items-center">
              {room === 'browse' && (
                <>
                  {browseItems.map(item => {
                    const isActive = !isAdminRoute && (
                      item.path ? currentPath.startsWith(item.path) : activeSection === item.section
                    );
                    const onClick = () => {
                      if (item.path) {
                        if (currentPath === item.path) window.scrollTo({ top: 0, behavior: 'smooth' });
                        return;
                      }
                      if (!item.section) return;
                      if (!isAdminRoute && item.section === activeSection) {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        return;
                      }
                      onNavigate(item.section);
                    };
                    return item.path ? (
                      <Link key={item.id} to={item.path} onClick={onClick} className={railIconClass(isActive)} style={{ minHeight: 44 }} title={item.label} aria-label={item.label}>
                        {item.icon}
                      </Link>
                    ) : (
                      <button key={item.id} onClick={onClick} className={railIconClass(isActive)} style={{ minHeight: 44 }} title={item.label} aria-label={item.label}>
                        {item.icon}
                      </button>
                    );
                  })}
                  <Hairline className="w-6 mx-0 my-2" />
                  <button
                    onClick={onCartClick}
                    className={`relative ${railIconClass(false)}`}
                    style={{ minHeight: 44 }}
                    title="Cart"
                    aria-label={cartItemCount > 0 ? `Cart, ${cartItemCount} item${cartItemCount !== 1 ? 's' : ''}` : 'Cart'}
                  >
                    <ShoppingCart size={18} weight={PHOSPHOR_WEIGHT} />
                    {cartItemCount > 0 && (
                      <div
                        className={`absolute top-1 right-2 w-4 h-4 cta-solid text-ui-10 font-bold rounded-full flex items-center justify-center leading-none ${
                          badgeAnimating ? 'cart-badge-pulse' : ''
                        }`}
                        aria-hidden="true"
                      >
                        {cartItemCount > 9 ? '9+' : cartItemCount}
                      </div>
                    )}
                  </button>
                </>
              )}

              {room === 'manage' && manageItems.map(item => {
                const isAnyChildActive = item.children?.some(c => currentPath === c.path) ?? false;
                const isParentExact = currentPath === item.path;
                const isActive = (isParentExact && !isAnyChildActive) || isAnyChildActive;
                return (
                  <Link key={item.id} to={item.path!} className={railIconClass(isActive)} style={{ minHeight: 44 }} title={item.label} aria-label={item.label}>
                    {React.cloneElement(item.icon as React.ReactElement<{ size?: number }>, { size: 18 })}
                  </Link>
                );
              })}
            </div>

            <Hairline className="w-6 mx-0 my-2" />

            {/* Footer marks, icons */}
            <Link to="/spaces" className={railIconClass(currentPath === '/spaces')} style={{ minHeight: 44 }} title="Connections" aria-label="Connections">
              <UsersThree size={18} weight={PHOSPHOR_WEIGHT} />
            </Link>
            {hasSettingsRoute && (
              <Link to="/admin/settings" className={railIconClass(currentPath.startsWith('/admin/settings'))} style={{ minHeight: 44 }} title="Settings" aria-label="Settings">
                <GearSix size={18} weight={PHOSPHOR_WEIGHT} />
              </Link>
            )}
            <button
              type="button"
              onClick={(e) => toggleTheme(e)}
              className={railIconClass(false)}
              style={{ minHeight: 44 }}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={18} weight={PHOSPHOR_WEIGHT} /> : <Moon size={18} weight={PHOSPHOR_WEIGHT} />}
            </button>
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              className={railIconClass(false)}
              style={{ minHeight: 44 }}
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <CaretRight size={16} weight="bold" />
            </button>

            <Hairline className="w-6 mx-0 my-2" />

            {/* Account, bottom */}
            <button
              onClick={onAccountClick}
              className="w-full flex items-center justify-center pb-3 pt-1 shrink-0 group"
              title="Your Table"
              aria-label="Your Table"
            >
              <span
                className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-full border transition-colors duration-200 ${
                  activeSection === 'YOUR_TABLE' ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
                }`}
                style={{ borderColor: 'var(--tea-keyline)' }}
                aria-hidden="true"
              >
                {accountInitial ? (
                  <span className="font-display text-ui-15 leading-none">{accountInitial}</span>
                ) : (
                  <Icons.User className="w-[15px] h-[15px]" strokeWidth={1.75} />
                )}
              </span>
            </button>
          </div>
        ) : (
          <>
            {/* ── Pod 1: brand, room switch, search, the room ───────────── */}
            <div className="nav-pod rounded-[28px] flex-1 min-h-0 flex flex-col">
              <button
                onClick={() => { if (isAdminRoute) { navigate('/'); } else { onNavigate('HOME'); window.scrollTo({ top: 0, behavior: 'smooth' }); } }}
                className="flex items-center gap-3 group shrink-0"
                style={{ padding: '16px 22px 12px' }}
                title="Home"
              >
                <LogoEmblem
                  size={28}
                  color={theme === 'dark' ? '#c0b49a' : '#18130e'}
                  className={`shrink-0 transition-opacity duration-200 ${
                    activeSection === 'HOME' && !isAdminRoute ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
                  }`}
                />
                <LogoText
                  size="sm"
                  color={activeSection === 'HOME' && !isAdminRoute ? 'var(--tea-gold)' : 'var(--tea-text)'}
                  className="transition-colors duration-200 shrink-0"
                />
              </button>

              {hasManageRoom && (
                <div className="flex gap-[22px] shrink-0" style={{ padding: '2px 24px 14px' }}>
                  {ROOMS.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setSidebarRoom(r.id)}
                      aria-pressed={room === r.id}
                      className={`font-display text-ui-15 font-medium tracking-[0.04em] lowercase pb-[3px] border-b transition-colors duration-200 ${
                        room === r.id ? 'text-tea-gold border-tea-gold' : 'text-tea-text-dim hover:text-tea-text border-transparent'
                      }`}
                    >
                      {r.label.toLowerCase()}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={onSearchClick}
                className="flex items-center gap-3 group shrink-0"
                style={{ minHeight: 44, padding: '0 24px' }}
                title="Search (⌘K)"
              >
                <Icons.Search className="w-4 h-4 text-tea-text-sec group-hover:text-tea-text transition-colors shrink-0" strokeWidth={1.75} />
                <span className={`${TYPOGRAPHY_CLASSES.accountMeta} text-tea-text-sec group-hover:text-tea-text transition-colors flex-1 text-left`}>
                  Search
                </span>
                <kbd className="text-ui-11 text-tea-text-sec shrink-0">⌘K</kbd>
              </button>

              <Hairline />

              <motion.div
                key={room}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="flex-1 min-h-0 overflow-y-auto hide-scrollbar flex flex-col"
              >
                {room === 'browse' && (
                  <nav className="flex flex-col flex-1 min-h-0">
                    {browseItems.map((item, index) => {
                      const isActive = !isAdminRoute && (
                        item.path ? currentPath.startsWith(item.path) : activeSection === item.section
                      );
                      return (
                        <React.Fragment key={item.id}>
                          {index > 0 && <Hairline />}
                          <NavRow
                            item={item}
                            isActive={isActive}
                            minHeight={52}
                            textClass={TYPOGRAPHY_CLASSES.navSidebar}
                            onClick={() => {
                              if (item.path) {
                                if (currentPath === item.path) {
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }
                                return;
                              }
                              if (!item.section) return;
                              if (!isAdminRoute && item.section === activeSection) {
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                return;
                              }
                              onNavigate(item.section);
                            }}
                          />
                        </React.Fragment>
                      );
                    })}

                    <div className="flex-1" />
                    <Hairline />

                    {/* Cart, bottom of the browse room */}
                    <button
                      onClick={onCartClick}
                      className="w-full flex items-center gap-3 justify-between group"
                      style={{ minHeight: 52, padding: '0 28px' }}
                      title="Cart"
                      aria-label={cartItemCount > 0 ? `Cart, ${cartItemCount} item${cartItemCount !== 1 ? 's' : ''}` : 'Cart'}
                    >
                      <span className={`${TYPOGRAPHY_CLASSES.navSidebar} lowercase text-tea-text-sec group-hover:text-tea-text transition-colors duration-200`}>
                        Cart
                      </span>
                      <span className="flex items-center gap-2">
                        {sampleCount > 0 && (
                          <span className="flex items-center gap-1 text-ui-10 text-tea-gold/70">
                            <SampleIcon className="w-[10px] h-[10px]" />
                            {sampleCount}
                          </span>
                        )}
                        {cartItemCount > 0 && (
                          <span
                            className={`text-ui-11 font-semibold text-tea-gold ${badgeAnimating ? 'cart-badge-pulse' : ''}`}
                            aria-hidden="true"
                          >
                            {cartItemCount > 9 ? '9+' : cartItemCount}
                          </span>
                        )}
                      </span>
                    </button>
                  </nav>
                )}

                {room === 'manage' && (
                  <nav className="flex flex-col flex-1 min-h-0">
                    {manageItems.map((item, index) => {
                      const hasChildren = (item.children?.length ?? 0) > 0;
                      const isAnyChildActive = item.children?.some(c => currentPath === c.path) ?? false;
                      const isParentExact = currentPath === item.path;
                      const showActive = isParentExact && !isAnyChildActive;
                      const showChildren = hasChildren && (isParentExact || isAnyChildActive);

                      return (
                        <React.Fragment key={item.id}>
                          {index > 0 && <Hairline />}
                          <NavRow
                            item={item}
                            isActive={showActive || isAnyChildActive}
                            minHeight={42}
                            textClass="font-display text-ui-16 font-medium tracking-[0.04em] leading-[1.3]"
                            onClick={() => {}}
                          />

                          {/* Collapsing the column unmounts the children outright rather
                              than animating them out: a height transition would render
                              them clipped to single letters inside the 56px rail for the
                              length of the exit. */}
                          <AnimatePresence initial={false}>
                            {showChildren && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.18, ease: 'easeInOut' }}
                                className="overflow-hidden"
                              >
                                <div className="flex flex-col border-l border-tea-border" style={{ marginLeft: 28, paddingLeft: 12, paddingBottom: 8 }}>
                                  {item.children!.map(child => (
                                    <Link
                                      key={child.id}
                                      to={child.path}
                                      className={`relative flex items-center min-h-[26px] transition-colors duration-150 ${
                                        currentPath === child.path ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
                                      }`}
                                    >
                                      <span className={`${TYPOGRAPHY_CLASSES.navSidebarChild} lowercase`}>
                                        {child.label}
                                      </span>
                                    </Link>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      );
                    })}
                    <div className="flex-1" />
                  </nav>
                )}
              </motion.div>
            </div>

            {/* ── Pod 2: Your Table, connections + marks ────────────────── */}
            <div className="nav-pod rounded-[28px] flex flex-col shrink-0">
              <button
                onClick={onAccountClick}
                className="flex items-center gap-3 group"
                style={{ padding: '16px 22px 14px' }}
                title="Your Table"
              >
                <span
                  className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-full border transition-colors duration-200 ${
                    activeSection === 'YOUR_TABLE' ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
                  }`}
                  style={{ borderColor: 'var(--tea-keyline)' }}
                  aria-hidden="true"
                >
                  {accountInitial ? (
                    <span className="font-display text-ui-15 leading-none">{accountInitial}</span>
                  ) : (
                    <Icons.User className="w-[15px] h-[15px]" strokeWidth={1.75} />
                  )}
                </span>
                <span className="min-w-0 flex-1 text-left flex flex-col gap-0.5">
                  <span
                    className={`${TYPOGRAPHY_CLASSES.navSidebar} lowercase block transition-colors duration-200 ${
                      activeSection === 'YOUR_TABLE' ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
                    }`}
                  >
                    Your Table
                  </span>
                  <span className={`${TYPOGRAPHY_CLASSES.accountMeta} text-tea-text-sec block truncate`}>
                    {accountMetaLine}
                  </span>
                </span>
              </button>

              <Hairline />

              <div className="flex items-center justify-between shrink-0" style={{ height: 44, padding: '0 22px' }}>
                <Link
                  to="/spaces"
                  className="tap-target flex items-center justify-center text-tea-text-dim hover:text-tea-text transition-colors duration-200"
                  title="Connections"
                  aria-label="Connections"
                >
                  <UsersThree size={16} weight={PHOSPHOR_WEIGHT} />
                </Link>
                {hasSettingsRoute && (
                  <Link
                    to="/admin/settings"
                    className="tap-target flex items-center justify-center text-tea-text-dim hover:text-tea-text transition-colors duration-200"
                    title="Settings"
                    aria-label="Settings"
                  >
                    <GearSix size={16} weight={PHOSPHOR_WEIGHT} />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={(e) => toggleTheme(e)}
                  className="tap-target flex items-center justify-center text-tea-text-dim hover:text-tea-text transition-colors duration-200"
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? <Sun size={16} weight={PHOSPHOR_WEIGHT} /> : <Moon size={16} weight={PHOSPHOR_WEIGHT} />}
                </button>
                <button
                  type="button"
                  onClick={toggleSidebarCollapsed}
                  className="tap-target flex items-center justify-center text-tea-text-dim hover:text-tea-text transition-colors duration-200"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <CaretLeft size={16} weight={PHOSPHOR_WEIGHT} />
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </aside>
  );
};
