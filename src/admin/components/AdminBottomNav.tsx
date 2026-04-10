import React, { useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogoText } from '../../components/Logos';

interface AdminBottomNavProps {
  onSearchClick: () => void;
  onCartClick: () => void;
  cartItemCount: number;
  isMember: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  onAddProduct?: () => void;
}

export const AdminBottomNav: React.FC<AdminBottomNavProps> = ({
  isMember,
  isStaff,
  isAdmin,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  // Long-press logo → storefront, tap → admin home
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const handleLogoPointerDown = useCallback(() => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      navigate('/');
    }, 600);
  }, [navigate]);

  const handleLogoPointerUp = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  const handleLogoClick = useCallback(() => {
    if (!didLongPress.current) navigate('/admin/home');
  }, [navigate]);

  const isActive = (path: string) => {
    const base = path.split('?')[0];
    return location.pathname === base || location.pathname.startsWith(base + '/');
  };

  const renderTab = (tab: { id: string; label: string; path: string }) => {
    const active = isActive(tab.path);
    return (
      <div key={tab.id} className="flex items-center h-full flex-1">
        <button
          onClick={() => navigate(tab.path)}
          aria-current={active ? 'page' : undefined}
          aria-label={tab.label}
          className="flex-1 min-w-0 h-full flex items-center justify-center relative transition-all duration-300 group focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50 focus-visible:outline-none select-none"
          style={{ WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
        >
          <span
            className={`text-[16px] tracking-[0.04em] lowercase transition-all duration-300 pointer-events-none select-none ${
              active ? 'text-tea-gold font-bold' : 'text-tea-text-sec font-medium group-hover:text-tea-text'
            }`}
            style={{ fontFamily: 'var(--font-display)', WebkitUserSelect: 'none', userSelect: 'none' }}
          >
            {tab.label.toLowerCase()}
          </span>
        </button>
      </div>
    );
  };

  // ── Exactly 5 tabs per role tier (2 left + center + 2 right) ─────────────
  //
  // Admin:  Compass | Stock    | [茶] | Activity | Events
  // Staff:  Compass | Activity | [茶] | Events   | People
  // Member: Compass | Samples  | [茶] | Capture  | Events

  type Tab = { id: string; label: string; path: string };

  const [leftTabs, rightTabs] = ((): [Tab[], Tab[]] => {
    if (isAdmin) return [
      [{ id: 'compass',   label: 'Compass',  path: '/admin/compass' },
       { id: 'inventory', label: 'Stock',    path: '/admin/inventory' }],
      [{ id: 'activity',  label: 'Activity', path: '/admin/activity' },
       { id: 'events',    label: 'Events',   path: '/admin/events' }],
    ];
    if (isStaff) return [
      [{ id: 'compass',  label: 'Compass',  path: '/admin/compass' },
       { id: 'activity', label: 'Activity', path: '/admin/activity' }],
      [{ id: 'events',   label: 'Events',   path: '/admin/events' },
       { id: 'people',   label: 'People',   path: '/admin/people' }],
    ];
    // Member
    return [
      [{ id: 'compass', label: 'Compass', path: '/admin/compass' },
       { id: 'samples', label: 'Samples', path: '/admin/samples' }],
      [{ id: 'capture', label: 'Capture', path: '/admin/capture' },
       { id: 'events',  label: 'Events',  path: '/admin/events' }],
    ];
  })();


  const divider = <div className="w-px h-3 bg-tea-gold/10" />;

  return (
    <>
      <nav
        aria-label="Back of house navigation"
        className="flex lg:hidden fixed bottom-0 left-0 right-0 z-modal animate-[slideUp_0.4s_ease-out] transition-all duration-200 md:hidden border-t border-tea-border select-none"
        style={{
          background: 'rgb(var(--tea-bg-rgb, 24, 19, 14))',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
          height: 'calc(40px + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) * 0.45)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div className="flex items-center w-full px-0 h-full">
          {/* Left tabs */}
          {leftTabs.map((tab, i) => (
            <React.Fragment key={tab.id}>
              {i > 0 && divider}
              {renderTab(tab)}
            </React.Fragment>
          ))}

          {leftTabs.length > 0 && divider}

          {/* Center — home logo */}
          <div className="flex items-center h-full flex-1">
            <button
              onPointerDown={handleLogoPointerDown}
              onPointerUp={handleLogoPointerUp}
              onPointerLeave={handleLogoPointerUp}
              onClick={handleLogoClick}
              className="flex-1 h-full flex items-center justify-center relative transition-all duration-300 select-none"
              style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
              title="Home (hold to go to storefront)"
              aria-label="Admin home"
            >
              <LogoText
                size="sm"
                color={location.pathname === '/admin/home' ? 'var(--tea-gold)' : 'var(--tea-text-sec)'}
                className="transition-all duration-300 pointer-events-none"
              />
            </button>
          </div>

          {/* Right tabs */}
          {rightTabs.map((tab, i) => (
            <React.Fragment key={tab.id}>
              {divider}
              {renderTab(tab)}
            </React.Fragment>
          ))}

        </div>
      </nav>

    </>
  );
};

export default AdminBottomNav;
