import React from 'react';
import { Icons } from './Icons';
import { LogoEmblem } from './Logos';
import { Section } from '../types';
import { getNavIcon, getIconScale } from './navIconConfig';
import { useTheme } from '../context/ThemeContext';

interface LeftSidebarProps {
  activeSection: Section;
  onNavigate: (section: Section) => void;
  onAccountClick?: () => void;
  onCartClick?: () => void;
  cartItemCount?: number;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeSection,
  onNavigate,
  onAccountClick,
  onCartClick,
  cartItemCount = 0
}) => {
  const { theme, toggleTheme } = useTheme();

  const sections = [
    { id: 'MAGAZINE' as Section, label: 'Read' },
    { id: 'LEARN' as Section, label: 'Learn' },
    { id: 'OFFERINGS' as Section, label: 'Consult' },
    { id: 'SHOP' as Section, label: 'Shop' },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-20 xl:w-56 bg-[#FFFDF5] dark:bg-tea-ink text-tea-ink dark:text-tea-paper border-r border-tea-ink/10 dark:border-white/10 h-screen fixed top-0 left-0 overflow-y-auto no-scrollbar transition-all duration-300 z-40">
      {/* Logo/Brand - Home Button */}
      <button
        onClick={() => onNavigate('HOME')}
        className={`h-20 flex items-center justify-center xl:justify-start xl:px-6 xl:gap-3 border-b border-tea-ink/10 dark:border-white/10 animate-[fadeIn_0.5s_ease-out] transition-all duration-300 group relative ${
          activeSection === 'HOME' ? 'bg-tea-seal/8' : 'hover:bg-white/30 dark:hover:bg-white/5'
        }`}
        title="Home"
      >
        <LogoEmblem
          size={36}
          className={`transition-all duration-300 shrink-0 ${
            activeSection === 'HOME'
              ? 'scale-110 opacity-100'
              : 'opacity-80 group-hover:opacity-100 group-hover:scale-105'
          }`}
        />
        <span className="hidden xl:block font-serif text-lg text-tea-ink dark:text-tea-paper tracking-wide">Teajia</span>
        {activeSection === 'HOME' && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-tea-seal rounded-l-full animate-[slideIn_0.3s_ease-out]"></div>
        )}
      </button>

      {/* Navigation Items */}
      <nav className="flex flex-col items-center xl:items-stretch py-8 gap-2 xl:px-3">
        {sections.map((section, index) => {
          const IconComponent = getNavIcon(section.id);
          const isActive = activeSection === section.id;
          const scale = getIconScale(section.id);

          return (
            <button
              key={section.id}
              onClick={() => onNavigate(section.id)}
              className={`relative flex flex-col xl:flex-row items-center gap-2 xl:gap-3 px-2 xl:px-4 py-4 xl:py-3 rounded-md transition-all duration-300 group animate-[fadeIn_0.5s_ease-out] min-h-[56px] xl:min-h-0 focus-visible:outline-2 focus-visible:outline-tea-seal focus-visible:outline-offset-2 focus-visible:ring-4 focus-visible:ring-tea-seal/20 ${
                isActive ? 'xl:bg-tea-seal/8' : 'xl:hover:bg-tea-ink/5 xl:dark:hover:bg-white/5'
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
              title={section.label}
              aria-label={section.label}
            >
              <IconComponent
                className={`transition-all duration-300 shrink-0 ${
                  isActive
                    ? 'text-tea-seal w-5 h-5 scale-110'
                    : 'text-tea-ink/40 dark:text-tea-paper/60 w-5 h-5 group-hover:text-tea-ink dark:group-hover:text-tea-paper group-hover:scale-105'
                }`}
                strokeWidth={2}
                {...(isActive ? { fill: 'currentColor' } : {})}
                style={scale !== 1 ? { transform: `scale(${scale})` } : undefined}
              />
              <span className={`text-xs xl:text-sm font-semibold mt-2 xl:mt-0 transition-all duration-300 text-center xl:text-left ${
                isActive ? 'text-tea-seal' : 'text-tea-ink/40 dark:text-tea-paper/60 group-hover:text-tea-ink dark:group-hover:text-tea-paper'
              }`}>
                {section.label}
              </span>
              {isActive && (
                <div className="hidden xl:block absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-tea-seal rounded-l-full"></div>
              )}
              {/* Hover tooltip for compact sidebar (lg only) */}
              <div className="xl:hidden absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-tea-ink dark:bg-tea-paper text-tea-paper dark:text-tea-ink text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap shadow-lg z-50">
                {section.label}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Flexible spacing */}
      <div className="flex-1" />

      {/* Utility Area - Cart & Account at Bottom */}
      <div className="border-t border-tea-ink/10 dark:border-white/10 py-4 xl:px-3">
        <button
          onClick={onCartClick}
          className="w-full flex flex-col xl:flex-row items-center gap-2 xl:gap-3 px-2 xl:px-4 py-4 xl:py-3 rounded-md transition-all duration-300 group relative min-h-[56px] xl:min-h-0 xl:hover:bg-tea-ink/5 xl:dark:hover:bg-white/5"
          title="Cart"
          aria-label="Open shopping cart"
        >
          <div className="relative shrink-0">
            <Icons.Bag
              className="transition-all duration-300 text-tea-ink/40 dark:text-tea-paper/60 w-5 h-5 group-hover:text-tea-ink dark:group-hover:text-tea-paper group-hover:scale-105"
              strokeWidth={2}
            />
            {cartItemCount > 0 && (
              <div className="absolute -top-2 -right-3 w-4 h-4 bg-tea-seal text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {cartItemCount > 9 ? '9+' : cartItemCount}
              </div>
            )}
          </div>
          <span className="text-xs xl:text-sm font-semibold mt-2 xl:mt-0 transition-all duration-300 text-center xl:text-left text-tea-ink/40 dark:text-tea-paper/60 group-hover:text-tea-ink dark:group-hover:text-tea-paper">
            Cart
          </span>
        </button>
        <button
          onClick={onAccountClick}
          className={`w-full flex flex-col xl:flex-row items-center gap-2 xl:gap-3 px-2 xl:px-4 py-4 xl:py-3 rounded-md transition-all duration-300 group relative min-h-[56px] xl:min-h-0 xl:hover:bg-tea-ink/5 xl:dark:hover:bg-white/5`}
          title="Account"
          aria-label="Open account settings"
        >
          <Icons.User
            className={`transition-all duration-300 shrink-0 ${
              activeSection === 'ACCOUNT'
                ? 'text-tea-seal w-5 h-5 scale-110'
                : 'text-tea-ink/40 dark:text-tea-paper/60 w-5 h-5 group-hover:text-tea-ink dark:group-hover:text-tea-paper group-hover:scale-105'
            }`}
            strokeWidth={2}
            {...(activeSection === 'ACCOUNT' ? { fill: 'currentColor' } : {})}
          />
          <span className={`text-xs xl:text-sm font-semibold mt-2 xl:mt-0 transition-all duration-300 text-center xl:text-left ${
            activeSection === 'ACCOUNT' ? 'text-tea-seal' : 'text-tea-ink/40 dark:text-tea-paper/60 group-hover:text-tea-ink dark:group-hover:text-tea-paper'
          }`}>
            Account
          </span>
        </button>
        <button
          onClick={(e) => toggleTheme(e)}
          className="w-full flex flex-col xl:flex-row items-center gap-2 xl:gap-3 px-2 xl:px-4 py-4 xl:py-3 rounded-md transition-all duration-300 group relative min-h-[56px] xl:min-h-0 xl:hover:bg-tea-ink/5 xl:dark:hover:bg-white/5"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Icons.Sun className="transition-all duration-300 text-tea-ink/40 dark:text-tea-paper/60 w-5 h-5 group-hover:text-tea-ink dark:group-hover:text-tea-paper group-hover:scale-105 shrink-0" strokeWidth={2} />
          ) : (
            <Icons.Moon className="transition-all duration-300 text-tea-ink/40 dark:text-tea-paper/60 w-5 h-5 group-hover:text-tea-ink dark:group-hover:text-tea-paper group-hover:scale-105 shrink-0" strokeWidth={2} />
          )}
          <span className="text-xs xl:text-sm font-semibold mt-2 xl:mt-0 transition-all duration-300 text-center xl:text-left text-tea-ink/40 dark:text-tea-paper/60 group-hover:text-tea-ink dark:group-hover:text-tea-paper">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </span>
        </button>
      </div>
    </aside>
  );
};
