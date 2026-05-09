import React, { useCallback, useState } from 'react';
import type { Currency } from '../../admin/types';
import { GRAM_PRESETS, TEA_FORMS, type TeaForm } from './types';
import { BottomSheet, SheetOption } from '../shared/BottomSheet';

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

/* One-line hint per tea form, surfaced in the bottom-sheet picker. */
const FORM_HINTS: Record<TeaForm, string> = {
  Loose: 'Loose leaf · the standard',
  Cake: 'Compressed disc · puerh + heicha',
  Brick: 'Compressed rectangle',
  Tuo: 'Compressed bowl',
  Ball: 'Hand-rolled balls',
  Bag: 'Tea bag',
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
  const [formSheetOpen, setFormSheetOpen] = useState(false);

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
    <div className="space-y-2.5">
      {/* Price + Grams — one line. Currency is a persistent prefix
          separated from the price by a hairline so the unit reads as
          part of the input rather than a floating selector. */}
      <div className="flex items-center gap-1.5">
        {/* Currency + cost — unified inset container */}
        <div className="flex-1 min-w-0 flex items-stretch bg-tea-gold/[0.06] rounded-xl border border-tea-border focus-within:border-tea-gold/40 transition-colors">
          <select
            value={priceCurrency}
            onChange={(e) => onCurrencyChange(e.target.value as Currency)}
            className="self-stretch bg-transparent text-tea-text-sec text-xs tabular-nums font-medium border-none border-r border-r-tea-border outline-none cursor-pointer appearance-none shrink-0 pl-3 pr-1"
            style={{ backgroundImage: 'none' }}
            aria-label="Currency"
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
            className="flex-1 min-w-0 bg-transparent text-tea-text px-2 py-2 outline-none text-base tabular-nums placeholder:text-tea-text-sec/70 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                     placeholder:text-tea-text-sec/70 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>

      {/* Form chip + gram presets — Form is a distinct concept (physical
          shape: loose / cake / brick / …) so it lives in its own row,
          separated from the gram-preset chips by a hairline divider so the
          two affordances don't visually blur together. */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {onFormChange && (
          <>
            <button
              type="button"
              onClick={() => setFormSheetOpen(true)}
              className={`tap-target py-1.5 px-3 rounded-md text-ui-11 font-medium border transition-colors ${
                form
                  ? 'bg-tea-gold/15 text-tea-gold border-tea-gold/40'
                  : 'text-tea-text-sec border-tea-border bg-tea-elevated/40 hover:text-tea-text hover:border-tea-gold/40'
              }`}
            >
              {form || 'Form'}
            </button>
            {presets.length > 0 && (
              <div className="w-px h-4 bg-tea-border self-center mx-0.5" aria-hidden />
            )}
          </>
        )}
        {presets.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onGramsChange(g)}
            className={`tap-target py-1.5 px-2.5 rounded-md text-ui-11 transition-colors ${
              pricePerUnitGrams === g
                ? 'bg-tea-gold/15 text-tea-gold font-semibold'
                : 'text-tea-text-sec hover:text-tea-text'
            }`}
          >
            {g}g
          </button>
        ))}
      </div>

      {/* Form picker — bottom sheet with one-line hints per option. */}
      {onFormChange && (
        <BottomSheet
          open={formSheetOpen}
          onOpenChange={setFormSheetOpen}
          title="Form"
          description="What shape is this tea?"
        >
          <div className="flex flex-col gap-0.5 px-1">
            {TEA_FORMS.map((f) => (
              <SheetOption
                key={f}
                label={f}
                hint={FORM_HINTS[f]}
                selected={form === f}
                onSelect={() => { onFormChange(f); setFormSheetOpen(false); }}
              />
            ))}
          </div>
        </BottomSheet>
      )}
    </div>
  );
};

export default PriceGrams;
