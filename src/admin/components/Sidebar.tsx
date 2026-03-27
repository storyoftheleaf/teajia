import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, Calendar, LayoutDashboard, Package, Users, ClipboardList, Camera, Compass } from 'lucide-react';
import { LogoEmblem } from '../../components/Logos/LogoEmblem';
import { Icons } from '../../components/Icons';
import { useTheme } from '../../context/ThemeContext';


interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: React.ReactNode;
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
      <div className={`transition-colors duration-200 shrink-0 ${
        isActive
          ? 'text-tea-gold scale-110'
          : 'text-tea-text-sec group-hover:text-tea-text'
      }`}>
        {item.icon}
      </div>
      <span className={`text-sm font-semibold transition-colors duration-200 ${
        isActive ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-text'
      }`}>
        {item.label}
      </span>
      {item.badge !== undefined && item.badge > 0 && (
        <span className="ml-auto w-5 h-5 bg-tea-gold text-tea-bg text-[9px] font-bold rounded-full flex items-center justify-center shrink-0 mr-2">
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      )}
      {isActive && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-tea-gold rounded-l-full"></div>
      )}
    </>
  );

  const className = `relative flex items-center gap-3 px-4 py-3 rounded-md transition-colors duration-200 group animate-[fadeIn_0.5s_ease-out] focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none ${
    isActive ? 'bg-tea-gold/8' : 'hover:bg-tea-elevated/50'
  }`;

  if (item.action) {
    return (
      <button
        onClick={item.action}
        className={`w-full ${className}`}
        style={{ animationDelay: `${animationDelay}ms` }}
        aria-label={item.label}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={className}
      style={{ animationDelay: `${animationDelay}ms` }}
      aria-current={isActive ? 'page' : undefined}
    >
      {content}
    </Link>
  );
};

export const Sidebar = ({
  isAdmin,
  isLoggedIn,
  onLoginClick,
  onLogoutClick,
  isMobileOpen,
  setIsMobileOpen,
  cartItemCount,
  onOpenCart,
  onOpenPurchase
}: {
  isAdmin: boolean;
  isLoggedIn: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (v: boolean) => void;
  cartItemCount: number;
  onOpenCart: () => void;
  onOpenPurchase?: () => void;
}) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const { theme, toggleTheme } = useTheme();

  const browseItems: NavItem[] = [
    { id: 'read', path: '/magazine', label: 'Read', icon: <Icons.Magazine className="w-5 h-5" strokeWidth={2} /> },
    { id: 'learn', path: '/learn', label: 'Learn', icon: <Icons.School className="w-5 h-5" strokeWidth={2} /> },
    { id: 'consult', path: '/consult', label: 'Consult', icon: <Icons.Sparkles className="w-5 h-5" strokeWidth={2} /> },
    { id: 'shop', path: '/shop', label: 'Shop', icon: <Icons.Bag className="w-5 h-5" strokeWidth={2} /> },
  ];

  const adminItems: NavItem[] = [
    { id: 'dashboard', path: '/admin/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" strokeWidth={2} /> },
    { id: 'inventory', path: '/admin/inventory', label: 'Inventory', icon: <Package className="w-5 h-5" strokeWidth={2} /> },
    { id: 'activity', path: '/admin/activity', label: 'Activity', icon: <ClipboardList className="w-5 h-5" strokeWidth={2} /> },
    { id: 'people', path: '/admin/people', label: 'People', icon: <Users className="w-5 h-5" strokeWidth={2} /> },
    { id: 'events', path: '/admin/events', label: 'Events', icon: <Calendar className="w-5 h-5" strokeWidth={2} /> },
    { id: 'capture', path: '/admin/capture', label: 'Capture', icon: <Camera className="w-5 h-5" strokeWidth={2} /> },
    { id: 'compass', path: '/admin/compass', label: 'Tea Compass', icon: <Compass className="w-5 h-5" strokeWidth={2} /> },
  ];

  const handleNav = () => {
    setIsMobileOpen(false);
  };

  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 w-48 text-tea-text transform transition-transform duration-300 ease-in-out ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full'
      } md:relative md:translate-x-0 flex flex-col overflow-y-auto hide-scrollbar`}
      style={{
        background: 'linear-gradient(180deg, var(--tea-surface) 0%, var(--tea-bg) 100%)',
        boxShadow: 'inset -1px 0 0 var(--tea-accent-sub), 1px 0 8px rgba(0,0,0,0.08)'
      }}
    >
      {/* Logo/Brand */}
      <Link
        to="/"
        onClick={handleNav}
        className="h-20 flex items-center justify-start px-6 gap-3 animate-[fadeIn_0.5s_ease-out] transition-colors duration-200 group"
        style={{ boxShadow: '0 1px 0 var(--tea-border)' }}
      >
        <LogoEmblem
          size={36}
          color={theme === 'dark' ? 'var(--tea-text-sec)' : 'var(--tea-text)'}
          className="transition-opacity duration-200 shrink-0 opacity-80 group-hover:opacity-100"
        />
        <span className="text-lg text-tea-text tracking-wide" style={{ fontFamily: "var(--font-display)", fontWeight: 300 }}>Teajia</span>
      </Link>

      {/* Browse Navigation */}
      <nav className="flex flex-col py-6 gap-1 px-3" aria-label="Browse">
        <span className="text-[9px] uppercase tracking-[0.2em] text-tea-gold/50 font-sans font-medium px-4 py-2">Browse</span>
        {browseItems.map((item, index) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={currentPath === item.path}
            onClick={handleNav}
            animationDelay={index * 50}
          />
        ))}
      </nav>

      {/* Admin Navigation */}
      {isAdmin && (
        <nav className="flex flex-col gap-1 px-3 pt-2 pb-4" aria-label="Admin" style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub)' }}>
          <span className="text-[9px] uppercase tracking-[0.2em] text-tea-gold/50 font-sans font-medium px-4 py-2">Admin</span>
          {adminItems.map((item, index) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={currentPath === item.path || currentPath.startsWith(item.path + '/')}
              onClick={handleNav}
              animationDelay={(browseItems.length + index) * 50}
            />
          ))}
        </nav>
      )}

      {/* Flexible spacing */}
      <div className="flex-1" />

      {/* Close button */}
      <div className="py-4 px-3 md:hidden">
        <button
          onClick={() => setIsMobileOpen(false)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors duration-200 group hover:bg-tea-elevated/50 focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none"
          aria-label="Close sidebar"
        >
          <X className="transition-colors duration-200 text-tea-text-sec w-5 h-5 group-hover:text-tea-text shrink-0" strokeWidth={2} />
          <span className="text-sm font-semibold transition-colors duration-200 text-tea-text-sec group-hover:text-tea-text">
            Close
          </span>
        </button>
      </div>
    </div>
  );
};
