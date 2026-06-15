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

// A compact field row inside the panel. Saves on blur only when the value
// actually changed, mirroring GhostInput so onUpdate fires exactly once per edit.
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
    <label className="flex items-center justify-between gap-4 py-2.5 border-b border-tea-border">
      <span className="text-ui-14 text-tea-text-sec shrink-0">{label}</span>
      <span className="flex items-center gap-1.5 min-w-0">
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
          className="admin-input w-28 h-11 py-2 px-3 text-ui-15 text-right num text-tea-text"
        />
        {suffix && <span className="text-ui-13 text-tea-text-dim shrink-0">{suffix}</span>}
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
    <div className="inv-detail-panel bg-tea-surface border border-tea-border rounded-md mx-3 my-2 px-4 pt-2.5 pb-3">
      {/* Context line — givenName / vendor, calm and quiet, like the old block. */}
      <div className="flex items-baseline gap-2 min-w-0 pb-1.5">
        <p className="font-display text-ui-15 text-tea-text truncate leading-snug">{name}</p>
        {product.vendor && (
          <p className="text-ui-12 text-tea-text-dim truncate shrink-0">{product.vendor}</p>
        )}
      </div>

      <NumberField
        label="Stock"
        ariaLabel="Stock grams"
        suffix="g"
        value={Math.round(product.stockGrams ?? 0)}
        onSave={(val) => onUpdate(product.id, 'stockGrams', val)}
      />
      <NumberField
        label="Retail"
        ariaLabel="Retail price per gram"
        value={retailValue}
        onSave={(val) => onUpdate(product.id, 'fixedRetailPriceUSD', val ? Number(val) : null)}
      />
      <NumberField
        label="Year"
        ariaLabel="Year"
        value={product.year ?? ''}
        onSave={(val) => onUpdate(product.id, 'year', val)}
      />

      {/* Show in shop toggle */}
      <div className="flex items-center justify-between gap-4 py-2.5 border-b border-tea-border">
        <span className="text-ui-14 text-tea-text-sec">Show in shop</span>
        <button
          role="switch"
          aria-checked={product.isPublic}
          aria-label="Show in shop"
          onClick={() => onUpdate(product.id, 'isPublic', !product.isPublic)}
          className={`tap-target relative w-12 h-7 rounded-full transition-colors ${product.isPublic ? 'bg-tea-gold' : 'bg-tea-elevated'}`}
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-tea-bg transition-transform ${product.isPublic ? 'translate-x-5' : 'translate-x-0'}`}
          />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-3">
        <button
          onClick={() => onTasting(product)}
          className="tap-target flex-1 h-11 rounded-md border border-tea-border text-tea-text hover:bg-tea-accent-sub transition-colors text-ui-14"
        >
          Tasting
        </button>
        <button
          onClick={() => onFullEdit(product)}
          className="tap-target flex-1 h-11 rounded-md bg-tea-gold text-tea-bg hover:bg-tea-gold-lt transition-colors text-ui-14 font-medium"
        >
          Full edit
        </button>
      </div>
    </div>
  );
};
