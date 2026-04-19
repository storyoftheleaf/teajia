import React from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { LogoText } from './Logos';
import { Section } from '../types';

import { useLongPress } from '../hooks/useLongPress';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../lib/store';



interface BottomTabBarProps {
  activeSection: Section;
  onNavigate: (section: Section) => void;
  hidden?: boolean;
  onAccountClick?: () => void;
  onSearchClick?: () => void;
  onLaunchPadClick?: () => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeSection,
  onNavigate,
  hidden = false,
  onAccountClick,
  onSearchClick,
  onLaunchPadClick,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnAdmin = location.pathname.startsWith('/admin');

  const { activeAccount } = useAppStore();
  const locationAbbr = activeAccount?.location_country?.slice(0, 2).toUpperCase()
    ?? activeAccount?.location_city?.slice(0, 2).toUpperCase()
    ?? null;

  const centerLongPress = useLongPress({
    delay: 500,
    onLongPress: () => {
      if ('vibrate' in navigator) { navigator.vibrate?.(20); }
      navigate('/admin');
    },
    onClick: () => {
      if (isOnAdmin) {
        navigate('/');
        onNavigate('HOME');
        return;
      }
      onNavigate('HOME');
      setTimeout(() => window.scrollTo({ top: 0 }), 150);
    },
  });

  const leftSections = [
    { id: 'MAGAZINE' as Section, label: 'Read' },
    { id: 'LEARN' as Section, label: 'Learn' },
  ];

  const rightSections = [
    { id: 'OFFERINGS' as Section, label: 'Consult' },
    { id: 'SHOP' as Section, label: 'Shop' },
  ];

  const renderTabButton = (section: { id: Section; label: string }, index: number) => {
    const isActive = activeSection === section.id;

    return (
      <button
        key={section.id}
        onClick={() => {
          if ('vibrate' in navigator) { navigator.vibrate?.(10); }
          if (section.id === activeSection) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          onNavigate(section.id);
        }}
        className="flex-1 w-full min-w-0 h-full flex items-center justify-center relative transition-all duration-200 group animate-[fadeIn_0.5s_ease-out] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none select-none"
        style={{ animationDelay: `${index * 50}ms`, WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
        title={section.label}
        aria-current={isActive ? 'page' : undefined}
        aria-label={section.label}
      >
        <span
          className={`text-[14px] tracking-normal lowercase transition-all duration-300 pointer-events-none select-none whitespace-nowrap overflow-hidden ${
            isActive ? 'text-tea-gold font-bold' : 'text-tea-text-sec font-medium group-hover:text-tea-text'
          }`}
          style={{ fontFamily: 'var(--font-display)', WebkitUserSelect: 'none', userSelect: 'none' }}
        >
          {section.label.toLowerCase()}
        </span>
        {isActive && (
          <motion.div
            layoutId="bottomtab-indicator"
            className="absolute bottom-1 w-1 h-1 rounded-full bg-tea-gold"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
      </button>
    );
  };

  return (
    <LayoutGroup>
      {/* Navigation Tab Bar */}
      <nav
        aria-label="Main navigation"
        onContextMenu={(e) => e.preventDefault()}
        className={`flex lg:hidden fixed bottom-0 left-0 right-0 backdrop-blur-md backdrop-saturate-150 z-modal animate-[slideUp_0.4s_ease-out] transition-transform duration-200 select-none ${
          hidden ? 'translate-y-full' : 'translate-y-0'
        }`}
        style={{
          background: 'rgb(var(--tea-bg-rgb) / 0.95)',
          boxShadow: '0 -6px 20px rgb(var(--tea-bg-rgb) / 0.25), 0 -1px 4px rgb(var(--tea-bg-rgb) / 0.15)',
          height: 'calc(44px + env(safe-area-inset-bottom, 0px))',
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

          <div className="w-px h-4 bg-tea-gold/20 self-center flex-shrink-0" />

          {/* Left sections */}
          {leftSections.map((section, index) => (
            <React.Fragment key={section.id}>
              {renderTabButton(section, index)}
              <div className="w-px h-4 bg-tea-gold/20 self-center flex-shrink-0" />
            </React.Fragment>
          ))}

          {/* Center - HOME */}
          <button
            {...centerLongPress}
            className="flex-1 w-full h-full flex items-center justify-center relative transition-all duration-300 animate-[fadeIn_0.5s_ease-out] select-none"
            style={{
              animationDelay: `${leftSections.length * 50}ms`,
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              touchAction: 'manipulation',
            }}
            title="Home · Long press for launchpad"
            aria-label="Return to home, long press to open launchpad"
          >
            <span style={{ display: 'inline-block', transform: 'scale(0.78)', transformOrigin: 'center', lineHeight: 0 }}>
              <LogoText
                size="sm"
                color={activeSection === 'HOME' ? 'var(--tea-gold)' : 'var(--tea-text-sec)'}
                className="transition-all duration-300 pointer-events-none"
              />
            </span>
          </button>

          {/* Right sections */}
          {rightSections.map((section, index) => (
            <React.Fragment key={section.id}>
              <div className="w-px h-4 bg-tea-gold/20 self-center flex-shrink-0" />
              {renderTabButton(section, index + leftSections.length + 1)}
            </React.Fragment>
          ))}

          <div className="w-px h-4 bg-tea-gold/20 self-center flex-shrink-0" />

          {/* Far right — Account/Admin icon (fixed narrow slot) */}
          <button
            onClick={onAccountClick}
            className="w-8 flex-shrink-0 h-full flex flex-col items-center justify-center gap-px group focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none select-none"
            style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
            title="Account"
            aria-label="Account"
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
            {locationAbbr && (
              <span className="text-[7px] leading-none font-mono text-tea-text-sec/60 group-hover:text-tea-text-sec transition-colors pointer-events-none select-none">
                {locationAbbr}
              </span>
            )}
          </button>

        </div>
      </nav>
    </LayoutGroup>
  );
};
