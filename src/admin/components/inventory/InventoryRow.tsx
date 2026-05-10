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

function InventoryRowBase(props: InventoryRowProps) {
  const {
    product, globalIdx, isSelected, focusedCol, isEditMode, visibleCols,
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

  const renderCell = (colKey: string, colIndex: number) => {
    const fr = focusedCol === colIndex ? 'ring-1 ring-tea-gold/50 rounded' : '';
    switch (colKey) {
      case 'productName': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-4 align-middle overflow-hidden ${fr}`}>
          <div className="flex flex-col justify-center h-full">
            {isEditMode ? (
              <GhostInput value={product.productName} onSave={(val) => onProductUpdate(product.id, 'productName', val)} className="font-serif text-sm text-tea-text tracking-wide truncate" ariaLabel="Product name" />
            ) : (
              <>
                <span className="text-sm font-serif text-tea-text tracking-wide group-hover:text-tea-gold transition-colors truncate">{product.productName}</span>
                {product.givenName && (
                  <span className="text-ui-10 text-tea-text-sec font-sans truncate block">
                    {product.givenName}{product.form && <span className="ml-1 opacity-50">· {product.form}</span>}
                  </span>
                )}
                {!product.givenName && product.form && (
                  <span className="text-ui-10 text-tea-text-sec/50 font-sans truncate block">{product.form}</span>
                )}
              </>
            )}
          </div>
        </td>
      );
      case 'type': {
        const dotColor = getThemeColor(product.type);
        return (
          <td key={colKey} id={cellId(colIndex)} className={`px-4 align-middle overflow-hidden ${fr}`}>
            {isEditMode ? (
              <label className="flex items-center gap-2 text-xs font-medium tracking-wide text-tea-text-sec truncate cursor-pointer">
                <span style={{ color: dotColor, fontSize: '10px' }} className="flex-shrink-0">&#9679;</span>
                <select
                  value={product.type}
                  onChange={(e) => onProductUpdate(product.id, 'type', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent outline-none appearance-none cursor-pointer text-xs text-tea-text-sec hover:text-tea-text focus-visible:ring-2 focus-visible:ring-tea-gold/50 rounded"
                  aria-label="Tea type"
                >
                  {TYPE_OPTIONS.map((t) => <option key={t} value={t} className="bg-tea-surface text-tea-text">{t}</option>)}
                </select>
              </label>
            ) : (
              <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-tea-text-sec truncate">
                <span style={{ color: dotColor, fontSize: '10px' }}>&#9679;</span> {product.type}
              </span>
            )}
          </td>
        );
      }
      case 'year': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-4 align-middle overflow-hidden ${fr}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Year" value={product.year || ''} onSave={(val) => onProductUpdate(product.id, 'year', val)} type="number" placeholder="YYYY" className="font-sans text-xs text-tea-text-sec tabular-nums" />
            : <span className="text-xs text-tea-text-sec font-sans tabular-nums">{product.year || '-'}</span>}
        </td>
      );
      case 'originRegion': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-4 align-middle overflow-hidden ${fr}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Origin region" value={product.originRegion} onSave={(val) => onProductUpdate(product.id, 'originRegion', val)} className="font-sans text-xs text-tea-text-sec truncate" />
            : <span className="text-xs text-tea-text-sec font-sans truncate block">{product.originRegion}</span>}
        </td>
      );
      case 'stockGrams': {
        const isOut = (product.stockGrams ?? 0) <= 0;
        const isLow = !isOut && product.stockGrams <= product.lowStockThreshold;
        const stockColor = isOut ? 'text-tea-text-dim' : isLow ? 'text-tea-gold font-bold' : 'text-tea-text-sec';
        return (
          <td key={colKey} id={cellId(colIndex)} className={`px-4 align-middle overflow-hidden ${fr}`}>
            {isEditMode ? (
              <div className="flex items-center gap-1">
                <GhostInput id={ghostId(colIndex)} ariaLabel="Stock grams" value={product.stockGrams} onSave={(val) => onProductUpdate(product.id, 'stockGrams', val)} type="number" className="num text-xs" />
                <button aria-label={product.recheckStock ? 'Clear recheck flag' : 'Flag for stock recheck'} title={product.recheckStock ? 'Clear recheck flag' : 'Flag for stock recheck'} onClick={(e) => { e.stopPropagation(); onProductUpdate(product.id, 'recheckStock', !product.recheckStock); }} className={`text-ui-10 transition-colors ${product.recheckStock ? 'text-tea-gold hover:text-tea-text-sec' : 'text-tea-border hover:text-tea-gold/70'}`} aria-hidden={false}><span aria-hidden="true">&#9888;</span></button>
              </div>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); onStockHistory(product.id, product.givenName || product.productName); }} className={`tap-target num text-xs flex items-center gap-1 hover:text-tea-gold transition-colors ${stockColor}`} title="View stock history" aria-label={`View stock history for ${product.productName}`}>
                {product.recheckStock && <span title="Stock needs rechecking" aria-label="Stock needs rechecking" className="text-tea-gold/80 text-ui-10"><span aria-hidden="true">&#9888;</span></span>}
                {isOut ? '0g' : Math.round(product.stockGrams)}
              </button>
            )}
          </td>
        );
      }
      case 'costAmount': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-4 align-middle overflow-hidden ${fr}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Cost amount" value={product.costAmount} onSave={(val) => onProductUpdate(product.id, 'costAmount', val)} type="number" className="num text-xs" />
            : <span className="num text-xs text-tea-text-sec">{product.costAmount > 0 ? product.costAmount.toLocaleString() : '-'}</span>}
        </td>
      );
      case 'costPerGramUSD': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-4 align-middle overflow-hidden ${fr}`}>
          <span className="num text-xs text-tea-text-sec">{product.costPerGramUSD > 0 ? fmtNum(product.costPerGramUSD) : '-'}</span>
        </td>
      );
      case 'pricePerGramUSD': {
        const sellingPrice = product.fixedRetailPriceUSD ?? product.pricePerGramUSD;
        return (
          <td key={colKey} id={cellId(colIndex)} className={`px-4 align-middle overflow-hidden ${fr}`}>
            {isEditMode
              ? <GhostInput id={ghostId(colIndex)} ariaLabel="Retail price per gram (USD)" value={sellingPrice?.toFixed(2)} onSave={(val) => onProductUpdate(product.id, 'fixedRetailPriceUSD', val ? Number(val) : null)} type="number" className="num text-xs" />
              : <span className={`num text-xs ${product.fixedRetailPriceUSD != null ? 'text-tea-gold' : 'text-tea-text'}`}>{sellingPrice != null ? fmtNum(sellingPrice) : '-'}</span>}
          </td>
        );
      }
      case 'material': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-4 align-middle overflow-hidden ${fr}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Material" value={product.material || ''} onSave={(val) => onProductUpdate(product.id, 'material', val)} className="font-sans text-xs text-tea-text-sec truncate" />
            : <span className="text-xs text-tea-text-sec font-sans truncate block">{product.material || '-'}</span>}
        </td>
      );
      case 'teawareCategory': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-4 align-middle overflow-hidden ${fr}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Teaware category" value={product.teawareCategory || ''} onSave={(val) => onProductUpdate(product.id, 'teawareCategory', val)} className="font-sans text-xs text-tea-text-sec truncate" />
            : <span className="text-xs text-tea-text-sec font-sans capitalize truncate block">{product.teawareCategory || '-'}</span>}
        </td>
      );
      case 'capacityMl': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-4 align-middle overflow-hidden ${fr}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Capacity (ml)" value={product.capacityMl || ''} onSave={(val) => onProductUpdate(product.id, 'capacityMl', val)} type="number" className="num text-xs" />
            : <span className="num text-xs text-tea-text-sec">{product.capacityMl ? `${product.capacityMl}ml` : '-'}</span>}
        </td>
      );
      case 'quantityUnits': return (
        <td key={colKey} id={cellId(colIndex)} className={`px-4 align-middle overflow-hidden ${fr}`}>
          {isEditMode
            ? <GhostInput id={ghostId(colIndex)} ariaLabel="Quantity units" value={product.quantityUnits || ''} onSave={(val) => onProductUpdate(product.id, 'quantityUnits', val)} type="number" className="num text-xs" />
            : <span className="num text-xs text-tea-text-sec">{product.quantityUnits ?? '-'}</span>}
        </td>
      );
      case 'verified': {
        const isVerified = !!product.stockVerifiedAt;
        return (
          <td key={colKey} id={cellId(colIndex)} className={`px-4 align-middle text-center ${fr}`}>
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
        <td key={colKey} className="px-4 align-middle overflow-hidden">
          {product.vendor
            ? <button onClick={(e) => { e.stopPropagation(); navigate(`/admin/people?tab=sources&search=${encodeURIComponent(product.vendor!)}`); }} className="text-xs text-tea-text-sec hover:text-tea-gold transition-colors truncate block text-left">{product.vendor}</button>
            : <span className="text-xs text-tea-text-dim">—</span>}
        </td>
      );
      default: return <td key={colKey} className="px-4 align-middle text-xs text-tea-text-sec">-</td>;
    }
  };

  const borderCls = !isSelected ? getRowBorderClass(product) : '';
  const trCls = [
    'border-b border-tea-border group cursor-pointer select-none',
    borderCls,
    isSelected
      ? 'bg-tea-gold/20 border-l-2 border-l-tea-gold'
      : isPanelOpen
        ? 'bg-tea-gold/10'
        : !product.isPublic
          ? 'opacity-60 hover:opacity-100 hover:bg-tea-bg/50'
          : 'hover:bg-tea-bg/50',
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
      {splitView
        ? renderCell('productName', 0)
        : visibleCols.map((col, colIdx) => renderCell(col.key, colIdx))}
      <td className="px-1 align-middle text-right">
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          {!isEditMode && !isSelected && (
            <>
              <span className="inline-flex items-center gap-0.5">
                <button onClick={(e) => { e.stopPropagation(); onSelectionAwareUpdate(product, 'isFeatured', !product.isFeatured); }} className={`tap-target ${product.isFeatured ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'} p-1 transition-colors`} aria-label={product.isFeatured ? 'Remove featured star' : 'Mark as featured'} aria-pressed={product.isFeatured} title={product.isFeatured ? 'Remove star' : 'Star'}><Star size={12} className={product.isFeatured ? 'fill-tea-gold' : ''} aria-hidden="true" /></button>
                {isFeaturedButHidden(product) && <span className="font-body italic text-ui-10 text-tea-text-sec leading-none">hidden</span>}
              </span>
              <button onClick={(e) => { e.stopPropagation(); onSelectionAwareUpdate(product, 'isPublic', !product.isPublic); }} className={`tap-target ${product.isPublic ? 'text-tea-text-sec hover:text-tea-text' : 'text-tea-text-sec/50 hover:text-tea-text-sec'} p-1 transition-colors`} aria-label={product.isPublic ? 'Hide from shop' : 'Show in shop'} aria-pressed={product.isPublic} title={product.isPublic ? 'Hide' : 'Show'}>{product.isPublic ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}</button>
              {!splitView && <button onClick={(e) => { e.stopPropagation(); onOpenPanel(product); }} className="tap-target text-tea-text-sec hover:text-tea-text p-1 transition-colors" aria-label="Edit product" title="Edit"><Pencil size={13} aria-hidden="true" /></button>}
              {!splitView && (
                <div className="relative" data-row-dropdown>
                  <button onClick={() => onToggleDropdown(isDropdownOpen ? null : product.id)} className="tap-target text-tea-text-sec hover:text-tea-text p-1 transition-colors" aria-label="More actions" aria-haspopup="menu" aria-expanded={isDropdownOpen} title="More actions"><MoreHorizontal size={13} aria-hidden="true" /></button>
                  {isDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-tea-surface rounded-lg shadow-lg py-1 min-w-[140px]" style={{ boxShadow: '0 4px 20px rgba(24,19,14,0.3)' }}>
                      <button onClick={() => onRestock(product)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-tea-text hover:bg-tea-bg/60 transition-colors text-left"><Globe size={12} /> Restock via Compass</button>
                      <button onClick={() => { onProductUpdate(product.id, 'status', product.status === 'Archived' ? 'Active' : 'Archived'); onToggleDropdown(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-tea-text hover:bg-tea-bg/60 transition-colors text-left"><Archive size={12} /> {product.status === 'Archived' ? 'Unarchive' : 'Archive'}</button>
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
  prev.splitView === next.splitView &&
  prev.rowHeight === next.rowHeight &&
  prev.isPanelOpen === next.isPanelOpen &&
  prev.isDropdownOpen === next.isDropdownOpen
);
