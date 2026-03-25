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

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'NT', label: 'NT' },
  { value: 'USD', label: 'USD' },
  { value: 'Yuan', label: '\u00A5' },
  { value: 'MYR', label: 'MYR' },
  { value: 'IDR', label: 'IDR' },
  { value: 'JPY', label: 'JPY' },
  { value: 'HKD', label: 'HKD' },
];

function getGramLabel(form?: TeaForm, grams?: number): string {
  if (!form || !grams) return 'Price';
  if (form === 'Cake') return `Price per ${grams}g cake`;
  if (form === 'Brick') return `Price per ${grams}g brick`;
  if (form === 'Tuo') return `Price per ${grams}g tuo`;
  return `Price per ${grams}g`;
}

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
    <div className="space-y-3">
      {/* Price + Currency row */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-tea-text-dim uppercase tracking-wider">
          {getGramLabel(form, pricePerUnitGrams)}
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={priceAmount ?? ''}
            onChange={handlePriceInput}
            className="flex-1 bg-transparent text-tea-text border-b border-tea-border/60 focus:border-tea-gold outline-none pb-1 text-base num transition-colors"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {CURRENCIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => onCurrencyChange(c.value)}
              className={priceCurrency === c.value ? 'pill-active' : 'pill'}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grams row */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-tea-text-dim uppercase tracking-wider">
          Grams
        </label>
        <input
          type="number"
          inputMode="numeric"
          placeholder={form ? String(DEFAULT_GRAMS[form]) : '100'}
          value={pricePerUnitGrams ?? ''}
          onChange={handleGramsInput}
          className="w-full bg-transparent text-tea-text border-b border-tea-border/60 focus:border-tea-gold outline-none pb-1 text-base num transition-colors"
        />
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
    </div>
  );
};

export default PriceGrams;
