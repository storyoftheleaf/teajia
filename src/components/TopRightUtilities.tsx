import React from 'react';
import { Icons } from './Icons';

interface TopRightUtilitiesProps {
  onAccountClick: () => void;
  onCartClick: () => void;
  cartItemCount?: number;
  hidden?: boolean;
}

export const TopRightUtilities: React.FC<TopRightUtilitiesProps> = ({
  onAccountClick,
  onCartClick,
  cartItemCount = 0,
  hidden = false,
}) => {
  return (
    <div className={`lg:hidden fixed top-4 right-4 z-50 flex items-center gap-3 transition-opacity duration-300 ${hidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      {/* Cart Button - Min 44x44px touch target */}
      <button
        onClick={onCartClick}
        className="p-3 md:p-2 rounded-xl transition-all duration-300 hover:bg-tea-text/10 group relative min-w-[44px] min-h-[44px] flex items-center justify-center"
        title="Shopping cart"
        aria-label="Open shopping cart"
      >
        <Icons.Bag className="w-5 h-5 text-tea-text/70 group-hover:text-tea-text dark:group-hover:text-tea-text transition-colors" />

        {/* Cart Badge */}
        {cartItemCount > 0 && (
          <div
            key={cartItemCount}
            className="absolute -top-1 -right-1 w-5 h-5 cta-solid text-ui-10 font-bold rounded-full flex items-center justify-center animate-[scaleIn_0.3s_ease-out]"
          >
            {cartItemCount > 9 ? '9+' : cartItemCount}
          </div>
        )}

        {/* Tooltip */}
        <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-tea-elevated text-tea-text text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          Cart {cartItemCount > 0 && `(${cartItemCount})`}
        </span>
      </button>

      {/* Account Button - Min 44x44px touch target */}
      <button
        onClick={onAccountClick}
        className="p-3 md:p-2 rounded-xl transition-all duration-300 hover:bg-tea-text/10 group relative min-w-[44px] min-h-[44px] flex items-center justify-center"
        title="Account settings"
        aria-label="Open account settings"
      >
        <Icons.User className="w-5 h-5 text-tea-text/70 group-hover:text-tea-text dark:group-hover:text-tea-text transition-colors" />

        {/* Tooltip */}
        <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-tea-elevated text-tea-text text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          Account
        </span>
      </button>
    </div>
  );
};
