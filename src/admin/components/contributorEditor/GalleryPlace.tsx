import React, { useEffect, useId, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import { isTouch } from '../../../pages/read/imageUtils';
import { galleryPlacement } from '../../../components/people/profileFormat';
import type { ContributorGalleryImage } from '../../../types';
import { ACTION, Count, Line, QUIET } from './parts';
import { CropStrip, FocusPicker, type Crop } from './PhotoPlace';
import { imagesFrom, preparePhoto } from './photoUpload';
import { mediaUrl } from '../../../lib/mediaUrl';

const TOUCH = isTouch();
export const GALLERY_IMAGE_LIMIT = 8;
const CAPTION_LIMIT = 280;

type Pending = { key: string; preview: string; progress: number; error?: string; file: File };

/** The frames a tile at this position becomes on the page: phone column 342px, desktop 576px. */
function cropsFor(index: number): Crop[] {
  const place = galleryPlacement(index);
  const size = (column: number, row: number) => ({
    width: place.columnSpan === 2 ? column * 2 + 4 : column,
    height: place.rowSpan === 2 ? row * 2 + 4 : row,
  });
  return [
    { label: 'Phone', ...size(169, 108) },
    { label: 'Desktop', ...size(286, 170) },
  ];
}

function tileStyle(index: number): React.CSSProperties {
  const place = galleryPlacement(index);
  return { gridColumn: place.columnSpan === 2 ? 'span 2' : undefined, gridRow: place.rowSpan === 2 ? 'span 2' : undefined };
}

type Props = {
  images: ContributorGalleryImage[];
  update: (change: (images: ContributorGalleryImage[]) => ContributorGalleryImage[]) => void;
  onBusy?: (busy: boolean) => void;
  takeRef?: React.MutableRefObject<((files: File[]) => void) | null>;
};

/**
 * Hands on, drawn as the page draws it: the same two-column mosaic, the same
 * tall, small and wide tiles in the same order. Photos arrive by drop, paste
 * or picker, several at once; each shows itself while it travels. Drag a tile
 * onto another to reorder, or select it and move it earlier or later, which is
 * the way that works with a thumb.
 */
export function GalleryPlace({ images, update, onBusy, takeRef }: Props) {
  const inputId = useId();
  const cameraId = useId();
  const [pending, setPending] = useState<Pending[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [byAddress, setByAddress] = useState(false);
  const [address, setAddress] = useState('');
  const counter = useRef(0);

  const busy = pending.some(item => !item.error);
  useEffect(() => { onBusy?.(busy); }, [busy, onBusy]);
  useEffect(() => { if (selected !== null && selected >= images.length) setSelected(images.length ? images.length - 1 : null); }, [images.length, selected]);

  const room = GALLERY_IMAGE_LIMIT - images.length - pending.filter(item => !item.error).length;

  const send = async (item: Pending) => {
    try {
      const ready = await preparePhoto(item.file);
      const url = await api.uploadImageProgress(ready, progress => {
        setPending(current => current.map(entry => entry.key === item.key ? { ...entry, progress: Math.max(0.05, Math.min(0.98, progress)) } : entry));
      }, { filename: ready.name || 'photo.jpg' });
      update(current => current.length >= GALLERY_IMAGE_LIMIT ? current : [...current, { image_url: url, caption: null, focus: null }]);
      setPending(current => current.filter(entry => entry.key !== item.key));
      URL.revokeObjectURL(item.preview);
    } catch (caught) {
      const error = caught instanceof Error && caught.message.startsWith('This browser') ? caught.message : 'Did not arrive.';
      setPending(current => current.map(entry => entry.key === item.key ? { ...entry, error } : entry));
    }
  };

  const take = (files: File[]) => {
    if (!files.length) return;
    const accepted = files.slice(0, Math.max(0, room));
    setNotice(files.length > accepted.length ? `The page holds ${GALLERY_IMAGE_LIMIT} photos, so ${files.length - accepted.length === 1 ? 'one was' : `${files.length - accepted.length} were`} left out.` : null);
    const items = accepted.map(file => ({ key: `p${counter.current++}`, preview: URL.createObjectURL(file), progress: 0.02, file }));
    setPending(current => [...current, ...items]);
    items.forEach(item => { void send(item); });
  };

  if (takeRef) takeRef.current = take;

  const retry = (item: Pending) => {
    const fresh = { ...item, error: undefined, progress: 0.02 };
    setPending(current => current.map(entry => entry.key === item.key ? fresh : entry));
    void send(fresh);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    update(current => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setSelected(to);
  };

  const patch = (index: number, change: Partial<ContributorGalleryImage>) =>
    update(current => current.map((image, position) => position === index ? { ...image, ...change } : image));

  const remove = (index: number) => {
    update(current => current.filter((_, position) => position !== index));
    setSelected(null);
  };

  const isFiles = (event: React.DragEvent) => Array.from(event.dataTransfer.types).includes('Files');
  const chosen = selected !== null ? images[selected] : null;
  const total = images.length + pending.length;

  return (
    <div
      data-testid="gallery-place"
      onDragOver={event => { if (isFiles(event)) { event.preventDefault(); setOver(true); } }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false); }}
      onDrop={event => { if (!isFiles(event)) return; event.preventDefault(); setOver(false); take(imagesFrom(event.dataTransfer.files, true)); }}
      onPaste={event => { const files = imagesFrom(event.clipboardData.items, true); if (files.length) { event.preventDefault(); take(files); } }}
    >
      <input id={inputId} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} data-testid="gallery-file"
        onChange={event => { take(imagesFrom(event.target.files, true)); event.target.value = ''; }} />
      {TOUCH && <input id={cameraId} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1}
        onChange={event => { take(imagesFrom(event.target.files, true)); event.target.value = ''; }} />}

      <ul className={`grid grid-cols-2 auto-rows-[108px] gap-1 transition-colors md:auto-rows-[170px] ${over ? 'bg-tea-accent-sub' : ''}`} aria-label="Photos at work, in page order">
        {images.map((image, index) => (
          <li
            key={image.id ?? `${image.image_url}-${index}`}
            style={tileStyle(index)}
            draggable={!TOUCH}
            onDragStart={event => { setDragFrom(index); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); }}
            onDragEnd={() => setDragFrom(null)}
            onDragOver={event => { if (dragFrom !== null) event.preventDefault(); }}
            onDrop={event => { if (dragFrom === null) return; event.preventDefault(); event.stopPropagation(); move(dragFrom, index); setDragFrom(null); }}
            className={`relative overflow-hidden bg-tea-surface ${dragFrom === index ? 'opacity-40' : ''}`}
          >
            <button
              type="button"
              aria-label={`Photo ${index + 1}${image.caption ? `, ${image.caption}` : ''}. ${selected === index ? 'Selected.' : 'Select to set its focus, caption and place.'}`}
              aria-pressed={selected === index}
              onClick={() => setSelected(current => current === index ? null : index)}
              className="absolute inset-0 block h-full w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/60"
            >
              <img src={mediaUrl(image.image_url)} alt="" draggable={false} className="h-full w-full object-cover" style={{ objectPosition: image.focus ?? undefined }} />
              <span aria-hidden className="absolute left-2 top-1.5 font-mono text-ui-11 tabular-nums text-tea-text" style={{ textShadow: '0 1px 3px rgb(var(--tea-bg-rgb) / 0.9)' }}>{index + 1}</span>
              {selected === index && <span aria-hidden className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-tea-gold" />}
            </button>
          </li>
        ))}
        {pending.map((item, offset) => (
          <li key={item.key} style={tileStyle(images.length + offset)} className="relative overflow-hidden bg-tea-surface" role="status">
            <img src={item.preview} alt="" className="h-full w-full object-cover opacity-50" />
            {item.error ? (
              <span className="absolute inset-0 flex flex-col items-start justify-end gap-0.5 p-2.5" style={{ background: 'linear-gradient(to top, rgb(var(--tea-bg-rgb) / 0.92), rgb(var(--tea-bg-rgb) / 0.2))' }}>
                <span className="font-sans text-ui-12 leading-snug text-tea-text">{item.error}</span>
                <span className="flex gap-x-4">
                  <button type="button" onClick={() => retry(item)} className={ACTION}>Try again</button>
                  <button type="button" onClick={() => setPending(current => current.filter(entry => entry.key !== item.key))} className={QUIET}>Drop it</button>
                </span>
              </span>
            ) : (
              <>
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-tea-border"><span className="block h-full bg-tea-gold transition-[width] duration-200" style={{ width: `${Math.round(item.progress * 100)}%` }} /></span>
                <span className="absolute bottom-2 left-2.5 font-mono text-ui-11 tabular-nums text-tea-text">{Math.round(item.progress * 100)}%</span>
              </>
            )}
          </li>
        ))}
        {total < GALLERY_IMAGE_LIMIT && (
          <li style={total === 0 ? { gridColumn: 'span 2', gridRow: 'span 2' } : tileStyle(total)} className={`flex flex-col items-center justify-center gap-0.5 border px-3 text-center ${over ? 'border-tea-gold' : 'border-tea-border'}`}>
            <span className="font-display text-ui-20 leading-tight text-tea-text">{over ? 'Let go to add them' : total === 0 ? 'No photos yet' : 'Add more'}</span>
            <span className="font-sans text-ui-11 text-tea-text-dim">{TOUCH ? `${GALLERY_IMAGE_LIMIT - total} more fit` : `Drop, paste or choose. ${GALLERY_IMAGE_LIMIT - total} more fit.`}</span>
            <span className="mt-1 flex flex-wrap justify-center gap-x-5">
              {TOUCH && <label htmlFor={cameraId} className={`${ACTION} cursor-pointer`}>Take</label>}
              <label htmlFor={inputId} className={`${ACTION} cursor-pointer`}>{TOUCH ? 'Choose' : 'Choose photos'}</label>
            </span>
          </li>
        )}
      </ul>

      {notice && <p className="mt-3 font-sans text-ui-12 text-tea-text-sec" role="status">{notice}</p>}
      {images.length > 1 && !chosen && <p className="mt-3 font-sans text-ui-12 text-tea-text-dim">{TOUCH ? 'Tap a photo to set its focus, caption and place.' : 'Drag a photo onto another to reorder. Click one to set its focus and caption.'}</p>}

      {chosen && selected !== null && (
        <div className="mt-6 border-l border-tea-gold/40 pl-4 sm:pl-6" data-testid="gallery-selected">
          <p className="font-display text-ui-20 text-tea-text">Photo {selected + 1} <span className="font-body text-ui-14 italic text-tea-text-sec">of {images.length}</span></p>
          <div className="mt-4 flex flex-col items-start gap-5">
            <FocusPicker url={chosen.image_url} focus={chosen.focus} alt={`Photo ${selected + 1}, whole`} onFocus={css => patch(selected, { focus: css })} />
            <CropStrip url={chosen.image_url} focus={chosen.focus} crops={cropsFor(selected)} />
          </div>
          <Line
            className="mt-6"
            label="Caption"
            aria-label={`Gallery photo ${selected + 1} caption`}
            value={chosen.caption ?? ''}
            maxLength={CAPTION_LIMIT}
            placeholder="Optional. Read aloud to anyone who cannot see it."
            onChange={event => patch(selected, { caption: event.target.value || null })}
            aside={<Count value={chosen.caption?.length ?? 0} max={CAPTION_LIMIT} />}
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-6">
            <button type="button" onClick={() => move(selected, selected - 1)} disabled={selected === 0} className={QUIET} aria-label={`Move gallery photo ${selected + 1} earlier`}>Earlier</button>
            <button type="button" onClick={() => move(selected, selected + 1)} disabled={selected === images.length - 1} className={QUIET} aria-label={`Move gallery photo ${selected + 1} later`}>Later</button>
            <button type="button" onClick={() => remove(selected)} className={QUIET} aria-label={`Remove gallery photo ${selected + 1}`}>Remove</button>
            <button type="button" onClick={() => setSelected(null)} className={QUIET}>Done</button>
          </div>
        </div>
      )}

      <div className="mt-4">
        <button type="button" onClick={() => setByAddress(open => !open)} aria-expanded={byAddress} className={QUIET}>{byAddress ? 'Hide the web address' : 'Add one by web address'}</button>
        {byAddress && (
          <div className="mt-2 flex flex-wrap items-end gap-x-6">
            <Line className="min-w-0 flex-1" label="Photo URL" type="url" inputMode="url" placeholder="https://" value={address} onChange={event => setAddress(event.target.value)} />
            <button
              type="button"
              disabled={!/^https?:\/\/\S+$/.test(address.trim()) || room <= 0}
              onClick={() => { update(current => [...current, { image_url: address.trim(), caption: null, focus: null }]); setAddress(''); }}
              className={ACTION}
            >
              Add it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
