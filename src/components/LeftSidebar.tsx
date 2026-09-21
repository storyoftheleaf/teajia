import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';
import { LogoEmblem } from './Logos';
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
  FolderOpen, UserCheck, BookOpen, Package, Stack, Camera, Compass, GearSix, Globe,
} from '@phosphor-icons/react';
import { SampleIcon } from './Icons';
import { useSampleCartStore } from '../samples/sampleCartStore';
import { ADMIN_CONNECTION_ROUTES, getVisibleAdminItemIds } from './navigationConnections';

const PHOSPHOR_WEIGHT = 'light' as const;

// The two rooms of the desk. Browse is the rail's four words; Manage is a
// fifth word on the rail that opens the column beside it. Only one hierarchy
// is visible at a time.
//
// The rail wears `.nav-rail` (card-utilities.css): the page's own ground
// lifted a few percent, one keyline on its right edge, and nothing else. It
// used to be two floating pods cut from the mobile bar's material, and on a
// wide dark page two capsules with a 32px shadow read as objects placed on
// the page rather than part of it. Depth now comes from tone, not effects.

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
// A single row inside the Manage column. Words only; the active state is the
// same gold + glow treatment BottomTabBar uses for its tabs, so desktop and
// mobile read as one navigation system rather than two designs.
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
  const { activeAccount, sidebarRoom, setSidebarRoom } = useAppStore();
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
        { id: 'tasting-notes', path: '/admin/tasting-notes', label: 'Tasting Notes', icon: <Leaf size={14} weight={PHOSPHOR_WEIGHT} /> },
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
  const showPanel = hasManageRoom && room === 'manage';

  // The aside is the rail alone (4.5rem) or rail plus the Manage column
  // (17rem). Full-screen panels read this to clear it (`.sidebar-inset`), and
  // App.tsx reads it for the main column's left margin.
  useEffect(() => {
    document.documentElement.style.setProperty('--teajia-sidebar-w', showPanel ? '17rem' : '4.5rem');
  }, [showPanel]);

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

  // ── Render ────────────────────────────────────────────────────────────────
  // The desk's navigation is a 72px rail of words against the left edge, and
  // a 200px column beside it that exists only while Manage is the room. No
  // pod, no shadow, no radius, no icons: the rail is lifted from the page by
  // a few percent of tone and one keyline (`.nav-rail`), which is the whole
  // of its material. Browse has no children, so browse is rail plus page.
  const railWord = (active: boolean) =>
    `font-display text-ui-14 lowercase tracking-[0.04em] leading-none transition-colors duration-200 ${
      active ? 'text-tea-gold font-semibold' : 'text-tea-text-sec hover:text-tea-text'
    }`;
  const footWord = 'font-display text-ui-13 lowercase tracking-[0.04em] leading-none text-tea-text-sec hover:text-tea-text transition-colors duration-200';
  const activeGlow: React.CSSProperties = {
    filter: 'drop-shadow(0 0 8px rgb(var(--tea-gold-rgb) / 0.75)) drop-shadow(0 0 18px rgb(var(--tea-gold-rgb) / 0.32))',
  };

  return (
    <aside
      data-testid="left-sidebar"
      aria-label="Main navigation"
      className={`hidden lg:flex flex-row fixed left-0 top-0 h-screen z-sticky select-none transition-[width] duration-300 ${
        showPanel ? 'w-[17rem]' : 'w-[4.5rem]'
      }`}
    >
      {/* ── The rail ─────────────────────────────────────────────────────── */}
      <div className="nav-rail w-[4.5rem] shrink-0 h-full flex flex-col items-center pt-7 pb-6">
        <button
          onClick={() => { if (isAdminRoute) { navigate('/'); } else { onNavigate('HOME'); window.scrollTo({ top: 0, behavior: 'smooth' }); } }}
          className="tap-target flex items-center justify-center group shrink-0"
          title="Home"
          aria-label="Home"
        >
          <LogoEmblem
            size={24}
            color={theme === 'dark' ? '#c0b49a' : '#18130e'}
            className={`transition-opacity duration-200 ${
              activeSection === 'HOME' && !isAdminRoute ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
            }`}
          />
        </button>

        <nav className="flex flex-col items-center gap-5 mt-9" aria-label="Browse">
          {browseItems.map(item => {
            const isActive = !isAdminRoute && (
              item.path ? currentPath.startsWith(item.path) : activeSection === item.section
            );
            const onClick = () => {
              if (hasManageRoom) setSidebarRoom('browse');
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
              <Link key={item.id} to={item.path} onClick={onClick} className={`nav-rail-word ${railWord(isActive)}`} style={isActive ? activeGlow : undefined}>
                {item.label}
              </Link>
            ) : (
              <button key={item.id} onClick={onClick} className={`nav-rail-word ${railWord(isActive)}`} style={isActive ? activeGlow : undefined}>
                {item.label}
              </button>
            );
          })}

          {hasManageRoom && (
            <>
              <span className="block w-5 h-px bg-tea-border" aria-hidden="true" />
              <button
                onClick={() => {
                  setSidebarRoom('manage');
                  if (!isAdminRoute && manageItems[0]?.path) navigate(manageItems[0].path);
                }}
                aria-pressed={room === 'manage'}
                className={`nav-rail-word ${railWord(room === 'manage')}`}
                style={room === 'manage' ? activeGlow : undefined}
              >
                Manage
              </button>
            </>
          )}
        </nav>

        <div className="flex-1" />

        <nav className="flex flex-col items-center gap-[18px]" aria-label="Utilities">
          <button onClick={onSearchClick} className={`nav-rail-word ${footWord}`} title="Search (⌘K)">
            Search
          </button>
          <button
            onClick={onAccountClick}
            className={`nav-rail-word ${footWord} ${activeSection === 'YOUR_TABLE' ? 'text-tea-gold' : ''}`}
            title="Your Table"
          >
            Your Table
            <span className="sr-only">{accountMetaLine}</span>
          </button>
          <button
            onClick={onCartClick}
            className={`nav-rail-word ${footWord} flex items-baseline gap-1`}
            title="Cart"
            aria-label={cartItemCount > 0 ? `Cart, ${cartItemCount} item${cartItemCount !== 1 ? 's' : ''}` : 'Cart'}
          >
            <span>Cart</span>
            {cartItemCount > 0 && (
              <span className={`text-ui-11 font-semibold text-tea-gold ${badgeAnimating ? 'cart-badge-pulse' : ''}`} aria-hidden="true">
                {cartItemCount > 9 ? '9+' : cartItemCount}
              </span>
            )}
            {sampleCount > 0 && (
              <span className="flex items-center gap-0.5 text-ui-10 text-tea-gold/70" aria-hidden="true">
                <SampleIcon className="w-[9px] h-[9px]" />
                {sampleCount}
              </span>
            )}
          </button>
          <Link to="/spaces" className={`nav-rail-word ${footWord} ${currentPath === '/spaces' ? 'text-tea-gold' : ''}`} title="Connections">
            Connections
          </Link>
          {hasSettingsRoute && (
            <Link to="/admin/settings" className={`nav-rail-word ${footWord} ${currentPath.startsWith('/admin/settings') ? 'text-tea-gold' : ''}`} title="Settings">
              Settings
            </Link>
          )}
          <button
            type="button"
            onClick={(e) => toggleTheme(e)}
            className={`nav-rail-word ${footWord}`}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </nav>
      </div>

      {/* ── The Manage column: only while Manage is the room ──────────── */}
      <AnimatePresence initial={false}>
        {showPanel && (
          <motion.div
            key="manage-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-[12.5rem] shrink-0 h-full border-r border-tea-border flex flex-col overflow-y-auto hide-scrollbar"
          >
            <div className="shrink-0" style={{ padding: '30px 24px 14px' }}>
              <span className="font-display text-ui-15 font-medium tracking-[0.04em] lowercase text-tea-gold">
                Manage
              </span>
            </div>
            <nav className="flex flex-col flex-1 min-h-0" aria-label="Manage">
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
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
};
