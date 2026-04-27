
import React from 'react';
import { CartItem as PublicCartItemType } from '../../types';
import { Icons } from '../Icons';
import { fmtShopPrice } from '../../utils/formatNumber';
import { useAppStore } from '../../lib/store';
import { formatCurrency } from '../../admin/utils';
import { useRates } from '../../admin/hooks/useAdminData';

interface CartItemProps {
  item: PublicCartItemType;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, grams: number) => void;
}

export const CartItemRow: React.FC<CartItemProps> = ({ item, onRemove, onUpdateQuantity }) => {
  const currency = useAppStore(s => s.currency);
  const { data: rates = [] } = useRates();

  const displayPrice = (usd: number) => {
    const rounded = Math.ceil(usd);
    if (rates.length > 0 && currency !== 'USD') {
      return formatCurrency(rounded, currency, rates);
    }
    return fmtShopPrice(usd);
  };
  const step = item.category === 'tea' ? 10 : 1;

  // Suppress variant when it duplicates the product name (case-insensitive)
  const showVariant =
    !!item.variant &&
    item.variant.trim().toLowerCase() !== item.name.trim().toLowerCase();

  const initial = item.name.trim().charAt(0).toUpperCase();
  const isTea = item.category === 'tea';
  const presets = [25, 50, 100, 250];

  return (
    <div className="group relative pt-5 pb-5 first:pt-0 border-b border-tea-border last:border-0">
      <div className="flex gap-4">
        {/* Thumbnail — 48px, monogram fallback (varies per item) */}
        <div className="w-12 h-12 bg-tea-elevated flex items-center justify-center overflow-hidden rounded-sm shrink-0">
          {item.image ? (
            <img src={item.image} className="w-full h-full object-cover" alt={item.name} loading="eager" />
          ) : (
            <span className="font-serif text-tea-text-sec text-base leading-none select-none">{initial}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row — name on the left, price as the row anchor on the right */}
          <div className="flex justify-between items-baseline gap-3">
            <h3 className="font-serif text-tea-text text-lg leading-tight truncate">{item.name}</h3>
            <span className="num text-base text-tea-text shrink-0">{displayPrice(item.totalPrice)}</span>
          </div>

          {/* Variant — only when it adds information */}
          {showVariant && (
            <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec mt-1">
              {item.variant}
            </p>
          )}

          {/* Quantity — inline editorial reading: − 100g + */}
          <div className={`flex items-center ${showVariant ? 'mt-3' : 'mt-2'}`}>
            <button
              onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantityGrams - step))}
              className="w-9 h-9 -ml-2 rounded-sm flex items-center justify-center text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-base leading-none"
              aria-label="Decrease quantity"
            >−</button>
            <div className="flex items-baseline">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={9999}
                value={item.quantityGrams}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) onUpdateQuantity(item.id, Math.min(9999, Math.max(1, val)));
                }}
                onBlur={(e) => {
                  const val = parseInt(e.target.value);
                  if (isNaN(val) || val < 1) onUpdateQuantity(item.id, 1);
                }}
                className="w-10 bg-transparent num text-base text-tea-text focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="Quantity"
              />
              {isTea && <span className="num text-base text-tea-text-sec -ml-0.5">g</span>}
            </div>
            <button
              onClick={() => onUpdateQuantity(item.id, Math.min(9999, item.quantityGrams + step))}
              className="w-9 h-9 rounded-sm flex items-center justify-center text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-base leading-none"
              aria-label="Increase quantity"
            >+</button>

            {/* Quick presets — same row as qty, demoted weight; matching value is hidden */}
            {isTea && (
              <div className="ml-4 flex items-center gap-3 overflow-x-auto">
                {presets
                  .filter((g) => g !== item.quantityGrams)
                  .map((g) => (
                    <button
                      key={g}
                      onClick={() => onUpdateQuantity(item.id, g)}
                      className="text-[11px] num text-tea-text-sec/80 hover:text-tea-text transition-colors py-1 shrink-0"
                    >
                      {g}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Remove — ghost icon, top-right, fades in on hover/focus only; always visible on touch */}
      <button
        onClick={() => onRemove(item.id)}
        className="absolute top-4 right-0 w-8 h-8 flex items-center justify-center rounded-sm text-tea-text-sec hover:text-tea-error transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100"
        aria-label={`Remove ${item.name} from cart`}
      >
        <Icons.Close className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
