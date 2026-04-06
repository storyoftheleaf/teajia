import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Currency } from '../../admin/types';
import { GRAM_PRESETS, TEA_FORMS, type TeaForm } from './types';

interface PriceGramsProps {
  priceAmount?: number;
  priceCurrency: Currency;
  pricePerUnitGrams?: number;
  form?: TeaForm;
  onPriceChange: (amount: number | undefined) => void;
  onCurrencyChange: (currency: Currency) => void;
  onGramsChange: (grams: number | undefined) => void;
  onFormChange?: (form: TeaForm) => void;
}

const CURRENCY_LABELS: Record<Currency, string> = {
  NT: 'NT$',
  USD: '$',
  Yuan: '¥',
  MYR: 'RM',
  IDR: 'Rp',
  JPY: '¥',
  HKD: 'HK$',
  UNK: '?',
};

/* Hide number input spinners globally for these inputs */
const noSpinnerStyle: React.CSSProperties = {
  MozAppearance: 'textfield',
};

export const PriceGrams: React.FC<PriceGramsProps> = ({
  priceAmount,
  priceCurrency,
  pricePerUnitGrams,
  form,
  onPriceChange,
  onCurrencyChange,
  onGramsChange,
  onFormChange,
}) => {
  const presets = form ? GRAM_PRESETS[form] : GRAM_PRESETS.Loose;
  const [formPopoverOpen, setFormPopoverOpen] = useState(false);
  const formPopoverRef = useRef<HTMLDivElement>(null);

  // Close form popover on outside click
  useEffect(() => {
    if (!formPopoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (formPopoverRef.current && !formPopoverRef.current.contains(e.target as Node)) {
        setFormPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [formPopoverOpen]);

  const handlePriceInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      onPriceChange(val === '' ? undefined : Number(val));
    },
    [onPriceChange]
  );

  const handleGramsInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      onGramsChange(val === '' ? undefined : Number(val));
    },
    [onGramsChange]
  );

  return (
    <div className="space-y-2">
      {/* Price (with currency dropdown) + Grams — one line */}
      <div className="flex gap-3 items-center">
        {/* Price half */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <select
              value={priceCurrency}
              onChange={(e) => onCurrencyChange(e.target.value as Currency)}
              className="bg-transparent text-tea-text-sec text-xs tabular-nums font-medium border-none outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg cursor-pointer appearance-none shrink-0"
              style={{ backgroundImage: 'none' }}
            >
              {Object.entries(CURRENCY_LABELS).filter(([k]) => k !== 'UNK').map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input
              type="number"
              inputMode="decimal"
              placeholder="cost"
              value={priceAmount ?? ''}
              onChange={handlePriceInput}
              style={noSpinnerStyle}
              className="flex-1 min-w-0 bg-tea-gold/[0.06] text-tea-text rounded-md px-3 py-2 border border-tea-border focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors text-base tabular-nums
                         placeholder:text-tea-text-dim [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* Form + Grams half */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {/* Form selector chip */}
            {onFormChange && (
              <div className="relative shrink-0" ref={formPopoverRef}>
                <button
                  type="button"
                  onClick={() => setFormPopoverOpen(!formPopoverOpen)}
                  className={`text-xs tabular-nums font-medium cursor-pointer shrink-0 whitespace-nowrap px-2 py-2 rounded-md transition-colors ${
                    form
                      ? 'text-tea-gold bg-tea-gold/[0.08]'
                      : 'text-tea-text-sec bg-transparent hover:text-tea-text'
                  }`}
                >
                  {form || 'Form'}
                </button>

                <AnimatePresence>
                  {formPopoverOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full right-0 mt-1 z-20 bg-tea-surface rounded-lg p-2 shadow-lg border border-tea-border"
                    >
                      <div className="grid grid-cols-3 gap-1.5" style={{ minWidth: '180px' }}>
                        {TEA_FORMS.map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => { onFormChange(f); setFormPopoverOpen(false); }}
                            className={`${form === f ? 'tag-selectable-active' : 'tag-selectable'} py-2`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            <input
              type="number"
              inputMode="numeric"
              placeholder="grams"
              value={pricePerUnitGrams ?? ''}
              onChange={handleGramsInput}
              style={noSpinnerStyle}
              className="flex-1 min-w-0 bg-tea-gold/[0.06] text-tea-text rounded-md px-3 py-2 border border-tea-border focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors text-base tabular-nums text-right
                         placeholder:text-tea-text-dim [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>
      </div>

      {/* Gram presets */}
      <div className="flex gap-1 flex-wrap">
        {presets.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onGramsChange(g)}
            className={`py-0.5 px-2 rounded text-[10px] transition-colors ${
              pricePerUnitGrams === g
                ? 'bg-tea-gold/15 text-tea-gold'
                : 'text-tea-text-dim hover:text-tea-text-sec'
            }`}
          >
            {g}g
          </button>
        ))}
      </div>
    </div>
  );
};

export default PriceGrams;
