import { useRef, useState } from 'react';
import { BottomSheet } from '../../../../components/shared/BottomSheet';
import { TYPOGRAPHY_CLASSES as T } from '../../../../designTokens';
import { TEA_FORMS } from '../../../../wisdom/vocabulary';
import { SHOP_MARKUP_MULTIPLIER } from '../../../../lib/markup';
import { useRates, useShopFreightDefault } from '../../../hooks/useAdminData';
import { enteredNumber } from '../../../productUpdatePayload';
import type { Product } from '../../../types';
import { formPricingPreview } from './formPricingModel';

export type FormPricingChanges = Partial<Pick<Product, 'form' | 'costAmount' | 'quantityPurchased' | 'soldInWholeUnits'>> & { pieceWeightG?: number | null };
export type SaveFormPricing = (changes: FormPricingChanges) => Promise<void>;
const money = (value: number | null) => value === null ? '\u2014' : `$${value.toFixed(2)}`;
const formLabel = (value: string) => value === 'Loose' || value === 'Loose Leaf' ? 'Loose leaf' : value;

export function FormPricingSheet({ product, onSave, onClose }: { product: Product; onSave: SaveFormPricing; onClose: () => void }) {
  const { data: rates = [] } = useRates();
  const freight = useShopFreightDefault();
  const rawForm = String(product.form || '');
  const initialForm = rawForm === 'Loose Leaf' ? 'Loose' : rawForm;
  const [form, setForm] = useState(initialForm);
  const [weight, setWeight] = useState(product.pieceWeightG == null ? '' : String(product.pieceWeightG));
  const [cost, setCost] = useState(product.costAmount == null ? '' : String(product.costAmount));
  const [purchaseGrams, setPurchaseGrams] = useState(product.quantityPurchased > 0 ? String(product.quantityPurchased) : '');
  const [wholeOnly, setWholeOnly] = useState(Boolean(product.soldInWholeUnits));
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const savingRef = useRef(false);
  const forms = [...new Set<string>([...TEA_FORMS, 'Powder', 'Other', ...(form ? [form] : [])])];
  const pieceWeight = enteredNumber(weight);
  const basisGrams = enteredNumber(purchaseGrams);
  const paid = enteredNumber(cost);
  const draft = { ...product, form: form as Product['form'], soldInWholeUnits: wholeOnly, pieceWeightG: pieceWeight, costAmount: paid, quantityPurchased: basisGrams };
  const preview = formPricingPreview(draft, rates, freight.perKgUsd);
  async function save() {
    if (savingRef.current) return;
    setError('');
    try {
      if (wholeOnly && !(pieceWeight !== null && pieceWeight > 0)) throw new Error('Enter the piece or pack weight before selling whole pieces only.');
      if (weight.trim() && (pieceWeight === null || pieceWeight <= 0)) throw new Error('Enter a piece or pack weight greater than zero, or leave it blank.');
      if (cost !== (product.costAmount == null ? '' : String(product.costAmount)) && (paid === null || paid < 0)) throw new Error('Enter the purchase cost. Zero means it was free.');
      if (purchaseGrams !== (product.quantityPurchased > 0 ? String(product.quantityPurchased) : '') && (basisGrams === null || basisGrams <= 0)) throw new Error('Enter the grams that the purchase cost covered, greater than zero.');
      const changes: FormPricingChanges = {};
      if (form !== initialForm) changes.form = form as Product['form'];
      if (pieceWeight !== (product.pieceWeightG ?? null)) changes.pieceWeightG = pieceWeight;
      if (paid !== (product.costAmount ?? null)) changes.costAmount = paid!;
      if (basisGrams !== (product.quantityPurchased > 0 ? product.quantityPurchased : null)) changes.quantityPurchased = basisGrams!;
      if (wholeOnly !== Boolean(product.soldInWholeUnits)) changes.soldInWholeUnits = wholeOnly;
      savingRef.current = true; setSaving(true);
      if (Object.keys(changes).length) await onSave(changes);
      onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save. Your changes are still here.'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  return <BottomSheet open large title="Form & pricing" description={product.productName} onOpenChange={open => { if (!open && !savingRef.current) onClose(); }}>
    <div className="stock-form-sheet space-y-3 px-2 pb-3 text-tea-text">
      <fieldset disabled={saving}><legend className={`${T.label} mb-1 text-tea-text-dim`}>Form</legend><div className="flex flex-wrap gap-1">{forms.map(value => <button type="button" key={value} aria-pressed={form === value} onClick={() => setForm(value)} className={`${T.link} min-h-11 rounded-md border px-3 ${form === value ? 'border-tea-gold bg-tea-accent-sub text-tea-gold' : 'border-tea-border bg-tea-surface text-tea-text-sec'}`}>{formLabel(value)}</button>)}</div></fieldset>
      <div><label htmlFor="stock-piece-grams" className={`${T.label} block text-tea-text-dim`}>One piece / pack weighs · g</label><input id="stock-piece-grams" type="number" min="0" step="any" inputMode="decimal" value={weight} disabled={saving} onChange={event => setWeight(event.target.value)} placeholder="For example, 357 for one cake" className="admin-input min-h-11 w-full"/></div>
      <fieldset disabled={saving} className="rounded-md border border-tea-border bg-tea-surface p-3"><legend className={`${T.label} px-1 text-tea-text-dim`}>What you paid for</legend><div className="grid grid-cols-2 gap-2">
        <div><label htmlFor="stock-purchase-cost" className={`${T.label} block text-tea-text-sec`}>Purchase cost · {product.costCurrency || 'unit not recorded'}</label><input id="stock-purchase-cost" type="number" min="0" step="any" inputMode="decimal" value={cost} onChange={event => setCost(event.target.value)} className="admin-input min-h-11 w-full"/></div>
        <div><label htmlFor="stock-purchase-grams" className={`${T.label} block text-tea-text-sec`}>Grams this cost bought</label><input id="stock-purchase-grams" type="number" min="0" step="any" inputMode="decimal" value={purchaseGrams} onChange={event => setPurchaseGrams(event.target.value)} className="admin-input min-h-11 w-full"/></div>
      </div><p className={`${T.link} mt-2 text-tea-text-sec`}>Use the grams bought, not the grams left.</p></fieldset>
      <div className="rounded-md border border-tea-border bg-tea-accent-sub p-3" aria-live="polite"><dl className="grid grid-cols-3 gap-2">{[['Base / g', preview.retailPerGram], ['Full piece', preview.fullPiece], ['Half piece', preview.halfPiece]].map(([label, value]) => <div key={String(label)}><dt className={`${T.label} text-tea-text-dim`}>{label}</dt><dd className={`${T.h3} text-tea-text`}>{money(value as number | null)}</dd></div>)}</dl><details className="mt-2"><summary className={`${T.link} text-tea-text-sec`}>How retail is calculated{preview.hasFixedRetail ? ' · fixed price in use' : ''}</summary><p className={`${T.link} mt-1 text-tea-text-sec`}>{preview.hasFixedRetail ? `Fixed retail is in use. Calculated retail is ${money(preview.calculatedPerGram)}/g; the fixed price stays unchanged.` : `(Purchase cost ÷ purchased grams + freight per gram) × ${SHOP_MARKUP_MULTIPLIER}, converted to USD.`}</p><p className={`${T.link} mt-1 text-tea-text-sec`}>Full and half prices use the piece weight above and the shop’s existing handling rule for cut or weighed portions. Stock changes never change the cost per gram.</p></details>{preview.retailPerGram === null && <p className={`${T.link} mt-1 text-tea-text-sec`}>Add the purchase cost and grams, with a current exchange rate, to calculate retail.</p>}</div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 text-tea-text-sec"><label className={`${T.link} flex min-h-11 items-center gap-2`}><input type="checkbox" checked={wholeOnly} disabled={saving} onChange={event => setWholeOnly(event.target.checked)}/>Whole pieces only</label><span className={T.link}>On hand: {product.stockGrams} g.</span></div>
      {wholeOnly && <p className={`${T.link} text-tea-text-sec`}>Halves and samples are not offered while whole pieces only is selected.</p>}
      {error && <p role="alert" className={`${T.link} text-tea-text-sec`}>{error}</p>}
      <button type="button" disabled={saving} onClick={save} className={`${T.nav} cta-solid min-h-11 w-full rounded-md px-3 py-2 disabled:opacity-50`}>{saving ? 'Saving…' : 'Save form & pricing'}</button>
    </div>
  </BottomSheet>;
}
