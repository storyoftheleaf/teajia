import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BottomSheet } from '../../../../components/shared/BottomSheet';
import { TYPOGRAPHY_CLASSES as T } from '../../../../designTokens';
import { useRates, useShopFreightDefault, teaFallbackFreightUsd } from '../../../hooks/useAdminData';
import type { Product } from '../../../types';
import { SHOP_MARKUP_MULTIPLIER } from '../../../../lib/markup';
import { clearPriceLine, freightClearPreview } from './freightModel';

// Freight on the phone tools. Read-only (Adrian, 2026-11-27): rates are typed
// only in Logistics on the Purchases page. A tea that already carries its own
// rate shows it, with Clear to hand it back to its service or the shop default.

export interface FreightSheetProps {
  product: Product;
  /** Called with null only: clearing is the one change this sheet makes. */
  onSave: (storedRate: null) => Promise<void>;
  onClose: () => void;
}
const usd = (value: number | null) => value === null ? '—' : `$${value.toFixed(2)}`;

export function FreightSheet({ product, onSave, onClose }: FreightSheetProps) {
  const { data: rates = [] } = useRates();
  const shop = useShopFreightDefault();
  const fallbackUsd = teaFallbackFreightUsd(product, shop.perKgUsd);
  const follows = product.freightSource && product.freightSource !== 'shop' ? 'its logistics service' : 'the shop default';
  const preview = freightClearPreview(product, rates, fallbackUsd);
  const ownRate = product.shippingRatePerKg != null;
  const isTeaware = product.type === 'Teaware';
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const dismiss = () => { if (!savingRef.current) onClose(); };
  async function clear() {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setSaveError(null);
    try { await onSave(null); onClose(); }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Freight could not be cleared. Try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  return <BottomSheet open onOpenChange={open => { if (!open) dismiss(); }} title="Freight" description={product.givenName || product.productName}>
    <div className="px-2 pb-2 space-y-4 text-tea-text">
      {isTeaware ? <p className={`${T.bodyLight} text-tea-text-sec`}>Freight is included in the per-piece cost of this teaware. No per-kilogram rate applies.</p> : <>
        <div className="rounded-xl border border-tea-border bg-tea-surface p-3 space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className={`${T.label} text-tea-text-dim`}>{ownRate ? 'This tea’s own rate' : `Follows ${follows}`}</span>
            <span data-testid="freight-sheet-rate" className={`${T.h3} text-tea-text tabular-nums`}>{usd(ownRate ? preview.ownPerKgUsd : fallbackUsd)}/kg</span>
          </div>
          {ownRate && <p className={`${T.link} text-tea-text-sec`}>Set before rates moved to Logistics. It wins over any service until cleared.</p>}
        </div>
        {ownRate && <div aria-live="polite" className="rounded-xl border border-tea-border bg-tea-accent-sub p-3 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><span className={`${T.label} text-tea-text-dim`}>Calculated retail if cleared</span><span data-testid="freight-clear-preview" className={`${T.h3} text-tea-text tabular-nums`}>{clearPriceLine(preview)}</span></div>
          <p className={`${T.link} text-tea-text-sec`}>Clearing hands it to {follows}, {usd(fallbackUsd)}/kg. (Tea cost + freight) × {SHOP_MARKUP_MULTIPLIER}.{product.fixedRetailPriceUSD != null ? ` Your fixed retail of ${usd(product.fixedRetailPriceUSD)}/g stays unchanged.` : ''}</p>
        </div>}
        {saveError && <p role="alert" className={`${T.link} text-tea-text-sec`}>{saveError}</p>}
        {ownRate && <button type="button" onClick={clear} disabled={saving} className={`${T.nav} min-h-tap w-full rounded-md cta-solid px-4 py-3 disabled:opacity-50`}>{saving ? 'Clearing…' : 'Clear this tea’s rate'}</button>}
        <Link to="/admin/purchase-orders" onClick={onClose} className={`${T.link} tap-target inline-block text-tea-gold`}>Rates are set in Logistics</Link>
      </>}
    </div>
  </BottomSheet>;
}
