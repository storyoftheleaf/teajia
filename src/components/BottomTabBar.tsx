import React from 'react';
import { Icons } from './Icons';
import { LogoEmblem, LogoText } from './Logos';
import { Section } from '../types';

import { getNavIcon, getIconScale } from './navIconConfig';
import { useTheme } from '../context/ThemeContext';
import { useLongPress } from '../hooks/useLongPress';
import { useAuth } from '../hooks/useAuth';



interface BottomTabBarProps {
  activeSection: Section;
  onNavigate: (section: Section) => void;
  cartItemCount?: number;
  hidden?: boolean;
  onAccountClick?: () => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeSection,
  onNavigate,
  cartItemCount = 0,
  hidden = false,
  onAccountClick
}) => {
  const { toggleTheme, theme } = useTheme();
  const isDark = theme === 'dark';
  const auth = useAuth();
  const [themeFlash, setThemeFlash] = React.useState(false);

  const centerLongPress = useLongPress({
    delay: 500,
    onLongPress: (e) => {
      toggleTheme(e as React.MouseEvent);
      setThemeFlash(true);
      setTimeout(() => setThemeFlash(false), 400);
    },
    onClick: () => onNavigate('HOME'),
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
    const IconComponent = getNavIcon(section.id);
    const isActive = activeSection === section.id;
    const scale = getIconScale(section.id);

    return (
      <button
        key={section.id}
        onClick={() => onNavigate(section.id)}
        className={`flex-1 min-w-0 h-full flex flex-col items-center justify-center relative transition-all duration-300 group animate-[fadeIn_0.5s_ease-out]`}
        style={{ animationDelay: `${index * 50}ms` }}
        title={section.label}
      >
        {/* Icon with relative positioning for badge */}
        <div className="relative flex-shrink-0 w-6 h-6 flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:scale-105">
          <IconComponent
            className={`transition-all duration-300 flex-shrink-0 ${
              isActive
                ? 'text-tea-gold w-5 h-5 scale-110 origin-center'
                : 'text-tea-paper/60 w-5 h-5 group-hover:text-tea-paper/85'
            }`}
            strokeWidth={2}
            {...(isActive ? { fill: 'currentColor' } : {})}
            style={scale !== 1 ? { transform: `scale(${scale})` } : undefined}
          />

        </div>

        {/* Label */}
        <span className={`text-[11px] font-sans font-normal uppercase tracking-[0.15em] mt-1 transition-all duration-300 text-center truncate px-1 relative z-10 ${
          isActive ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
        }`}>
          {section.label}
        </span>

      </button>
    );
  };

  return (
    <>
      {/* Navigation Tab Bar - 3 left + center OFFERINGS + 3 right */}
      <nav
        className={`flex lg:hidden fixed bottom-0 left-0 right-0 bg-tea-surface/92 backdrop-blur-xl z-[65] animate-[slideUp_0.4s_ease-out] transition-all duration-200 pb-[env(safe-area-inset-bottom)] ${
          hidden ? 'opacity-0 pointer-events-none' : 'h-[56px] opacity-100'
        }`}
        style={{ boxShadow: '0 -8px 24px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-center w-full px-0 h-full">
          {/* Left sections */}
          {leftSections.map((section, index) => (
            <div key={section.id} className="flex items-center h-full flex-1">
              {renderTabButton(section, index)}
            </div>
          ))}

          {/* Center - HOME Logo (Subtle Seal) */}
          <div className="flex items-center h-full flex-1">
            <button
              {...centerLongPress}
              className={`flex-1 h-full flex items-center justify-center relative transition-all duration-300 animate-[fadeIn_0.5s_ease-out] ${themeFlash ? 'scale-95' : ''}`}
              style={{ animationDelay: `${leftSections.length * 50}ms` }}
              title="Home · Long press for theme"
              aria-label="Return to home, long press to toggle theme"
            >
              <div className="absolute inset-0 flex items-end justify-center pb-1 pointer-events-none">
                <LogoEmblem
                  size={48}
                  color={isDark
                    ? (activeSection === 'HOME' ? 'rgba(200,170,120,0.18)' : 'rgba(200,170,120,0.10)')
                    : (activeSection === 'HOME' ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.15)')
                  }
                  className={`transition-all duration-300 ${themeFlash ? 'scale-125 opacity-50' : ''}`}
                />
              </div>
              <LogoText
                size="sm"
                color={activeSection === 'HOME' ? 'var(--tea-gold)' : 'var(--tea-text-dim)'}
                className={`relative z-10 transition-all duration-300 scale-[1.08] ${themeFlash ? 'opacity-60' : ''}`}
              />
            </button>
          </div>

          {/* Right sections */}
          {rightSections.map((section, index) => (
            <div key={section.id} className="flex items-center h-full flex-1">
              {renderTabButton(section, index + leftSections.length + 1)}
            </div>
          ))}

          {/* Account button — shows for authenticated users, with admin badge for admins */}
          {auth.isAuthenticated && onAccountClick && (
            <div className="flex items-center h-full" style={{ flex: '0 0 48px' }}>
              <button
                onClick={onAccountClick}
                className="h-full flex flex-col items-center justify-center relative transition-all duration-300 group px-2 animate-[fadeIn_0.5s_ease-out]"
                title="Account"
              >
                <div className="relative flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  <Icons.User
                    className="text-tea-paper/60 w-5 h-5 group-hover:text-tea-paper/85 transition-all duration-300"
                    strokeWidth={2}
                  />
                  {auth.isAdmin && (
                    <div className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-tea-gold rounded-full border border-tea-surface dark:border-tea-surface" />
                  )}
                </div>
              </button>
            </div>
          )}
        </div>
      </nav>

    </>
  );
};
