
import React from 'react';
import { CartItem as PublicCartItemType } from '../../types';
import { Icons } from '../Icons';
import { fmtPrice } from '../../utils/formatNumber';

// ── Types ────────────────────────────────────────────────────────────────────

interface CartItemProps {
  item: PublicCartItemType;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, grams: number) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export const CartItemRow: React.FC<CartItemProps> = ({ item, onRemove, onUpdateQuantity }) => {
  const step = item.category === 'tea' ? 10 : 1;

  return (
    <div className="flex gap-4 pb-4">
      <div className="w-16 h-16 bg-tea-bg/5 flex items-center justify-center overflow-hidden rounded-lg shrink-0">
        {item.image ? (
          <img src={item.image} className="w-full h-full object-cover sepia-[0.3]" alt={item.name} loading="eager" />
        ) : (
          <Icons.Leaf className="w-6 h-6 opacity-20" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <h3 className="font-serif text-tea-text text-lg leading-none mb-1">{item.name}</h3>
          <button
            onClick={() => onRemove(item.id)}
            className="text-tea-text-sec hover:text-red-500 p-2 -mr-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={`Remove ${item.name} from cart`}
          >
            <Icons.Close className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-tea-text-sec mb-3">{item.variant}</p>
        <div className="flex items-center justify-between gap-3 bg-tea-gold/20 px-2 py-1.5 rounded-lg">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantityGrams - step))}
              className="w-7 h-7 flex items-center justify-center rounded-sm bg-tea-gold/25 hover:bg-tea-gold/40 transition-colors text-tea-text font-medium text-base leading-none min-w-[44px] min-h-[44px]"
              aria-label="Decrease quantity"
            >−</button>
            <div className="flex items-center gap-1">
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
                className="w-12 bg-transparent num text-xs text-tea-text border-b border-tea-border focus:outline-none focus:border-tea-gold text-center"
              />
              {item.category === 'tea' && <span className="num text-xs text-tea-text-sec">g</span>}
            </div>
            <button
              onClick={() => onUpdateQuantity(item.id, Math.min(9999, item.quantityGrams + step))}
              className="w-7 h-7 flex items-center justify-center rounded-sm bg-tea-gold/25 hover:bg-tea-gold/40 transition-colors text-tea-text font-medium text-base leading-none min-w-[44px] min-h-[44px]"
              aria-label="Increase quantity"
            >+</button>
          </div>
          <span className="num text-sm text-tea-text font-medium">{fmtPrice(item.totalPrice)}</span>
        </div>
      </div>
    </div>
  );
};
