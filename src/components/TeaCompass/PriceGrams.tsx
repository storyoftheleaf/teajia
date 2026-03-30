import React, { useCallback } from 'react';
import type { Currency } from '../../admin/types';
import { GRAM_PRESETS, DEFAULT_GRAMS, type TeaForm } from './types';

interface PriceGramsProps {
  priceAmount?: number;
  priceCurrency: Currency;
  pricePerUnitGrams?: number;
  form?: TeaForm;
  onPriceChange: (amount: number | undefined) => void;
  onCurrencyChange: (currency: Currency) => void;
  onGramsChange: (grams: number | undefined) => void;
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
}) => {
  const presets = form ? GRAM_PRESETS[form] : GRAM_PRESETS.Loose;

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
      <div className="flex gap-4 items-end">
        {/* Price half */}
        <div className="flex-1 min-w-0">
          <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em] block mb-1.5">
            Price
          </label>
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
              placeholder="0"
              value={priceAmount ?? ''}
              onChange={handlePriceInput}
              style={noSpinnerStyle}
              className="flex-1 min-w-0 bg-tea-gold/[0.06] text-tea-text rounded-md px-3 py-2 border border-tea-gold/15 focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors text-base tabular-nums
                         placeholder:text-tea-text-sec/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* Grams half */}
        <div className="flex-1 min-w-0">
          <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em] block mb-1.5">
            Grams
          </label>
          <input
            type="number"
            inputMode="numeric"
            placeholder={form ? String(DEFAULT_GRAMS[form]) : '100'}
            value={pricePerUnitGrams ?? ''}
            onChange={handleGramsInput}
            style={noSpinnerStyle}
            className="w-full bg-tea-gold/[0.06] text-tea-text rounded-md px-3 py-2 border border-tea-gold/15 focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors text-base tabular-nums text-right
                       placeholder:text-tea-text-sec/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
      </div>

      {/* Gram presets */}
      <div className="flex gap-1.5 flex-wrap">
        {presets.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onGramsChange(g)}
            className={`${pricePerUnitGrams === g ? 'pill-active' : 'pill'} py-1.5 px-3`}
          >
            {g}g
          </button>
        ))}
      </div>
    </div>
  );
};

export default PriceGrams;
