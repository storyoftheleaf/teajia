import React from 'react';
import { motion } from 'framer-motion';
import { LogoText } from './Logos';
import { Section } from '../types';

import { useLongPress } from '../hooks/useLongPress';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import { useAuth } from '../hooks/useAuth';



interface BottomTabBarProps {
  activeSection: Section;
  onNavigate: (section: Section) => void;
  hidden?: boolean;
  onAccountClick?: () => void;
  onAccountClose?: () => void;
  isAccountOpen?: boolean;
  onSearchClick?: () => void;
  onSearchClose?: () => void;
  isSearchOpen?: boolean;
  isAdminRoute?: boolean;
}

const BracketFrame: React.FC<{ active: boolean }> = ({ active }) => {
  const tone = active ? 'rgb(var(--tea-gold-rgb) / 0.7)' : 'rgb(var(--tea-gold-rgb) / 0.35)';
  const corner = 'absolute w-1.5 h-1.5 transition-[border-color,transform] duration-300 ease-out';
  const offset = active ? '-translate-x-px -translate-y-px' : '';
  return (
    <span aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <span className="relative w-9 h-7">
        <span className={`${corner} top-0 left-0 border-l border-t ${active ? offset : ''}`} style={{ borderColor: tone }} />
        <span className={`${corner} top-0 right-0 border-r border-t ${active ? 'translate-x-px -translate-y-px' : ''}`} style={{ borderColor: tone }} />
        <span className={`${corner} bottom-0 left-0 border-l border-b ${active ? '-translate-x-px translate-y-px' : ''}`} style={{ borderColor: tone }} />
        <span className={`${corner} bottom-0 right-0 border-r border-b ${active ? 'translate-x-px translate-y-px' : ''}`} style={{ borderColor: tone }} />
      </span>
    </span>
  );
};

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeSection,
  onNavigate,
  hidden = false,
  onAccountClick,
  onAccountClose,
  isAccountOpen = false,
  onSearchClick,
  onSearchClose,
  isSearchOpen = false,
  isAdminRoute = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  // Derive admin route state from location — same value as the `isAdminRoute` prop,
  // using one authoritative source to avoid split-brain if prop is ever stale.
  const isOnAdmin = location.pathname.startsWith('/admin');

  const { activeAccount, upcomingEventsCount } = useAppStore();
  const auth = useAuth();
  const isAdmin = auth.isAdmin;
  const isStaff = auth.user?.role === 'staff' || auth.user?.role === 'admin' || auth.user?.role === 'owner';
  const locationAbbr = activeAccount?.location_country?.slice(0, 2).toUpperCase()
    ?? activeAccount?.location_city?.slice(0, 2).toUpperCase()
    ?? null;

  // Admin tab definitions (path-based routing)
  type AdminTab = { id: string; label: string; path: string };
  const [adminLeftTabs, adminRightTabs] = ((): [AdminTab[], AdminTab[]] => {
    if (isAdmin) return [
      [{ id: 'compass',   label: 'compass',  path: '/admin/compass' },
       { id: 'inventory', label: 'inventory', path: '/admin/inventory' }],
      [{ id: 'activity',  label: 'sales',    path: '/admin/activity' },
       { id: 'events',    label: 'events',   path: '/admin/events' }],
    ];
    if (isStaff) return [
      [{ id: 'compass',  label: 'compass',  path: '/admin/compass' },
       { id: 'activity', label: 'sales',    path: '/admin/activity' }],
      [{ id: 'events',   label: 'events',   path: '/admin/events' },
       { id: 'people',   label: 'people',   path: '/admin/people' }],
    ];
    return [
      [{ id: 'compass', label: 'compass', path: '/admin/compass' },
       { id: 'samples', label: 'samples', path: '/admin/samples' }],
      [{ id: 'capture', label: 'capture', path: '/admin/capture' },
       { id: 'events',  label: 'events',  path: '/admin/events' }],
    ];
  })();

  const renderAdminTabButton = (tab: AdminTab, index: number) => {
    const isActive = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');
    return (
      <motion.button
        key={tab.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.05, duration: 0.25, ease: 'easeOut' }}
        onClick={() => {
          if ('vibrate' in navigator) { navigator.vibrate?.(10); }
          onSearchClose?.();
          onAccountClose?.();
          navigate(tab.path);
        }}
        className="flex-1 w-full min-w-0 h-full flex items-center justify-center relative transition-all duration-200 group focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none select-none"
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
        title={tab.label}
        aria-current={isActive ? 'page' : undefined}
        aria-label={tab.label}
      >
        <motion.span
          className="text-ui-15 tracking-normal lowercase font-medium pointer-events-none select-none whitespace-nowrap"
          style={{ fontFamily: 'var(--font-display)', WebkitUserSelect: 'none', userSelect: 'none' }}
          animate={
            isActive
              ? { color: 'var(--tea-gold)', fontWeight: 600, filter: 'drop-shadow(0 0 8px rgb(var(--tea-gold-rgb) / 0.75)) drop-shadow(0 0 18px rgb(var(--tea-gold-rgb) / 0.32))' }
              : { color: 'var(--tea-text-sec)', fontWeight: 400, filter: 'drop-shadow(0 0 0px transparent)' }
          }
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          {tab.label.toLowerCase()}
        </motion.span>
      </motion.button>
    );
  };

  const centerLongPress = useLongPress({
    delay: 500,
    onLongPress: () => {
      if ('vibrate' in navigator) { navigator.vibrate?.(20); }
      if (isOnAdmin) {
        navigate('/');
      } else {
        navigate('/admin');
      }
    },
    onClick: () => {
      if (isOnAdmin) {
        onSearchClose?.();
        onAccountClose?.();
        navigate('/admin/dashboard');
        return;
      }
      onNavigate('HOME');
      setTimeout(() => window.scrollTo({ top: 0 }), 150);
    },
  });

  const leftSections = [
    { id: 'MAGAZINE' as Section, label: 'Read' },
    { id: 'LEARN' as Section, label: 'Craft' },
  ];

  const rightSections = [
    { id: 'OFFERINGS' as Section, label: 'Advise' },
    { id: 'SHOP' as Section, label: 'Shop' },
  ];

  const renderTabButton = (section: { id: Section; label: string }, index: number) => {
    const isActive = !isOnAdmin && activeSection === section.id;

    return (
      <motion.button
        key={section.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.05, duration: 0.25, ease: 'easeOut' }}
        onClick={() => {
          if ('vibrate' in navigator) { navigator.vibrate?.(10); }
          onSearchClose?.();
          if (section.id === activeSection) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          onNavigate(section.id);
        }}
        className="flex-1 w-full min-w-0 h-full flex items-center justify-center relative transition-all duration-200 group focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none select-none"
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
        title={section.label}
        aria-current={isActive ? 'page' : undefined}
        aria-label={section.label}
      >
        <motion.span
          className="text-ui-15 tracking-normal lowercase font-medium pointer-events-none select-none whitespace-nowrap"
          style={{ fontFamily: 'var(--font-display)', WebkitUserSelect: 'none', userSelect: 'none' }}
          animate={
            isActive
              ? { color: 'var(--tea-gold)', fontWeight: 600, filter: 'drop-shadow(0 0 8px rgb(var(--tea-gold-rgb) / 0.75)) drop-shadow(0 0 18px rgb(var(--tea-gold-rgb) / 0.32))' }
              : { color: 'var(--tea-text-sec)', fontWeight: 400, filter: 'drop-shadow(0 0 0px transparent)' }
          }
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          {section.label.toLowerCase()}
        </motion.span>
      </motion.button>
    );
  };

  return (
      <nav
        aria-label="Main navigation"
        onContextMenu={(e) => e.preventDefault()}
        className={`flex lg:hidden fixed bottom-0 left-0 right-0 backdrop-blur-md backdrop-saturate-150 z-nav animate-[slideUp_0.4s_ease-out] transition-transform duration-200 select-none ${
          hidden ? 'translate-y-full' : 'translate-y-0'
        }`}
        style={{
          background: 'rgb(var(--tea-bg-rgb) / 0.95)',
          boxShadow: '0 -6px 20px rgb(var(--tea-bg-rgb) / 0.25), 0 -1px 4px rgb(var(--tea-bg-rgb) / 0.15)',
          height: 'calc(52px + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          WebkitTapHighlightColor: 'transparent',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
      >
        <div className="flex w-full px-0 h-full">

          {/* Far left — Search (bracket-framed tool slot) */}
          <button
            onClick={onSearchClick}
            className="relative w-14 flex-shrink-0 h-full flex items-center justify-center group focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none select-none"
            style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
            title="Search"
            aria-label="Search"
            aria-pressed={isSearchOpen}
          >
            <BracketFrame active={isSearchOpen} />
            <svg
              viewBox="0 0 24 24"
              className={`w-5 h-5 transition-colors duration-300 pointer-events-none relative ${isSearchOpen ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="22" y2="22" />
            </svg>
          </button>

          {/* Left sections — divider only between tab pairs, not adjacent to the bracket-framed search */}
          {isAdminRoute ? (
            adminLeftTabs.map((tab, index) => (
              <React.Fragment key={tab.id}>
                {index > 0 && <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />}
                {renderAdminTabButton(tab, index)}
              </React.Fragment>
            ))
          ) : (
            leftSections.map((section, index) => (
              <React.Fragment key={section.id}>
                {index > 0 && <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />}
                {renderTabButton(section, index)}
              </React.Fragment>
            ))
          )}

          <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />

          {/* Center - HOME / ADMIN HOME */}
          <motion.button
            {...centerLongPress}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: leftSections.length * 0.05, duration: 0.25, ease: 'easeOut' }}
            className="flex-1 w-full h-full flex items-center justify-center relative transition-all duration-300 select-none"
            style={{
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              touchAction: 'manipulation',
            }}
            title={isAdminRoute ? 'Admin Home · Long press to go to storefront' : 'Home · Long press for admin'}
            aria-label={isAdminRoute ? 'Admin home, long press to go to storefront' : 'Return to home, long press to open launchpad'}
          >
            <span style={{ display: 'inline-block', transform: 'scale(0.89)', transformOrigin: 'center', lineHeight: 0 }}>
              <LogoText
                size="sm"
                color={isAdminRoute
                  ? 'var(--tea-text-sec)'
                  : (activeSection === 'HOME' ? 'var(--tea-gold)' : 'var(--tea-text-sec)')}
                className="transition-all duration-300 pointer-events-none"
              />
            </span>
          </motion.button>

          <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />

          {/* Right sections — divider only between tab pairs, not adjacent to the bracket-framed account */}
          {isAdminRoute ? (
            adminRightTabs.map((tab, index) => (
              <React.Fragment key={tab.id}>
                {renderAdminTabButton(tab, index + adminLeftTabs.length + 1)}
                {index < adminRightTabs.length - 1 && <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />}
              </React.Fragment>
            ))
          ) : (
            rightSections.map((section, index) => (
              <React.Fragment key={section.id}>
                {renderTabButton(section, index + leftSections.length + 1)}
                {index < rightSections.length - 1 && <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />}
              </React.Fragment>
            ))
          )}

          {/* Far right — Your Table (bracket-framed tool slot) */}
          <button
            onClick={() => {
              if ('vibrate' in navigator) { navigator.vibrate?.(10); }
              onAccountClick?.();
            }}
            className="relative w-14 flex-shrink-0 h-full flex items-center justify-center group focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none select-none"
            style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
            title="Your Table"
            aria-label="Your Table"
            aria-pressed={isAccountOpen}
          >
            <BracketFrame active={isAccountOpen} />
            <svg
              viewBox="0 0 24 24"
              className={`w-5 h-5 transition-colors duration-300 pointer-events-none relative ${isAccountOpen ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            {upcomingEventsCount > 0 && (
              <span className="absolute top-2.5 right-3 w-1.5 h-1.5 rounded-full bg-tea-gold pointer-events-none" />
            )}
          </button>

        </div>
      </nav>
  );
};
