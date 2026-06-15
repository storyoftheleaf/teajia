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

// A single numeric field rendered as a filled well: micro-cap label above, a
// mono right-aligned input in a recessed box with an optional unit affordance.
// Saves on blur only when the value actually changed, mirroring GhostInput so
// onUpdate fires exactly once per edit.
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
    <label className="flex flex-col gap-1.5">
      <span className="text-ui-11 uppercase tracking-wide text-tea-text-dim font-sans">{label}</span>
      <span className="qe-well flex items-center gap-1.5 h-11 rounded-md bg-tea-bg border border-tea-border px-3 focus-within:border-tea-gold">
        {prefix && <span className="text-ui-13 text-tea-text-dim shrink-0 num">{prefix}</span>}
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
          className="min-w-0 flex-1 bg-transparent border-0 outline-none text-ui-15 text-right num text-tea-text"
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
      className="inv-detail-panel relative bg-tea-elevated rounded-xl mx-3 my-2 pl-5 pr-4 pt-3 pb-4 overflow-hidden"
      style={{ boxShadow: `inset 3px 0 0 0 ${accent}` }}
    >
      {/* Header — name in the display serif, romanized name + vendor quiet beneath. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-ui-17 text-tea-text truncate leading-snug">{name}</p>
          {secondary && (
            <p className="text-ui-12 text-tea-text-dim truncate leading-snug mt-0.5">{secondary}</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close quick edit"
            className="tap-target shrink-0 -mr-1 -mt-0.5 text-tea-text-sec hover:text-tea-text transition-colors"
          >
            <X size={17} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Fields — 2-up grid on wider widths, single column on narrow phones. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 mt-3">
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
          prefix="$"
          suffix="/g"
          value={retailValue}
          onSave={(val) => onUpdate(product.id, 'fixedRetailPriceUSD', val ? Number(val) : null)}
        />
        <NumberField
          label="Year"
          ariaLabel="Year"
          value={product.year ?? ''}
          onSave={(val) => onUpdate(product.id, 'year', val)}
        />

        {/* Show in shop — inline labeled switch sitting in its own grid cell. */}
        <label className="flex flex-col gap-1.5">
          <span className="text-ui-11 uppercase tracking-wide text-tea-text-dim font-sans">Visibility</span>
          <span className="flex items-center justify-between gap-3 h-11 rounded-md bg-tea-bg border border-tea-border px-3">
            <span className="text-ui-14 text-tea-text-sec">Show in shop</span>
            <button
              role="switch"
              aria-checked={product.isPublic}
              aria-label="Show in shop"
              onClick={() => onUpdate(product.id, 'isPublic', !product.isPublic)}
              className={`tap-target relative w-12 h-7 rounded-full transition-colors shrink-0 ${product.isPublic ? 'bg-tea-gold' : 'bg-tea-surface'}`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-tea-bg transition-transform ${product.isPublic ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-4">
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
