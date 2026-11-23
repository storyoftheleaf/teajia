import { useEffect, useRef, useState } from 'react';
import type { CellarItem, ShelfOfferInput } from '../../lib/api';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { PersonalShopTeaRow } from '../shop/PersonalShopTeaRow';

interface CellarOfferEditorProps {
  item: CellarItem;
  whatsapp: string | null;
  saving: boolean;
  error: Error | null;
  onCancel: () => void;
  onPublish: (offer: ShelfOfferInput) => void;
}

const fieldClass = 'w-full min-w-0 rounded-md border border-tea-border bg-tea-bg px-3 py-2 text-ui-14 text-tea-text focus:border-tea-gold focus:outline-none';

export function CellarOfferEditor({ item, whatsapp, saving, error, onCancel, onPublish }: CellarOfferEditorProps) {
  const [name, setName] = useState(item.shelfOffer?.name ?? '');
  const [grams, setGrams] = useState(item.shelfOffer ? String(item.shelfOffer.grams) : '');
  const [type, setType] = useState(item.shelfOffer?.type ?? '');
  const [year, setYear] = useState(item.shelfOffer?.year ? String(item.shelfOffer.year) : '');
  const [origin, setOrigin] = useState(item.shelfOffer?.origin ?? '');
  const [preview, setPreview] = useState<ShelfOfferInput | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [preview]);
  const offeredGrams = Number(grams);
  const validWeight = Number.isFinite(offeredGrams) && offeredGrams > 0 && offeredGrams <= item.grams;
  const valid = !!name.trim() && validWeight && (!year || /^[1-9]\d{3}$/.test(year));

  return (
    <section aria-label="Shelf offer" className="space-y-3">
      <header className="space-y-1">
        <h2 ref={heading} tabIndex={-1} className={TYPOGRAPHY_CLASSES.h3}>{preview ? 'Buyer preview' : 'Shelf offer'}</h2>
        {!preview && <p className="break-words text-ui-13 text-tea-text-sec">{item.name} · {item.grams} g in your Tea Chest</p>}
      </header>
      {preview ? (
        <>
          <PersonalShopTeaRow
            item={{ id: item.id, name: preview.name, grams: preview.grams, type: preview.type ?? null,
              origin: preview.origin ?? null, year: preview.year ?? null, image_url: null }}
            preview={Boolean(whatsapp)}
          />
          {error && <p role="alert" className="text-ui-13 text-tea-text">{error.message}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => setPreview(null)}>Back to details</button>
            <button type="button" className="btn-primary" disabled={!whatsapp || !valid || saving} onClick={() => onPublish(preview)}>
              {saving ? 'Publishing…' : 'Publish offer'}
            </button>
          </div>
        </>
      ) : (
        <form className="space-y-3" onSubmit={event => {
          event.preventDefault();
          if (valid) setPreview({
            name: name.trim(), grams: offeredGrams, type: type.trim() || null,
            year: year ? Number(year) : null, origin: origin.trim() || null,
          });
        }}>
          <label className="block space-y-1 text-ui-13 text-tea-text-sec">
            <span>Public tea name</span>
            <input className={fieldClass} value={name} maxLength={120} onChange={event => setName(event.target.value)} required />
          </label>
          <label className="block space-y-1 text-ui-13 text-tea-text-sec">
            <span>Offer weight (g)</span>
            <input className={fieldClass} type="number" inputMode="decimal" step="any" max={item.grams} value={grams} onChange={event => setGrams(event.target.value)} required />
            {grams && !validWeight && <span className="block">Enter a weight above 0 g and up to {item.grams} g.</span>}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block min-w-0 space-y-1 text-ui-13 text-tea-text-sec">
              <span>Tea type (optional)</span>
              <input className={fieldClass} value={type} maxLength={40} onChange={event => setType(event.target.value)} />
            </label>
            <label className="block min-w-0 space-y-1 text-ui-13 text-tea-text-sec">
              <span>Year (optional)</span>
              <input className={fieldClass} type="text" inputMode="numeric" value={year} maxLength={4} onChange={event => setYear(event.target.value)} />
            </label>
          </div>
          <label className="block space-y-1 text-ui-13 text-tea-text-sec">
            <span>Broad origin (optional)</span>
            <input className={fieldClass} value={origin} maxLength={100} onChange={event => setOrigin(event.target.value)} />
          </label>
          <p className="text-ui-12 text-tea-text-dim">Use only details you want buyers to see. Keep supplier names and sourcing details in your Tea Chest.</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!valid}>Preview offer</button>
          </div>
        </form>
      )}
    </section>
  );
}
