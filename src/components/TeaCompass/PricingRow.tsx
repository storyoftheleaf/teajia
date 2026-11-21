import React, { useCallback, useState } from 'react';
import { Check, ChevronDown, Minus, Plus, Ruler } from 'lucide-react';
import type { Currency } from '../../admin/types';
import { GRAM_PRESETS, TEA_FORMS, type TeaForm } from './types';
import { BottomSheet } from '../shared/BottomSheet';
import { Modal } from '../shared/Modal';
import { GramSlider } from './GramSlider';
import { Button } from '../shared/Button';
import { isoCurrencyCode } from '../../lib/currency';

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

// Yuan (CNY) and Yen (JPY) share the ¥ glyph in real life, so we prefix them
// (CN¥ / JP¥) to keep the sourcing price selector unambiguous at a glance.
export const CURRENCY_LABELS: Record<Currency, string> = {
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
  showQuoteLabels?: boolean;
  priceAmount?: number;
  priceCurrency: Currency;
  onPriceChange: (amount: number | undefined) => void;
  onCurrencyChange: (currency: Currency) => void;
  unit: PricingRowUnit;
}

export const PricingRow: React.FC<PricingRowProps> = ({
  showQuoteLabels = false,
  priceAmount,
  priceCurrency,
  onPriceChange,
  onCurrencyChange,
  unit,
}) => {
  const [formSheetOpen, setFormSheetOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [otherWeight, setOtherWeight] = useState('');
  const [weightPresetsOpen, setWeightPresetsOpen] = useState(false);
  const gramPresets = unit.mode === 'grams' ? (GRAM_PRESETS[unit.form || 'Loose'] ?? []) : [];
  // Shared outlined fields match the photo and tasting controls.
  const fieldShellClass = 'capture-quote-field';

  const handlePriceInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      onPriceChange(val === '' ? undefined : Number(val));
    },
    [onPriceChange]
  );

  return (
    <div className="capture-quote space-y-1 lg:space-y-2">
      {showQuoteLabels && unit.mode === 'grams' && (
        <div aria-hidden className={`capture-quote-grid capture-quote-labels text-ui-10 text-tea-text-sec ${unit.onFormChange ? 'capture-quote-with-form' : ''}`}>
          <span>Supplier quote</span>
          <span>Quoted weight</span>
          {unit.onFormChange && <span>Form</span>}
        </div>
      )}
      {/* Quote, measured weight and form share one responsive row. */}
      <div className={unit.mode === 'grams' ? `capture-quote-grid ${unit.onFormChange ? 'capture-quote-with-form' : ''}` : 'flex min-w-0 items-stretch gap-2'}>
        <div className={`min-h-tap flex-1 min-w-0 flex items-center ${fieldShellClass}`}>
          <Button type="button" variant="quiet" size="sm" className="capture-currency-trigger"
            aria-label="Currency" title={`Quote currency: ${isoCurrencyCode(priceCurrency)}`} aria-haspopup="dialog"
            aria-expanded={currencyOpen} onClick={() => setCurrencyOpen(true)}>
            {CURRENCY_LABELS[priceCurrency]}<ChevronDown size={12} aria-hidden />
          </Button>
          <input
            type="number"
            inputMode="decimal"
            placeholder="Price"
            value={priceAmount ?? ''}
            onChange={handlePriceInput}
            style={noSpinnerStyle}
            className="curate-primary min-h-tap flex-1 min-w-0 bg-transparent text-tea-text px-1 py-2.5 outline-none tabular-nums placeholder:text-tea-text-dim [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label="Price"
          />
        </div>

        {/* Unit, grams + form picker in grams mode (both flex-1, equal
            sizes); +/- counter pill in count mode. */}
        {unit.mode === 'grams' ? (
          <>
            <div className={`min-h-tap flex-1 min-w-0 flex items-center ${fieldShellClass}`}>
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
                className="capture-weight-input curate-primary min-h-tap flex-1 min-w-0 bg-transparent text-tea-text px-1 py-2.5 outline-none tabular-nums text-right placeholder:text-tea-text-dim [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Grams"
              />
              <span
                className="curate-support self-center pr-1 pl-1 text-tea-text-dim tabular-nums pointer-events-none select-none"
                aria-hidden
              >
                g
              </span>
            </div>

            {unit.onFormChange && (
              <button
                type="button"
                onClick={() => setFormSheetOpen(true)}
                className={`btn-field capture-form-trigger ${
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
            className="min-h-tap shrink-0 flex items-stretch bg-tea-surface rounded-md border border-tea-border"
            aria-label={`Quantity: ${unit.quantity} count`}
          >
            <button
              type="button"
              onClick={() => unit.onQuantityChange(Math.max(1, unit.quantity - 1))}
              className="curate-action tap-target w-11 self-stretch text-tea-text-sec hover:text-tea-text border-r border-r-tea-border"
              aria-label="Decrease quantity"
              data-curate-action
            >
              <Minus size={12} />
            </button>
            <span className="curate-primary w-8 self-center text-center font-medium tabular-nums text-tea-text" aria-live="polite">
              {unit.quantity}
            </span>
            <span
              className="curate-support self-center pr-2 pl-0.5 text-tea-text-dim tabular-nums pointer-events-none select-none"
              aria-hidden
            >
              ct
            </span>
            <button
              type="button"
              onClick={() => unit.onQuantityChange(unit.quantity + 1)}
              className="curate-action tap-target w-11 self-stretch text-tea-text-sec hover:text-tea-text border-l border-l-tea-border"
              aria-label="Increase quantity"
              data-curate-action
            >
              <Plus size={12} />
            </button>
          </div>
        )}
      </div>

      {unit.mode === 'grams' && gramPresets.length > 0 && (
        <>
          <div className={showQuoteLabels ? 'capture-mobile-weight-tools min-w-0 items-center gap-2' : undefined}>
            <GramSlider presets={gramPresets} value={unit.pricePerUnitGrams} onChange={unit.onGramsChange} className="min-w-0 flex-1" />
            {showQuoteLabels && <Button type="button" variant="icon" size="sm" className="tap-target shrink-0"
              aria-label="Choose preset weight" title="Quoted weight"
              onClick={() => { setOtherWeight(unit.pricePerUnitGrams == null ? '' : String(unit.pricePerUnitGrams)); setWeightPresetsOpen(true); }}>
              <Ruler size={14} aria-hidden />
            </Button>}
          </div>
          {showQuoteLabels && <Modal isOpen={weightPresetsOpen} onClose={() => setWeightPresetsOpen(false)} title="Quoted weight">
            <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-3">
              {gramPresets.map(grams => <Button key={grams} type="button" size="sm"
                variant={grams === unit.pricePerUnitGrams ? 'secondary' : 'ghost'} aria-pressed={grams === unit.pricePerUnitGrams}
                onClick={() => { unit.onGramsChange(grams); setWeightPresetsOpen(false); }}>{grams} g</Button>)}
            </div>
            <form className="capture-other-weight" onSubmit={event => {
              event.preventDefault();
              if (otherWeight.trim() === '' || !Number.isFinite(Number(otherWeight)) || Number(otherWeight) < 0) return;
              unit.onGramsChange(Number(otherWeight)); setWeightPresetsOpen(false);
            }}>
              <label htmlFor="capture-other-quoted-weight">Other weight</label>
              <div className="flex min-w-0 items-center gap-2">
                <input id="capture-other-quoted-weight" type="number" inputMode="decimal" min="0" step="any"
                  value={otherWeight} onChange={event => setOtherWeight(event.target.value)} className="btn-field min-w-0 flex-1" />
                <span>g</span>
                <Button type="submit" size="sm" disabled={otherWeight.trim() === '' || !Number.isFinite(Number(otherWeight)) || Number(otherWeight) < 0}>Use weight</Button>
              </div>
            </form>
          </Modal>}
        </>
      )}

      <Modal isOpen={currencyOpen} onClose={() => setCurrencyOpen(false)} title="Quote currency">
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          {Object.entries(CURRENCY_LABELS).filter(([key]) => key !== 'UNK').map(([value, label]) => (
            <Button key={value} type="button" variant="secondary" aria-pressed={priceCurrency === value} className={priceCurrency === value ? 'border-tea-gold' : ''}
              onClick={() => { onCurrencyChange(value as Currency); setCurrencyOpen(false); }}>
              {label} · {isoCurrencyCode(value)}
            </Button>
          ))}
        </div>
      </Modal>

      {/* Form picker, compact 2-column grid, name only. */}
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
                  <span className="curate-primary min-w-0 flex-1 truncate font-medium">{f}</span>
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
