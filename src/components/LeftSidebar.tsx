import React from 'react';
import { Icons } from './Icons';
import { LogoEmblem } from './Logos';
import { Section } from '../types';
import { getNavIcon, getIconScale } from './navIconConfig';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';

function getCurrentSeason(): { name: string; icon: string } {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return { name: 'Spring', icon: '\u2727' };
  if (month >= 5 && month <= 7) return { name: 'Summer', icon: '\u2600' };
  if (month >= 8 && month <= 10) return { name: 'Autumn', icon: '\u2618' };
  return { name: 'Winter', icon: '\u2744' };
}

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
  const auth = useAuth();
  const season = getCurrentSeason();

  const sections = [
    { id: 'MAGAZINE' as Section, label: 'Read' },
    { id: 'LEARN' as Section, label: 'Learn' },
    { id: 'OFFERINGS' as Section, label: 'Consult' },
    { id: 'SHOP' as Section, label: 'Shop' },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-20 xl:w-56 bg-tea-surface  text-tea-text border-r border-tea-border h-screen fixed top-0 left-0 overflow-y-auto no-scrollbar transition-all duration-300 z-40">
      {/* Logo/Brand - Home Button */}
      <button
        onClick={() => onNavigate('HOME')}
        className={`h-20 flex items-center justify-center xl:justify-start xl:px-6 xl:gap-3 border-b border-tea-border animate-[fadeIn_0.5s_ease-out] transition-all duration-300 group relative ${
          activeSection === 'HOME' ? 'bg-tea-gold/8' : 'hover:bg-tea-elevated/50'
        }`}
        title="Home"
      >
        <LogoEmblem
          size={36}
          color={theme === 'dark' ? '#c0b49a' : '#010101'}
          className={`transition-all duration-300 shrink-0 ${
            activeSection === 'HOME'
              ? 'scale-110 opacity-100'
              : 'opacity-80 group-hover:opacity-100 group-hover:scale-105'
          }`}
        />
        <span className="hidden xl:block font-serif text-lg text-tea-text tracking-wide">Teajia</span>
        {activeSection === 'HOME' && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-tea-gold rounded-l-full animate-[slideIn_0.3s_ease-out]"></div>
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
              className={`relative flex flex-col xl:flex-row items-center gap-2 xl:gap-3 px-2 xl:px-4 py-4 xl:py-3 rounded-md transition-all duration-300 group animate-[fadeIn_0.5s_ease-out] min-h-[56px] xl:min-h-0 focus-visible:outline-2 focus-visible:outline-tea-gold focus-visible:outline-offset-2 focus-visible:ring-4 focus-visible:ring-tea-gold/20 ${
                isActive ? 'xl:bg-tea-gold/8' : 'xl:hover:bg-tea-elevated/50'
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
              title={section.label}
              aria-label={section.label}
            >
              <IconComponent
                className={`transition-all duration-300 shrink-0 ${
                  isActive
                    ? 'text-tea-gold w-5 h-5 scale-110'
                    : 'text-tea-text-dim w-5 h-5 group-hover:text-tea-text group-hover:scale-105'
                }`}
                strokeWidth={2}
                {...(isActive ? { fill: 'currentColor' } : {})}
                style={scale !== 1 ? { transform: `scale(${scale})` } : undefined}
              />
              <span className={`text-xs xl:text-sm font-semibold mt-2 xl:mt-0 transition-all duration-300 text-center xl:text-left ${
                isActive ? 'text-tea-gold' : 'text-tea-text-dim group-hover:text-tea-text'
              }`}>
                {section.label}
              </span>
              {isActive && (
                <div className="hidden xl:block absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-tea-gold rounded-l-full"></div>
              )}
              {/* Hover tooltip for compact sidebar (lg only) */}
              <div className="xl:hidden absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-tea-surface text-tea-text text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap shadow-lg z-50">
                {section.label}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Admin Navigation — visible only for admin users */}
      {auth.isAuthenticated && auth.isAdmin && (
        <nav className="flex flex-col items-center xl:items-stretch px-0 xl:px-3 pt-2 pb-4 border-t border-tea-border">
          <span className="hidden xl:block text-[9px] uppercase tracking-[0.2em] text-tea-gold/50 font-sans font-medium px-4 py-2">Admin</span>
          {[
            { path: '/admin/inventory', label: 'Inventory', Icon: Icons.Settings },
            { path: '/admin/personal', label: 'Collection', Icon: Icons.Heart },
            { path: '/admin/orders', label: 'Orders', Icon: Icons.Clock },
            { path: '/admin/records', label: 'Records', Icon: Icons.BookOpen },
          ].map((item) => (
            <a
              key={item.path}
              href={item.path}
              className="relative flex flex-col xl:flex-row items-center gap-2 xl:gap-3 px-2 xl:px-4 py-3 xl:py-2.5 rounded-md transition-all duration-300 group min-h-[48px] xl:min-h-0 xl:hover:bg-tea-gold/8"
              title={item.label}
            >
              <item.Icon
                className="text-tea-gold/60 w-4 h-4 group-hover:text-tea-gold transition-all duration-300 shrink-0"
                strokeWidth={2}
              />
              <span className="text-[10px] xl:text-xs font-semibold mt-1 xl:mt-0 transition-all duration-300 text-center xl:text-left text-tea-gold/60 group-hover:text-tea-gold">
                {item.label}
              </span>
            </a>
          ))}
        </nav>
      )}

      {/* Flexible spacing */}
      <div className="flex-1" />

      {/* Seasonal indicator — xl only */}
      <div className="hidden xl:flex items-center gap-2 px-6 py-3 text-tea-gold/40">
        <span className="text-sm">{season.icon}</span>
        <span className="text-[10px] uppercase tracking-[0.2em] font-sans">{season.name} {new Date().getFullYear()}</span>
      </div>

      {/* Utility Area - Cart & Account at Bottom */}
      <div className="border-t border-tea-border relative py-4 xl:px-3">
        {/* Decorative seal accent on the border */}
        <div className="hidden xl:block absolute top-0 left-6 w-6 h-[2px] bg-tea-gold/20"></div>
        <button
          onClick={onCartClick}
          className="w-full flex flex-col xl:flex-row items-center gap-2 xl:gap-3 px-2 xl:px-4 py-4 xl:py-3 rounded-md transition-all duration-300 group relative min-h-[56px] xl:min-h-0 xl:hover:bg-tea-elevated/50"
          title="Cart"
          aria-label="Open shopping cart"
        >
          <div className="relative shrink-0">
            <Icons.Bag
              className="transition-all duration-300 text-tea-text-dim w-5 h-5 group-hover:text-tea-text group-hover:scale-105"
              strokeWidth={2}
            />
            {cartItemCount > 0 && (
              <div className="absolute -top-2 -right-3 w-4 h-4 bg-tea-gold text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {cartItemCount > 9 ? '9+' : cartItemCount}
              </div>
            )}
          </div>
          <span className="text-xs xl:text-sm font-semibold mt-2 xl:mt-0 transition-all duration-300 text-center xl:text-left text-tea-text-dim group-hover:text-tea-text">
            Cart
          </span>
        </button>
        <button
          onClick={onAccountClick}
          className={`w-full flex flex-col xl:flex-row items-center gap-2 xl:gap-3 px-2 xl:px-4 py-4 xl:py-3 rounded-md transition-all duration-300 group relative min-h-[56px] xl:min-h-0 xl:hover:bg-tea-elevated/50`}
          title="Account"
          aria-label="Open account settings"
        >
          <Icons.User
            className={`transition-all duration-300 shrink-0 ${
              activeSection === 'ACCOUNT'
                ? 'text-tea-gold w-5 h-5 scale-110'
                : 'text-tea-text-dim w-5 h-5 group-hover:text-tea-text group-hover:scale-105'
            }`}
            strokeWidth={2}
            {...(activeSection === 'ACCOUNT' ? { fill: 'currentColor' } : {})}
          />
          <span className={`text-xs xl:text-sm font-semibold mt-2 xl:mt-0 transition-all duration-300 text-center xl:text-left ${
            activeSection === 'ACCOUNT' ? 'text-tea-gold' : 'text-tea-text-dim group-hover:text-tea-text'
          }`}>
            Account
          </span>
        </button>
        <button
          onClick={(e) => toggleTheme(e)}
          className="w-full flex flex-col xl:flex-row items-center gap-2 xl:gap-3 px-2 xl:px-4 py-4 xl:py-3 rounded-md transition-all duration-300 group relative min-h-[56px] xl:min-h-0 xl:hover:bg-tea-elevated/50"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Icons.Sun className="transition-all duration-300 text-tea-text-dim w-5 h-5 group-hover:text-tea-text group-hover:scale-105 shrink-0" strokeWidth={2} />
          ) : (
            <Icons.Moon className="transition-all duration-300 text-tea-text-dim w-5 h-5 group-hover:text-tea-text group-hover:scale-105 shrink-0" strokeWidth={2} />
          )}
          <span className="text-xs xl:text-sm font-semibold mt-2 xl:mt-0 transition-all duration-300 text-center xl:text-left text-tea-text-dim group-hover:text-tea-text">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </span>
        </button>
      </div>
    </aside>
  );
};
