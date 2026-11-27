import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';
import { LogoEmblem } from './Logos';
import { Section } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useSiteProblemCount } from '../lib/useSiteIncidents';
import { useAppStore } from '../lib/store';
import type { SidebarRoom } from '../lib/store';
import { Stack, SunHorizon } from '@phosphor-icons/react';
import { SampleIcon } from './Icons';
import { useSampleCartStore } from '../samples/sampleCartStore';
import { useManageNav, isManagePathActive, type ManageItem } from './manageNav';
import { barSections, barSectionActive } from './navSections';
import { homeBarOpen } from '../lib/homeBar';
import { manageLook, MANAGE_LOOK_WIDTH_REM } from './manageLook';

// One rail for everyone, a drawer for the people who run the shop
// (Adrian, 2026-11-25, "Narrow B as a pair, one wide").
//
// Every visitor sees the rail alone: the four words, then the foot (search,
// the person, the bag, People, Places). It is the whole navigation and has to
// read as complete. Someone who may manage the shop gets one more word at the
// very bottom of the same rail, under a hairline. While Manage is the room,
// a drawer of room buttons, one wide, stands beside the rail, stacked up from
// that word, and the word itself takes the drawer's tone so the two read as
// one shape rather than a second rail. Nothing the visitor sees moves.
//
// A room's own screens (Publish's Collections, Wisdom...) are no longer listed
// here: they are tabs across the top of the page (ManageRoomTabs), so the left
// edge never grows a third column. `sidebarCollapsed` now means "the drawer is
// put away"; pressing the word manage again while standing in Manage puts it
// away or brings it back. The canvas: outputs/sidebar-directions-2026-11-25.

// 60px rail: "manage", the widest one-line word, sits inside it with room;
// "tea table" and "tea spaces" go on two close lines (Adrian, 2026-11-27).
// The drawer's width depends on its look (manageLook.ts).
const RAIL_WIDTH_REM = 3.75;

// ── LeftSidebar ────────────────────────────────────────────────────────────

interface LeftSidebarProps {
  activeSection: Section;
  onNavigate: (section: Section) => void;
  onAccountClick?: () => void;
  onCartClick?: () => void;
  onSearchClick?: () => void;
  cartItemCount?: number;
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
  // Owner only: the person glyph turns terracotta while something needs fixing.
  const siteProblems = useSiteProblemCount(auth.isAdmin);
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

  // The four words come from one list (navSections.ts), which the phone bar
  // reads too, so the rail and the bar cannot fall out of step. Read lands on
  // the unified /read section: a word's `path` overrides the section→view
  // routing exactly like the bar's "Read" tab.
  const barOpen = homeBarOpen();
  const browseItems = barSections(barOpen);

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
  const today = manageNav.today;
  const isTodayActive = today ? isManagePathActive(today.path, currentPath) : false;
  const here = (path: string) => isManagePathActive(path, currentPath, location.search);
  const room: SidebarRoom = hasManageRoom ? sidebarRoom : 'browse';
  const showPanel = hasManageRoom && room === 'manage';

  // The aside is the rail alone (3.75rem) or the rail plus the open drawer
  // plus the look's width (manageLook.ts). Full-screen panels read this to clear it
  // (`.sidebar-inset`), and App.tsx reads it for the main column's margin.
  const drawerOpen = showPanel && !sidebarCollapsed;
  const look = manageLook(location.search);
  const drawerRem = MANAGE_LOOK_WIDTH_REM[look];
  const asideWidth = drawerOpen ? `${RAIL_WIDTH_REM + drawerRem}rem` : `${RAIL_WIDTH_REM}rem`;
  useEffect(() => {
    document.documentElement.style.setProperty('--teajia-sidebar-w', asideWidth);
  }, [asideWidth]);

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
      data-look={look}
      style={{ width: asideWidth }}
      className="hidden lg:flex flex-row fixed left-0 top-0 h-screen z-sticky select-none transition-[width] duration-300"
    >
      {/* ── The rail ─────────────────────────────────────────────────────── */}
      <div className="nav-rail w-[3.75rem] shrink-0 h-full flex flex-col items-center pt-7 pb-6">
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

        <nav className="flex flex-col items-center gap-[18px] mt-9" aria-label="Browse">
          {browseItems.map(item => {
            const isActive = !isAdminRoute && barSectionActive(item, currentPath, activeSection);
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
            // `rail-stacked` sets a two-word label on two lines held close
            // ("tea" over "table"), so it fits the rail and reads as one word.
            return item.path ? (
              <Link key={item.id} to={item.path} onClick={onClick} className={`nav-rail-word rail-stacked ${railWord(isActive)}`} style={isActive ? activeGlow : undefined}>
                {item.label}
              </Link>
            ) : (
              <button key={item.id} onClick={onClick} className={`nav-rail-word rail-stacked ${railWord(isActive)}`} style={isActive ? activeGlow : undefined}>
                {item.label}
              </button>
            );
          })}

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
            className={`nav-rail-word ${footGlyph(activeSection === 'YOUR_TABLE')}${siteProblems > 0 && activeSection !== 'YOUR_TABLE' ? ' !text-tea-error' : ''}`}
            title={siteProblems > 0 ? `Your Table, ${siteProblems} to fix` : 'Your Table'}
            aria-label={siteProblems > 0 ? `Your Table, ${siteProblems} site problem${siteProblems === 1 ? '' : 's'} to fix` : 'Your Table'}
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
          {/* With the new bar, People and Places live under "table" and
              "house", so the foot is the three glyphs (Narrow B). */}
          {!barOpen && (
            <>
              <Link to="/people" className={`nav-rail-word ${footWord(currentPath.startsWith('/people'))}`} title="People">
                People
              </Link>
              <Link to="/spaces" className={`nav-rail-word ${footWord(currentPath === '/spaces')}`} title="Places">
                Places
              </Link>
            </>
          )}
        </nav>

        {/* Manage: the one word only shop staff see, last on the rail. Open,
            it wears the drawer's tone and reaches the rail's edge, so the word
            and the drawer beside it are one shape. */}
        {hasManageRoom && (
          <>
            <span className="block w-5 h-px bg-tea-border mt-6 mb-3 shrink-0" aria-hidden="true" />
            <button
              type="button"
              onClick={() => {
                // Standing in Manage with the drawer out, the word puts it
                // away; anywhere else it brings the drawer out (and from the
                // shop, walks to the first room).
                if (room === 'manage' && isAdminRoute && !sidebarCollapsed) {
                  toggleSidebarCollapsed();
                  return;
                }
                setSidebarRoom('manage');
                if (sidebarCollapsed) toggleSidebarCollapsed();
                const door = today?.path ?? manageItems[0]?.path;
                if (!isAdminRoute && door) navigate(door);
              }}
              aria-pressed={room === 'manage'}
              aria-expanded={drawerOpen}
              aria-controls="manage-drawer"
              data-open={drawerOpen ? 'true' : undefined}
              className={`nav-manage-word ${railWord(room === 'manage')}`}
            >
              Manage
            </button>
          </>
        )}
      </div>

      {/* ── The drawer: the rooms, one wide, stacked up from the word ─── */}
      <AnimatePresence initial={false}>
        {drawerOpen && (
          <motion.nav
            key="manage-drawer"
            id="manage-drawer"
            aria-label="Manage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ width: `${drawerRem}rem` }}
            className="nav-drawer shrink-0 h-full flex flex-col overflow-y-auto hide-scrollbar"
          >
            <div className="nav-drawer-list">
            <span className="nav-drawer-label">Manage</span>
            {today && (
              <>
                <Link to={today.path} className="nav-room" aria-current={isTodayActive ? 'page' : undefined}>
                  <span className="nav-room-mark"><SunHorizon className="nav-room-glyph" size={20} weight="light" aria-hidden="true" /></span>
                  <span className="nav-room-word">{today.label}</span>
                </Link>
                <span className="nav-drawer-rule" aria-hidden="true" />
              </>
            )}
            {manageItems.map(item => {
              const isActive = here(item.path) || (item.children?.some(c => here(c.path)) ?? false);
              return (
                <Link key={item.id} to={item.path} className="nav-room" aria-current={isActive ? 'page' : undefined}>
                  <span className="nav-room-mark"><item.Icon className="nav-room-glyph" size={20} weight="light" aria-hidden="true" /></span>
                  <span className="nav-room-word">{item.label}</span>
                </Link>
              );
            })}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </aside>
  );
};
