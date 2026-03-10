import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Leaf, Coffee, Receipt, Settings, FolderOpen, LogOut, User, History, UserCheck, ExternalLink, Users, Calendar } from 'lucide-react';
import { LogoEmblem } from '../../components/Logos/LogoEmblem';

function getCurrentSeason(): { name: string; icon: string } {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return { name: 'Spring', icon: '✧' };
  if (month >= 5 && month <= 7) return { name: 'Summer', icon: '☀' };
  if (month >= 8 && month <= 10) return { name: 'Autumn', icon: '☘' };
  return { name: 'Winter', icon: '❄' };
}

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
        <span className="ml-auto w-4 h-4 bg-tea-gold text-tea-bg text-[9px] font-bold rounded-full flex items-center justify-center shrink-0 mr-2">
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
};

export const Sidebar = ({
  isAdmin,
  isLoggedIn,
  onLoginClick,
  onLogoutClick,
  isMobileOpen,
  setIsMobileOpen,
  cartItemCount,
  onOpenCart
}: {
  isAdmin: boolean;
  isLoggedIn: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (v: boolean) => void;
  cartItemCount: number;
  onOpenCart: () => void;
}) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const season = getCurrentSeason();

  const navItems: NavItem[] = [
    { id: 'catalog', path: '/admin/catalog', label: 'Tea Glossary', icon: <Leaf size={20} strokeWidth={2} /> },
    { id: 'teaware', path: '/admin/teaware', label: 'Equipment', icon: <Coffee size={20} strokeWidth={2} /> },
    { id: 'invoices', path: '#', label: 'Registry', icon: <Receipt size={20} strokeWidth={2} />, badge: cartItemCount, action: onOpenCart },
  ];

  const adminItems: NavItem[] = [
    { id: 'inventory', path: '/admin/inventory', label: 'Master Inventory', icon: <Settings size={20} strokeWidth={2} /> },
    { id: 'customers', path: '/admin/customers', label: 'Customers', icon: <Users size={20} strokeWidth={2} /> },
    { id: 'events', path: '/admin/events', label: 'Events', icon: <Calendar size={20} strokeWidth={2} /> },
    { id: 'orders', path: '/admin/orders', label: 'Orders', icon: <History size={20} strokeWidth={2} /> },
    { id: 'records', path: '/admin/records', label: 'Records & Logs', icon: <FolderOpen size={20} strokeWidth={2} /> },
    { id: 'settings', path: '/admin/settings', label: 'Settings', icon: <Settings size={20} strokeWidth={2} /> },
  ];

  const handleNav = () => {
    setIsMobileOpen(false);
  };

  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 w-56 text-tea-text transform transition-transform duration-300 ease-in-out ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full'
      } md:relative md:translate-x-0 flex flex-col overflow-y-auto no-scrollbar`}
      style={{
        background: 'linear-gradient(180deg, var(--tea-surface) 0%, rgba(24,19,14,0.95) 100%)',
        boxShadow: 'inset -1px 0 0 rgba(200,170,120,0.06), 1px 0 8px rgba(0,0,0,0.15)'
      }}
    >
      {/* Logo/Brand */}
      <Link
        to="/admin"
        onClick={handleNav}
        className="h-20 flex items-center justify-start px-6 gap-3 animate-[fadeIn_0.5s_ease-out] transition-all duration-300 group"
        style={{ boxShadow: '0 1px 0 rgba(184,146,78,0.08)' }}
      >
        <LogoEmblem
          size={36}
          color="#c0b49a"
          className="transition-all duration-300 shrink-0 opacity-80 group-hover:opacity-100 group-hover:scale-105"
        />
        <div className="flex flex-col">
          <span className="text-lg text-tea-text tracking-wide" style={{ fontFamily: "var(--font-display)", fontWeight: 300 }}>Teajia</span>
          <span className="text-[9px] uppercase tracking-[0.15em] text-tea-gold/50 font-sans -mt-0.5">Inventory</span>
        </div>
      </Link>

      {/* Catalog Navigation */}
      <nav className="flex flex-col py-6 gap-1 px-3">
        <span className="text-[9px] uppercase tracking-[0.2em] text-tea-gold/50 font-sans font-medium px-4 py-2">Catalog</span>
        {navItems.map((item, index) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={currentPath === item.path || (currentPath === '/admin' && item.id === 'catalog')}
            onClick={handleNav}
            animationDelay={index * 50}
          />
        ))}
      </nav>

      {/* Admin Navigation */}
      {isAdmin && (
        <nav className="flex flex-col gap-1 px-3 pt-2 pb-4" style={{ boxShadow: 'inset 0 1px 0 rgba(184,146,78,0.06)' }}>
          <span className="text-[9px] uppercase tracking-[0.2em] text-tea-gold/50 font-sans font-medium px-4 py-2">Admin</span>
          {adminItems.map((item, index) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={currentPath === item.path}
              onClick={handleNav}
              animationDelay={(navItems.length + index) * 50}
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
      <div className="relative py-4 px-3" style={{ boxShadow: 'inset 0 1px 0 rgba(184,146,78,0.06)' }}>
        <div className="absolute top-0 left-6 w-6 h-[2px] bg-tea-gold/20"></div>

        <Link
          to="/"
          className="w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 group hover:bg-tea-elevated/50"
        >
          <ExternalLink className="text-tea-text-dim w-5 h-5 group-hover:text-tea-text transition-all duration-300 shrink-0" strokeWidth={2} />
          <span className="text-sm font-semibold text-tea-text-dim group-hover:text-tea-text transition-all duration-300">
            Main Site
          </span>
        </Link>

        <button
          onClick={isLoggedIn ? onLogoutClick : onLoginClick}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 group hover:bg-tea-elevated/50"
        >
          {isLoggedIn ? (
            <LogOut className="text-tea-text-dim w-5 h-5 group-hover:text-tea-text transition-all duration-300 shrink-0" strokeWidth={2} />
          ) : (
            <User className="text-tea-text-dim w-5 h-5 group-hover:text-tea-text transition-all duration-300 shrink-0" strokeWidth={2} />
          )}
          <span className="text-sm font-semibold text-tea-text-dim group-hover:text-tea-text transition-all duration-300">
            {isLoggedIn ? 'Sign Out' : 'Sign In'}
          </span>
        </button>
      </div>
    </div>
  );
};
