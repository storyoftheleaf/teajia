import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
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

// A single numeric field, on-design: an uppercase eyebrow label above a boxed
// input (the canonical Field block from the design system, §12/§13), sized
// py-2 not h-11 so the whole panel stays short. Saves on blur only when the
// value actually changed, mirroring GhostInput so onUpdate fires once per edit.
const NumberField = ({
  label, value, onSave, ariaLabel, prefix, suffix,
}: {
  label: string;
  value: string | number;
  onSave: (val: string) => void;
  ariaLabel: string;
  prefix?: string;
  suffix?: string;
}) => {
  const [local, setLocal] = useState<string>(value === '' || value == null ? '' : String(value));
  useEffect(() => { setLocal(value === '' || value == null ? '' : String(value)); }, [value]);
  const commit = () => { if (local !== (value == null ? '' : String(value))) onSave(local); };
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-ui-11 uppercase tracking-[1.2px] text-tea-text-sec">{label}</span>
      <span className="flex items-center gap-1.5 rounded-md bg-tea-surface border border-tea-border px-2.5 py-1.5 focus-within:border-tea-gold transition-colors">
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
          className="min-w-0 flex-1 bg-transparent border-0 outline-none text-ui-14 num text-tea-text"
        />
        {suffix && <span className="text-ui-12 text-tea-text-dim shrink-0">{suffix}</span>}
      </span>
    </label>
  );
};

// The inner quick-edit form. Rendered inline in the inventory table directly
// under the long-pressed row (the old expand-under-the-tea feel), inside a
// full-width td. Holds Stock / Retail / Year / Show-in-shop plus Tasting and
// Full-edit actions. Saves route through onUpdate (the same handleProductUpdate
// path the table's inline edits use), so nothing about persistence changes.
//
// Visual: a recessed editorial drawer. A 2px left accent bar in the tea's type
// color anchors it to its row (same hue the row's type label uses), the header
// name is set in the display serif, and the numeric fields sit in filled wells.
export const QuickEditFields: React.FC<QuickEditFieldsProps> = ({
  product, onUpdate, onTasting, onFullEdit, rates, onClose,
}) => {
  void rates; // accepted for forward-compatible pricing display; basic fields don't need it yet
  const name = product.givenName || product.productName;
  // Secondary line: the romanized name when we led with the given name, plus vendor.
  const secondary = [product.givenName ? product.productName : null, product.vendor]
    .filter(Boolean)
    .join('  ·  ');
  // Mirror the table Retail column: edits fixedRetailPriceUSD, shows the override
  // when present otherwise the calculated retail.
  const retailValue = product.fixedRetailPriceUSD ?? product.pricePerGramUSD ?? '';
  const accent = getThemeColor(product.type);

  return (
    <div
      className="inv-detail-panel relative bg-tea-elevated rounded-xl mx-3 my-2 pl-5 pr-4 py-3 overflow-hidden"
      style={{ boxShadow: `inset 3px 0 0 0 ${accent}` }}
    >
      {/* Header — name + quiet secondary on the left; the two actions and close
          tucked on the right so there's no tall footer block. */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-ui-16 text-tea-text truncate leading-snug">{name}</p>
          {secondary && (
            <p className="text-ui-12 text-tea-text-dim truncate leading-snug">{secondary}</p>
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
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close quick edit"
              className="tap-target shrink-0 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              <X size={17} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {/* Fields — one row: the three numbers plus the in-shop toggle. Wraps on
          narrow phones rather than stacking into tall full-width rows. */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 mt-3">
        <div className="w-24">
          <NumberField
            label="Stock"
            ariaLabel="Stock grams"
            suffix="g"
            value={Math.round(product.stockGrams ?? 0)}
            onSave={(val) => onUpdate(product.id, 'stockGrams', val)}
          />
        </div>
        <div className="w-28">
          <NumberField
            label="Retail"
            ariaLabel="Retail price per gram"
            prefix="$"
            suffix="/g"
            value={retailValue}
            onSave={(val) => onUpdate(product.id, 'fixedRetailPriceUSD', val ? Number(val) : null)}
          />
        </div>
        <div className="w-20">
          <NumberField
            label="Year"
            ariaLabel="Year"
            value={product.year ?? ''}
            onSave={(val) => onUpdate(product.id, 'year', val)}
          />
        </div>

        {/* In shop — inline ghost switch with a single label, no boxed well. */}
        <div className="flex flex-col gap-1">
          <span className="text-ui-11 uppercase tracking-[1.2px] text-tea-text-sec">In shop</span>
          <button
            role="switch"
            aria-checked={product.isPublic}
            aria-label="Show in shop"
            onClick={() => onUpdate(product.id, 'isPublic', !product.isPublic)}
            className={`tap-target relative w-12 h-7 rounded-full transition-colors shrink-0 self-start ${product.isPublic ? 'bg-tea-gold' : 'bg-tea-surface'}`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-tea-bg transition-transform ${product.isPublic ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
