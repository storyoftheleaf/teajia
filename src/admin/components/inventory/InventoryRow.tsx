import React, { useLayoutEffect, useRef } from 'react';
import { Archive, Check, Eye, EyeOff, Globe, MoreHorizontal, Pencil, Star } from 'lucide-react';
import { GhostInput } from '../ProductEditPanel';
import type { Product } from '../../types';
import { fmtNum } from '../../../utils/formatNumber';
import { getThemeColor } from '../../themeUtils';
import { TYPE_OPTIONS } from './config';
import type { ColDef } from './types';
import { getRowBorderClass, isFeaturedButHidden } from './helpers';

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
    onOpenPanel, onToggleDropdown, onStockHistory, onRestock, showToast, navigate,
  } = props;

  const globalIdxRef = useRef(globalIdx);
  useLayoutEffect(() => { globalIdxRef.current = globalIdx; }, [globalIdx]);

  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpFired = useRef(false);

  const cellId = (colIdx: number) => `cell-${globalIdx}-${colIdx}`;
  const ghostId = (colIdx: number) => `ghost-${globalIdx}-${colIdx}`;

  // Tone tokens — canonical: low-stock → tea-readgold; sold-out name → text-sec, numerics → text-dim.
  const isOut = (product.stockGrams ?? 0) <= 0;
  const isLow = !isOut && product.stockGrams <= product.lowStockThreshold;
  const isSold = product.status === 'Archived' || isOut;
  const nameTone = isLow ? 'text-tea-readgold' : isSold ? 'text-tea-text-sec' : 'text-tea-text';
  const numTone = isLow ? 'text-tea-readgold' : isSold ? 'text-tea-text-dim' : 'text-tea-text';

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
          <td key={colKey} id={cellId(colIndex)} className={`px-4 py-3 align-middle overflow-hidden ${fr}`}>
            <div className="flex flex-col justify-center">
              {isEditMode ? (
                <GhostInput value={product.productName} onSave={(val) => onProductUpdate(product.id, 'productName', val)} className={`font-display text-ui-17 leading-tight truncate ${nameTone}`} ariaLabel="Product name" />
              ) : (
                <span className={`font-display text-ui-17 leading-tight truncate ${nameTone}`}>{product.productName}</span>
              )}
              <span className="font-sans text-ui-11 text-tea-text-dim mt-0.5 truncate block" style={{ letterSpacing: '0.02em' }}>
                {subtitle}
              </span>
            </div>
          </td>
        );
      }
      case 'type': {
        const dotColor = getThemeColor(product.type);
        return (
          <td key={colKey} id={cellId(colIndex)} className={`px-4 py-3 text-ui-13 text-tea-text-sec align-middle overflow-hidden ${fr}`}>
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
        <td key={colKey} id={cellId(colIndex)} className={`px-4 py-3 text-ui-15 align-middle font-serif tabular-nums overflow-hidden ${fr} ${isSold ? 'text-tea-text-dim' : 'text-tea-text-sec'}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Year" value={product.year || ''} onSave={(val) => onProductUpdate(product.id, 'year', val)} type="number" placeholder="YYYY" className="font-serif text-ui-15 tabular-nums text-tea-text-sec" />
            : <span>{product.year || '—'}</span>}
        </td>
      );
      case 'originRegion': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-4 py-3 text-ui-13 text-tea-text-sec align-middle overflow-hidden ${fr}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Origin region" value={product.originRegion} onSave={(val) => onProductUpdate(product.id, 'originRegion', val)} className="font-sans text-ui-13 text-tea-text-sec truncate" />
            : <span className="truncate block">{product.originRegion}</span>}
        </td>
      );
      case 'stockGrams': {
        return (
          <td key={colKey} id={cellId(colIndex)} className={`px-4 py-3 text-ui-15 text-right tabular-nums align-middle font-serif overflow-hidden ${fr} ${numTone}`}>
            {isEditMode ? (
              <div className="inline-flex items-center gap-1 justify-end">
                <GhostInput id={ghostId(colIndex)} ariaLabel="Stock grams" value={product.stockGrams} onSave={(val) => onProductUpdate(product.id, 'stockGrams', val)} type="number" align="right" className={`font-serif text-ui-15 tabular-nums ${numTone}`} />
                <button aria-label={product.recheckStock ? 'Clear recheck flag' : 'Flag for stock recheck'} title={product.recheckStock ? 'Clear recheck flag' : 'Flag for stock recheck'} onClick={(e) => { e.stopPropagation(); onProductUpdate(product.id, 'recheckStock', !product.recheckStock); }} className={`text-ui-10 transition-colors ${product.recheckStock ? 'text-tea-readgold hover:text-tea-text-sec' : 'text-tea-border hover:text-tea-readgold'}`}><span aria-hidden="true">&#9888;</span></button>
              </div>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); onStockHistory(product.id, product.givenName || product.productName); }} className={`tap-target inline-flex items-center gap-1 justify-end hover:text-tea-gold transition-colors ${numTone}`} title="View stock history" aria-label={`View stock history for ${product.productName}`}>
                {product.recheckStock && <span title="Stock needs rechecking" aria-label="Stock needs rechecking" className="text-tea-readgold text-ui-10"><span aria-hidden="true">&#9888;</span></span>}
                {isOut ? '0' : Math.round(product.stockGrams)}
              </button>
            )}
          </td>
        );
      }
      case 'costAmount': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-4 py-3 text-ui-15 text-right tabular-nums align-middle font-serif overflow-hidden ${fr} ${numTone}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Cost amount" value={product.costAmount} onSave={(val) => onProductUpdate(product.id, 'costAmount', val)} type="number" align="right" className={`font-serif text-ui-15 tabular-nums ${numTone}`} />
            : <span>{product.costAmount > 0 ? product.costAmount.toLocaleString() : '—'}</span>}
        </td>
      );
      case 'costPerGramUSD': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-4 py-3 text-ui-15 text-right tabular-nums align-middle font-serif overflow-hidden ${fr} ${numTone}`}>
          <span>{product.costPerGramUSD > 0 ? fmtNum(product.costPerGramUSD) : '—'}</span>
        </td>
      );
      case 'pricePerGramUSD': {
        const sellingPrice = product.fixedRetailPriceUSD ?? product.pricePerGramUSD;
        const overrideTone = product.fixedRetailPriceUSD != null && !isLow && !isSold ? 'text-tea-readgold' : numTone;
        return (
          <td key={colKey} id={cellId(colIndex)} className={`px-4 py-3 text-ui-15 text-right tabular-nums align-middle font-serif overflow-hidden ${fr} ${overrideTone}`}>
            {isEditMode
              ? <GhostInput id={ghostId(colIndex)} ariaLabel="Retail price per gram (USD)" value={sellingPrice?.toFixed(2)} onSave={(val) => onProductUpdate(product.id, 'fixedRetailPriceUSD', val ? Number(val) : null)} type="number" align="right" className={`font-serif text-ui-15 tabular-nums ${overrideTone}`} />
              : <span>{sellingPrice != null ? fmtNum(sellingPrice) : '—'}</span>}
          </td>
        );
      }
      case 'material': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-4 py-3 text-ui-13 text-tea-text-sec align-middle overflow-hidden ${fr}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Material" value={product.material || ''} onSave={(val) => onProductUpdate(product.id, 'material', val)} className="font-sans text-ui-13 text-tea-text-sec truncate" />
            : <span className="truncate block">{product.material || '—'}</span>}
        </td>
      );
      case 'teawareCategory': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-4 py-3 text-ui-13 text-tea-text-sec align-middle overflow-hidden ${fr}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Teaware category" value={product.teawareCategory || ''} onSave={(val) => onProductUpdate(product.id, 'teawareCategory', val)} className="font-sans text-ui-13 text-tea-text-sec truncate" />
            : <span className="capitalize truncate block">{product.teawareCategory || '—'}</span>}
        </td>
      );
      case 'capacityMl': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-4 py-3 text-ui-15 text-right tabular-nums align-middle font-serif overflow-hidden ${fr} ${numTone}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Capacity (ml)" value={product.capacityMl || ''} onSave={(val) => onProductUpdate(product.id, 'capacityMl', val)} type="number" align="right" className={`font-serif text-ui-15 tabular-nums ${numTone}`} />
            : <span>{product.capacityMl ? `${product.capacityMl}ml` : '—'}</span>}
        </td>
      );
      case 'quantityUnits': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-4 py-3 text-ui-15 text-right tabular-nums align-middle font-serif overflow-hidden ${fr} ${numTone}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Quantity units" value={product.quantityUnits || ''} onSave={(val) => onProductUpdate(product.id, 'quantityUnits', val)} type="number" align="right" className={`font-serif text-ui-15 tabular-nums ${numTone}`} />
            : <span>{product.quantityUnits ?? '—'}</span>}
        </td>
      );
      case 'verified': {
        const isVerified = !!product.stockVerifiedAt;
        return (
          <td key={colKey} id={cellId(colIndex)} className={`px-4 py-3 align-middle text-center ${fr}`}>
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
                {isVerified ? <Check size={12} strokeWidth={3} /> : <span className="w-3 h-3 rounded-sm border border-current" />}
              </span>
            </button>
          </td>
        );
      }
      case 'vendor': return (
        <td key={colKey} className="px-4 py-3 text-ui-13 align-middle overflow-hidden">
          {product.vendor
            ? <button onClick={(e) => { e.stopPropagation(); navigate(`/admin/people?tab=sources&search=${encodeURIComponent(product.vendor!)}`); }} className="text-tea-text-sec hover:text-tea-gold transition-colors truncate block text-left">{product.vendor}</button>
            : <span className="text-tea-text-dim">—</span>}
        </td>
      );
      default: return <td key={colKey} className="px-4 py-3 align-middle text-ui-13 text-tea-text-sec">—</td>;
    }
  };

  // Canonical active-row signature: gold-tinted bg + 1px gold outline (selection or panel open).
  const borderCls = !isSelected && !isPanelOpen ? getRowBorderClass(product) : '';
  const activeRow = isSelected || isPanelOpen;
  const trCls = [
    'border-b border-tea-border last:border-b-0 group cursor-pointer select-none transition-colors',
    borderCls,
    activeRow
      ? 'bg-tea-gold/8 outline outline-1 -outline-offset-1 outline-tea-gold/40'
      : !product.isPublic
        ? 'opacity-60 hover:opacity-100 hover:bg-tea-accent-sub'
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
      {/* Action cluster — canonical: star / eye / edit / more, each p-1.5 Lucide 14px */}
      <td className="px-3 py-3 align-middle text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-0.5 text-tea-text-dim" onClick={(e) => e.stopPropagation()}>
          {!isEditMode && !isSelected && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onSelectionAwareUpdate(product, 'isFeatured', !product.isFeatured); }}
                className={`p-1.5 transition-colors ${product.isFeatured ? 'text-tea-readgold' : 'hover:text-tea-readgold'}`}
                aria-label={product.isFeatured ? 'Remove featured star' : 'Mark as featured'}
                aria-pressed={product.isFeatured}
                title={product.isFeatured ? 'Remove star' : 'Star'}
              >
                <Star size={14} style={product.isFeatured ? { fill: 'currentColor' } : undefined} aria-hidden="true" />
              </button>
              {isFeaturedButHidden(product) && <span className="font-body italic text-ui-10 text-tea-text-sec leading-none">hidden</span>}
              <button
                onClick={(e) => { e.stopPropagation(); onSelectionAwareUpdate(product, 'isPublic', !product.isPublic); }}
                className="p-1.5 hover:text-tea-text-sec transition-colors"
                aria-label={product.isPublic ? 'Hide from shop' : 'Show in shop'}
                aria-pressed={product.isPublic}
                title={product.isPublic ? 'Hide' : 'Show'}
              >
                {product.isPublic ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
              </button>
              {!splitView && (
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenPanel(product); }}
                  className="p-1.5 hover:text-tea-text-sec transition-colors"
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
                    className="p-1.5 hover:text-tea-text-sec transition-colors"
                    aria-label="More actions"
                    aria-haspopup="menu"
                    aria-expanded={isDropdownOpen}
                    title="More actions"
                  >
                    <MoreHorizontal size={14} aria-hidden="true" />
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-tea-surface rounded-lg shadow-lg py-1 min-w-[160px] border border-tea-border" style={{ boxShadow: '0 4px 20px rgba(24,19,14,0.3)' }}>
                      <button onClick={() => onRestock(product)} className="w-full flex items-center gap-2 px-3 py-2 text-ui-13 text-tea-text hover:bg-tea-accent-sub transition-colors text-left"><Globe size={12} /> Restock via Compass</button>
                      <button onClick={() => { onProductUpdate(product.id, 'status', product.status === 'Archived' ? 'Active' : 'Archived'); onToggleDropdown(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-ui-13 text-tea-text hover:bg-tea-accent-sub transition-colors text-left"><Archive size={12} /> {product.status === 'Archived' ? 'Unarchive' : 'Archive'}</button>
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
