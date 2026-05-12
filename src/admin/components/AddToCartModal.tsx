import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Product, Currency, ExchangeRate } from '../types';
import { formatCurrency } from '../utils';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface AddToCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  product: Product | null;
  currency: Currency;
  rates: ExchangeRate[];
}

export const AddToCartModal: React.FC<AddToCartModalProps> = ({
  isOpen, onClose, onConfirm, product, currency, rates
}) => {
  const [quantity, setQuantity] = useState<string>('');
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (isOpen) setQuantity('');
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const currentQty = Number(quantity);
  const sellingPrice = product.fixedRetailPriceUSD ?? product.pricePerGramUSD;
  const totalUSD = currentQty * sellingPrice;

  const teaPresets = [
    { label: '25g', value: 25 },
    { label: '50g', value: 50 },
    { label: '100g', value: 100 },
    { label: '150g', value: 150 },
    { label: 'Brick (250g)', value: 250 },
    { label: 'Cake (357g)', value: 357 },
  ];

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <button
        type="button"
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-tea-bg/70 backdrop-blur-[2px]"
      />
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add to order"
        className="relative bg-tea-surface border border-tea-border rounded-xl shadow-2xl w-full max-w-md"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-tea-text-sec hover:text-tea-text transition-colors rounded-md p-1.5 tap-target"
        >
          <X size={16} />
        </button>

        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h3 className="h3 text-tea-text">Add to Order</h3>
            <p className="label-caps text-tea-text-dim mt-1">
              {product.givenName} · {product.productName}
            </p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-6">
          <div>
            <label className="block label-caps text-tea-text-sec mb-1.5">
              Quantity ({product.type === 'Teaware' ? 'Units' : 'Grams'})
            </label>
            <input
              type="number"
              autoFocus
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && Number(quantity) > 0) onConfirm(Number(quantity)); }}
              inputMode="numeric"
              onFocus={(e) => { setTimeout(() => { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 300); }}
              className="w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors"
              placeholder="0"
            />
            {product.type !== 'Teaware' && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {teaPresets.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => setQuantity(preset.value.toString())}
                    className="min-h-[44px] px-3 py-2 rounded-md border border-tea-border text-tea-text-sec text-ui-12 hover:text-tea-text hover:bg-tea-accent-sub transition-colors num"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center text-ui-13 border-b border-tea-border pb-3">
            <span className="text-tea-text-sec">Price per unit</span>
            <span className="text-tea-text num">{formatCurrency(sellingPrice, currency, rates)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-tea-text-sec text-ui-13">Total price</span>
            <span className="font-display text-ui-26 text-tea-gold">{formatCurrency(totalUSD, currency, rates)}</span>
          </div>
        </div>

        <div className="flex justify-between gap-2 px-5 py-3 border-t border-tea-border bg-tea-bg/40 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs text-tea-text-sec hover:text-tea-text transition-colors focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={() => { if (Number(quantity) > 0) onConfirm(Number(quantity)); }}
            disabled={!quantity || Number(quantity) <= 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-tea-gold/10 focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none"
          >
            Add Item
          </button>
        </div>
      </div>
    </div>
  );
};
