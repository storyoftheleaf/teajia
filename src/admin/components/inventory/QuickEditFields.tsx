import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { Product, ExchangeRate } from '../../types';
import { getThemeColor } from '../../themeUtils';

export interface QuickEditColumn {
  key: string;
  /** Tailwind width class (e.g. 'w-[9%]') — the SAME class the table column uses. */
  width: string;
}

export interface QuickEditFieldsProps {
  /** The product being quick-edited. */
  product: Product;
  /** The visible columns (key + width), in order — the editors align to these. */
  cols: QuickEditColumn[];
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
  /** Opens explicit stock movement entry; spreadsheet stock edits are recounts. */
  onStockMovement?: (product: Product, trigger: HTMLElement) => void;
}

// A single editable value, sitting in its own column cell directly under the
// matching table header. No label needed — the column header above IS the label.
// Saves on blur only when the value changed, mirroring GhostInput.
const CellInput = ({
  value, onSave, ariaLabel, prefix, suffix,
}: {
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
        className="min-w-0 flex-1 bg-transparent border-0 outline-none text-ui-13 text-right num text-tea-text"
      />
      {suffix && <span className="text-ui-12 text-tea-text-dim shrink-0">{suffix}</span>}
    </span>
  );
};

// The inline quick-edit form. Rendered under the long-pressed row as a nested
// table-fixed grid that mirrors the parent's column widths, so each editor lands
// directly beneath its real column: Stock under Stock, Year under Year, Retail
// under Retail. Columns with no quick-edit field stay empty; the in-shop chip and
// the two actions ride in the wide Product (first) column. Saves route through
// onUpdate (same path as the table's inline edits), so persistence is unchanged.
export const QuickEditFields: React.FC<QuickEditFieldsProps> = ({
  product, cols, onUpdate, onTasting, onFullEdit, rates, onClose, onStockMovement,
}) => {
  void rates; // accepted for forward-compatible pricing display; basic fields don't need it yet
  const retailValue = product.fixedRetailPriceUSD ?? product.pricePerGramUSD ?? '';
  const accent = getThemeColor(product.type);

  // Renders the editor that belongs in a given column, or null if that column
  // has no quick-edit field.
  const editorFor = (key: string): React.ReactNode => {
    switch (key) {
      case 'stockGrams':
        return (
          <button
            type="button"
            aria-label={`Recount stock for ${product.productName || product.givenName}`}
            onClick={(event) => onStockMovement?.(product, event.currentTarget)}
            className="tap-target w-full rounded-md bg-tea-bg border border-tea-border px-2 py-1 text-ui-13 text-right num text-tea-text hover:border-tea-gold transition-colors"
          >
            {Math.round(product.stockGrams ?? 0)}g · Recount
          </button>
        );
      case 'year':
        return (
          <CellInput
            ariaLabel="Year"
            value={product.year ?? ''}
            onSave={(val) => onUpdate(product.id, 'year', val)}
          />
        );
      case 'pricePerGramUSD':
        return (
          <CellInput
            ariaLabel="Retail price per gram" prefix="$"
            value={retailValue}
            onSave={(val) => onUpdate(product.id, 'fixedRetailPriceUSD', val ? Number(val) : null)}
          />
        );
      default:
        return null;
    }
  };

  // The first (widest, Product) column carries the in-shop control — a clearly
  // LABELLED checkbox so it reads as "show this tea in the shop", never a bare
  // pill that looks like a stray tag or a date.
  const inShop = (
    <button
      role="switch"
      aria-checked={product.isPublic}
      aria-label="Show in shop"
      onClick={() => onUpdate(product.id, 'isPublic', !product.isPublic)}
      className="tap-target inline-flex items-center gap-2 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
    >
      <span
        className={`inline-flex items-center justify-center w-4 h-4 rounded-[4px] border transition-colors ${
          product.isPublic ? 'bg-tea-gold border-tea-gold text-tea-bg' : 'border-tea-border'
        }`}
        aria-hidden="true"
      >
        {product.isPublic && <Check size={11} strokeWidth={3} />}
      </span>
      Show in shop
    </button>
  );

  return (
    <div
      className="inv-detail-panel relative overflow-hidden py-2"
      style={{ boxShadow: `inset 3px 0 0 0 ${accent}` }}
    >
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          {cols.map(c => <col key={c.key} className={c.width} />)}
        </colgroup>
        <tbody>
          <tr>
            {cols.map((c, i) => {
              const isFirst = i === 0;
              return (
                <td key={c.key} className={`align-middle px-3 ${isFirst ? 'pl-5' : ''}`}>
                  {/* First (widest) column: a left-aligned close, the in-shop
                      control, and the two actions as a quiet line so nothing is
                      crammed. The numeric columns just hold their aligned editor. */}
                  {isFirst ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-3">
                        {onClose && (
                          <button
                            onClick={onClose}
                            aria-label="Close quick edit"
                            className="tap-target shrink-0 -ml-1 text-tea-text-sec hover:text-tea-text transition-colors"
                          >
                            <X size={16} strokeWidth={1.75} />
                          </button>
                        )}
                        {inShop}
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => onTasting(product)}
                          className="tap-target text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
                        >
                          Tasting
                        </button>
                        <button
                          onClick={() => onFullEdit(product)}
                          className="tap-target text-ui-13 text-tea-gold hover:text-tea-gold-lt transition-colors font-medium"
                        >
                          Full edit
                        </button>
                      </div>
                    </div>
                  ) : editorFor(c.key)}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
};
