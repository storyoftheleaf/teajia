import React, { useCallback, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { Currency } from '../../admin/types';
import { GRAM_PRESETS, TEA_FORMS, type TeaForm } from './types';
import { BottomSheet, SheetOption } from '../shared/BottomSheet';

/**
 * PricingRow — the shared "what does this cost and how much of it"
 * control. Both the tea form (grams) and the teaware form (count) used
 * to render their own bespoke price/quantity layouts; this consolidates
 * them so the only thing that changes between the two is the unit chip
 * on the right and the optional gram-preset row below.
 *
 * `unit` is a discriminated union:
 *   { mode: 'grams', pricePerUnitGrams, onGramsChange, form?, onFormChange? }
 *   { mode: 'count', quantity, onQuantityChange }
 *
 * In `'grams'` mode we additionally render the Form chip + preset chips
 * (50g / 75g / 100g …) below the main row so the gram input has fast
 * shortcuts. In `'count'` mode there's no such row — count is just an
 * integer.
 */

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

const FORM_HINTS: Record<TeaForm, string> = {
  Loose: 'Loose leaf · the standard',
  Cake: 'Compressed disc · puerh + heicha',
  Brick: 'Compressed rectangle',
  Tuo: 'Compressed bowl',
  Ball: 'Hand-rolled balls',
  Bag: 'Tea bag',
};

const noSpinnerStyle: React.CSSProperties = { MozAppearance: 'textfield' };

export type PricingRowUnit =
  | {
      mode: 'grams';
      pricePerUnitGrams?: number;
      onGramsChange: (grams: number | undefined) => void;
      /** Tea form (Loose / Cake / …) — drives which gram presets render. */
      form?: TeaForm;
      onFormChange?: (form: TeaForm) => void;
    }
  | {
      mode: 'count';
      quantity: number;
      onQuantityChange: (quantity: number) => void;
    };

interface PricingRowProps {
  priceAmount?: number;
  priceCurrency: Currency;
  onPriceChange: (amount: number | undefined) => void;
  onCurrencyChange: (currency: Currency) => void;
  unit: PricingRowUnit;
}

export const PricingRow: React.FC<PricingRowProps> = ({
  priceAmount,
  priceCurrency,
  onPriceChange,
  onCurrencyChange,
  unit,
}) => {
  const [formSheetOpen, setFormSheetOpen] = useState(false);

  const handlePriceInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      onPriceChange(val === '' ? undefined : Number(val));
    },
    [onPriceChange]
  );

  return (
    <div className="space-y-2">
      {/* Top row — [currency + price] [unit]. Currency is a persistent
          prefix separated by a hairline; the unit on the right adapts
          to grams or count mode. */}
      <div className="flex items-stretch gap-2">
        <div className="flex-1 min-w-0 flex items-stretch bg-tea-gold/[0.06] rounded-xl border border-tea-border focus-within:border-tea-gold/40 transition-colors">
          <select
            value={priceCurrency}
            onChange={(e) => onCurrencyChange(e.target.value as Currency)}
            className="self-stretch bg-transparent text-tea-text-sec text-xs tabular-nums font-medium border-none border-r border-r-tea-border outline-none cursor-pointer appearance-none shrink-0 pl-2.5 pr-1"
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
            placeholder="Price"
            value={priceAmount ?? ''}
            onChange={handlePriceInput}
            style={noSpinnerStyle}
            className="flex-1 min-w-0 bg-transparent text-tea-text px-2 py-2.5 outline-none text-base tabular-nums placeholder:text-tea-text-sec/70 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label="Price"
          />
        </div>

        {/* Unit — grams input with "g" suffix, or +/- counter pill */}
        {unit.mode === 'grams' ? (
          <div className="w-[88px] shrink-0 flex items-stretch bg-tea-gold/[0.06] rounded-xl border border-tea-border focus-within:border-tea-gold/40 transition-colors">
            <input
              type="number"
              inputMode="numeric"
              placeholder="Grams"
              value={unit.pricePerUnitGrams ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                unit.onGramsChange(val === '' ? undefined : Number(val));
              }}
              style={noSpinnerStyle}
              className="flex-1 min-w-0 bg-transparent text-tea-text pl-2.5 pr-1 py-2.5 outline-none text-base tabular-nums text-right placeholder:text-tea-text-sec/70 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label="Grams"
            />
            <span
              className="self-center pr-2.5 pl-1 text-tea-text-sec text-xs tabular-nums font-medium pointer-events-none select-none"
              aria-hidden
            >
              g
            </span>
          </div>
        ) : (
          <div
            className="shrink-0 flex items-stretch bg-tea-gold/[0.06] rounded-xl border border-tea-border"
            aria-label={`Quantity: ${unit.quantity} count`}
          >
            <button
              type="button"
              onClick={() => unit.onQuantityChange(Math.max(1, unit.quantity - 1))}
              className="w-7 self-stretch flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors border-r border-r-tea-border"
              aria-label="Decrease quantity"
            >
              <Minus size={12} />
            </button>
            <span className="text-tea-text text-base font-semibold tabular-nums w-7 text-center self-center pl-1" aria-live="polite">
              {unit.quantity}
            </span>
            <span
              className="self-center pr-2 pl-0.5 text-tea-text-sec text-ui-10 tabular-nums font-medium pointer-events-none select-none"
              aria-hidden
            >
              ct
            </span>
            <button
              type="button"
              onClick={() => unit.onQuantityChange(unit.quantity + 1)}
              className="w-7 self-stretch flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors border-l border-l-tea-border"
              aria-label="Increase quantity"
            >
              <Plus size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Grams-mode only — Form chip + gram presets below the main row.
          Skipped entirely for count mode where presets don't make sense. */}
      {unit.mode === 'grams' && (() => {
        const presets = unit.form ? GRAM_PRESETS[unit.form] : GRAM_PRESETS.Loose;
        return (
          <>
            <div className="flex items-center gap-1.5 flex-wrap">
              {unit.onFormChange && (
                <>
                  <button
                    type="button"
                    onClick={() => setFormSheetOpen(true)}
                    className={`tap-target py-1.5 px-3 rounded-md text-ui-11 font-medium border transition-colors ${
                      unit.form
                        ? 'bg-tea-gold/15 text-tea-gold border-tea-gold/40'
                        : 'text-tea-text-sec border-tea-border bg-tea-elevated/40 hover:text-tea-text hover:border-tea-gold/40'
                    }`}
                  >
                    {unit.form || 'Form'}
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
                  onClick={() => unit.onGramsChange(g)}
                  className={`tap-target py-1.5 px-2.5 rounded-md text-ui-11 transition-colors ${
                    unit.pricePerUnitGrams === g
                      ? 'bg-tea-gold/15 text-tea-gold font-semibold'
                      : 'text-tea-text-sec hover:text-tea-text'
                  }`}
                >
                  {g}g
                </button>
              ))}
            </div>

            {unit.onFormChange && (
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
                      selected={unit.form === f}
                      onSelect={() => { unit.onFormChange?.(f); setFormSheetOpen(false); }}
                    />
                  ))}
                </div>
              </BottomSheet>
            )}
          </>
        );
      })()}
    </div>
  );
};

export default PricingRow;
