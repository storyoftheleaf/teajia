import React, { useCallback, useEffect, useId, useState } from 'react';
import { isTouch } from '../../../pages/read/imageUtils';
import { ACTION, LABEL, Line, QUIET } from './parts';
import { imagesFrom, usePhotoUpload, usePhotoUploader, type UploadState } from './photoUpload';
import { SquareCropModal } from '../../../components/shared/SquareCropModal';
import { recallPhotoEdit, rememberPhotoEdit } from '../../../lib/photoEditMemory';
import { mediaUrl } from '../../../lib/mediaUrl';

const TOUCH = isTouch();

/** A frame the page crops this photo into, drawn at a shared height so the crops read side by side. */
export type Crop = { label: string; width: number; height: number; round?: boolean };

/** Every crop preview is drawn this tall; widths keep each frame's real proportion. */
const CROP_HEIGHT = 104;

export function CropStrip({ url, focus, crops }: { url: string; focus: string | null | undefined; crops: Crop[] }) {
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3" aria-label="How the page crops it">
      {crops.map(crop => {
        const scale = CROP_HEIGHT / crop.height;
        return (
          <figure key={crop.label} className="m-0">
            <div
              className={`relative overflow-hidden border border-tea-border bg-tea-surface ${crop.round ? 'rounded-full' : ''}`}
              style={{ width: Math.round(crop.width * scale), height: CROP_HEIGHT }}
            >
              <img src={mediaUrl(url)} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: focus ?? undefined }} />
            </div>
            <figcaption className="mt-1.5 font-sans text-ui-10 uppercase tracking-caps text-tea-text-dim">{crop.label}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/**
 * "Edit photo": the one shared photo editor, the same one Curate uses, opened
 * on a placed photo to straighten, turn, enlarge and frame it. What it saves is
 * a new picture, already framed, so the page centres on it. The untouched
 * picture is kept for this sitting, so opening the editor again starts from it.
 */
export function PhotoEdit({ url, label, onEdited, className = ACTION }: { url: string; label: string; onEdited: (url: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const send = usePhotoUploader();
  const before = recallPhotoEdit(url);
  const original = before?.original ?? url;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} aria-label={label}>Edit photo</button>
      <SquareCropModal
        isOpen={open}
        source={open ? mediaUrl(original) : null}
        title="Edit photo"
        initialFrame={before?.frame ?? null}
        allowAspectSelection
        onClose={() => setOpen(false)}
        onConfirm={async (blob, frame) => {
          const next = await send(new File([blob], 'photo.jpg', { type: 'image/jpeg' }), () => {});
          rememberPhotoEdit(next, original, frame);
          onEdited(next);
          setOpen(false);
        }}
      />
    </>
  );
}

type Props = {
  /** One word for the photo, "Portrait", used in labels and the web address field. */
  name: string;
  url: string | null | undefined;
  focus: string | null | undefined;
  onChange: (next: { url: string | null; focus: string | null }) => void;
  crops: Crop[];
  /** Short line in the empty frame saying what this photo is for. */
  purpose: string;
  /** How tall the empty frame stands. */
  emptyHeight?: number;
  onBusy?: (busy: boolean) => void;
  extraActions?: React.ReactNode;
  testId?: string;
  /** Lets the panel hand this place a pasted photo when nothing else took it. */
  takeRef?: React.MutableRefObject<((files: File[]) => void) | null>;
  /** The photo as said in a sentence, "No portrait yet". Defaults to the name in lower case; give it when the name carries capitals, "QR code". */
  noun?: string;
  /** Offer "Use a web address". Off on a contributor's own screen, where a photo is always placed, never linked. */
  allowAddress?: boolean;
};

/**
 * A place for one photo. Empty, it is a drop target that also takes a paste
 * and opens the file picker, and on a phone the camera. While the photo
 * travels it shows the photo itself, dimmed, with a bronze line filling along
 * the foot. Placed, it shows the whole photo beside the crops the page will
 * make of it, and "Edit photo" opens the shared photo editor.
 */
export function PhotoPlace({ name, url, focus, onChange, crops, purpose, emptyHeight = 240, onBusy, extraActions, testId, takeRef, noun, allowAddress = true }: Props) {
  const inputId = useId();
  const cameraId = useId();
  const addressId = useId();
  const [over, setOver] = useState(false);
  const [byAddress, setByAddress] = useState(false);
  const onUploaded = useCallback((next: string) => onChange({ url: next, focus: null }), [onChange]);
  const { state, upload, retry, dismiss } = usePhotoUpload(onUploaded);
  const busy = state.status === 'uploading';

  useEffect(() => { onBusy?.(busy); }, [busy, onBusy]);

  const take = (files: File[]) => { if (files[0]) void upload(files[0]); };
  if (takeRef) takeRef.current = take;

  const dropProps = {
    onDragOver: (event: React.DragEvent) => {
      if (!Array.from(event.dataTransfer.types).includes('Files')) return;
      event.preventDefault();
      setOver(true);
    },
    onDragLeave: (event: React.DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
    },
    onDrop: (event: React.DragEvent) => {
      if (!Array.from(event.dataTransfer.types).includes('Files')) return;
      event.preventDefault();
      setOver(false);
      take(imagesFrom(event.dataTransfer.files));
    },
    onPaste: (event: React.ClipboardEvent) => {
      const files = imagesFrom(event.clipboardData.items);
      if (!files.length) return;
      event.preventDefault();
      take(files);
    },
  };

  const pickers = (
    <>
      <input id={inputId} type="file" accept="image/*" className="sr-only" tabIndex={-1} data-testid={testId ? `${testId}-file` : undefined}
        onChange={event => { take(imagesFrom(event.target.files)); event.target.value = ''; }} />
      {TOUCH && (
        <input id={cameraId} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1}
          onChange={event => { take(imagesFrom(event.target.files)); event.target.value = ''; }} />
      )}
    </>
  );

  const chooseLabel = url ? 'Replace' : TOUCH ? 'Choose from photos' : 'Choose a photo';

  return (
    <div data-testid={testId} {...dropProps} className="min-w-0">
      {pickers}

      {state.status === 'uploading' ? (
        <div className="relative overflow-hidden border border-tea-border bg-tea-surface" style={{ height: emptyHeight }} role="status" aria-live="polite">
          <img src={state.preview} alt="" className="absolute inset-0 h-full w-full object-contain opacity-50" />
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-tea-border">
            <div className="h-full bg-tea-gold transition-[width] duration-200" style={{ width: `${Math.round(state.progress * 100)}%` }} />
          </div>
          <p className="absolute bottom-3 left-4 font-sans text-ui-12 text-tea-text">
            Placing the photo <span className="ml-1 font-mono tabular-nums text-tea-text-sec">{Math.round(state.progress * 100)}%</span>
          </p>
        </div>
      ) : state.status === 'failed' ? (
        <div className="flex flex-col items-start justify-center gap-2 border border-tea-border bg-tea-surface px-5 py-6" style={{ minHeight: emptyHeight }} role="alert">
          <p className="max-w-[40ch] font-body text-ui-15 leading-relaxed text-tea-text">{state.message}</p>
          <div className="flex flex-wrap gap-x-6">
            <button type="button" onClick={retry} className={ACTION}>Try again</button>
            <label htmlFor={inputId} className={`${QUIET} cursor-pointer`} onClick={dismiss}>Choose another</label>
          </div>
        </div>
      ) : url ? (
        <div className="flex flex-col items-start gap-5">
          <div className="min-w-0 max-w-full">
            <img src={mediaUrl(url)} alt={`${name}, whole photo`} draggable={false} className="block h-auto max-h-[360px] w-auto max-w-full" />
          </div>
          <CropStrip url={url} focus={focus} crops={crops} />
        </div>
      ) : (
        <div
          tabIndex={0}
          aria-label={`${name}. Drop a photo here, paste one, or choose one.`}
          className={`flex flex-col items-center justify-center gap-1 border px-6 text-center transition-colors focus:outline-none focus-visible:border-tea-gold ${over ? 'border-tea-gold bg-tea-accent-sub' : 'border-tea-border bg-tea-surface'}`}
          style={{ height: emptyHeight }}
        >
          <p className="font-display text-ui-26 font-light leading-tight text-tea-text">{over ? 'Let go to place it' : `No ${noun ?? name.toLowerCase()} yet`}</p>
          <p className="max-w-[36ch] font-body text-ui-14 italic leading-relaxed text-tea-text-sec">{purpose}</p>
          <p className="mt-1 font-sans text-ui-12 text-tea-text-dim">{TOUCH ? 'From the camera or your photos.' : 'Drop it here, paste it, or choose one.'}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-x-7">
            {TOUCH && <label htmlFor={cameraId} className={`${ACTION} cursor-pointer`}>Take a photo</label>}
            <label htmlFor={inputId} className={`${ACTION} cursor-pointer`}>{chooseLabel}</label>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-6">
        {url && !busy && <label htmlFor={inputId} className={`${ACTION} cursor-pointer`}>{chooseLabel}</label>}
        {url && !busy && <PhotoEdit url={url} label={`Edit the ${noun ?? name.toLowerCase()}`} onEdited={next => onChange({ url: next, focus: null })} />}
        {url && !busy && focus && <button type="button" onClick={() => onChange({ url, focus: null })} className={QUIET}>Centre the focus</button>}
        {extraActions}
        {url && !busy && <button type="button" onClick={() => onChange({ url: null, focus: null })} className={QUIET}>Remove</button>}
        {!busy && allowAddress && <button type="button" onClick={() => setByAddress(open => !open)} aria-expanded={byAddress} className={QUIET}>{byAddress ? 'Hide the web address' : 'Use a web address'}</button>}
      </div>
      {byAddress && (
        <Line
          className="mt-3"
          id={addressId}
          label={`${name} URL`}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={url ?? ''}
          onChange={event => onChange({ url: event.target.value || null, focus: null })}
        />
      )}
    </div>
  );
}

export type { UploadState };
export { LABEL };
