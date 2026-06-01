import React, { useLayoutEffect, useRef } from 'react';
import { Archive, Check, Eye, EyeOff, Globe, History, MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react';
import { GhostInput } from '../ProductEditPanel';
import type { Product } from '../../types';
import { fmtNum } from '../../../utils/formatNumber';
import { getThemeColor } from '../../themeUtils';
import { TYPE_OPTIONS } from './config';
import type { ColDef } from './types';
import { isFeaturedButHidden, stripMatchingYear } from './helpers';

export interface InventoryRowProps {
  product: Product;
  globalIdx: number;
  isSelected: boolean;
  focusedCol: number | null;
  isEditMode: boolean;
  visibleCols: readonly ColDef[];
  splitViewCols: readonly ColDef[];
  splitView: boolean;
  rowHeight: number;
  isPanelOpen: boolean;
  isDropdownOpen: boolean;
  onRowClick: (productId: string, globalIdx: number, e: React.MouseEvent) => void;
  onLongPressSelect: (productId: string, globalIdx: number) => void;
  onProductUpdate: (id: string, field: keyof Product, value: any) => void;
  onSelectionAwareUpdate: (product: Product, field: keyof Product, value: any) => void;
  onOpenPanel: (product: Product) => void;
  onToggleDropdown: (productId: string | null) => void;
  onStockHistory: (id: string, name: string) => void;
  onRestock: (product: Product) => void;
  onDeleteRequest: (product: Product) => void;
  showToast: (msg: string, type: string, opts?: any) => void;
  navigate: (path: string) => void;
}

// Canonical inventory row — see DesignSystemShowcase § Inventory list (INV_ROWS).
// Serif numerics for year/grams/price, dot+label for type, gold-tinted active row,
// star/eye/edit/more action cluster on the right edge.
function InventoryRowBase(props: InventoryRowProps) {
  const {
    product, globalIdx, isSelected, focusedCol, isEditMode, visibleCols, splitViewCols,
    splitView, rowHeight, isPanelOpen, isDropdownOpen,
    onRowClick, onLongPressSelect, onProductUpdate, onSelectionAwareUpdate,
    onOpenPanel, onToggleDropdown, onStockHistory, onRestock, onDeleteRequest, showToast, navigate,
  } = props;

  const globalIdxRef = useRef(globalIdx);
  useLayoutEffect(() => { globalIdxRef.current = globalIdx; }, [globalIdx]);

  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpFired = useRef(false);

  const cellId = (colIdx: number) => `cell-${globalIdx}-${colIdx}`;
  const ghostId = (colIdx: number) => `ghost-${globalIdx}-${colIdx}`;

  // Tone tokens — the PRODUCT NAME stays one calm color (text, or text-sec when
  // sold/archived) so the Product column reads consistently. The low-stock signal
  // is confined to the STOCK NUMBER alone (`stockTone`) so it informs without
  // shouting; every other numeric column stays neutral. This keeps the list calm
  // and reserves the loudest treatment for the SELECTED row, not a warning.
  const isOut = (product.stockGrams ?? 0) <= 0;
  const isLow = !isOut && product.stockGrams <= product.lowStockThreshold;
  const isSold = product.status === 'Archived' || isOut;
  const nameTone = isSold ? 'text-tea-text-sec' : 'text-tea-text';
  // Non-stock numbers (retail, cost) never carry the low-stock tint — low stock
  // has nothing to do with price, so tinting it there was pure noise.
  const numTone = isSold ? 'text-tea-text-dim' : 'text-tea-text';
  // The stock number is the only place the low-stock signal lives. `tea-gold-lt`
  // is a softer bronze than the old `tea-readgold`, so the warning reads as a
  // quiet flag rather than the brightest thing in the row.
  const stockTone = isLow ? 'text-tea-gold-lt' : isSold ? 'text-tea-text-dim' : 'text-tea-text';

  // The Year column already shows the vintage, so a trailing year baked into the
  // name ("Aged Liu Bao 1960") is redundant. Strip it for display ONLY when it
  // matches product.year — never touch a trailing number that isn't the vintage.
  const displayName = stripMatchingYear(product.productName, product.year);

  const renderCell = (colKey: string, colIndex: number) => {
    const fr = focusedCol === colIndex ? 'ring-1 ring-tea-gold/50 rounded' : '';
    switch (colKey) {
      case 'productName': {
        // Subtitle slot is always rendered (with &nbsp; fallback) so every row
        // has the same height regardless of whether a givenName/form is present.
        const subtitle = product.givenName
          ? <>{product.givenName}{product.form && <span className="ml-1 opacity-70">· {product.form}</span>}</>
          : product.form
            ? product.form
            : ' ';
        return (
          <td key={colKey} id={cellId(colIndex)} className={`px-3 py-1 align-middle overflow-hidden ${fr}`}>
            <div className="flex flex-col justify-center">
              {isEditMode ? (
                <GhostInput value={displayName} onSave={(val) => onProductUpdate(product.id, 'productName', val)} className={`font-display text-ui-17 leading-snug truncate font-medium ${nameTone}`} ariaLabel="Product name" />
              ) : (
                <span className={`font-display text-ui-17 leading-snug truncate font-medium ${nameTone}`}>{displayName}</span>
              )}
              <span className="font-sans text-ui-11 text-tea-text-dim mt-px truncate block" style={{ letterSpacing: '0.02em' }}>
                {subtitle}
              </span>
            </div>
          </td>
        );
      }
      case 'type': {
        const dotColor = getThemeColor(product.type);
        return (
          <td key={colKey} id={cellId(colIndex)} className={`px-3 py-1 text-ui-13 text-tea-text-sec align-middle overflow-hidden ${fr}`}>
            {isEditMode ? (
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: dotColor }} />
                <select
                  value={product.type}
                  onChange={(e) => onProductUpdate(product.id, 'type', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent outline-none appearance-none cursor-pointer text-ui-13 text-tea-text-sec hover:text-tea-text focus-visible:ring-2 focus-visible:ring-tea-gold/50 rounded"
                  aria-label="Tea type"
                >
                  {TYPE_OPTIONS.map((t) => <option key={t} value={t} className="bg-tea-surface text-tea-text">{t}</option>)}
                </select>
              </label>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: dotColor }} />
                {product.type}
              </span>
            )}
          </td>
        );
      }
      case 'year': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-3 py-1 text-ui-13 align-middle num overflow-hidden ${fr} ${isSold ? 'text-tea-text-dim' : 'text-tea-text-sec'}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Year" value={product.year || ''} onSave={(val) => onProductUpdate(product.id, 'year', val)} type="number" placeholder="YYYY" className="num text-ui-13 text-tea-text-sec" />
            : <span>{product.year || '—'}</span>}
        </td>
      );
      case 'originRegion': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-3 py-1 text-ui-13 text-tea-text-sec align-middle overflow-hidden ${fr}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Origin region" value={product.originRegion} onSave={(val) => onProductUpdate(product.id, 'originRegion', val)} className="font-sans text-ui-13 text-tea-text-sec truncate" />
            : <span className="truncate block">{product.originRegion}</span>}
        </td>
      );
      case 'stockGrams': {
        return (
          <td key={colKey} id={cellId(colIndex)} className={`px-3 py-1 text-ui-13 text-right num align-middle overflow-hidden ${fr} ${stockTone}`}>
            {/* Stock is always editable inline — type a new gram value directly in
                the cell. The clock icon (left) opens stock history; the number
                itself no longer hijacks the click for history. */}
            <div className="inline-flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => { e.stopPropagation(); onStockHistory(product.id, product.givenName || product.productName); }}
                className="tap-target shrink-0 text-tea-text-dim hover:text-tea-gold transition-colors"
                title="View stock history"
                aria-label={`View stock history for ${product.productName}`}
              >
                <History size={12} aria-hidden="true" />
              </button>
              {product.recheckStock && (
                <button aria-label={product.recheckStock ? 'Clear recheck flag' : 'Flag for stock recheck'} title="Stock needs rechecking — clear flag" onClick={(e) => { e.stopPropagation(); onProductUpdate(product.id, 'recheckStock', !product.recheckStock); }} className="text-ui-10 text-tea-text-dim hover:text-tea-text-sec transition-colors shrink-0"><span aria-hidden="true">&#9888;</span></button>
              )}
              <GhostInput id={ghostId(colIndex)} ariaLabel="Stock grams" value={isOut ? 0 : Math.round(product.stockGrams)} onSave={(val) => onProductUpdate(product.id, 'stockGrams', val)} type="number" align="right" className={`num text-ui-13 w-12 ${stockTone}`} />
            </div>
          </td>
        );
      }
      case 'costAmount': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-3 py-1 text-ui-13 text-right num align-middle overflow-hidden ${fr} ${numTone}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Cost amount" value={product.costAmount} onSave={(val) => onProductUpdate(product.id, 'costAmount', val)} type="number" align="right" className={`num text-ui-13 ${numTone}`} />
            : <span>{product.costAmount > 0 ? product.costAmount.toLocaleString() : '—'}</span>}
        </td>
      );
      case 'costPerGramUSD': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-3 py-1 text-ui-13 text-right num align-middle overflow-hidden ${fr} ${numTone}`}>
          <span>{product.costPerGramUSD > 0 ? fmtNum(product.costPerGramUSD) : '—'}</span>
        </td>
      );
      case 'pricePerGramUSD': {
        const sellingPrice = product.fixedRetailPriceUSD ?? product.pricePerGramUSD;
        // Price-override marker: a soft bronze, not the brightest tone — the
        // selected row is what should stand out, not a per-row price flag.
        const overrideTone = product.fixedRetailPriceUSD != null && !isSold ? 'text-tea-gold-lt' : numTone;
        return (
          <td key={colKey} id={cellId(colIndex)} className={`px-3 py-1 text-ui-13 text-right num align-middle overflow-hidden ${fr} ${overrideTone}`}>
            {isEditMode
              ? <GhostInput id={ghostId(colIndex)} ariaLabel="Retail price per gram (USD)" value={sellingPrice?.toFixed(2)} onSave={(val) => onProductUpdate(product.id, 'fixedRetailPriceUSD', val ? Number(val) : null)} type="number" align="right" className={`num text-ui-13 ${overrideTone}`} />
              : <span>{sellingPrice != null ? fmtNum(sellingPrice) : '—'}</span>}
          </td>
        );
      }
      case 'material': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-3 py-1 text-ui-13 text-tea-text-sec align-middle overflow-hidden ${fr}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Material" value={product.material || ''} onSave={(val) => onProductUpdate(product.id, 'material', val)} className="font-sans text-ui-13 text-tea-text-sec truncate" />
            : <span className="truncate block">{product.material || '—'}</span>}
        </td>
      );
      case 'teawareCategory': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-3 py-1 text-ui-13 text-tea-text-sec align-middle overflow-hidden ${fr}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Teaware category" value={product.teawareCategory || ''} onSave={(val) => onProductUpdate(product.id, 'teawareCategory', val)} className="font-sans text-ui-13 text-tea-text-sec truncate" />
            : <span className="capitalize truncate block">{product.teawareCategory || '—'}</span>}
        </td>
      );
      case 'capacityMl': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-3 py-1 text-ui-13 text-right num align-middle overflow-hidden ${fr} ${numTone}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Capacity (ml)" value={product.capacityMl || ''} onSave={(val) => onProductUpdate(product.id, 'capacityMl', val)} type="number" align="right" className={`num text-ui-13 ${numTone}`} />
            : <span>{product.capacityMl ? `${product.capacityMl}ml` : '—'}</span>}
        </td>
      );
      case 'quantityUnits': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-3 py-1 text-ui-13 text-right num align-middle overflow-hidden ${fr} ${numTone}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Quantity units" value={product.quantityUnits || ''} onSave={(val) => onProductUpdate(product.id, 'quantityUnits', val)} type="number" align="right" className={`num text-ui-13 ${numTone}`} />
            : <span>{product.quantityUnits ?? '—'}</span>}
        </td>
      );
      case 'verified': {
        const isVerified = !!product.stockVerifiedAt;
        return (
          <td key={colKey} id={cellId(colIndex)} className={`px-3 py-1 align-middle text-center ${fr}`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const name = product.givenName || product.productName;
                if (!isVerified) {
                  onProductUpdate(product.id, 'stockVerifiedAt', new Date().toISOString());
                  showToast(`${name} verified`, 'success', {
                    duration: 5000,
                    action: { label: 'Undo', onClick: () => onProductUpdate(product.id, 'stockVerifiedAt', null) },
                  });
                } else {
                  onProductUpdate(product.id, 'stockVerifiedAt', null);
                }
              }}
              title={isVerified ? `Verified ${new Date(product.stockVerifiedAt!).toLocaleDateString()}` : 'Mark as verified'}
              aria-label={isVerified ? `Clear verification for ${product.productName}` : `Mark ${product.productName} as verified`}
              className="tap-target group/verified"
            >
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded transition-colors ${isVerified ? 'bg-tea-surface text-tea-text group-hover/verified:bg-tea-elevated group-hover/verified:text-tea-text-sec' : 'bg-tea-surface text-tea-border group-hover/verified:text-tea-text-sec group-hover/verified:bg-tea-bg'}`}>
                {isVerified ? <Check size={12} strokeWidth={3} /> : <span className="w-3 h-3 rounded-md border border-current" />}
              </span>
            </button>
          </td>
        );
      }
      case 'vendor': return (
        <td key={colKey} className="px-3 py-1 text-ui-13 align-middle overflow-hidden">
          {product.vendor
            ? <button onClick={(e) => { e.stopPropagation(); navigate(`/admin/people?tab=sources&search=${encodeURIComponent(product.vendor!)}`); }} className="text-tea-text-sec hover:text-tea-gold transition-colors truncate block text-left">{product.vendor}</button>
            : <span className="text-tea-text-dim">—</span>}
        </td>
      );
      default: return <td key={colKey} className="px-3 py-1 align-middle text-ui-13 text-tea-text-sec">—</td>;
    }
  };

  // Canonical active-row signature: gold-tinted bg + gold outline (selection or panel open).
  // Every non-active row reads as ONE flat color — no per-row background tints and no
  // whole-row opacity fades (they made the table look like a patchwork of browns).
  // Hidden-from-shop state is carried by the EyeOff icon, not by fading the row.
  const trCls = [
    'border-b border-tea-border last:border-b-0 group cursor-pointer select-none transition-colors',
    isPanelOpen
      ? 'bg-tea-gold/16 outline outline-2 -outline-offset-1 outline-tea-gold/70 shadow-[inset_3px_0_0_0_var(--tea-gold)]'
      : isSelected
        ? 'bg-tea-gold/[0.18] outline outline-2 -outline-offset-1 outline-tea-gold/80 shadow-[inset_3px_0_0_0_var(--tea-gold)]'
        : 'hover:bg-tea-accent-sub',
  ].join(' ');

  return (
    <tr
      data-product-id={product.id}
      className={trCls}
      style={{ height: rowHeight }}
      tabIndex={isEditMode ? -1 : 0}
      aria-selected={isSelected}
      onTouchStart={() => {
        lpFired.current = false;
        lpTimer.current = setTimeout(() => {
          lpFired.current = true;
          onLongPressSelect(product.id, globalIdxRef.current);
        }, 500);
      }}
      onTouchMove={() => { if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; } }}
      onTouchEnd={() => { if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; } }}
      onClick={(e) => {
        if (lpFired.current) { lpFired.current = false; return; }
        onRowClick(product.id, globalIdxRef.current, e);
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onRowClick(product.id, globalIdxRef.current, e as unknown as React.MouseEvent);
      }}
    >
      {(splitView ? splitViewCols : visibleCols).map((col, colIdx) => renderCell(col.key, colIdx))}
      {/* Action cluster — featured STAR (a status toggle) is set apart from the
          eye / edit / more ACTION icons by a hairline divider. Off-state reads as
          a visible outlined star (text-sec, the actionable floor — not the dim
          grey it used to inherit); on-state is a filled bronze star inside a soft
          bronze halo, so the fill — not a colour-only shift — carries the state. */}
      <td className="px-2 py-1 align-middle text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-0 text-tea-text-dim" onClick={(e) => e.stopPropagation()}>
          {!isEditMode && !isSelected && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onSelectionAwareUpdate(product, 'isFeatured', !product.isFeatured); }}
                className={`tap-target p-1 mr-0.5 rounded-full transition-all duration-150 active:scale-90 ${
                  product.isFeatured
                    ? 'text-tea-readgold bg-tea-gold/10'
                    : 'text-tea-text-sec hover:text-tea-readgold hover:bg-tea-gold/[0.06]'
                }`}
                aria-label={product.isFeatured ? 'Featured — remove from shop home' : 'Feature on shop home'}
                aria-pressed={product.isFeatured}
                title={product.isFeatured ? 'Featured — remove' : 'Feature on shop home'}
              >
                <Star size={16} style={product.isFeatured ? { fill: 'currentColor' } : undefined} aria-hidden="true" />
              </button>
              {isFeaturedButHidden(product) && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-tea-readgold shrink-0 -ml-0.5 mr-0.5"
                  title="Featured but hidden from shop"
                  aria-label="Featured but hidden from shop"
                />
              )}
              <span className="w-px h-4 bg-tea-border mx-1 shrink-0" aria-hidden="true" />
              <button
                onClick={(e) => { e.stopPropagation(); onSelectionAwareUpdate(product, 'isPublic', !product.isPublic); }}
                className="tap-target p-1 hover:text-tea-text-sec transition-colors"
                aria-label={product.isPublic ? 'Hide from shop' : 'Show in shop'}
                aria-pressed={product.isPublic}
                title={product.isPublic ? 'Hide' : 'Show'}
              >
                {product.isPublic ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
              </button>
              {!splitView && (
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenPanel(product); }}
                  className="tap-target p-1 hover:text-tea-text-sec transition-colors"
                  aria-label="Edit product"
                  title="Edit"
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
              )}
              {!splitView && (
                <div className="relative" data-row-dropdown>
                  <button
                    onClick={() => onToggleDropdown(isDropdownOpen ? null : product.id)}
                    className="tap-target p-1 hover:text-tea-text-sec transition-colors"
                    aria-label="More actions"
                    aria-haspopup="menu"
                    aria-expanded={isDropdownOpen}
                    title="More actions"
                  >
                    <MoreHorizontal size={14} aria-hidden="true" />
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-tea-surface rounded-md shadow-lg py-1 min-w-[160px] border border-tea-border" style={{ boxShadow: '0 4px 20px rgba(24,19,14,0.3)' }}>
                      <button onClick={() => onRestock(product)} className="w-full flex items-center gap-2 px-3 py-1 text-ui-13 text-tea-text hover:bg-tea-accent-sub transition-colors text-left"><Globe size={12} /> Restock via Compass</button>
                      <button onClick={() => { onProductUpdate(product.id, 'status', product.status === 'Archived' ? 'Active' : 'Archived'); onToggleDropdown(null); }} className="w-full flex items-center gap-2 px-3 py-1 text-ui-13 text-tea-text hover:bg-tea-accent-sub transition-colors text-left"><Archive size={12} /> {product.status === 'Archived' ? 'Unarchive' : 'Archive'}</button>
                      <div className="my-1 border-t border-tea-border" />
                      <button onClick={() => { onDeleteRequest(product); onToggleDropdown(null); }} className="w-full flex items-center gap-2 px-3 py-1 text-ui-13 text-tea-readgold hover:bg-tea-gold/[0.06] transition-colors text-left"><Trash2 size={12} /> Delete permanently</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export const InventoryRow = React.memo(InventoryRowBase, (prev, next) =>
  prev.product === next.product &&
  prev.globalIdx === next.globalIdx &&
  prev.isSelected === next.isSelected &&
  prev.focusedCol === next.focusedCol &&
  prev.isEditMode === next.isEditMode &&
  prev.visibleCols === next.visibleCols &&
  prev.splitViewCols === next.splitViewCols &&
  prev.splitView === next.splitView &&
  prev.rowHeight === next.rowHeight &&
  prev.isPanelOpen === next.isPanelOpen &&
  prev.isDropdownOpen === next.isDropdownOpen
);
