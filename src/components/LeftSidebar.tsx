import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icons } from './Icons';
import { LogoEmblem } from './Logos';
import { Section } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { Leaf, Coffee, Receipt, Settings, FolderOpen, Users, History, Calendar } from 'lucide-react';

function getCurrentSeason(): { name: string; icon: string } {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return { name: 'Spring', icon: '✧' };
  if (month >= 5 && month <= 7) return { name: 'Summer', icon: '☀' };
  if (month >= 8 && month <= 10) return { name: 'Autumn', icon: '☘' };
  return { name: 'Winter', icon: '❄' };
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  section?: Section;
  path?: string;
  badge?: number;
  action?: () => void;
}

const NavButton: React.FC<{
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  animationDelay?: number;
}> = ({ item, isActive, onClick, animationDelay = 0 }) => {
  const content = (
    <>
      <div className={`transition-all duration-300 shrink-0 ${
        isActive
          ? 'text-tea-gold scale-110'
          : 'text-tea-text-dim group-hover:text-tea-text group-hover:scale-105'
      }`}>
        {item.icon}
      </div>
      <span className={`text-sm font-semibold transition-all duration-300 ${
        isActive ? 'text-tea-gold' : 'text-tea-text-dim group-hover:text-tea-text'
      }`}>
        {item.label}
      </span>
      {item.badge !== undefined && item.badge > 0 && (
        <span className="ml-auto w-4 h-4 bg-tea-gold text-white text-[9px] font-bold rounded-full flex items-center justify-center shrink-0 mr-2">
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      )}
      {isActive && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-tea-gold rounded-l-full"></div>
      )}
    </>
  );

  const className = `relative flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 group animate-[fadeIn_0.5s_ease-out] ${
    isActive ? 'bg-tea-gold/8' : 'hover:bg-tea-elevated/50'
  }`;

  if (item.action) {
    return (
      <button
        onClick={item.action}
        className={`w-full ${className}`}
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {content}
      </button>
    );
  }

  if (item.path) {
    return (
      <Link
        to={item.path}
        onClick={onClick}
        className={className}
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full ${className}`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {content}
    </button>
  );
};

interface LeftSidebarProps {
  activeSection: Section;
  onNavigate: (section: Section) => void;
  onAccountClick?: () => void;
  onCartClick?: () => void;
  onSearchClick?: () => void;
  cartItemCount?: number;
  topOffset?: boolean;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeSection,
  onNavigate,
  onAccountClick,
  onCartClick,
  onSearchClick,
  cartItemCount = 0,
  topOffset = false
}) => {
  const { theme, toggleTheme } = useTheme();
  const auth = useAuth();
  const season = getCurrentSeason();
  const location = useLocation();
  const currentPath = location.pathname;

  const browseItems: NavItem[] = [
    { id: 'MAGAZINE', label: 'Read', icon: <Icons.Magazine className="w-5 h-5" strokeWidth={2} />, section: 'MAGAZINE' as Section },
    { id: 'LEARN', label: 'Learn', icon: <Icons.School className="w-5 h-5" strokeWidth={2} />, section: 'LEARN' as Section },
    { id: 'OFFERINGS', label: 'Consult', icon: <Icons.Sparkles className="w-5 h-5" strokeWidth={2} />, section: 'OFFERINGS' as Section },
    { id: 'SHOP', label: 'Shop', icon: <Icons.Bag className="w-5 h-5" strokeWidth={2} />, section: 'SHOP' as Section },
  ];

  const catalogItems: NavItem[] = [
    { id: 'catalog', label: 'Tea Glossary', icon: <Leaf size={20} strokeWidth={2} />, path: '/admin/catalog' },
    { id: 'teaware', label: 'Equipment', icon: <Coffee size={20} strokeWidth={2} />, path: '/admin/teaware' },
    { id: 'invoices', label: 'Registry', icon: <Receipt size={20} strokeWidth={2} />, badge: cartItemCount, action: onCartClick },
  ];

  const adminItems: NavItem[] = [
    { id: 'inventory', label: 'Master Inventory', icon: <Settings size={20} strokeWidth={2} />, path: '/admin/inventory' },
    { id: 'customers', label: 'Customers', icon: <Users size={20} strokeWidth={2} />, path: '/admin/customers' },
    { id: 'events', label: 'Events', icon: <Calendar size={20} strokeWidth={2} />, path: '/admin/events' },
    { id: 'orders', label: 'Orders', icon: <History size={20} strokeWidth={2} />, path: '/admin/orders' },
    { id: 'records', label: 'Records & Logs', icon: <FolderOpen size={20} strokeWidth={2} />, path: '/admin/records' },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} strokeWidth={2} />, path: '/admin/settings' },
  ];

  return (
    <aside
      className={`hidden lg:flex flex-col w-56 text-tea-text fixed left-0 overflow-y-auto no-scrollbar transition-all duration-300 z-40 ${topOffset ? 'top-9 h-[calc(100vh-2.25rem)]' : 'top-0 h-screen'}`}
      style={{
        background: 'linear-gradient(180deg, var(--tea-surface) 0%, rgba(24,19,14,0.95) 100%)',
        boxShadow: 'inset -1px 0 0 var(--tea-accent-sub), 1px 0 8px rgba(0,0,0,0.15)'
      }}
    >
      {/* Logo/Brand - Home Button */}
      <button
        onClick={() => onNavigate('HOME')}
        className={`h-20 flex items-center justify-start px-6 gap-3 animate-[fadeIn_0.5s_ease-out] transition-all duration-300 group ${
          activeSection === 'HOME' ? 'bg-tea-gold/8' : 'hover:bg-tea-elevated/50'
        }`}
        title="Home"
        style={{ boxShadow: '0 1px 0 var(--tea-border)' }}
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
        <span className="text-lg text-tea-text tracking-wide" style={{ fontFamily: "var(--font-display)", fontWeight: 300 }}>Teajia</span>
        {activeSection === 'HOME' && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-tea-gold rounded-l-full animate-[slideIn_0.3s_ease-out]"></div>
        )}
      </button>

      {/* Search Button */}
      <div className="px-3 pt-4 pb-1">
        <button
          onClick={onSearchClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-md transition-all duration-300 group hover:bg-tea-elevated/50 border border-tea-border"
          title="Search (Ctrl+K)"
        >
          <Icons.Search className="w-4 h-4 text-tea-text-dim group-hover:text-tea-text transition-colors duration-300 shrink-0" strokeWidth={2} />
          <span className="text-sm text-tea-text-dim group-hover:text-tea-text transition-colors duration-300">Search...</span>
          <kbd className="ml-auto text-[10px] text-tea-text-dim border border-tea-border rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
        </button>
      </div>

      {/* Browse Navigation */}
      <nav className="flex flex-col py-6 gap-1 px-3">
        <span className="text-[9px] uppercase tracking-[0.2em] text-tea-gold/50 font-sans font-medium px-4 py-2">Browse</span>
        {browseItems.map((item, index) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activeSection === item.section}
            onClick={() => item.section && onNavigate(item.section)}
            animationDelay={index * 50}
          />
        ))}
      </nav>

      {/* Catalog Navigation — visible only for admin users */}
      {auth.isAuthenticated && auth.isAdmin && (
        <nav className="flex flex-col gap-1 px-3 pt-2 pb-4" style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub)' }}>
          <span className="text-[9px] uppercase tracking-[0.2em] text-tea-gold/50 font-sans font-medium px-4 py-2">Catalog</span>
          {catalogItems.map((item, index) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={currentPath === item.path}
              onClick={() => {}}
              animationDelay={(browseItems.length + index) * 50}
            />
          ))}
        </nav>
      )}

      {/* Admin Navigation — visible only for admin users */}
      {auth.isAuthenticated && auth.isAdmin && (
        <nav className="flex flex-col gap-1 px-3 pt-2 pb-4" style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub)' }}>
          <span className="text-[9px] uppercase tracking-[0.2em] text-tea-gold/50 font-sans font-medium px-4 py-2">Admin</span>
          {adminItems.map((item, index) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={currentPath === item.path}
              onClick={() => {}}
              animationDelay={(browseItems.length + catalogItems.length + index) * 50}
            />
          ))}
        </nav>
      )}

      {/* Flexible spacing */}
      <div className="flex-1" />

      {/* Seasonal indicator */}
      <div className="flex items-center gap-2 px-6 py-3 text-tea-gold/40">
        <span className="text-sm">{season.icon}</span>
        <span className="text-[10px] uppercase tracking-[0.2em] font-sans">{season.name} {new Date().getFullYear()}</span>
      </div>

      {/* Utility Area */}
      <div className="relative py-4 px-3" style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub)' }}>
        <div className="absolute top-0 left-6 w-6 h-[2px] bg-tea-gold/20"></div>

        <button
          onClick={onCartClick}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 group hover:bg-tea-elevated/50"
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
          <span className="text-sm font-semibold transition-all duration-300 text-tea-text-dim group-hover:text-tea-text">
            Cart
          </span>
        </button>

        <button
          onClick={onAccountClick}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 group hover:bg-tea-elevated/50"
        >
          <Icons.User
            className={`transition-all duration-300 shrink-0 ${
              activeSection === 'ACCOUNT'
                ? 'text-tea-gold w-5 h-5 scale-110'
                : 'text-tea-text-dim w-5 h-5 group-hover:text-tea-text group-hover:scale-105'
            }`}
            strokeWidth={2}
          />
          <span className={`text-sm font-semibold transition-all duration-300 ${
            activeSection === 'ACCOUNT' ? 'text-tea-gold' : 'text-tea-text-dim group-hover:text-tea-text'
          }`}>
            Account
          </span>
        </button>

        <button
          onClick={(e) => toggleTheme(e)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 group hover:bg-tea-elevated/50"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Icons.Sun className="transition-all duration-300 text-tea-text-dim w-5 h-5 group-hover:text-tea-text group-hover:scale-105 shrink-0" strokeWidth={2} />
          ) : (
            <Icons.Moon className="transition-all duration-300 text-tea-text-dim w-5 h-5 group-hover:text-tea-text group-hover:scale-105 shrink-0" strokeWidth={2} />
          )}
          <span className="text-sm font-semibold transition-all duration-300 text-tea-text-dim group-hover:text-tea-text">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </span>
        </button>
      </div>
    </aside>
  );
};
