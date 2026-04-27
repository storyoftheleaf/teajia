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
  AUD: 'A$',
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
      {/* Price + Grams — one line */}
      <div className="flex items-center gap-1">
        {/* Currency + cost — unified inset container */}
        <div className="flex-1 min-w-0 flex items-center bg-tea-gold/[0.06] rounded-xl border border-tea-border focus-within:border-tea-gold/40 transition-colors">
          <select
            value={priceCurrency}
            onChange={(e) => onCurrencyChange(e.target.value as Currency)}
            className="bg-transparent text-tea-text-sec text-xs tabular-nums font-medium border-none outline-none cursor-pointer appearance-none shrink-0 pl-3 pr-1"
            style={{ backgroundImage: 'none' }}
          >
            {Object.entries(CURRENCY_LABELS).filter(([k]) => k !== 'UNK').map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input
            type="number"
            inputMode="decimal"
            placeholder="Cost"
            value={priceAmount ?? ''}
            onChange={handlePriceInput}
            style={noSpinnerStyle}
            className="flex-1 min-w-0 bg-transparent text-tea-text px-2 py-2 outline-none text-base tabular-nums placeholder:text-tea-text-dim [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>

        {/* Grams */}
        <input
          type="number"
          inputMode="numeric"
          placeholder="Grams"
          value={pricePerUnitGrams ?? ''}
          onChange={handleGramsInput}
          style={noSpinnerStyle}
          className="w-20 shrink-0 bg-tea-gold/[0.06] text-tea-text rounded-xl px-3 py-2 border border-tea-border focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors text-base tabular-nums text-right
                     placeholder:text-tea-text-dim [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>

      {/* Gram presets + Form selector */}
      <div className="flex items-center gap-1 flex-wrap">
        {onFormChange && (
          <div className="relative shrink-0" ref={formPopoverRef}>
            <button
              type="button"
              onClick={() => setFormPopoverOpen(!formPopoverOpen)}
              className={`py-1.5 px-2.5 rounded-lg text-ui-11 transition-colors ${
                form
                  ? 'bg-tea-gold/15 text-tea-gold'
                  : 'text-tea-text-sec hover:text-tea-text'
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
                  className="absolute top-full left-0 mt-1 z-20 bg-tea-surface rounded-lg p-2 shadow-lg border border-tea-border"
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
        {presets.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onGramsChange(g)}
            className={`py-1.5 px-2.5 rounded-lg text-ui-11 transition-colors ${
              pricePerUnitGrams === g
                ? 'bg-tea-gold/15 text-tea-gold'
                : 'text-tea-text-sec hover:text-tea-text'
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
