import { useRef, useState } from 'react';
import { BottomSheet } from '../../../../components/shared/BottomSheet';
import { TYPOGRAPHY_CLASSES as T } from '../../../../designTokens';
import type { Product } from '../../../types';
import { VendorPicker } from '../../ProductEditPanel';

interface UnknownSupplierSheetProps {
  products: Product[];
  onSave: (id: string, name: string) => Promise<void>;
  onClose: () => void;
}

/** Missing sources are assigned per tea: an empty supplier is not one shared supplier. */
export function UnknownSupplierSheet({ products, onSave, onClose }: UnknownSupplierSheetProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const savingRef = useRef(false);
  const remaining = products.filter(product => !saved.has(product.id) && !product.vendor?.trim());

  async function save(product: Product) {
    const name = drafts[product.id]?.trim();
    if (savingRef.current || !name) return;
    savingRef.current = true;
    setSavingId(product.id);
    setErrors(previous => ({ ...previous, [product.id]: '' }));
    try {
      await onSave(product.id, name);
      setSaved(previous => new Set(previous).add(product.id));
    } catch (error) {
      setErrors(previous => ({ ...previous, [product.id]: error instanceof Error ? error.message : 'Could not save the supplier. Try again.' }));
    } finally {
      savingRef.current = false;
      setSavingId(null);
    }
  }

  return <BottomSheet open onOpenChange={open => { if (!open && !savingRef.current) onClose(); }} title="Unknown supplier" description="Choose who each tea came from.">
    <div className="stock-mini-sheet px-2 pb-3">
      {remaining.map(product => <fieldset key={product.id} disabled={savingId !== null} className="min-w-0 border-b border-tea-border pb-3 mb-3 last:mb-0 last:border-0">
        <legend className={`${T.link} mb-2 max-w-full break-words text-tea-text`}>{product.productName || 'Unnamed tea'}</legend>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <VendorPicker value={drafts[product.id] || ''} onChange={name => setDrafts(previous => ({ ...previous, [product.id]: name }))} className="w-full min-h-11 rounded-md border border-tea-border bg-tea-surface px-3 text-ui-16 text-tea-text focus:border-tea-gold focus:outline-none" />
          <button type="button" onClick={() => void save(product)} disabled={savingId !== null || !drafts[product.id]?.trim()} aria-label={`Save supplier for ${product.productName || 'Unnamed tea'}`} className={`${T.link} min-h-11 shrink-0 rounded-md border border-tea-border px-3 text-tea-text hover:bg-tea-surface disabled:opacity-50`}>{savingId === product.id ? 'Saving…' : 'Save'}</button>
        </div>
        {errors[product.id] && <p role="alert" className={`${T.link} mt-2 text-tea-text-sec`}>{errors[product.id]}</p>}
      </fieldset>)}
      {remaining.length === 0 && <p role="status" className={`${T.link} text-tea-text-sec`}>All suppliers assigned.</p>}
    </div>
  </BottomSheet>;
}
