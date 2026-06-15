import React, { useEffect, useState } from 'react';
import type { Product, ExchangeRate } from '../../types';
import { getThemeColor } from '../../themeUtils';

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
  /** Collapses the panel. Wired to setExpandedRowId(null) in the parent. */
  onClose?: () => void;
}

// One inline field: a quiet label and a tiny content-width input on the SAME
// line. These are small values (stock, price, year) — they don't need eyebrow
// labels or boxed wells. Width is set per field so the input is just big enough.
// Saves on blur only when the value changed, mirroring GhostInput.
const InlineField = ({
  label, value, onSave, ariaLabel, prefix, suffix, width,
}: {
  label: string;
  value: string | number;
  onSave: (val: string) => void;
  ariaLabel: string;
  prefix?: string;
  suffix?: string;
  width: string;
}) => {
  const [local, setLocal] = useState<string>(value === '' || value == null ? '' : String(value));
  useEffect(() => { setLocal(value === '' || value == null ? '' : String(value)); }, [value]);
  const commit = () => { if (local !== (value == null ? '' : String(value))) onSave(local); };
  return (
    <label className="flex items-center gap-1.5 shrink-0">
      <span className="text-ui-12 text-tea-text-dim">{label}</span>
      <span className="flex items-center gap-0.5 rounded-md bg-tea-bg border border-tea-border px-2 py-1 focus-within:border-tea-gold transition-colors">
        {prefix && <span className="text-ui-12 text-tea-text-dim shrink-0 num">{prefix}</span>}
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
          className={`${width} bg-transparent border-0 outline-none text-ui-14 text-right num text-tea-text`}
        />
        {suffix && <span className="text-ui-12 text-tea-text-dim shrink-0">{suffix}</span>}
      </span>
    </label>
  );
};

// The inner quick-edit form. Rendered inline in the inventory table directly
// under the long-pressed row. Stock / Retail / Year are small numbers and the
// in-shop control is a yes/no — so the whole thing is ONE compact line: a quiet
// type-coloured accent bar, the three inline fields, the in-shop chip, and the
// two actions. The tea name is NOT repeated here — it's in the row right above.
// Saves route through onUpdate (same path as the table's inline edits), so
// nothing about persistence changes.
export const QuickEditFields: React.FC<QuickEditFieldsProps> = ({
  product, onUpdate, onTasting, onFullEdit, rates,
}) => {
  void rates; // accepted for forward-compatible pricing display; basic fields don't need it yet
  const retailValue = product.fixedRetailPriceUSD ?? product.pricePerGramUSD ?? '';
  const accent = getThemeColor(product.type);

  return (
    <div
      className="inv-detail-panel relative bg-tea-elevated rounded-xl mx-3 my-2 pl-4 pr-3 py-2 overflow-hidden flex items-center gap-x-4 gap-y-2 flex-wrap"
      style={{ boxShadow: `inset 3px 0 0 0 ${accent}` }}
    >
      {/* No name or close here — the tea name sits in the row directly above
          this panel, so repeating it (and a close X) is redundant. */}

      {/* The three small numbers, inline. */}
      <InlineField
        label="Stock" ariaLabel="Stock grams" suffix="g" width="w-12"
        value={Math.round(product.stockGrams ?? 0)}
        onSave={(val) => onUpdate(product.id, 'stockGrams', val)}
      />
      <InlineField
        label="Retail" ariaLabel="Retail price per gram" prefix="$" suffix="/g" width="w-14"
        value={retailValue}
        onSave={(val) => onUpdate(product.id, 'fixedRetailPriceUSD', val ? Number(val) : null)}
      />
      <InlineField
        label="Year" ariaLabel="Year" width="w-12"
        value={product.year ?? ''}
        onSave={(val) => onUpdate(product.id, 'year', val)}
      />

      {/* In shop — a plain yes/no chip, not a circle switch. Fills gold when
          on, sits as a quiet outline when off. The label itself is the control. */}
      <button
        role="switch"
        aria-checked={product.isPublic}
        aria-label="Show in shop"
        onClick={() => onUpdate(product.id, 'isPublic', !product.isPublic)}
        className={`tap-target shrink-0 h-7 px-2.5 rounded-md text-ui-13 transition-colors ${
          product.isPublic
            ? 'bg-tea-gold/15 text-tea-gold'
            : 'border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub'
        }`}
      >
        In shop
      </button>

      {/* Actions — quiet text + a small filled chip, pushed to the right. */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        <button
          onClick={() => onTasting(product)}
          className="tap-target h-7 px-2.5 rounded-md text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-ui-13"
        >
          Tasting
        </button>
        <button
          onClick={() => onFullEdit(product)}
          className="tap-target h-7 px-2.5 rounded-md bg-tea-gold text-tea-bg hover:bg-tea-gold-lt transition-colors text-ui-13 font-medium"
        >
          Full edit
        </button>
      </div>
    </div>
  );
};
