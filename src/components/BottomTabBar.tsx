import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2 } from 'lucide-react';
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
  onSearchClick?: () => void;
  onSearchClose?: () => void;
  isAdminRoute?: boolean;
}

/**
 * MicCenterButton — a web3-flavoured circular button that sits inside the
 * bar with a layered gold halo and animated ripple rings during recording.
 * Replaces the centered teajiā logo on screens that register a
 * `bottomBarAction` of type `'mic'`.
 *
 * The button is sized to fit comfortably within the 52px bar (40×40 with
 * a 4px halo) so it never clips against the bar edges or the home
 * indicator on iOS — visual prominence comes from the layered glow and
 * gold ring rather than physically protruding above the bar plane.
 */
const MicCenterButton: React.FC<{
  state: 'idle' | 'recording' | 'transcribing' | 'error';
  onPress: () => void;
}> = ({ state, onPress }) => {
  const recording = state === 'recording';
  const transcribing = state === 'transcribing';
  const errored = state === 'error';

  return (
    <motion.button
      type="button"
      onClick={onPress}
      disabled={transcribing}
      whileHover={{ scale: transcribing ? 1 : 1.06 }}
      whileTap={{ scale: transcribing ? 1 : 0.92 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      aria-label={recording ? 'Stop recording' : transcribing ? 'Transcribing' : 'Record voice note'}
      title={recording ? 'Stop recording' : transcribing ? 'Transcribing…' : 'Tap to record'}
      className="relative w-10 h-10 rounded-full flex items-center justify-center select-none disabled:cursor-wait"
      style={{
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation',
        background: recording
          ? 'radial-gradient(circle at 50% 35%, rgb(var(--tea-gold-rgb) / 0.36), rgb(var(--tea-elevated-rgb)) 78%)'
          : 'radial-gradient(circle at 50% 35%, rgb(var(--tea-gold-rgb) / 0.18), rgb(var(--tea-elevated-rgb)) 72%)',
        border: `1.5px solid rgb(var(--tea-gold-rgb) / ${recording ? 0.7 : 0.5})`,
        boxShadow: recording
          ? '0 0 0 4px rgb(var(--tea-gold-rgb) / 0.12), 0 4px 14px -2px rgb(var(--tea-gold-rgb) / 0.45), 0 0 16px rgb(var(--tea-gold-rgb) / 0.4), inset 0 1px 0 rgb(255 255 255 / 0.08)'
          : '0 0 0 4px rgb(var(--tea-gold-rgb) / 0.06), 0 4px 14px -4px rgb(var(--tea-gold-rgb) / 0.28), 0 0 18px rgb(var(--tea-gold-rgb) / 0.2), inset 0 1px 0 rgb(255 255 255 / 0.05)',
      }}
    >
      {/* Recording ripple rings — two concentric, staggered, expand outward */}
      <AnimatePresence>
        {recording && (
          <>
            <motion.span
              key="ring-1"
              initial={{ scale: 1, opacity: 0.55 }}
              animate={{ scale: 1.55, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ border: '1px solid rgb(var(--tea-gold-rgb) / 0.55)' }}
            />
            <motion.span
              key="ring-2"
              initial={{ scale: 1, opacity: 0.4 }}
              animate={{ scale: 1.85, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ border: '1px solid rgb(var(--tea-gold-rgb) / 0.35)' }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Icon */}
      <span
        className="relative pointer-events-none"
        style={{ color: errored ? '#fb7185' : 'var(--tea-gold)' }}
      >
        {recording ? (
          <Square size={16} fill="currentColor" strokeWidth={0} />
        ) : transcribing ? (
          <motion.span
            className="block"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 size={18} strokeWidth={1.75} />
          </motion.span>
        ) : (
          <Mic size={18} strokeWidth={1.75} />
        )}
      </span>
    </motion.button>
  );
};

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeSection,
  onNavigate,
  hidden = false,
  onAccountClick,
  onAccountClose,
  onSearchClick,
  onSearchClose,
  isAdminRoute = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  // Derive admin route state from location — same value as the `isAdminRoute` prop,
  // using one authoritative source to avoid split-brain if prop is ever stale.
  const isOnAdmin = location.pathname.startsWith('/admin');

  const { activeAccount, upcomingEventsCount, bottomBarAction } = useAppStore();
  const auth = useAuth();
  const isAdmin = auth.isAdmin;
  const isStaff = auth.user?.role === 'staff' || auth.user?.role === 'admin' || auth.user?.role === 'owner';
  const locationAbbr = activeAccount?.location_country?.slice(0, 2).toUpperCase()
    ?? activeAccount?.location_city?.slice(0, 2).toUpperCase()
    ?? null;

  const micActive = bottomBarAction?.type === 'mic';

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
        onAccountClick?.();
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
        className={`flex lg:hidden fixed bottom-0 left-0 right-0 backdrop-blur-md backdrop-saturate-150 z-priority animate-[slideUp_0.4s_ease-out] transition-transform duration-200 select-none ${
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

          {/* Far left — Search icon (fixed narrow slot) */}
          <button
            onClick={onSearchClick}
            className="w-8 flex-shrink-0 h-full flex items-center justify-center group focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none select-none"
            style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
            title="Search"
            aria-label="Search"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-[15px] h-[15px] transition-colors duration-200 text-tea-text-sec group-hover:text-tea-text pointer-events-none"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="22" y2="22" />
            </svg>
          </button>

          {/* Left sections */}
          {isAdminRoute ? (
            adminLeftTabs.map((tab, index) => (
              <React.Fragment key={tab.id}>
                <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />
                {renderAdminTabButton(tab, index)}
              </React.Fragment>
            ))
          ) : (
            leftSections.map((section, index) => (
              <React.Fragment key={section.id}>
                <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />
                {renderTabButton(section, index)}
              </React.Fragment>
            ))
          )}

          <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />

          {/* Center — HOME / ADMIN HOME, OR a contextual mic button when a
              page registers `bottomBarAction = { type: 'mic' }`. */}
          {micActive && bottomBarAction?.type === 'mic' ? (
            <div
              className="flex items-center justify-center"
              style={{ flex: '1 1 0%' }}
            >
              <MicCenterButton state={bottomBarAction.state} onPress={bottomBarAction.onPress} />
            </div>
          ) : (
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
          )}

          <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />

          {/* Right sections */}
          {isAdminRoute ? (
            adminRightTabs.map((tab, index) => (
              <React.Fragment key={tab.id}>
                {renderAdminTabButton(tab, index + adminLeftTabs.length + 1)}
                <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />
              </React.Fragment>
            ))
          ) : (
            rightSections.map((section, index) => (
              <React.Fragment key={section.id}>
                {renderTabButton(section, index + leftSections.length + 1)}
                <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />
              </React.Fragment>
            ))
          )}

          {/* Far right — Account panel */}
          <button
            onClick={() => {
              if ('vibrate' in navigator) { navigator.vibrate?.(10); }
              onAccountClick?.();
            }}
            className="w-8 flex-shrink-0 h-full flex flex-col items-center justify-center gap-px group focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none select-none relative"
            style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
            title="Your Table"
            aria-label="Your Table"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-[13px] h-[13px] transition-colors duration-200 text-tea-text-sec group-hover:text-tea-text pointer-events-none"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            {upcomingEventsCount > 0 && (
              <span className="absolute top-1.5 right-1 w-1.5 h-1.5 rounded-full bg-tea-gold pointer-events-none" />
            )}
          </button>

        </div>
      </nav>
  );
};
