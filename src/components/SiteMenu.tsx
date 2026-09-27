import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useManageNav } from './manageNav';
import { useFocusTrap } from '../hooks/useFocusTrap';

// The phone's second door. The bottom bar has seven slots and the site has
// more than seven places, so the left end of the bar opens this panel the way
// the right end opens Your Table: left door is the site, right door is you,
// the four words stay between them. It lists what the desktop rail carries
// beyond the four words (search, sessions, people, places, tea wisdom, cart)
// and, for anyone with a Manage room, the same rooms the desktop column
// shows, read from the same list. A customer never sees the second band.
//
// Desktop never mounts it: the rail already holds every one of these.

interface SiteMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchClick: () => void;
  onCartClick: () => void;
  cartItemCount?: number;
}

interface SiteLink {
  id: string;
  label: string;
  path: string;
}

const SITE_LINKS: SiteLink[] = [
  { id: 'sessions', label: 'Sessions', path: '/events' },
  { id: 'people', label: 'People', path: '/people' },
  { id: 'places', label: 'Places', path: '/spaces' },
  { id: 'wisdom', label: 'Tea Wisdom', path: '/wisdom' },
];

const ROW_CLASS = 'flex items-center justify-between w-full min-h-[44px] px-5 font-display text-ui-17 lowercase tracking-[0.03em] transition-colors duration-200';
const ROW_IDLE = 'text-tea-text-sec hover:text-tea-text';
const ROW_ACTIVE = 'text-tea-gold';
const ACTIVE_GLOW: React.CSSProperties = {
  filter: 'drop-shadow(0 0 8px rgb(var(--tea-gold-rgb) / 0.75)) drop-shadow(0 0 18px rgb(var(--tea-gold-rgb) / 0.32))',
};

const BandLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-5 pt-3 pb-1 text-ui-10 uppercase tracking-[0.14em] text-tea-text-dim select-none">{children}</div>
);

export const SiteMenu: React.FC<SiteMenuProps> = ({ isOpen, onClose, onSearchClick, onCartClick, cartItemCount = 0 }) => {
  const location = useLocation();
  const manageNav = useManageNav();
  const trapRef = useFocusTrap(isOpen);

  // Escape closes; a route change closes, because every row is a navigation.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="site-menu-backdrop"
            className="fixed inset-0 z-panel-backdrop bg-black/60 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            key="site-menu"
            ref={trapRef as React.RefObject<HTMLDivElement>}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            data-testid="site-menu"
            className="fixed left-4 right-4 bottom-nav-gap z-panel-modal lg:hidden bg-tea-bg border border-tea-border rounded-xl overflow-hidden flex flex-col max-h-[70dvh]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="overflow-y-auto hide-scrollbar py-2">
              {/* Search sits first: it left the bar to make room for this door. */}
              <button
                type="button"
                onClick={() => { onClose(); onSearchClick(); }}
                className="mx-4 my-2 flex items-center gap-3 w-[calc(100%-2rem)] min-h-[44px] px-4 border border-tea-border rounded-md text-tea-text-sec hover:text-tea-text transition-colors duration-200"
                aria-label="Search"
              >
                <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="16.5" y1="16.5" x2="22" y2="22" />
                </svg>
                <span className="font-display italic text-ui-15 lowercase tracking-[0.02em]">search teas, pieces, people</span>
              </button>

              <BandLabel>The site</BandLabel>
              {SITE_LINKS.map(link => {
                const active = isActive(link.path);
                return (
                  <Link
                    key={link.id}
                    to={link.path}
                    onClick={onClose}
                    className={`${ROW_CLASS} ${active ? ROW_ACTIVE : ROW_IDLE}`}
                    style={active ? ACTIVE_GLOW : undefined}
                    aria-current={active ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => { onClose(); onCartClick(); }}
                className={`${ROW_CLASS} ${ROW_IDLE}`}
                aria-label={cartItemCount > 0 ? `Cart, ${cartItemCount} item${cartItemCount !== 1 ? 's' : ''}` : 'Cart'}
              >
                <span>Cart</span>
                {cartItemCount > 0 && (
                  <span className="text-ui-11 font-semibold text-tea-gold" aria-hidden="true">
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </span>
                )}
              </button>
              {/* About had no door but the footer, which the home page does not show. */}
              <Link
                to="/about"
                onClick={onClose}
                className={`${ROW_CLASS} ${isActive('/about') ? ROW_ACTIVE : ROW_IDLE}`}
                style={isActive('/about') ? ACTIVE_GLOW : undefined}
                aria-current={isActive('/about') ? 'page' : undefined}
              >
                About
              </Link>

              {manageNav.hasManageRoom && (
                <>
                  <div className="h-px bg-tea-border mx-5 mt-2" />
                  <BandLabel>Manage</BandLabel>
                  {(manageNav.items.length > 0
                    ? manageNav.items
                    : [{ id: 'collections', label: 'Collections', path: '/admin/collections' }]
                  ).map(item => {
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        onClick={onClose}
                        className={`${ROW_CLASS} ${active ? ROW_ACTIVE : ROW_IDLE}`}
                        style={active ? ACTIVE_GLOW : undefined}
                        aria-current={active ? 'page' : undefined}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
