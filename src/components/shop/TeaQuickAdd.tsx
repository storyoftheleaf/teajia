import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { minimumOrderGrams, offeredSizes, quoteGrams, sellUnitOf, TEA_PRICING, wholePieceOf } from '../../lib/teaPricing';
import type { InventoryItem } from '../../types';

export interface TeaQuickAddProps {
  item: InventoryItem;
  initialGrams: number;
  formatPrice: (usd: number) => string;
  onAdd: (item: InventoryItem, grams: number, totalUsd: number) => void;
  onClose: () => void;
}

/** A quantity choice that stays inside the tea's ledger row. */
export function TeaQuickAdd({ item, initialGrams, formatPrice, onAdd, onClose }: TeaQuickAddProps) {
  const recordedStock = Number(item.stock_g);
  const stockG = Number.isFinite(recordedStock) ? Math.max(0, Math.floor(recordedStock)) : 0;
  const pricePerGram = Number(item.price_per_gram);
  const sellUnit = sellUnitOf(item.form, item.pieceWeightG, item.soldInWholeUnits);
  const wholePiece = sellUnit ?? wholePieceOf(item.form, item.pieceWeightG);
  const minimum = minimumOrderGrams(sellUnit?.grams);
  const canQuote = item.category === 'tea' && Number.isFinite(pricePerGram) && pricePerGram > 0;
  const hasSealedUnit = !item.soldInWholeUnits || Boolean(sellUnit);
  const quotes = canQuote && hasSealedUnit
    ? offeredSizes(pricePerGram, stockG, {
      wholePieceGrams: wholePiece?.grams,
      unitGrams: sellUnit?.grams,
    })
    : [];

  // A remainder can be worth buying even when it misses every standard rung.
  // Keep that one valid choice available when the preset ladder is empty.
  if (quotes.length === 0 && canQuote && hasSealedUnit && stockG >= minimum) {
    const remainder = quoteGrams(pricePerGram, stockG, { wholePieceGrams: wholePiece?.grams });
    if (remainder.totalUsd >= TEA_PRICING.minTotalUsd) quotes.push(remainder);
  }

  const defaultGrams = quotes.find(quote => quote.grams === initialGrams)?.grams
    ?? quotes.find(quote => quote.grams >= initialGrams)?.grams
    ?? quotes[quotes.length - 1]?.grams;
  const [selectedGrams, setSelectedGrams] = useState<number | undefined>(defaultGrams);
  const [customOpen, setCustomOpen] = useState(quotes.length === 0 && canQuote && hasSealedUnit && stockG >= minimum);
  const [customValue, setCustomValue] = useState('');
  const sectionRef = useRef<HTMLElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const customRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (selectedRef.current ?? closeRef.current)?.focus({ preventScroll: true });
    const frame = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (customOpen) customRef.current?.focus();
  }, [customOpen]);

  const enteredGrams = Number(customValue);
  const hasCustomValue = customValue.trim() !== '';
  const customError = !hasCustomValue
    ? null
    : !Number.isFinite(enteredGrams) || !Number.isInteger(enteredGrams) || enteredGrams < minimum
      ? `Enter at least ${minimum} whole grams.`
      : enteredGrams > stockG
        ? `Only ${stockG}g is available.`
        : sellUnit && enteredGrams % sellUnit.grams !== 0
          ? `Choose a multiple of ${sellUnit.grams}g for sealed ${sellUnit.label.toLowerCase()} units.`
          : null;
  const customValid = customOpen && hasCustomValue && customError === null;
  const selectedValid = selectedGrams !== undefined && quotes.some(size => size.grams === selectedGrams);
  const grams = customOpen ? (customValid ? enteredGrams : undefined) : (selectedValid ? selectedGrams : undefined);
  const quote = grams === undefined || !canQuote || !hasSealedUnit || stockG < minimum
    ? undefined
    : quoteGrams(pricePerGram, grams, { wholePieceGrams: wholePiece?.grams });

  const unavailable = !canQuote
    ? 'Price is unavailable.'
    : !hasSealedUnit
      ? 'This sealed tea needs a recorded unit weight.'
      : stockG < minimum
        ? 'No orderable amount remains.'
        : 'No amount is currently available.';

  return (
    <section
      ref={sectionRef}
      aria-label={`Choose amount for ${item.name}`}
      className="tea-quick-add min-w-0 border-t border-tea-border bg-tea-accent-sub px-3 py-3 text-tea-text md:px-4"
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h4 className={`${TYPOGRAPHY_CLASSES.label} m-0 text-tea-text-sec`}>Choose amount</h4>
        <button
          ref={closeRef}
          type="button"
          className="tap-target inline-flex h-8 w-8 shrink-0 items-center justify-center text-tea-text-dim hover:text-tea-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
          aria-label="Close amount chooser"
          onClick={onClose}
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {canQuote && hasSealedUnit && stockG >= minimum ? (
        <>
          <div role="group" aria-label="Available amounts" className="mt-2 flex min-w-0 flex-wrap gap-2">
            {quotes.map(size => {
              const active = !customOpen && selectedGrams === size.grams;
              return (
                <button
                  key={size.grams}
                  ref={active ? selectedRef : undefined}
                  type="button"
                  aria-pressed={active}
                  className={`min-h-11 min-w-[76px] border px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 ${active ? 'border-tea-gold bg-tea-surface text-tea-text' : 'border-tea-border bg-tea-surface text-tea-text-sec hover:border-tea-gold'}`}
                  onClick={() => {
                    setSelectedGrams(size.grams);
                    setCustomOpen(false);
                  }}
                >
                  <span className="block font-sans text-ui-12 font-medium tabular-nums">{size.grams}g</span>
                  <span className="block font-sans text-ui-11 tabular-nums text-tea-text-dim">{formatPrice(size.totalUsd)}</span>
                </button>
              );
            })}
            <button
              type="button"
              aria-expanded={customOpen}
              aria-pressed={customOpen}
              className={`min-h-11 border px-3 font-sans text-ui-11 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 ${customOpen ? 'border-tea-gold bg-tea-surface text-tea-text' : 'border-tea-border bg-tea-surface text-tea-text-sec hover:border-tea-gold'}`}
              onClick={() => setCustomOpen(true)}
            >
              Other amount
            </button>
          </div>
          {customOpen && (
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
              <label htmlFor={`tea-quick-add-grams-${item.id}`} className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>
                Grams
              </label>
              <input
                ref={customRef}
                id={`tea-quick-add-grams-${item.id}`}
                type="number"
                inputMode="numeric"
                min={minimum}
                max={stockG}
                step={sellUnit?.grams ?? 1}
                value={customValue}
                onChange={event => setCustomValue(event.target.value)}
                aria-invalid={Boolean(customError)}
                aria-describedby={customError ? `tea-quick-add-error-${item.id}` : undefined}
                className="h-11 w-24 border border-tea-border bg-tea-surface px-2 font-sans text-ui-14 tabular-nums text-tea-text focus:border-tea-gold focus:outline-none"
              />
              {customError && (
                <span id={`tea-quick-add-error-${item.id}`} role="alert" className="font-sans text-ui-11 text-tea-text-sec">
                  {customError}
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            disabled={!quote}
            className="cta-solid mt-3 inline-flex min-h-11 max-w-full items-center justify-center px-4 font-sans text-ui-12 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              if (quote) onAdd(item, quote.grams, quote.totalUsd);
            }}
          >
            {quote ? `Add ${quote.grams}g · ${formatPrice(quote.totalUsd)}` : 'Choose an amount'}
          </button>
        </>
      ) : (
        <p className="m-0 mt-1 font-sans text-ui-12 text-tea-text-sec">{unavailable}</p>
      )}
    </section>
  );
}
