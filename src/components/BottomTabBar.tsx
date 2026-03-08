import React from 'react';
import { Icons } from './Icons';
import { LogoEmblem, LogoText } from './Logos';
import { Section } from '../types';
import { NAV_ONBOARDING_MESSAGES } from '../constants';
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
  const { toggleTheme } = useTheme();
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

  const [showOnboarding, setShowOnboarding] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('teajia_nav_onboarded');
  });
  React.useEffect(() => {
    if (showOnboarding) {
      const timer = setTimeout(() => {
        setShowOnboarding(false);
        localStorage.setItem('teajia_nav_onboarded', 'true');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showOnboarding]);

  const leftSections = [
    { id: 'MAGAZINE' as Section, label: 'Read', hint: NAV_ONBOARDING_MESSAGES.magazine },
    { id: 'LEARN' as Section, label: 'Learn', hint: NAV_ONBOARDING_MESSAGES.learn },
  ];

  const rightSections = [
    { id: 'OFFERINGS' as Section, label: 'Consult', hint: NAV_ONBOARDING_MESSAGES.offerings },
    { id: 'SHOP' as Section, label: 'Shop', hint: NAV_ONBOARDING_MESSAGES.shop },
  ];

  const renderTabButton = (section: { id: Section; label: string; hint: string }, index: number) => {
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
                ? 'text-tea-seal w-5 h-5 scale-110 origin-center'
                : 'text-tea-ink/40 dark:text-tea-paper/60 w-5 h-5 group-hover:text-tea-ink/60 dark:group-hover:text-tea-paper/85'
            }`}
            strokeWidth={2}
            {...(isActive ? { fill: 'currentColor' } : {})}
            style={scale !== 1 ? { transform: `scale(${scale})` } : undefined}
          />

        </div>

        {/* Label */}
        <span className={`text-[10px] font-sans uppercase tracking-widest font-medium mt-1 transition-all duration-300 text-center truncate px-1 relative z-10 ${
          isActive ? 'text-tea-seal' : 'text-tea-ink/40 dark:text-tea-paper/60 group-hover:text-tea-ink/60 dark:group-hover:text-tea-paper/85'
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
        className={`flex lg:hidden fixed bottom-0 left-0 right-0 bg-[#FFFDF5]/80 dark:bg-tea-ink/80 backdrop-blur-xl z-[65] animate-[slideUp_0.4s_ease-out] transition-all duration-200 pb-[env(safe-area-inset-bottom)] ${
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
                  color={activeSection === 'HOME' ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.15)'}
                  className={`transition-all duration-300 ${themeFlash ? 'scale-125 opacity-50' : ''}`}
                />
              </div>
              <LogoText
                size="sm"
                color={activeSection === 'HOME' ? '#7A2E2E' : '#8B7D6B'}
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
                    className="text-tea-ink/40 dark:text-tea-paper/60 w-5 h-5 group-hover:text-tea-ink/60 dark:group-hover:text-tea-paper/85 transition-all duration-300"
                    strokeWidth={2}
                  />
                  {auth.isAdmin && (
                    <div className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-tea-seal rounded-full border border-[#FFFDF5] dark:border-tea-ink" />
                  )}
                </div>
              </button>
            </div>
          )}
        </div>
      </nav>

    {/* Mobile Navigation Onboarding Tutorial */}
    {showOnboarding && (
      <div className="fixed bottom-24 left-0 right-0 z-50 flex items-center justify-center px-4 animate-[slideUp_0.3s_ease-out]">
        <div className="bg-tea-ink text-tea-paper rounded-sm shadow-2xl p-4 max-w-xs animate-[pulse_2s_ease-in-out_infinite]">
          <div className="flex items-start gap-3">
            <Icons.Info className="w-5 h-5 text-tea-seal flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-serif mb-1">Navigate with ease</p>
              <p className="text-xs text-tea-paper/70">Tap the logo in the center to go home, or explore Magazine, Learn, Offerings, and Shop</p>
            </div>
            <button
              onClick={() => setShowOnboarding(false)}
              className="text-tea-paper/50 hover:text-tea-paper p-1"
              aria-label="Dismiss"
            >
              <Icons.Close className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )}

    </>
  );
};
