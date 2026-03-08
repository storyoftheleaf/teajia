import React from 'react';
import { Icons } from '../Icons';
import { useScrollDirection } from '../../hooks/useScrollDirection';

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

  // Interpolate between expanded and collapsed states — mobile only (desktop stays expanded)
  const titleSize = isAtTop ? 'text-4xl lg:text-5xl' : 'text-base lg:text-5xl';
  const titlePadding = isAtTop
    ? `${onBack ? 'pt-2' : 'pt-6'} pb-4 px-4 md:px-6 lg:pt-8 lg:pb-6 lg:px-10`
    : `pt-2 pb-1.5 px-4 md:px-6 lg:pt-8 lg:pb-6 lg:px-10`;

  const hasUtilityButtons = onCartClick || onAccountClick;

  return (
    <div
      className={`sticky top-0 z-30 -mx-4 md:-mx-6 lg:-mx-10 border-b border-tea-border bg-tea-surface/80 backdrop-blur-xl backdrop-saturate-150 shadow-[0_1px_3px_rgba(0,0,0,0.05)]  transition-all duration-500 ease-out ${className}`}
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
                className={`font-serif font-light text-tea-text leading-tight tracking-wide pl-1 lg:pl-0 transition-all duration-500 ease-out ${titleSize}`}
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
                <div className="flex items-center gap-2.5 lg:hidden">
                  {onCartClick && (
                    <button
                      onClick={onCartClick}
                      className="p-2.5 relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-tea-text/5 transition-colors"
                      aria-label="Open shopping cart"
                    >
                      <Icons.Bag className="w-[22px] h-[22px] text-tea-text/60" />
                      {cartItemCount > 0 && (
                        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-tea-gold text-white text-[9px] font-bold rounded-full flex items-center justify-center">
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
                      <Icons.User className="w-[22px] h-[22px] text-tea-text/60" />
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
          <div className="px-4 py-2 md:px-6 lg:px-10 border-t border-tea-border">
            {toolbar}
          </div>
        )}
      </div>
    </div>
  );
};
