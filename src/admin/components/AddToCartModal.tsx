import React, { useState, useEffect } from 'react';
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
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Add to order" className="bg-tea-surface border border-tea-border rounded-xl w-full max-w-sm p-8 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-2xl font-serif text-tea-text mb-2">Add to Order</h3>
        <p className="text-tea-text-sec text-sm mb-6 font-serif italic">{product.givenName} <span className="text-tea-border mx-2">•</span> {product.productName}</p>

        <div className="space-y-6">
          <div>
            <label className="block text-ui-10 font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Quantity ({product.type === 'Teaware' ? 'Units' : 'Grams'})</label>
            <input
              type="number" autoFocus value={quantity} onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && Number(quantity) > 0) onConfirm(Number(quantity)); }}
              inputMode="numeric"
              onFocus={(e) => { setTimeout(() => { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 300); }}
              className="w-full bg-tea-surface border border-tea-border rounded-xl p-3 text-tea-text focus:border-tea-text-sec outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg text-lg transition-colors placeholder-tea-text-sec/50"
              placeholder="0"
            />
            {product.type !== 'Teaware' && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                    {teaPresets.map(preset => (
                        <button key={preset.value} onClick={() => setQuantity(preset.value.toString())} className="min-h-[44px] px-4 py-2.5 bg-tea-surface text-tea-text-sec text-xs rounded-md border border-tea-border hover:bg-tea-border/50 hover:text-tea-text hover:border-tea-text-sec/50 transition-all num">
                            {preset.label}
                        </button>
                    ))}
                </div>
            )}
          </div>
          <div className="flex justify-between items-center text-sm border-b border-tea-border pb-4">
            <span className="text-tea-text-sec">Price per unit:</span>
            <span className="text-tea-text num">{formatCurrency(sellingPrice, currency, rates)}</span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-tea-text font-medium text-sm">Total Price:</span>
            <span className="text-2xl font-serif text-tea-gold">{formatCurrency(totalUSD, currency, rates)}</span>
          </div>
          <div className="pt-6 flex gap-4">
            <button onClick={onClose} className="flex-1 py-3 text-xs font-bold uppercase tracking-[0.2em] text-tea-text-sec hover:text-tea-text transition-colors border border-transparent hover:border-tea-border rounded-xl focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none">Cancel</button>
            <button 
              onClick={() => { if (Number(quantity) > 0) onConfirm(Number(quantity)); }}
              className="flex-1 py-3 bg-tea-gold text-tea-bg font-bold text-xs uppercase tracking-[0.2em] rounded-xl hover:bg-tea-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-tea-gold/10 focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none"
              disabled={!quantity || Number(quantity) <= 0}
            >
              Add Item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};