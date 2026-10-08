import React, { useCallback, useState } from 'react';
import type { Currency } from '../../admin/types';
import { GRAM_PRESETS, TEA_FORMS, type TeaForm } from './types';
import { BottomSheet } from '../shared/BottomSheet';

/**
 * PricingRow, the shared "what does this cost and how much of it"
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
 * shortcuts. In `'count'` mode there's no such row, count is just an
 * integer.
 */

// Yuan is written ¥, as everywhere else in Curate; Yen is the one that keeps
// its JP prefix so the two stay apart.
export const CURRENCY_LABELS: Record<Currency, string> = {
  NT: 'NT$',
  USD: '$',
  Yuan: '¥',
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
      /** Tea form (Loose / Cake / …), drives which gram presets render. */
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
    <div className="curate-v2">
      {/* Cost: the money it was quoted in, then the figure. */}
      <label className="curate-v2-line">
        <span className="curate-v2-label">Cost</span>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <select
            value={priceCurrency}
            onChange={(e) => onCurrencyChange(e.target.value as Currency)}
            className="curate-v2-select shrink-0 text-tea-text-sec"
            style={{ backgroundImage: 'none', textAlign: 'right' }}
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
            className="curate-v2-field tabular-nums !flex-none"
            style={{ ...noSpinnerStyle, width: `${priceAmount == null ? 6 : String(priceAmount).length + 1}ch` }}
            aria-label="Price"
          />
        </span>
      </label>

      {unit.mode === 'grams' ? (
        <>
          <label className="curate-v2-line">
            <span className="curate-v2-label">Weight</span>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
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
                className="curate-v2-field tabular-nums"
                aria-label="Grams"
              />
              <span className="shrink-0 font-mono text-ui-13 text-tea-text-sec" aria-hidden>g</span>
            </span>
          </label>

          {unit.onFormChange && (
            <button
              type="button"
              onClick={() => setFormSheetOpen(true)}
              className="curate-v2-line w-full text-left"
              aria-label="Tea form"
              data-curate-action
            >
              <span className="curate-v2-label">Form</span>
              <span className={`flex-1 truncate text-right ${unit.form ? 'font-display text-ui-17 text-tea-text' : 'font-mono text-ui-13 text-tea-gold'}`}>{unit.form || 'choose'}</span>
            </button>
          )}
        </>
      ) : (
        <div className="curate-v2-line" aria-label={`Quantity: ${unit.quantity} count`}>
          <span className="curate-v2-label">Quantity</span>
          <span className="flex flex-1 items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => unit.onQuantityChange(Math.max(1, unit.quantity - 1))}
              className="curate-v2-frame is-tall"
              aria-label="Decrease quantity"
              data-curate-action
            >
              −
            </button>
            <span className="min-w-8 text-center font-mono text-ui-15 tabular-nums text-tea-text" aria-live="polite">{unit.quantity}</span>
            <button
              type="button"
              onClick={() => unit.onQuantityChange(unit.quantity + 1)}
              className="curate-v2-frame is-tall"
              aria-label="Increase quantity"
              data-curate-action
            >
              +
            </button>
          </span>
        </div>
      )}

      {/* The usual weights, as thin frames: gold when it is the weight in the field. */}
      {unit.mode === 'grams' && (() => {
        const presets = unit.form ? (GRAM_PRESETS[unit.form] ?? []) : GRAM_PRESETS.Loose;
        if (presets.length === 0) return null;
        return (
          <div className="curate-v2-line flex-wrap gap-y-2 py-2" role="group" aria-label="Usual weights" data-testid="gram-presets">
            <span className="curate-v2-label">Usual</span>
            <span className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
              {presets.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => unit.onGramsChange(g)}
                  aria-pressed={unit.pricePerUnitGrams === g}
                  className={`curate-v2-frame is-tall tabular-nums ${unit.pricePerUnitGrams === g ? 'is-on' : ''}`}
                  data-curate-action
                >
                  {g} g
                </button>
              ))}
            </span>
          </div>
        );
      })()}

      {/* Form picker: each shape a thin frame. */}
      {unit.mode === 'grams' && unit.onFormChange && (
        <BottomSheet
          open={formSheetOpen}
          onOpenChange={setFormSheetOpen}
          title="Form"
          description="What shape is this tea?"
        >
          <div className="curate-v2 grid grid-cols-2 gap-2 px-2">
            {TEA_FORMS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => { unit.onFormChange?.(f); setFormSheetOpen(false); }}
                aria-pressed={unit.form === f}
                className="curate-v2-choice"
              >
                <span className="min-w-0 flex-1 truncate">{f}</span>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </div>
  );
};

export default PricingRow;
