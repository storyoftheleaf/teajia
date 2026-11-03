import { useRef, useState } from 'react';
import { Camera, ImagePlus } from 'lucide-react';
import { BottomSheet } from '../../../../components/shared/BottomSheet';
import { TYPOGRAPHY_CLASSES as T } from '../../../../designTokens';
import { api } from '../../../../lib/api';
import { mediaUrl } from '../../../../lib/mediaUrl';
import type { Product } from '../../../types';
import type { SaveField } from './MiniPageSheets';
import { firstPhotoSlot, photoFieldUpdate, type PhotoSlot } from './quickPhotoModel';

export interface QuickPhotoSheetProps { product: Product; onSave: SaveField; onClose: () => void }
type PendingPhoto = { file: File; slot: PhotoSlot; replace: boolean; url?: string };
const slotLabel = (slot: PhotoSlot) => slot === 'main' ? 'Main photo' : `Photo ${Number(slot) + 1}`;

export function QuickPhotoSheet({ product, onSave, onClose }: QuickPhotoSheetProps) {
  const [replaceSlot, setReplaceSlot] = useState<PhotoSlot | null>(null);
  const [pending, setPending] = useState<PendingPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const latestProduct = useRef(product);
  latestProduct.current = product;
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const autoSlot = firstPhotoSlot(product);
  const chosenSlot = replaceSlot || autoSlot;
  const existing = ([['main', product.imageUrl], ['1', product.additionalImages?.[0]], ['2', product.additionalImages?.[1]]] as const).filter(([, url]) => Boolean(url));

  async function persist(candidate: PendingPhoto) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null); setPending(candidate);
    let next = candidate;
    try {
      if (!next.url) {
        setStatus('Uploading photo…');
        const extension = next.file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
        // A unique upload keeps the old image intact if saving the product fails.
        const url = await api.uploadImage(next.file, { filename: `product-photo-${crypto.randomUUID()}.${extension}` });
        next = { ...next, url }; setPending(next);
      }
      setStatus('Saving photo…');
      const current = latestProduct.current;
      const occupied = next.slot === 'main' ? current.imageUrl : current.additionalImages?.[Number(next.slot) - 1];
      if (!next.replace && occupied?.trim()) throw new Error('That photo slot has just been filled. Choose another photo slot before trying again.');
      const update = photoFieldUpdate(current, next.slot, next.url!);
      await onSave(update.field, update.value);
      setPending(null); onClose();
    } catch (reason) {
      setPending(next);
      setError(reason instanceof Error ? reason.message : 'The photo could not be saved. Try again.');
    } finally { busyRef.current = false; setBusy(false); setStatus(''); }
  }
  function choose(file?: File) {
    if (!file || !chosenSlot || busyRef.current) return;
    if (!file.type.startsWith('image/')) { setError('Choose a photo file.'); return; }
    void persist({ file, slot: chosenSlot, replace: replaceSlot !== null });
  }
  function discardPending() {
    setPending(null); setError(null);
    if (camera.current) camera.current.value = '';
    if (library.current) library.current.value = '';
  }
  const pickerDisabled = busy || Boolean(pending) || !chosenSlot;
  return <BottomSheet open title="Photos" description={product.givenName || product.productName} onOpenChange={open => { if (!open && !busyRef.current) onClose(); }}>
    <div className="stock-mini-sheet space-y-3 px-2 pb-3 text-tea-text">
      {replaceSlot && <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-tea-border bg-tea-accent-sub px-3">
        <p className={`${T.link} text-tea-text-sec`}>Replacing {slotLabel(replaceSlot).toLowerCase()}</p>
        <button type="button" disabled={busy || Boolean(pending)} onClick={() => setReplaceSlot(null)} className={`${T.link} min-h-11 px-2 text-tea-gold disabled:opacity-50`}>Cancel replacement</button>
      </div>}
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Take product photo" onChange={event => choose(event.target.files?.[0])} />
      <input ref={library} type="file" accept="image/*" className="hidden" aria-label="Choose product photo" onChange={event => choose(event.target.files?.[0])} />
      <div className="grid grid-cols-1 gap-2">
        <button type="button" disabled={pickerDisabled} onClick={() => camera.current?.click()} className={`${T.nav} flex min-h-14 items-center justify-center gap-3 rounded-xl cta-solid px-4 py-3 disabled:opacity-50`}><Camera size={20} />Take photo</button>
        <button type="button" disabled={pickerDisabled} onClick={() => library.current?.click()} className={`${T.nav} flex min-h-14 items-center justify-center gap-3 rounded-xl border border-tea-border bg-tea-surface px-4 py-3 disabled:opacity-50`}><ImagePlus size={20} />Photo library</button>
      </div>
      {!replaceSlot && <p className={`${T.link} text-tea-text-sec`}>{autoSlot ? `Adds to ${slotLabel(autoSlot).toLowerCase()}. Existing photos stay unchanged.` : 'All three product photo slots are full. Choose a photo below to replace.'}</p>}
      {busy && <p role="status" className={`${T.link} text-tea-text-sec`}>{status}</p>}
      {error && <p role="alert" className={`${T.link} text-tea-text-sec`}>{error}</p>}
      {pending && !busy && <div className="space-y-2 rounded-xl border border-tea-border bg-tea-surface p-3">
        <p className={`${T.link} break-words text-tea-text-sec`}>{pending.file.name} is ready to retry.</p>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void persist(pending)} className={`${T.nav} min-h-11 rounded-md cta-solid px-4 py-2`}>Retry saving photo</button><button type="button" onClick={discardPending} className={`${T.link} min-h-11 rounded-md border border-tea-border px-4 py-2`}>Choose another</button></div>
      </div>}
      {existing.length > 0 && <div className="space-y-2">
        {existing.map(([slot, url]) => <div key={slot} className="flex min-w-0 items-center gap-3 rounded-xl border border-tea-border bg-tea-surface p-2">
          <img src={mediaUrl(url!)} alt={slotLabel(slot)} className="h-16 w-16 shrink-0 rounded-md object-cover" />
          <span className={`${T.link} min-w-0 flex-1 text-tea-text-sec`}>{slotLabel(slot)}</span>
          <button type="button" disabled={busy || Boolean(pending)} aria-label={`Replace ${slotLabel(slot).toLowerCase()}`} aria-pressed={replaceSlot === slot} onClick={() => { setReplaceSlot(slot); setError(null); }} className={`${T.link} min-h-11 shrink-0 rounded-md border border-tea-border px-3 text-tea-gold disabled:opacity-50`}>Replace</button>
        </div>)}
      </div>}
    </div>
  </BottomSheet>;
}
