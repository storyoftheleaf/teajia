import React, { useState, useEffect } from 'react';
import { Icons } from '../Icons';
import { useScrollDirection } from '../../hooks/useScrollDirection';
import { useTheme } from '../../context/ThemeContext';

interface PageHeaderProps {
  children?: React.ReactNode;
  title?: string;
  rightContent?: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
  onBack?: () => void;
  backLabel?: string;
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  children,
  title,
  rightContent,
  toolbar,
  className = '',
  onBack,
  backLabel,
  onCartClick,
  onAccountClick,
  cartItemCount = 0
}) => {
  const { progress, isAtTop } = useScrollDirection();
  const { theme, toggleTheme } = useTheme();
  const [badgeAnimating, setBadgeAnimating] = useState(false);
  const prevCountRef = React.useRef(cartItemCount);

  // Trigger pulse when cart count increases
  useEffect(() => {
    if (cartItemCount > prevCountRef.current) {
      setBadgeAnimating(true);
      const t = setTimeout(() => setBadgeAnimating(false), 400);
      return () => clearTimeout(t);
    }
    prevCountRef.current = cartItemCount;
  }, [cartItemCount]);

  // Static title — no longer collapses on scroll since header flows with page
  const titleSize = 'text-2xl lg:text-3xl';
  const titlePadding = `${onBack ? 'pt-2' : 'pt-3'} pb-2 px-4 md:px-6 lg:pt-6 lg:pb-4 lg:px-10`;

  const hasUtilityButtons = onCartClick || onAccountClick;

  return (
    <div
      className={`sticky top-[env(safe-area-inset-top)] z-30 -mx-4 md:-mx-6 lg:-mx-10 transition-all duration-500 ease-out bg-tea-bg/90 backdrop-blur-md rounded-none border-b border-tea-border ${className}`}
    >
      <div className="w-full">
        {/* Back navigation — inside the glass */}
        {onBack && (
          <div className="px-4 pt-3 md:px-6 lg:px-10">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 group min-h-[36px] rounded-md hover:bg-tea-text/5 px-2 py-1 -ml-2 transition-colors"
            >
              <Icons.Back className="w-3.5 h-3.5 text-tea-text/50 group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-xs text-tea-text/50 tracking-wide">
                {backLabel || 'Back'}
              </span>
            </button>
          </div>
        )}

        {/* Header Title Row — collapses on scroll (mobile), stays expanded (desktop) */}
        {(title || hasUtilityButtons) && (
          <div className={`flex items-center justify-between transition-all duration-500 ease-out ${titlePadding}`}>
            {title && (
              <h1
                className={`font-serif font-normal text-tea-text leading-tight tracking-[0.02em] pl-1 lg:pl-0 ${titleSize}`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {title}
              </h1>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {rightContent && (
                <div className={`transition-all duration-500 ease-out ${progress > 0.5 ? 'scale-90 origin-right' : ''}`}>
                  {rightContent}
                </div>
              )}
              {hasUtilityButtons && (
                <div className="flex items-center gap-1.5 lg:hidden">
                  {/* Search trigger — mobile */}
                  <button
                    onClick={() => {
                      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
                    }}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-tea-text/5 text-tea-text-sec"
                    aria-label="Search"
                  >
                    <Icons.Search className="w-5 h-5" />
                  </button>
                  {onCartClick && (
                    <button
                      onClick={onCartClick}
                      className="p-2.5 relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-tea-text/5 transition-colors"
                      aria-label="Open shopping cart"
                    >
                      <Icons.Bag className="w-5 h-5 text-tea-text/60" />
                      {cartItemCount > 0 && (
                        <div className={`absolute -top-0.5 -right-0.5 w-4 h-4 bg-tea-gold text-white text-[9px] font-bold rounded-full flex items-center justify-center ${badgeAnimating ? 'cart-badge-pulse' : ''}`}>
                          {cartItemCount > 9 ? '9+' : cartItemCount}
                        </div>
                      )}
                    </button>
                  )}
                  {onAccountClick && (
                    <button
                      onClick={onAccountClick}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-tea-text/5 transition-colors"
                      aria-label="Open account settings"
                    >
                      <Icons.User className="w-5 h-5 text-tea-text/60" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Children Content (Tabs, Subtitle, etc.) */}
        {children}

        {/* Toolbar row — below tabs, inside the glass */}
        {toolbar && (
          <div className="px-4 py-2 md:px-6 lg:px-10" style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub)' }}>
            {toolbar}
          </div>
        )}
      </div>
    </div>
  );
};
