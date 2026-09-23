import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';
import { LogoEmblem } from './Logos';
import { Section } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useAppStore } from '../lib/store';
import type { SidebarRoom } from '../lib/store';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
// Phosphor (Light weight), refined hairlines, replaces the generic lucide
// stock icons in the admin nav. Browse keeps its hand-drawn brand icons.
import { Stack, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { SampleIcon } from './Icons';
import { useSampleCartStore } from '../samples/sampleCartStore';
import { useManageNav, type ManageItem } from './manageNav';

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
//
// The Manage column itself has two states: open (11rem, sized to its own
// longest label rather than a round number, see the measurement note below)
// and collapsed to a 3rem icon strip. Collapsing is `sidebarCollapsed` in
// the store, which used to sit unused; it now means "the Manage column is
// folded", not "the whole sidebar is". It stays folded across navigation and
// reloads until the collapse or expand control is clicked, or the rail word
// "manage" is clicked again, which always re-opens it.

// The narrowest width, in rem, that seats every Manage label (parent or
// child) on one line. Measured against the real rendered rows, including
// their padding, margin and border, not just the text: "Collections" is the
// longest parent at roughly 130px all-in, "Carry from network" the longest
// child at roughly 167px all-in (that number already carries the column's
// own 28px/12px child indent). 11rem, 176px, clears both with a few px of
// breathing room on the right, well inside the 10rem to 12.5rem band Adrian
// asked for, and narrower than the 12.5rem the column used to run at flat.
const MANAGE_COLUMN_WIDTH_REM = 11;
const MANAGE_STRIP_WIDTH_REM = 3;
const RAIL_WIDTH_REM = 4.5;

const Hairline: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`h-px bg-tea-border mx-[22px] shrink-0 ${className}`} />
);

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  section?: Section;
  path?: string;
  badge?: number;
  action?: () => void;
}

// ── NavRow ─────────────────────────────────────────────────────────────────
// A single row inside the Manage column. Words only; the active state is the
// same gold + glow treatment BottomTabBar uses for its tabs, so desktop and
// mobile read as one navigation system rather than two designs.
const NavRow: React.FC<{
  item: Pick<NavItem, 'label' | 'path' | 'badge' | 'action'>;
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
  const { theme } = useTheme();
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const isAdminRoute = currentPath.startsWith('/admin');
  const { activeAccount, sidebarRoom, setSidebarRoom, sidebarCollapsed, toggleSidebarCollapsed } = useAppStore();
  // The Manage rooms come from one shared list (manageNav.ts) so the phone's
  // site panel and this column can never disagree about what exists.
  const manageNav = useManageNav();
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
  const curatorItems: ManageItem[] = manageNav.canCreateCollections
    ? [{ id: 'collections', label: 'Collections', Icon: Stack, path: '/admin/collections' }]
    : [];
  // Settings is a room in the column like any other. It used to sit in the
  // rail's foot as a word, which made it the one Manage room named outside
  // Manage; the foot is glyphs and public rooms now.
  const manageItems: ManageItem[] = manageNav.items.length > 0 ? manageNav.items : curatorItems;
  const hasManageRoom = auth.isAuthenticated && manageItems.length > 0;
  const room: SidebarRoom = hasManageRoom ? sidebarRoom : 'browse';
  const showPanel = hasManageRoom && room === 'manage';

  // The aside is the rail alone (4.5rem), rail plus the open Manage column
  // (4.5 + 11 = 15.5rem), or rail plus the collapsed icon strip (4.5 + 3 =
  // 7.5rem). Full-screen panels read this to clear it (`.sidebar-inset`), and
  // App.tsx reads it for the main column's left margin.
  useEffect(() => {
    const width = !showPanel
      ? `${RAIL_WIDTH_REM}rem`
      : sidebarCollapsed
        ? `${RAIL_WIDTH_REM + MANAGE_STRIP_WIDTH_REM}rem`
        : `${RAIL_WIDTH_REM + MANAGE_COLUMN_WIDTH_REM}rem`;
    document.documentElement.style.setProperty('--teajia-sidebar-w', width);
  }, [showPanel, sidebarCollapsed]);

  // Landing on an admin route puts you in the workshop. Picking a room by hand
  // does not navigate, so it survives until the next navigation, at which point
  // the room and the route agree again. Whether the column is collapsed is a
  // separate axis: arriving here does not touch it, so it stays folded while
  // Adrian is working if that's how he left it.
  useEffect(() => {
    if (isAdminRoute) setSidebarRoom('manage');
  }, [currentPath, isAdminRoute, setSidebarRoom]);

  const accountInitial = (userName?.trim()?.[0] ?? '').toUpperCase();
  const accountMetaLine = auth.isAuthenticated
    ? [userName, locationLine].filter(Boolean).join(' · ')
    : 'Sign in';

  // ── Render ────────────────────────────────────────────────────────────────
  // The desk's navigation is a 72px rail of words against the left edge, and
  // a 176px column beside it that exists only while Manage is the room and
  // is not collapsed. No pod, no shadow, no radius: the rail is lifted from
  // the page by a few percent of tone and one keyline (`.nav-rail`), which is
  // the whole of its material. Browse has no children, so browse is rail plus
  // page. Collapsed, the column becomes a 48px strip of icons in its place.
  const railWord = (active: boolean) =>
    `font-display text-ui-14 lowercase tracking-[0.04em] leading-none transition-colors duration-200 ${
      active ? 'text-tea-gold font-semibold' : 'text-tea-text-sec hover:text-tea-text'
    }`;
  // Active is decided here, not appended after: the stylesheet orders
  // text-tea-gold before text-tea-text-sec, so a gold class tacked on the end
  // of a string that already carries the secondary colour never wins.
  const footGlyph = (active = false) =>
    `flex items-center justify-center transition-colors duration-200 ${
      active ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
    }`;
  const footWord = (active = false) =>
    `font-display text-ui-13 lowercase tracking-[0.04em] leading-none transition-colors duration-200 ${
      active ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
    }`;
  const activeGlow: React.CSSProperties = {
    filter: 'drop-shadow(0 0 8px rgb(var(--tea-gold-rgb) / 0.75)) drop-shadow(0 0 18px rgb(var(--tea-gold-rgb) / 0.32))',
  };

  return (
    <aside
      data-testid="left-sidebar"
      aria-label="Main navigation"
      className={`hidden lg:flex flex-row fixed left-0 top-0 h-screen z-sticky select-none transition-[width] duration-300 ${
        !showPanel ? 'w-[4.5rem]' : sidebarCollapsed ? 'w-[7.5rem]' : 'w-[15.5rem]'
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
                  // Clicking "manage" is the one action that always re-opens
                  // the column, even if it was left collapsed from a prior
                  // visit. Collapsing itself only happens from its own
                  // control, so this only ever moves false, never true.
                  if (sidebarCollapsed) toggleSidebarCollapsed();
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

        {/* The foot: the three controls the mobile bar also carries, as the
            same glyphs it uses (search, the person, the bag), then the two
            public rooms the four words do not cover. Light and dark live in
            the Your Table header; Settings is a Manage room like any other. */}
        <nav className="flex flex-col items-center gap-[18px]" aria-label="Utilities">
          <button onClick={onSearchClick} className={`nav-rail-word ${footGlyph()}`} title="Search (⌘K)" aria-label="Search">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="22" y2="22" />
            </svg>
          </button>
          <button
            onClick={onAccountClick}
            className={`nav-rail-word ${footGlyph(activeSection === 'YOUR_TABLE')}`}
            title="Your Table"
            aria-label="Your Table"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            <span className="sr-only">{accountMetaLine}</span>
          </button>
          <button
            onClick={onCartClick}
            className={`nav-rail-word ${footGlyph()} relative`}
            title="Cart"
            aria-label={cartItemCount > 0 ? `Cart, ${cartItemCount} item${cartItemCount !== 1 ? 's' : ''}` : 'Cart'}
          >
            <Icons.Bag className="w-5 h-5" strokeWidth={1.6} aria-hidden="true" />
            {cartItemCount > 0 && (
              <span className={`absolute -top-1.5 -right-2.5 text-ui-10 font-semibold text-tea-gold ${badgeAnimating ? 'cart-badge-pulse' : ''}`} aria-hidden="true">
                {cartItemCount > 9 ? '9+' : cartItemCount}
              </span>
            )}
            {sampleCount > 0 && (
              <span className="absolute -bottom-1.5 -right-2.5 flex items-center gap-0.5 text-ui-10 text-tea-gold/70" aria-hidden="true">
                <SampleIcon className="w-[9px] h-[9px]" />
                {sampleCount}
              </span>
            )}
          </button>
          <Link to="/people" className={`nav-rail-word ${footWord(currentPath.startsWith('/people'))}`} title="People">
            People
          </Link>
          <Link to="/spaces" className={`nav-rail-word ${footWord(currentPath === '/spaces')}`} title="Places">
            Places
          </Link>
        </nav>
      </div>

      {/* ── The Manage column: only while Manage is the room, open or
          collapsed to its icon strip ─────────────────────────────────── */}
      <AnimatePresence initial={false} mode="wait">
        {showPanel && (sidebarCollapsed ? (
          <motion.div
            key="manage-strip"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-[3rem] shrink-0 h-full border-r border-tea-border flex flex-col items-center overflow-y-auto hide-scrollbar"
          >
            <div className="shrink-0" style={{ padding: '30px 0 14px' }}>
              <button
                type="button"
                onClick={() => toggleSidebarCollapsed()}
                className="tap-target flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors duration-200"
                title="Expand"
                aria-label="Expand manage column"
              >
                <CaretRight size={16} weight={PHOSPHOR_WEIGHT} />
              </button>
            </div>
            <nav className="flex flex-col items-center flex-1 min-h-0 w-full" aria-label="Manage (collapsed)">
              {manageItems.map(item => {
                const isAnyChildActive = item.children?.some(c => currentPath === c.path) ?? false;
                const isParentExact = currentPath === item.path;
                const isActive = isParentExact || isAnyChildActive;
                const iconClass = `w-full flex items-center justify-center transition-colors duration-200 ${
                  isActive ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
                }`;
                return (
                  <Link key={item.id} to={item.path} title={item.label} aria-label={item.label} className={iconClass} style={{ minHeight: 42 }}>
                    <item.Icon size={18} weight={PHOSPHOR_WEIGHT} />
                  </Link>
                );
              })}
              <div className="flex-1" />
            </nav>
          </motion.div>
        ) : (
          <motion.div
            key="manage-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-[11rem] shrink-0 h-full border-r border-tea-border flex flex-col overflow-y-auto hide-scrollbar"
          >
            <div className="shrink-0 flex items-center justify-between" style={{ padding: '30px 24px 14px' }}>
              <span className="font-display text-ui-15 font-medium tracking-[0.04em] lowercase text-tea-gold">
                Manage
              </span>
              <button
                type="button"
                onClick={() => toggleSidebarCollapsed()}
                className="tap-target flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors duration-200"
                title="Collapse"
                aria-label="Collapse manage column"
              >
                <CaretLeft size={16} weight={PHOSPHOR_WEIGHT} />
              </button>
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
        ))}
      </AnimatePresence>
    </aside>
  );
};
