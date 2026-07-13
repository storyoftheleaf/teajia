import React, { useCallback, useState } from 'react';
import { Check, ChevronDown, Minus, Plus } from 'lucide-react';
import type { Currency } from '../../admin/types';
import { GRAM_PRESETS, TEA_FORMS, type TeaForm } from './types';
import { BottomSheet } from '../shared/BottomSheet';
import { GramSlider } from './GramSlider';

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

// Yuan (CNY) and Yen (JPY) share the ¥ glyph in real life, so we prefix them
// (CN¥ / JP¥) to keep the sourcing price selector unambiguous at a glance.
const CURRENCY_LABELS: Record<Currency, string> = {
  NT: 'NT$',
  USD: '$',
  Yuan: 'CN¥',
  MYR: 'RM',
  IDR: 'Rp',
  JPY: 'JP¥',
  HKD: 'HK$',
  AUD: 'A$',
  UNK: '?',
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
  // Underline shell — matches the identity fields above (CaptureCard's
  // underlineFieldClass): bottom hairline only, no fill, warms to gold on
  // focus. focus-within so the hairline lights up whether the currency
  // <select> or the price <input> inside it has focus.
  const underlineShellClass = 'bg-transparent border-0 border-b border-tea-border focus-within:border-tea-gold transition-colors';

  const handlePriceInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      onPriceChange(val === '' ? undefined : Number(val));
    },
    [onPriceChange]
  );

  return (
    <div className="space-y-2">
      {/* Top row.
          - grams mode: [Currency + Price] [Grams · g] [Form ▾]
            — all three flex-1 / equal sizes so the row reads as one
            grouped pricing unit instead of "primary input + sidekick".
          - count mode: [Currency + Price flex-1] [− qty + ct]
            — counter stays a compact pill on the right since there's
            no form picker to balance it. */}
      <div className="flex items-stretch gap-4">
        <div className={`flex-1 min-w-0 flex items-center ${underlineShellClass}`}>
          <select
            value={priceCurrency}
            onChange={(e) => onCurrencyChange(e.target.value as Currency)}
            className="curate-primary self-center shrink-0 cursor-pointer appearance-none border-none bg-transparent py-2.5 pl-1 pr-1 text-tea-text-dim outline-none tabular-nums"
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
            className="curate-primary flex-1 min-w-0 bg-transparent text-tea-text px-1 py-2.5 outline-none tabular-nums placeholder:text-tea-text-dim [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label="Price"
          />
        </div>

        {/* Unit — grams + form picker in grams mode (both flex-1, equal
            sizes); +/- counter pill in count mode. */}
        {unit.mode === 'grams' ? (
          <>
            <div className={`flex-1 min-w-0 flex items-center ${underlineShellClass}`}>
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
                className="curate-primary flex-1 min-w-0 bg-transparent text-tea-text px-1 py-2.5 outline-none tabular-nums text-right placeholder:text-tea-text-dim [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Grams"
              />
              <span
                className="self-center pr-1 pl-1 text-ui-11 text-tea-text-dim tabular-nums pointer-events-none select-none"
                aria-hidden
              >
                g
              </span>
            </div>

            {unit.onFormChange && (
              <button
                type="button"
                onClick={() => setFormSheetOpen(true)}
                className={`curate-action flex-1 min-w-0 justify-between gap-1 bg-transparent border-0 border-b border-tea-border rounded-none px-1 py-2.5 transition-colors focus:border-tea-gold focus:outline-none ${
                  unit.form ? 'text-tea-text font-medium' : 'text-tea-text-sec'
                }`}
                aria-label="Tea form"
                data-curate-action
              >
                <span className="truncate">{unit.form || 'Form'}</span>
                <ChevronDown size={14} className={unit.form ? 'text-tea-gold shrink-0' : 'text-tea-text-sec shrink-0'} />
              </button>
            )}
          </>
        ) : (
          <div
            className="min-h-11 shrink-0 flex items-stretch bg-tea-surface rounded-md border border-tea-border"
            aria-label={`Quantity: ${unit.quantity} count`}
          >
            <button
              type="button"
              onClick={() => unit.onQuantityChange(Math.max(1, unit.quantity - 1))}
              className="w-7 self-stretch flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors border-r border-r-tea-border"
              aria-label="Decrease quantity"
              data-curate-action
            >
              <Minus size={12} />
            </button>
            <span className="text-tea-text text-base font-medium tabular-nums w-7 text-center self-center pl-1" aria-live="polite">
              {unit.quantity}
            </span>
            <span
              className="self-center pr-2 pl-0.5 text-tea-text-dim text-ui-11 tabular-nums pointer-events-none select-none"
              aria-hidden
            >
              ct
            </span>
            <button
              type="button"
              onClick={() => unit.onQuantityChange(unit.quantity + 1)}
              className="w-7 self-stretch flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors border-l border-l-tea-border"
              aria-label="Increase quantity"
              data-curate-action
            >
              <Plus size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Grams-mode only: stepped gram-preset slider below the main row.
          The Form chip moved up to share the top row, so this row is now
          JUST the preset shortcut. Skipped entirely for count mode.
          Fully controlled off unit.pricePerUnitGrams/unit.form, so it
          reacts automatically when CaptureCard resets grams to the new
          form's default (see CaptureCard.handleFormSelect). */}
      {unit.mode === 'grams' && (() => {
        const presets = unit.form ? GRAM_PRESETS[unit.form] : GRAM_PRESETS.Loose;
        if (presets.length === 0) return null;
        return (
          <GramSlider
            presets={presets}
            value={unit.pricePerUnitGrams}
            onChange={(g) => unit.onGramsChange(g)}
          />
        );
      })()}

      {/* Form picker — compact 2-column grid, name only. */}
      {unit.mode === 'grams' && unit.onFormChange && (
        <BottomSheet
          open={formSheetOpen}
          onOpenChange={setFormSheetOpen}
          title="Form"
          description="What shape is this tea?"
        >
          <div className="grid grid-cols-2 gap-2 px-1">
            {TEA_FORMS.map((f) => {
              const selected = unit.form === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => { unit.onFormChange?.(f); setFormSheetOpen(false); }}
                  className={`flex min-h-[52px] items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
                    selected
                      ? 'border-tea-gold/30 bg-tea-accent-sub text-tea-text'
                      : 'border-tea-border bg-tea-bg text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate font-sans text-base font-medium">{f}</span>
                  {selected && <Check size={13} className="shrink-0 text-tea-gold" />}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}
    </div>
  );
};

export default PricingRow;
