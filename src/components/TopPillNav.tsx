import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogoText } from './Logos';
import { Section } from '../types';
import { useAppStore } from '../lib/store';

interface TopPillNavProps {
  activeSection: Section;
  onNavigate: (section: Section) => void;
  onAccountClick?: () => void;
  onCartClick?: () => void;
  onSearchClick?: () => void;
  cartItemCount?: number;
  isAccountOpen?: boolean;
  isSearchOpen?: boolean;
}

const leftSections: { id: Section; label: string }[] = [
  { id: 'MAGAZINE' as Section, label: 'Read' },
  { id: 'LEARN'    as Section, label: 'Craft' },
];

const rightSections: { id: Section; label: string }[] = [
  { id: 'OFFERINGS' as Section, label: 'Advise' },
  { id: 'SHOP'      as Section, label: 'Shop' },
];

/**
 * TopPillNav — desktop floating glass pill, modelled exactly on the mobile
 * BottomTabBar. Same translucent glass, same Cormorant lowercase labels,
 * same gold drop-shadow on the active state. Lives at the top, centered,
 * never claims a vertical slab of the viewport.
 *
 * Only renders on `lg` and up, and only on public (non-admin) routes —
 * admin routes keep the LeftSidebar tool palette.
 *
 * Auto-hides on scroll-down so the content stage stays clear, just like
 * the mobile bar.
 */
export const TopPillNav: React.FC<TopPillNavProps> = ({
  activeSection,
  onNavigate,
  onAccountClick,
  onCartClick,
  onSearchClick,
  cartItemCount = 0,
  isAccountOpen = false,
  isSearchOpen = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { upcomingEventsCount } = useAppStore();

  // Auto-hide on scroll-down (reveal on scroll-up). Same UX as mobile bar.
  const [hidden, setHidden] = useState(false);
  const lastYRef = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastYRef.current;
      // Only react past 80px (so initial micro-jitter doesn't hide it).
      if (y < 80) {
        setHidden(false);
      } else if (delta > 6) {
        setHidden(true);
      } else if (delta < -6) {
        setHidden(false);
      }
      lastYRef.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const hasProductOverlay =
    location.pathname.startsWith('/shop/product/') ||
    new URLSearchParams(location.search).has('product');
  const shouldHide = hidden || hasProductOverlay;

  const renderTab = (section: { id: Section; label: string }, index: number) => {
    const isActive = activeSection === section.id;
    return (
      <motion.button
        key={section.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.05, duration: 0.25, ease: 'easeOut' }}
        onClick={() => {
          if (section.id === activeSection) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          onNavigate(section.id);
        }}
        className="flex-1 min-w-0 h-full flex items-center justify-center relative transition-all duration-200 group focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none px-4"
        title={section.label}
        aria-current={isActive ? 'page' : undefined}
        aria-label={section.label}
      >
        <motion.span
          className="text-ui-15 tracking-normal lowercase font-medium pointer-events-none whitespace-nowrap"
          style={{ fontFamily: 'var(--font-display)' }}
          animate={
            isActive
              ? {
                  color: 'var(--tea-gold)',
                  fontWeight: 600,
                  filter:
                    'drop-shadow(0 0 8px rgb(var(--tea-gold-rgb) / 0.75)) drop-shadow(0 0 18px rgb(var(--tea-gold-rgb) / 0.32))',
                }
              : {
                  color: 'var(--tea-text-sec)',
                  fontWeight: 400,
                  filter: 'drop-shadow(0 0 0px transparent)',
                }
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
      className={`hidden lg:flex fixed z-nav transition-transform duration-300 select-none overflow-hidden ${
        shouldHide ? '-translate-y-[calc(100%+24px)]' : 'translate-y-0'
      }`}
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        left: '50%',
        transform: shouldHide
          ? 'translateX(-50%) translateY(calc(-100% - 24px))'
          : 'translateX(-50%) translateY(0)',
        width: 'min(760px, calc(100vw - 64px))',
        height: '60px',
        borderRadius: '9999px',
        background: 'rgb(var(--tea-bg-rgb) / 0.88)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid rgb(var(--tea-border-rgb) / 0.6)',
        boxShadow:
          '0 10px 32px rgb(0 0 0 / 0.35), 0 2px 8px rgb(0 0 0 / 0.2), inset 0 1px 0 rgb(var(--tea-gold-rgb) / 0.06)',
        transitionProperty: 'transform',
        transitionDuration: '300ms',
      }}
    >
      <div className="flex w-full h-full">
        {/* Search — far left icon, sits inside the capsule */}
        <button
          onClick={onSearchClick}
          className="w-14 flex-shrink-0 h-full flex items-center justify-center pl-2 group focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none transition-colors duration-300"
          title="Search"
          aria-label="Search"
          aria-pressed={isSearchOpen}
        >
          <svg
            viewBox="0 0 24 24"
            className={`w-5 h-5 transition-colors duration-300 pointer-events-none ${
              isSearchOpen ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
            }`}
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

        <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />

        {/* Left sections */}
        {leftSections.map((section, index) => (
          <React.Fragment key={section.id}>
            {index > 0 && <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />}
            {renderTab(section, index)}
          </React.Fragment>
        ))}

        <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />

        {/* Center — brand mark, clickable → home */}
        <button
          onClick={() => {
            if (activeSection === 'HOME') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              onNavigate('HOME');
              navigate('/');
            }
          }}
          className="flex-1 h-full flex items-center justify-center transition-all duration-300"
          title="Home"
          aria-label="Return to home"
        >
          <span style={{ display: 'inline-block', transform: 'scale(0.95)', transformOrigin: 'center', lineHeight: 0 }}>
            <LogoText
              size="sm"
              color={activeSection === 'HOME' ? 'var(--tea-gold)' : 'var(--tea-text-sec)'}
              className="transition-all duration-300 pointer-events-none"
            />
          </span>
        </button>

        <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />

        {/* Right sections */}
        {rightSections.map((section, index) => (
          <React.Fragment key={section.id}>
            {renderTab(section, index + leftSections.length + 1)}
            {index < rightSections.length - 1 && <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />}
          </React.Fragment>
        ))}

        <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />

        {/* Account — Your Table */}
        <button
          onClick={onAccountClick}
          className="relative w-12 flex-shrink-0 h-full flex items-center justify-center group focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none transition-colors duration-300"
          title="Your Table"
          aria-label="Your Table"
          aria-pressed={isAccountOpen}
        >
          <svg
            viewBox="0 0 24 24"
            className={`w-5 h-5 transition-colors duration-300 pointer-events-none ${
              isAccountOpen ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
            }`}
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
            <span className="absolute top-3 right-2 w-1.5 h-1.5 rounded-full bg-tea-gold pointer-events-none" />
          )}
        </button>

        <div className="w-px h-4 bg-tea-border self-center flex-shrink-0" />

        {/* Cart */}
        <button
          onClick={onCartClick}
          className="relative w-14 flex-shrink-0 h-full flex items-center justify-center pr-2 group focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none transition-colors duration-300"
          title={cartItemCount > 0 ? `Cart, ${cartItemCount} item${cartItemCount === 1 ? '' : 's'}` : 'Cart'}
          aria-label={cartItemCount > 0 ? `Cart, ${cartItemCount} item${cartItemCount === 1 ? '' : 's'}` : 'Cart'}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5 text-tea-text-sec group-hover:text-tea-text transition-colors duration-300 pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 4h2l2.4 11.2A2 2 0 0 0 9.36 17h7.84a2 2 0 0 0 1.96-1.62L21 8H6" />
            <circle cx="10" cy="20" r="1.2" />
            <circle cx="17" cy="20" r="1.2" />
          </svg>
          {cartItemCount > 0 && (
            <span className="absolute top-2.5 right-1.5 min-w-[16px] h-4 px-1 bg-tea-gold text-tea-bg text-ui-10 font-bold rounded-full flex items-center justify-center leading-none pointer-events-none">
              {cartItemCount > 9 ? '9+' : cartItemCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
};
