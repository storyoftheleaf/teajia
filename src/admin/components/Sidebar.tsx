import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Leaf, Coffee, Receipt, Settings, FolderOpen, LogOut, User, History, UserCheck } from 'lucide-react';

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
  if (item.action) {
    return (
      <button
        onClick={item.action}
        className={`w-full flex items-center gap-4 px-4 py-3 text-sm transition-all duration-300 group ${
          isActive 
            ? 'text-tea-accent border-r-2 border-tea-accent bg-tea-surface/50' 
            : 'text-tea-muted hover:text-tea-text hover:pl-5'
        }`}
      >
        <div className={`transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>
          {item.icon}
        </div>
        <div className="flex-1 text-left relative">
          <span className={`font-serif tracking-wide ${isActive ? 'font-medium' : 'font-normal'}`}>
            {item.label}
          </span>
          {item.badge !== undefined && item.badge > 0 && (
              <span className="absolute -top-1 -right-2 bg-tea-surface border border-tea-border text-tea-muted text-[9px] min-w-[16px] h-4 px-1 flex items-center justify-center rounded-sm">
                {item.badge}
              </span>
          )}
        </div>
      </button>
    );
  }

  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3 text-sm transition-all duration-300 group ${
        isActive 
          ? 'text-tea-accent border-r-2 border-tea-accent bg-tea-surface/50' 
          : 'text-tea-muted hover:text-tea-text hover:pl-5'
      }`}
    >
      <div className={`transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>
        {item.icon}
      </div>
      <div className="flex-1 text-left relative">
        <span className={`font-serif tracking-wide ${isActive ? 'font-medium' : 'font-normal'}`}>
          {item.label}
        </span>
        {item.badge !== undefined && item.badge > 0 && (
            <span className="absolute -top-1 -right-2 bg-tea-surface border border-tea-border text-tea-muted text-[9px] min-w-[16px] h-4 px-1 flex items-center justify-center rounded-sm">
              {item.badge}
            </span>
        )}
      </div>
    </Link>
  );
};

export const Sidebar = ({ 
  isAdmin, 
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
    { id: 'catalog', path: '/admin/catalog', label: 'Tea Glossary', icon: <Leaf size={16} /> },
    { id: 'teaware', path: '/admin/teaware', label: 'Equipment', icon: <Coffee size={16} /> },
    { id: 'invoices', path: '#', label: 'Registry', icon: <Receipt size={16} />, badge: cartItemCount, action: onOpenCart },
  ];

  const adminItems: NavItem[] = [
    { id: 'inventory', path: '/admin/inventory', label: 'Master Inventory', icon: <Settings size={16} /> },
    { id: 'personal', path: '/admin/personal', label: 'Collection', icon: <UserCheck size={16} /> }, 
    { id: 'orders', path: '/admin/orders', label: 'Orders', icon: <History size={16} /> },
    { id: 'records', path: '/admin/records', label: 'Records & Logs', icon: <FolderOpen size={16} /> },
    { id: 'settings', path: '/admin/settings', label: 'Settings', icon: <Settings size={16} /> },
  ];

  const handleNav = () => {
    setIsMobileOpen(false);
  };

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-tea-surface/90 backdrop-blur-xl border-r border-tea-border transform transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 flex flex-col`}>
      <div className="p-8 pb-4">
        <h1 className="text-2xl font-serif tracking-widest text-tea-text">TEAJIA</h1>
        <div className="h-px w-8 bg-tea-accent/50 mt-4 mb-2"></div>
        <p className="text-[10px] text-tea-muted tracking-[0.2em] uppercase font-medium">Inventory System</p>
      </div>

      <nav className="flex-1 py-4 space-y-8 overflow-y-auto no-scrollbar">
        <div>
          <h3 className="px-4 text-[10px] font-bold text-tea-muted/50 uppercase tracking-[0.2em] mb-2 pl-4">Catalog</h3>
          {navItems.map((item) => (
            <NavButton key={item.id} item={item} isActive={currentPath === item.path || (currentPath === '/admin' && item.id === 'catalog')} onClick={handleNav} />
          ))}
        </div>

        {isAdmin && (
          <div>
            <h3 className="px-4 text-[10px] font-bold text-tea-muted/50 uppercase tracking-[0.2em] mb-2 pl-4">Admin</h3>
            {adminItems.map((item) => (
              <NavButton key={item.id} item={item} isActive={currentPath === item.path} onClick={handleNav} />
            ))}
          </div>
        )}

        <div className="pt-8 px-4 border-t border-tea-border space-y-4">
             <button 
              onClick={isAdmin ? onLogoutClick : onLoginClick}
              className="w-full flex items-center gap-3 px-2 text-tea-muted hover:text-tea-text transition-colors"
            >
              {isAdmin ? <LogOut size={16} /> : <User size={16} />}
              <span className="text-xs font-serif italic">{isAdmin ? 'Sign Out' : 'Admin Access'}</span>
            </button>

            <button 
              onClick={onToggleDevAdmin}
              className="w-full text-[10px] text-tea-muted/50 hover:text-tea-muted font-mono text-left pl-8"
            >
              {isDevAdmin ? '> DEV_MODE: ON' : '> DEV_MODE: OFF'}
            </button>
        </div>
      </nav>
    </div>
  );
};