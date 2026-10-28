import { useRef, useState } from 'react';
import { BottomSheet } from '../../../../components/shared/BottomSheet';
import { TYPOGRAPHY_CLASSES as T } from '../../../../designTokens';
import { useRates, useShopFreightDefault } from '../../../hooks/useAdminData';
import type { Product } from '../../../types';
import { calculatePricing } from '../../../utils';
import { isUnrecordedCurrency, rateToUsd } from '../../../../lib/currency';
import { shippingRateUsdFor, shopRateInCurrency } from '../../../../lib/shippingRate';
import { SHOP_MARKUP_MULTIPLIER } from '../../../../lib/markup';
import { freightSelection } from './freightModel';

export interface FreightSheetProps {
  product: Product;
  onSave: (storedRate: number | null) => Promise<void>;
  onClose: () => void;
}
const usd = (value: number) => `$${value.toFixed(2)}`;

export function FreightSheet({ product, onSave, onClose }: FreightSheetProps) {
  const { data: rates = [] } = useRates();
  const shop = useShopFreightDefault();
  const conversion = isUnrecordedCurrency(product.costCurrency) ? 1 : rateToUsd(rates, product.costCurrency);
  const initialUsd = shippingRateUsdFor(product.shippingRatePerKg, conversion, shop.perKgUsd);
  const [mode, setMode] = useState<'shop' | 'custom'>(product.shippingRatePerKg == null ? 'shop' : 'custom');
  const [input, setInput] = useState(() => initialUsd === null ? '' : String(initialUsd));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const selection = freightSelection(mode, input, product.costCurrency, rates);
  const isTeaware = product.type === 'Teaware';
  const proposedStored = selection.storedRate ?? shopRateInCurrency(shop.perKgUsd, conversion);
  const preview = product.costAmount != null && !selection.error && proposedStored !== null && conversion !== null && product.quantityPurchased > 0
    ? calculatePricing(product.costAmount, proposedStored, product.quantityPurchased, product.costCurrency, rates, isTeaware)
    : null;
  const currentStored = product.shippingRatePerKg ?? shopRateInCurrency(shop.perKgUsd, conversion);
  const current = product.costAmount != null && currentStored !== null && conversion !== null && product.quantityPurchased > 0
    ? calculatePricing(product.costAmount, currentStored, product.quantityPurchased, product.costCurrency, rates, isTeaware)
    : null;
  const fixed = product.fixedRetailPriceUSD !== null && product.fixedRetailPriceUSD !== undefined;
  const dismiss = () => { if (!savingRef.current) onClose(); };
  const choose = (next: 'shop' | 'custom') => { setMode(next); setSaveError(null); };
  async function save() {
    if (savingRef.current || selection.error || isTeaware) return;
    savingRef.current = true; setSaving(true); setSaveError(null);
    try { await onSave(selection.storedRate); onClose(); }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Freight could not be saved. Try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  return <BottomSheet open onOpenChange={open => { if (!open) dismiss(); }} title="Freight" description={product.givenName || product.productName}>
    <div className="px-2 pb-2 space-y-4 text-tea-text">
      {isTeaware ? <p className={`${T.bodyLight} text-tea-text-sec`}>Freight is included in the per-piece cost of this teaware. No per-kilogram rate applies.</p> : <>
        <fieldset disabled={saving} className="space-y-2">
          <legend className={`${T.label} mb-2 text-tea-text-dim`}>Rate for this tea</legend>
          <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-tea-border bg-tea-surface px-3 py-3">
            <input type="radio" name="freight-rate" checked={mode === 'shop'} onChange={() => choose('shop')} className="h-4 w-4 accent-tea-gold" />
            <span className="min-w-0 flex-1"><span className={`${T.bodyLight} block`}>Follow shop rate</span><span className={`${T.link} text-tea-text-sec`}>{shop.perKg} {shop.currency}/kg · {usd(shop.perKgUsd)}/kg</span></span>
          </label>
          <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-tea-border bg-tea-surface px-3 py-3">
            <input type="radio" name="freight-rate" checked={mode === 'custom'} onChange={() => choose('custom')} className="h-4 w-4 accent-tea-gold" />
            <span className="min-w-0 flex-1"><span className={`${T.bodyLight} block`}>Custom rate</span><span className={`${T.link} text-tea-text-sec`}>Only this tea · zero means free freight</span></span>
          </label>
          {mode === 'custom' && <div className="rounded-xl border border-tea-border bg-tea-surface p-3">
            <label htmlFor="custom-freight" className={`${T.label} block mb-2 text-tea-text-dim`}>USD per kg</label>
            <input id="custom-freight" type="number" min="0" step="any" inputMode="decimal" value={input} onChange={event => { setInput(event.target.value); setSaveError(null); }} aria-invalid={Boolean(selection.error)} aria-describedby={selection.error ? 'freight-error' : undefined} className="w-full min-h-11 rounded-md border border-tea-border bg-tea-bg px-3 text-ui-16 text-tea-text focus:border-tea-gold focus:outline-none" />
          </div>}
        </fieldset>
        <div aria-live="polite" className="rounded-xl border border-tea-border bg-tea-accent-sub p-3 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><span className={`${T.label} text-tea-text-dim`}>Calculated retail / g</span><span className={`${T.h3} text-tea-text`}>{preview ? `${current ? usd(current.suggestedRetailUSD) + ' → ' : ''}${usd(preview.suggestedRetailUSD)}` : '—'}</span></div>
          <p className={`${T.link} text-tea-text-sec`}>(Tea cost + freight) × {SHOP_MARKUP_MULTIPLIER}. {fixed ? `Your fixed retail of ${usd(product.fixedRetailPriceUSD!)}/g stays unchanged.` : 'Saving applies this rate to calculated retail.'}</p>
          {!preview && <p className={`${T.link} text-tea-text-sec`}>{product.costAmount == null ? 'Enter the purchase cost to calculate retail.' : conversion === null ? `Retail preview needs an exchange rate for ${product.costCurrency}. You can still follow the shop rate.` : product.quantityPurchased <= 0 ? 'Add the purchased quantity to calculate retail.' : 'Enter a valid rate to see its retail effect.'}</p>}
        </div>
        {(saveError || selection.error) && <p id="freight-error" role="alert" className={`${T.link} text-tea-text-sec`}>{saveError || selection.error}</p>}
        <button type="button" onClick={save} disabled={saving || Boolean(selection.error)} className={`${T.nav} min-h-11 w-full rounded-md cta-solid px-4 py-3 disabled:opacity-50`}>{saving ? 'Saving…' : 'Save freight'}</button>
      </>}
    </div>
  </BottomSheet>;
}
