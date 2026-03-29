import React from 'react';
import { LayoutGroup } from 'framer-motion';
import { Icons } from './Icons';
import { LogoEmblem, LogoText } from './Logos';
import { Section } from '../types';

import { getNavIcon, getIconScale } from './navIconConfig';
import { useLongPress } from '../hooks/useLongPress';
import { useNavigate, useLocation } from 'react-router-dom';



interface BottomTabBarProps {
  activeSection: Section;
  onNavigate: (section: Section) => void;
  hidden?: boolean;
  onAccountClick?: () => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeSection,
  onNavigate,
  hidden = false,
  onAccountClick
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnAdmin = location.pathname.startsWith('/admin');

  const centerLongPress = useLongPress({
    delay: 500,
    onLongPress: () => {
      if ('vibrate' in navigator) { navigator.vibrate?.(30); }
      if (isOnAdmin) {
        navigate('/');
        onNavigate('HOME');
      } else {
        navigate('/admin');
      }
    },
    onClick: () => { onNavigate('HOME'); window.scrollTo({ top: 0, behavior: 'smooth' }); },
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
        className="flex-1 min-w-0 h-full flex items-center justify-center relative transition-all duration-300 group animate-[fadeIn_0.5s_ease-out] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none select-none"
        style={{ animationDelay: `${index * 50}ms`, WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
        title={section.label}
        aria-current={isActive ? 'page' : undefined}
        aria-label={section.label}
      >
        {/* Text-only label */}
        <span
          className={`text-[16px] tracking-[0.04em] lowercase transition-all duration-300 pointer-events-none select-none ${
            isActive ? 'text-tea-gold font-bold' : 'text-tea-text-sec font-medium group-hover:text-tea-text'
          }`}
          style={{ fontFamily: 'var(--font-display)', WebkitUserSelect: 'none', userSelect: 'none' }}
        >
          {section.label.toLowerCase()}
        </span>
      </button>
    );
  };

  return (
    <LayoutGroup>
      {/* Navigation Tab Bar - 3 left + center OFFERINGS + 3 right */}
      <nav
        aria-label="Main navigation"
        className={`flex lg:hidden fixed bottom-0 left-0 right-0 backdrop-blur-md backdrop-saturate-150 z-[40] animate-[slideUp_0.4s_ease-out] transition-transform duration-200 select-none ${
          hidden ? 'translate-y-full' : 'translate-y-0'
        }`}
        style={{
          background: 'rgb(var(--tea-bg-rgb) / 0.95)',
          boxShadow: '0 -6px 20px rgb(var(--tea-bg-rgb) / 0.25), 0 -1px 4px rgb(var(--tea-bg-rgb) / 0.15)',
          height: 'calc(44px + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div className="flex items-center w-full px-0 h-full">
          {/* Left sections */}
          {leftSections.map((section, index) => (
            <React.Fragment key={section.id}>
              <div className="flex items-center h-full flex-1">
                {renderTabButton(section, index)}
              </div>
              <div className="w-px h-3 bg-tea-gold/10" />
            </React.Fragment>
          ))}

          {/* Center - HOME */}
          <div className="flex items-center h-full flex-1">
            <button
              {...centerLongPress}
              className="flex-1 h-full flex items-center justify-center relative transition-all duration-300 animate-[fadeIn_0.5s_ease-out] select-none"
              style={{
                animationDelay: `${leftSections.length * 50}ms`,
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'manipulation',
              }}
              title="Home · Long press for admin"
              aria-label="Return to home, long press to toggle admin"
            >
              <LogoText
                size="sm"
                color={activeSection === 'HOME' ? 'var(--tea-gold)' : 'var(--tea-text-sec)'}
                className="transition-all duration-300 pointer-events-none"
              />
            </button>
          </div>

          {/* Right sections */}
          {rightSections.map((section, index) => (
            <React.Fragment key={section.id}>
              <div className="w-px h-3 bg-tea-gold/10" />
              <div className="flex items-center h-full flex-1">
                {renderTabButton(section, index + leftSections.length + 1)}
              </div>
            </React.Fragment>
          ))}
        </div>
      </nav>
    </LayoutGroup>
  );
};
