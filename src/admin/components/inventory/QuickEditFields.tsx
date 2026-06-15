import React, { useEffect, useState } from 'react';
import type { Product, ExchangeRate } from '../../types';

export interface QuickEditFieldsProps {
  /** The product being quick-edited. */
  product: Product;
  /** Same optimistic + persisted update path the table's inline edits use. */
  onUpdate: (id: string, field: keyof Product, value: any) => void;
  /** Opens the tasting flow for this product (and collapses the panel). */
  onTasting: (product: Product) => void;
  /** Opens the full ProductEditPanel for this product (and collapses the panel). */
  onFullEdit: (product: Product) => void;
  /** Exchange rates, accepted for forward-compatible pricing display. */
  rates: ExchangeRate[];
}

// A compact labelled input. Label sits as a micro-cap above the field so the
// fields tile into a tight two-up grid instead of stacking full-width rows.
// Saves on blur only when the value actually changed, mirroring GhostInput so
// onUpdate fires exactly once per edit.
const NumberField = ({
  label, value, onSave, ariaLabel, suffix,
}: {
  label: string;
  value: string | number;
  onSave: (val: string) => void;
  ariaLabel: string;
  suffix?: string;
}) => {
  const [local, setLocal] = useState<string>(value === '' || value == null ? '' : String(value));
  useEffect(() => { setLocal(value === '' || value == null ? '' : String(value)); }, [value]);
  const commit = () => { if (local !== (value == null ? '' : String(value))) onSave(local); };
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="label-caps text-tea-text-dim">{label}</span>
      <span className="relative flex items-center">
        <input
          type="number"
          inputMode="decimal"
          aria-label={ariaLabel}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
          autoComplete="off"
          spellCheck={false}
          className={`admin-input w-full h-9 py-1.5 pl-3 text-ui-14 num text-tea-text ${suffix ? 'pr-7' : 'pr-3'}`}
        />
        {suffix && <span className="absolute right-3 text-ui-12 text-tea-text-dim pointer-events-none">{suffix}</span>}
      </span>
    </label>
  );
};

// The inner quick-edit form. Rendered inline in the inventory table directly
// under the long-pressed row (the old expand-under-the-tea feel), inside a
// full-width td. Holds Stock / Retail / Year / Show-in-shop plus Tasting and
// Full-edit actions. Saves route through onUpdate (the same handleProductUpdate
// path the table's inline edits use), so nothing about persistence changes.
export const QuickEditFields: React.FC<QuickEditFieldsProps> = ({
  product, onUpdate, onTasting, onFullEdit, rates,
}) => {
  void rates; // accepted for forward-compatible pricing display; basic fields don't need it yet
  const name = product.givenName || product.productName;
  // Mirror the table Retail column: edits fixedRetailPriceUSD, shows the override
  // when present otherwise the calculated retail.
  const retailValue = product.fixedRetailPriceUSD ?? product.pricePerGramUSD ?? '';

  return (
    <div className="inv-detail-panel bg-tea-surface border border-tea-border rounded-md mx-3 my-2 px-4 py-3">
      {/* Header row — name/vendor on the left, the two actions tucked on the
          right so the whole panel stays tight. */}
      <div className="flex items-center justify-between gap-3 min-w-0 pb-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <p className="font-display text-ui-15 text-tea-text truncate leading-snug">{name}</p>
          {product.vendor && (
            <p className="text-ui-12 text-tea-text-dim truncate shrink-0">{product.vendor}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onTasting(product)}
            className="tap-target h-8 px-3 rounded-md text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-ui-13"
          >
            Tasting
          </button>
          <button
            onClick={() => onFullEdit(product)}
            className="tap-target h-8 px-3 rounded-md bg-tea-gold text-tea-bg hover:bg-tea-gold-lt transition-colors text-ui-13 font-medium"
          >
            Full edit
          </button>
        </div>
      </div>

      {/* Fields — one tight row: the three numbers plus the shop toggle. */}
      <div className="flex items-end gap-3">
        <div className="w-24 shrink-0">
          <NumberField
            label="Stock"
            ariaLabel="Stock grams"
            suffix="g"
            value={Math.round(product.stockGrams ?? 0)}
            onSave={(val) => onUpdate(product.id, 'stockGrams', val)}
          />
        </div>
        <div className="w-24 shrink-0">
          <NumberField
            label="Retail"
            ariaLabel="Retail price per gram"
            value={retailValue}
            onSave={(val) => onUpdate(product.id, 'fixedRetailPriceUSD', val ? Number(val) : null)}
          />
        </div>
        <div className="w-20 shrink-0">
          <NumberField
            label="Year"
            ariaLabel="Year"
            value={product.year ?? ''}
            onSave={(val) => onUpdate(product.id, 'year', val)}
          />
        </div>

        {/* Shop toggle — a quiet on/off at the end of the row, label beside it. */}
        <button
          role="switch"
          aria-checked={product.isPublic}
          aria-label="Show in shop"
          onClick={() => onUpdate(product.id, 'isPublic', !product.isPublic)}
          className="tap-target h-9 flex items-center gap-2 group"
        >
          <span className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${product.isPublic ? 'bg-tea-gold' : 'bg-tea-elevated'}`}>
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-tea-bg transition-transform ${product.isPublic ? 'translate-x-4' : 'translate-x-0'}`} />
          </span>
          <span className={`text-ui-13 transition-colors ${product.isPublic ? 'text-tea-text' : 'text-tea-text-sec group-hover:text-tea-text'}`}>In shop</span>
        </button>
      </div>
    </div>
  );
};
