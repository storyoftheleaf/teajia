import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Leaf, Coffee, Receipt, Settings, FolderOpen, LogOut, User, History, UserCheck, ExternalLink, Users } from 'lucide-react';

interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  action?: () => void;
}

interface NavButtonProps {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ item, isActive, onClick }) => {
  const baseClass = `w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-all duration-200 group ${
    isActive
      ? 'text-tea-accent border-r-2 border-tea-accent bg-tea-surface/50'
      : 'text-tea-muted hover:text-tea-text hover:pl-4'
  }`;

  const content = (
    <>
      <div className={`transition-opacity duration-200 flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>
        {item.icon}
      </div>
      <div className="flex-1 text-left relative min-w-0">
        <span className={`tracking-wide ${isActive ? 'font-medium' : 'font-normal'}`}>
          {item.label}
        </span>
        {item.badge !== undefined && item.badge > 0 && (
          <span className="absolute -top-0.5 -right-1 bg-tea-surface border border-tea-border text-tea-muted text-[8px] min-w-[14px] h-3.5 px-0.5 flex items-center justify-center rounded-sm">
            {item.badge}
          </span>
        )}
      </div>
    </>
  );

  if (item.action) {
    return <button onClick={item.action} className={baseClass}>{content}</button>;
  }

  return <Link to={item.path} onClick={onClick} className={baseClass}>{content}</Link>;
};

export const Sidebar = ({
  isAdmin,
  isLoggedIn,
  onLoginClick,
  onLogoutClick,
  isMobileOpen,
  setIsMobileOpen,
  cartItemCount,
  isDevAdmin,
  onToggleDevAdmin,
  onOpenCart
}: {
  isAdmin: boolean;
  isLoggedIn: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (v: boolean) => void;
  cartItemCount: number;
  isDevAdmin: boolean;
  onToggleDevAdmin: () => void;
  onOpenCart: () => void;
}) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems: NavItem[] = [
    { id: 'catalog', path: '/admin/catalog', label: 'Glossary', icon: <Leaf size={14} /> },
    { id: 'teaware', path: '/admin/teaware', label: 'Teaware', icon: <Coffee size={14} /> },
    { id: 'invoices', path: '#', label: 'Registry', icon: <Receipt size={14} />, badge: cartItemCount, action: onOpenCart },
  ];

  const adminItems: NavItem[] = [
    { id: 'inventory', path: '/admin/inventory', label: 'Inventory', icon: <Settings size={14} /> },
    { id: 'customers', path: '/admin/customers', label: 'Clients', icon: <Users size={14} /> },
    { id: 'orders', path: '/admin/orders', label: 'Orders', icon: <History size={14} /> },
    { id: 'records', path: '/admin/records', label: 'Records', icon: <FolderOpen size={14} /> },
    { id: 'settings', path: '/admin/settings', label: 'Settings', icon: <Settings size={14} /> },
  ];

  const handleNav = () => {
    setIsMobileOpen(false);
  };

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-44 bg-tea-surface/90 backdrop-blur-xl border-r border-tea-border transform transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 flex flex-col`}>
      <div className="px-3 pt-4 pb-2">
        <h1 className="text-base font-serif tracking-widest text-tea-text">TEAJIA</h1>
        <div className="h-px w-6 bg-tea-accent/50 mt-1.5 mb-1"></div>
        <p className="text-[9px] text-tea-muted tracking-[0.2em] uppercase font-medium">Admin</p>
      </div>

      <nav className="flex-1 py-2 space-y-3 overflow-y-auto no-scrollbar">
        <div>
          <h3 className="px-3 text-[9px] font-bold text-tea-muted/50 uppercase tracking-[0.2em] mb-1">Catalog</h3>
          {navItems.map((item) => (
            <NavButton key={item.id} item={item} isActive={currentPath === item.path || (currentPath === '/admin' && item.id === 'catalog')} onClick={handleNav} />
          ))}
        </div>

        {isAdmin && (
          <div>
            <h3 className="px-3 text-[9px] font-bold text-tea-muted/50 uppercase tracking-[0.2em] mb-1">Admin</h3>
            {adminItems.map((item) => (
              <NavButton key={item.id} item={item} isActive={currentPath === item.path} onClick={handleNav} />
            ))}
          </div>
        )}

        <div className="pt-3 px-3 border-t border-tea-border space-y-1.5">
            <Link
              to="/"
              className="w-full flex items-center gap-2 px-1 text-tea-muted hover:text-tea-text transition-colors"
            >
              <ExternalLink size={13} />
              <span className="text-[11px] font-serif italic">Main Site</span>
            </Link>

             <button
              onClick={isLoggedIn ? onLogoutClick : onLoginClick}
              className="w-full flex items-center gap-2 px-1 text-tea-muted hover:text-tea-text transition-colors"
            >
              {isLoggedIn ? <LogOut size={13} /> : <User size={13} />}
              <span className="text-[11px] font-serif italic">{isLoggedIn ? 'Sign Out' : 'Sign In'}</span>
            </button>

            <button
              onClick={onToggleDevAdmin}
              className="w-full text-[9px] text-tea-muted/50 hover:text-tea-muted font-mono text-left pl-6"
            >
              {isDevAdmin ? '> DEV: ON' : '> DEV: OFF'}
            </button>
        </div>
      </nav>
    </div>
  );
};
