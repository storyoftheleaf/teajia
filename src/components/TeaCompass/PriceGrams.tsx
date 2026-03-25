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
      <div className="flex gap-3 items-end">
        {/* Price half */}
        <div className="flex-1 min-w-0">
          <label className="text-[11px] text-tea-text-dim uppercase tracking-wider block mb-1">
            Price
          </label>
          <div className="flex items-end gap-1">
            <select
              value={priceCurrency}
              onChange={(e) => onCurrencyChange(e.target.value as Currency)}
              className="bg-transparent text-tea-text-sec text-sm font-medium border-none outline-none cursor-pointer appearance-none pr-1 pb-1"
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
              className="flex-1 min-w-0 bg-transparent text-tea-text border-b border-tea-border/60 focus:border-tea-gold outline-none pb-1 text-base num transition-colors"
            />
          </div>
        </div>

        <div className="w-px h-6 bg-tea-border/30 shrink-0" />

        {/* Grams half */}
        <div className="flex-1 min-w-0">
          <label className="text-[11px] text-tea-text-dim uppercase tracking-wider block mb-1">
            Grams
          </label>
          <input
            type="number"
            inputMode="numeric"
            placeholder={form ? String(DEFAULT_GRAMS[form]) : '100'}
            value={pricePerUnitGrams ?? ''}
            onChange={handleGramsInput}
            className="w-full bg-transparent text-tea-text border-b border-tea-border/60 focus:border-tea-gold outline-none pb-1 text-base num transition-colors text-right"
          />
        </div>
      </div>

      {/* Gram presets */}
      <div className="flex gap-1 flex-wrap">
        {presets.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onGramsChange(g)}
            className={pricePerUnitGrams === g ? 'pill-active' : 'pill'}
          >
            {g}g
          </button>
        ))}
      </div>
    </div>
  );
};

export default PriceGrams;
