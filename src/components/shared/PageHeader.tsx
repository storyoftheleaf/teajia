import React, { useState, useEffect } from 'react';
import { Icons } from '../Icons';
import { useScrollDirection } from '../../hooks/useScrollDirection';
import { useTheme } from '../../context/ThemeContext';

interface PageHeaderProps {
  children?: React.ReactNode;
  title?: string;
  /** Sits beside the title on desktop, under it on a phone. */
  subtitle?: string;
  /**
   * Extra horizontal inset, so a page whose body carries its own gutter can put
   * its header on the same vertical edge. The bar's background still runs the
   * full width; only its contents and its bottom rule move.
   *
   * Pass MARGIN classes, not padding: these rows already carry px-4/6/10, and a
   * second padding class on the same axis replaces it rather than adding to it.
   */
  gutter?: string;
  rightContent?: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
  onBack?: () => void;
  backLabel?: string;
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
  /**
   * The magnifier in the utility cluster. On a surface whose own body carries
   * a search field, or whose bottom navigation already opens search, this is
   * the same door drawn twice, and the second one costs 44px of a phone header
   * that a title is trying to fit into.
   */
  showSearch?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  children,
  title,
  subtitle,
  gutter = '',
  rightContent,
  toolbar,
  className = '',
  onBack,
  backLabel,
  onCartClick,
  onAccountClick,
  cartItemCount = 0,
  showSearch = true
}) => {
  const { progress, isAtTop } = useScrollDirection();
  const { theme, toggleTheme } = useTheme();
  const [badgeAnimating, setBadgeAnimating] = useState(false);
  const prevCountRef = React.useRef(cartItemCount);

  /**
   * How tall this bar is, published to the page as `--page-header-h`.
   *
   * A second sticky band further down the page (the shop's filter toolbar) has
   * to come to rest UNDER this one, and it had no way to know how tall this one
   * is: it stuck at `top: 0`, which is the same line this bar occupies, so on
   * any scroll the two bands landed on each other and the higher z-index won.
   * That is the overlap where the tabs disappear behind Type / Place / Featured.
   *
   * Measured rather than assumed, because the height changes with the title,
   * the tabs, the toolbar row and the breakpoint. Cleared on unmount so a page
   * without a header does not inherit the last one's height.
   */
  const barRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const publish = () => {
      document.documentElement.style.setProperty('--page-header-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--page-header-h');
    };
  }, []);

  // Trigger pulse when cart count increases
  useEffect(() => {
    if (cartItemCount > prevCountRef.current) {
      setBadgeAnimating(true);
      const t = setTimeout(() => setBadgeAnimating(false), 400);
      return () => clearTimeout(t);
    }
    prevCountRef.current = cartItemCount;
  }, [cartItemCount]);

  // Static title, no longer collapses on scroll since header flows with page
  const titleSize = 'text-2xl lg:text-3xl';
  const titlePadding = `${onBack ? 'pt-1.5' : 'pt-2'} pb-1 px-4 md:px-6 lg:pt-0 lg:pb-0 lg:h-16 lg:px-10 ${gutter}`;

  const hasUtilityButtons = onCartClick || onAccountClick;

  return (
    /* z-sticky, not z-dropdown. The page's own sticky bands sit at z-sticky, so
       a header one step below them came to rest behind the band it is supposed
       to be above. */
    <div
      ref={barRef}
      className={`sticky top-[env(safe-area-inset-top)] z-sticky -mx-4 md:-mx-6 lg:-mx-10 transition-all duration-500 ease-out bg-tea-bg/90 backdrop-blur-md rounded-none ${className}`}
    >
      <div className="w-full">
        {/* Back navigation, inside the glass */}
        {onBack && (
          <div className={`px-4 pt-3 md:px-6 lg:px-10 ${gutter}`}>
            <button
              onClick={onBack}
              className="tap-target !justify-start gap-1.5 group rounded-md hover:bg-tea-text/5 px-2 py-1 -ml-2 transition-colors"
            >
              <Icons.Back className="w-3.5 h-3.5 text-tea-text-sec group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-xs text-tea-text-sec tracking-wide">
                {backLabel || 'Back'}
              </span>
            </button>
          </div>
        )}

        {/* Header Title Row, collapses on scroll (mobile), stays expanded (desktop) */}
        {(title || hasUtilityButtons) && (
          <div className={`flex items-center justify-between transition-all duration-500 ease-out ${titlePadding}`}>
            {title && (
              <div className="flex min-w-0 flex-col gap-0.5 pl-1 lg:flex-row lg:items-baseline lg:gap-4 lg:pl-0">
                <h1
                  className={`font-serif font-normal text-tea-text leading-tight tracking-[0.02em] ${titleSize}`}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {title}
                </h1>
                {/* Only where it sits beside the title and can be read whole.
                    Stacked under the title on a phone it had one line and no
                    room, so it arrived as "Sourced by hand, on…", which is a
                    line of chrome carrying no sentence: the reader learns
                    nothing and the header is 18px taller for it. */}
                {subtitle && (
                  <p className="hidden truncate font-body text-ui-13 italic leading-snug text-tea-text-sec lg:block">
                    {subtitle}
                  </p>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {rightContent && (
                <div className={`transition-all duration-500 ease-out ${progress > 0.5 ? 'scale-90 origin-right' : ''}`}>
                  {rightContent}
                </div>
              )}
              {hasUtilityButtons && (
                /* The cluster's own right edge, not the last button's box.
                   A 44px tap target centres a 20px glyph, so the icon was
                   floating 12px inside the line every other element in the bar
                   ends on, and the cart read as not quite reaching the corner.
                   The negative margin spends that centring padding; the target
                   stays 44px. */
                <div className="-mr-3 flex items-center gap-1.5 lg:hidden">
                  {/* Search trigger, mobile */}
                  {showSearch && (
                    <button
                      onClick={() => {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
                      }}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-tea-text/5 text-tea-text-sec"
                      aria-label="Search"
                    >
                      <Icons.Search className="w-5 h-5" />
                    </button>
                  )}
                  {onCartClick && (
                    <button
                      onClick={onCartClick}
                      className="p-2.5 relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-tea-text/5 transition-colors"
                      aria-label="Open shopping cart"
                    >
                      <Icons.Bag className="w-5 h-5 text-tea-text/60" />
                      {cartItemCount > 0 && (
                        <div className={`absolute -top-0.5 -right-0.5 w-4 h-4 cta-solid text-ui-9 font-bold rounded-full flex items-center justify-center ${badgeAnimating ? 'cart-badge-pulse' : ''}`}>
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

        {/* Toolbar row, below tabs, inside the glass */}
        {toolbar && (
          <div className={`px-4 py-2 md:px-6 lg:px-10 ${gutter}`} style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub)' }}>
            {toolbar}
          </div>
        )}

        {/* The bar's ground runs the full width so scrolling content passes
            under it, but its rule sits on the content edge, so every rule down
            the page begins and ends on the same two vertical lines. */}
        <div className="px-4 md:px-6 lg:px-10">
          <div className="h-px bg-tea-border" />
        </div>
      </div>
    </div>
  );
};
