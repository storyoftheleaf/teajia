
import React from 'react';
import { CartItem as PublicCartItemType } from '../../types';
import { Icons } from '../Icons';
import { fmtShopPrice } from '../../utils/formatNumber';
import { useAppStore } from '../../lib/store';
import { formatCurrency } from '../../admin/utils';
import { useRates } from '../../admin/hooks/useAdminData';

// ── Types ────────────────────────────────────────────────────────────────────

interface CartItemProps {
  item: PublicCartItemType;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, grams: number) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

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

  return (
    <div className="flex gap-4 pb-4 border-b border-tea-border last:border-0">
      <div className="w-16 h-16 bg-tea-elevated flex items-center justify-center overflow-hidden rounded-sm shrink-0">
        {item.image ? (
          <img src={item.image} className="w-full h-full object-cover" alt={item.name} loading="eager" />
        ) : (
          <Icons.Leaf className="w-6 h-6 text-tea-text-sec" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-serif text-tea-text text-lg leading-tight">{item.name}</h3>
          <button
            onClick={() => onRemove(item.id)}
            className="text-tea-text-sec hover:text-tea-error p-2 -mr-2 -mt-1 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={`Remove ${item.name} from cart`}
          >
            <Icons.Close className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-tea-text-sec mt-0.5 mb-3">{item.variant}</p>

        {/* Quantity row — type + rule, no fill */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantityGrams - step))}
              className="w-11 h-11 flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors text-lg leading-none"
              aria-label="Decrease quantity"
            >−</button>
            <div className="flex items-baseline gap-0.5">
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
                className="w-12 bg-transparent num text-sm text-tea-text border-b border-tea-border focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold text-center"
                aria-label="Quantity"
              />
              {item.category === 'tea' && <span className="num text-xs text-tea-text-sec">g</span>}
            </div>
            <button
              onClick={() => onUpdateQuantity(item.id, Math.min(9999, item.quantityGrams + step))}
              className="w-11 h-11 flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors text-lg leading-none"
              aria-label="Increase quantity"
            >+</button>
          </div>
          <span className="num text-sm text-tea-text">{displayPrice(item.totalPrice)}</span>
        </div>

        {/* Preset gram chips — underline + weight on selected, no fill */}
        {item.category === 'tea' && (
          <div className="flex gap-4 mt-2.5 px-1">
            {[25, 50, 100, 250].map((g) => {
              const selected = item.quantityGrams === g;
              return (
                <button
                  key={g}
                  onClick={() => onUpdateQuantity(item.id, g)}
                  className={`text-[11px] num py-1 transition-colors ${
                    selected
                      ? 'text-tea-gold underline underline-offset-4 decoration-tea-gold'
                      : 'text-tea-text-sec hover:text-tea-text'
                  }`}
                  aria-pressed={selected}
                >
                  {g}g
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
