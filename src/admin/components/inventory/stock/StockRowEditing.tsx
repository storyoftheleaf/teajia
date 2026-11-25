import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '../../../../components/shared/Button';
import type { Product } from '../../../types';
import { PREPARATION_NEED_LABELS, deriveInventoryStage, preparationNeed, type IncomingInventorySummary } from '../domain';
import { STOCK_GROUP_SWITCH } from '../config';
import { isLow, isUnchecked } from '../phone/groupStock';
import { PhoneTeaSheet } from '../phone/PhoneTeaSheet';
import { QuickPhotoSheet } from './QuickPhotoSheet';
import { stockNextStepLabel, useStockNextStep } from './StockCardSections';

// Stock as a list you change where you read it (Adrian, 2026-11-25): grouped by
// supplier, a plain click opens the tea's editor under its row on the laptop and
// the 2026-10-08 panel on a phone. The pieces live here so InventoryView only
// wires them in.

/** Supplier · Type · Stage, three words beside the filters. Choosing the open
 *  one again goes back to Supplier, the page's starting point. */
export function StockGroupSwitch({ value, onChange, placement }: { value: string; onChange: (value: string) => void; placement: 'bar' | 'line' }) {
  // Beside the filters on a laptop; its own line under them on a phone, so the
  // filter row stays one line at every width.
  return <div role="group" aria-label="Group teas by" className={`stock-group-switch stock-group-switch-${placement}`} data-testid={`stock-group-switch-${placement}`}>
    {STOCK_GROUP_SWITCH.map(option => {
      const on = value === option.value;
      return <Button key={option.value} variant="plain" type="button" aria-pressed={on}
        onClick={() => onChange(on && option.value !== 'vendor' ? 'vendor' : option.value)}>{option.label}</Button>;
    })}
  </div>;
}

/** The group line's warnings: how many are low and how many were never counted. */
export function StockGroupFlags({ items }: { items: readonly Product[] }) {
  const low = items.filter(isLow).length;
  const uncounted = items.filter(isUnchecked).length;
  if (!low && !uncounted) return null;
  return <span className="stock-group-flags" data-testid="stock-group-flags">
    {low > 0 && <span className="text-tea-gold">{low} low</span>}
    {uncounted > 0 && <span>{uncounted} never counted</span>}
  </span>;
}

/** The visible way to give supplier-less teas a supplier. */
export function AssignSupplierButton({ onClick }: { onClick: () => void }) {
  return <Button variant="plain" type="button" data-testid="assign-supplier" onClick={onClick}
    className="tap-target !text-tea-gold hover:!text-tea-gold-lt text-ui-12 whitespace-nowrap px-2">Assign a supplier</Button>;
}

/** "needs a cost", "needs a bag weight"... for a tea still in Needs preparation. */
export function needLabelFor(product: Product, incoming?: IncomingInventorySummary): string | undefined {
  if (deriveInventoryStage(product, incoming) !== 'needs_preparation') return undefined;
  const label = PREPARATION_NEED_LABELS[preparationNeed(product)];
  return label.charAt(0).toLowerCase() + label.slice(1);
}

interface RowEditingOptions {
  groupBy: string | null;
  category: string;
  products: readonly Product[];
  allProducts: readonly Product[];
  incoming: Readonly<Record<string, IncomingInventorySummary>>;
  isMobile: boolean;
  setExpandedRowId: (update: (prev: string | null) => string | null) => void;
  openRecord: (product: Product) => void;
  openSupplier: (product: Product) => void;
  openListingReview: (id: string) => void;
  startTasting: (product: Product) => void;
  onUpdate: (id: string, field: keyof Product, value: any, options?: { throwOnError?: boolean }) => unknown;
  onMovementRecorded: (productId: string, afterBalance: number, unit: 'g' | 'unit') => void;
}

export function useStockRowEditing(o: RowEditingOptions) {
  const [phoneSheetId, setPhoneSheetId] = useState<string | null>(null);
  const [photoProduct, setPhotoProduct] = useState<Product | null>(null);
  const isMobileRef = useRef(o.isMobile);
  useLayoutEffect(() => { isMobileRef.current = o.isMobile; }, [o.isMobile]);
  const { setExpandedRowId } = o;

  /** A plain click: the editor under the row on a laptop, the panel on a phone. */
  const openTea = useCallback((productId: string) => {
    if (isMobileRef.current) setPhoneSheetId(prev => (prev === productId ? null : productId));
    else setExpandedRowId(prev => (prev === productId ? null : productId));
  }, [setExpandedRowId]);

  // The Stage grouping heads these runs itself, so the marks are for every other grouping.
  const needLabelById = useMemo(() => {
    const labels = new Map<string, string>();
    if (o.groupBy === 'stage' || o.category !== 'tea') return labels;
    for (const product of o.products) {
      const label = needLabelFor(product, o.incoming[product.id]);
      if (label) labels.set(product.id, label);
    }
    return labels;
  }, [o.groupBy, o.category, o.products, o.incoming]);

  const nextStep = useStockNextStep(o.openRecord, o.openListingReview);
  const editorExtras = (product: Product) => {
    const stage = deriveInventoryStage(product, o.incoming[product.id]);
    const label = stockNextStepLabel(product, stage);
    const close = () => setExpandedRowId(() => null);
    return {
      onPhoto: (p: Product) => { close(); setPhotoProduct(p); },
      onTaste: (p: Product) => { close(); o.startTasting(p); },
      nextStep: label ? { label, run: () => { close(); nextStep(product, stage); } } : null,
    };
  };

  const sheetProduct = o.isMobile && phoneSheetId
    ? o.products.find(product => product.id === phoneSheetId) ?? o.allProducts.find(product => product.id === phoneSheetId)
    : undefined;
  const sheets: ReactNode = <>
    {photoProduct && <QuickPhotoSheet product={photoProduct}
      onSave={async (field, value) => { await o.onUpdate(photoProduct.id, field, value, { throwOnError: true }); }}
      onClose={() => setPhotoProduct(null)} />}
    {sheetProduct && <PhoneTeaSheet product={sheetProduct} onClose={() => setPhoneSheetId(null)}
      onOpenEditor={product => { setPhoneSheetId(null); o.openRecord(product); }}
      onOpenSource={o.openSupplier} onUpdate={(id, field, value) => { void o.onUpdate(id, field, value); }}
      onMovementRecorded={o.onMovementRecorded} />}
  </>;

  return { openTea, needLabelById, editorExtras, sheets };
}
