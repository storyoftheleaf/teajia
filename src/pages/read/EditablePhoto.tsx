/**
 * @color-literals. The Read section is one always-dark editorial surface.
 * Rationale, and the conditions on this exception, in read/immersive.tsx.
 */
/**
 * EditablePhoto, a photo frame for the hand-built Read story pages.
 *
 * Reads/writes through the shared story-edit draft (see storyEdit.tsx), so a
 * photo change joins the same draft -> publish -> undo flow as text edits.
 *
 * For everyone: shows the saved photo (filling the frame, positioned by the
 * saved pan/zoom/focal crop) or a captioned placeholder if none is set.
 *
 * For the owner in edit mode: drag a photo file onto the frame (or paste from
 * clipboard, or pick) to upload it, then "edit" opens the one shared photo
 * editor (the same one Curate uses) to straighten, turn, enlarge and frame it
 * to this frame's shape. Changes flow into the draft and save automatically.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useStoryEdit, type PhotoVal } from './storyEdit';
import { shrinkImage, isTouch } from './imageUtils';
import { SquareCropModal } from '../../components/shared/SquareCropModal';
import type { SquarePhotoFrame } from '../../lib/cropImage';

const DEFAULT_CROP = { scale: 1, x: 0.5, y: 0.5 };
const TOUCH = isTouch();

/** "4/5" as a number. A frame that fills its parent has no shape of its own. */
export function ratioOf(aspect: string): number {
  const [w, h] = aspect.split('/').map(Number);
  return w > 0 && h > 0 ? w / h : w > 0 ? w : 1;
}
/** The editor's three shapes; a filling frame opens on the nearest. */
const SHAPES = [1, 2 / 3, 3 / 2];
const QUIET_BUTTON: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'transparent', border: 'none', cursor: 'pointer', minHeight: 44 };

interface Props {
  slot: string;
  alt: string;
  label?: string;
  caption?: string;
  /** field key for the caption text, so the caption is inline-editable too */
  captionField?: string;
  aspect?: string;
  fill?: boolean;
  placeholderBg?: string;
  placeholder?: React.ReactNode;
  /**
   * The photograph the story was designed with, shipped as a site file. It
   * shows until the owner drops a different photo into the frame; removing
   * that photo brings this one back. x/y are the focal point, 0..1.
   */
  defaultPhoto?: { url: string; x?: number; y?: number };
  /** No hairline around the frame once it holds a photo. */
  bare?: boolean;
}

const EditablePhoto: React.FC<Props> = ({
  slot, alt, label, caption, captionField, aspect = '4/5', fill = false,
  placeholderBg = 'linear-gradient(160deg,var(--tj-read-empty-from),var(--tj-read-plate-to))', placeholder,
  defaultPhoto, bare = false,
}) => {
  const { isOwner, editing, previewVisitor, photos, setPhoto, text, setText, registerFrame, usedImages } = useStoryEdit();
  const liveEdit = isOwner && editing && !previewVisitor;
  const photo: PhotoVal | undefined = photos[slot] ?? (defaultPhoto
    ? { url: defaultPhoto.url, crop: { scale: 1, x: defaultPhoto.x ?? 0.5, y: defaultPhoto.y ?? 0.5 } }
    : undefined);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1 during upload
  const [uploadError, setUploadError] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [framing, setFraming] = useState(false);
  const [openShape, setOpenShape] = useState(1);
  const [showLibrary, setShowLibrary] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  // Register this frame so the editor bar's "what needs a photo" list knows it.
  useEffect(() => {
    if (isOwner) registerFrame(slot, label || alt || slot);
  }, [isOwner, slot, label, alt, registerFrame]);

  const objPos = (c: { x: number; y: number }) => `${(c.x * 100).toFixed(1)}% ${(c.y * 100).toFixed(1)}%`;

  const upload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setLastFile(file);
    setUploadError(false);
    setBusy(true);
    setProgress(0.02);
    try {
      // Shrink a big phone photo before sending so cell-data uploads are fast.
      const small = await shrinkImage(file);
      const url = await api.uploadImageProgress(small, (p) => setProgress(Math.max(0.05, p)), { filename: small.name || 'photo.jpg' });
      setPhoto(slot, { url, crop: { ...DEFAULT_CROP } });
      setProgress(1);
    } catch {
      setUploadError(true);
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 600);
    }
  }, [slot, setPhoto]);

  const retryUpload = useCallback(() => { if (lastFile) upload(lastFile); }, [lastFile, upload]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!liveEdit) return;
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }, [liveEdit, upload]);

  // Paste an image from the clipboard onto the focused frame.
  const onPaste = useCallback((e: React.ClipboardEvent) => {
    if (!liveEdit) return;
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (item) {
      const file = item.getAsFile();
      if (file) { e.preventDefault(); upload(file); }
    }
  }, [liveEdit, upload]);

  // "edit" opens the shared editor on the untouched picture. A frame with its
  // own shape is framed to that shape; one that fills its parent changes shape
  // with the screen, so it offers the three shapes and opens on the nearest.
  const openEditor = useCallback(() => {
    if (fill && frameRef.current) {
      const box = frameRef.current.getBoundingClientRect();
      const now = box.height ? box.width / box.height : 1;
      setOpenShape(SHAPES.reduce((best, shape) => Math.abs(shape - now) < Math.abs(best - now) ? shape : best, 1));
    }
    setFraming(true);
  }, [fill]);

  const saveFramed = useCallback(async (blob: Blob, frame: SquarePhotoFrame) => {
    if (!photo) return;
    const url = await api.uploadImageProgress(blob, () => {}, { filename: 'photo.jpg' });
    setPhoto(slot, { url, crop: { ...DEFAULT_CROP }, original: photo.original ?? photo.url, frame });
    setFraming(false);
  }, [photo, slot, setPhoto]);

  const captionText = captionField ? text(captionField, caption || '') : caption;

  return (
    <figure style={fill ? { margin: 0, position: 'absolute', inset: 0 } : { margin: 0 }}>
      <div
        ref={frameRef}
        data-frame-slot={slot}
        tabIndex={liveEdit ? 0 : -1}
        onPaste={onPaste}
        onDragOver={(e) => { if (!liveEdit) return; e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          position: fill ? 'absolute' : 'relative',
          inset: fill ? 0 : undefined,
          aspectRatio: fill ? undefined : aspect,
          border: fill || (bare && photo && !liveEdit) ? 'none' : `1px solid ${dragOver ? 'rgb(var(--tj-read-gold-rgb) / 0.7)' : liveEdit ? 'rgb(var(--tj-read-gold-rgb) / 0.4)' : 'rgb(var(--tj-read-gold-rgb) / 0.2)'}`,
          borderRadius: fill || bare ? 0 : 3,
          overflow: 'hidden',
          background: photo ? 'var(--tj-read-bg)' : placeholderBg,
          outline: 'none',
        }}
      >
        {photo ? (
          <img
            src={photo.url}
            alt={alt}
            loading="lazy"
            draggable={false}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover',
              objectPosition: objPos(photo.crop),
              transform: `scale(${photo.crop.scale})`,
              transformOrigin: objPos(photo.crop),
              userSelect: 'none',
            }}
          />
        ) : (placeholder ?? null)}

        {label && !liveEdit && (
          <div style={{ position: 'absolute', left: 14, bottom: 12, fontFamily: 'var(--font-sans)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--tj-gold, var(--tj-read-gold-default))' }}>
            {label}
          </div>
        )}

        {/* Upload progress bar */}
        {liveEdit && busy && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: 'rgb(var(--tj-read-gold-rgb) / 0.18)', zIndex: 6 }}>
            <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: 'var(--tj-gold, var(--tj-read-gold-default))', transition: 'width 160ms' }} />
          </div>
        )}

        {/* Upload error + retry */}
        {liveEdit && uploadError && !busy && (
          <button type="button" onClick={retryUpload}
            style={{ position: 'absolute', inset: 0, zIndex: 7, background: 'rgb(var(--tj-read-bg-rgb) / 0.85)', border: 'none', color: 'var(--tj-read-cream)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12, letterSpacing: '0.08em' }}>
            upload failed · tap to retry
          </button>
        )}

        {/* Owner hint / dropzone label */}
        {liveEdit && !busy && !uploadError && (
          <div style={{ position: 'absolute', top: 8, right: 8, fontFamily: 'var(--font-sans)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tj-read-taupe)', background: 'rgb(var(--tj-read-bg-rgb) / 0.72)', padding: '4px 8px', borderRadius: 2, pointerEvents: 'none' }}>
            {photo ? (TOUCH ? 'edit below' : 'drop or paste to replace') : (TOUCH ? 'add a photo' : 'drop / paste / pick')}
          </div>
        )}

        {/* Empty frame: take a photo (camera) + choose from library/files */}
        {liveEdit && !photo && !showLibrary && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12 }}>
            {TOUCH && (
              <label style={{ minWidth: 160, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.5)', borderRadius: 4, color: 'var(--tj-read-cream)', background: 'rgb(var(--tj-read-gold-rgb) / 0.18)', fontFamily: 'var(--font-sans)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                take a photo
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
              </label>
            )}
            <label style={{ minWidth: 160, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.35)', borderRadius: 4, color: 'var(--tj-read-taupe)', background: 'rgb(var(--tj-read-bg-rgb) / 0.5)', fontFamily: 'var(--font-sans)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
              {TOUCH ? 'choose from photos' : 'drop, paste, or choose'}
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            </label>
          </div>
        )}

        {/* Reuse a photo already used elsewhere on this story */}
        {liveEdit && !photo && usedImages.length > 0 && (
          <button type="button" onClick={() => setShowLibrary((s) => !s)}
            style={{ position: 'absolute', bottom: 8, left: 8, zIndex: 3, fontFamily: 'var(--font-sans)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tj-read-taupe)', background: 'rgb(var(--tj-read-bg-rgb) / 0.8)', border: 'none', borderRadius: 2, padding: '4px 8px', cursor: 'pointer' }}>
            {showLibrary ? 'close' : 'reuse a photo'}
          </button>
        )}
        {liveEdit && !photo && showLibrary && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 4, background: 'rgb(var(--tj-read-bg-rgb) / 0.95)', padding: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(44px,1fr))', gap: 6, alignContent: 'start', overflowY: 'auto' }}>
            {usedImages.map((url) => (
              <button key={url} type="button"
                onClick={() => { setPhoto(slot, { url, crop: { ...DEFAULT_CROP } }); setShowLibrary(false); }}
                style={{ aspectRatio: '1/1', border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.3)', borderRadius: 2, padding: 0, overflow: 'hidden', cursor: 'pointer', background: 'none' }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Edit + remove under the frame, owner editing only */}
      {liveEdit && photo && (
        <div style={fill
          ? { position: 'absolute', left: 16, bottom: 16, zIndex: 5, padding: '0 12px', border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.3)', borderRadius: 4, background: 'rgb(var(--tj-read-bg-rgb) / 0.92)', display: 'flex', alignItems: 'center', gap: 18 }
          : { marginTop: 4, display: 'flex', alignItems: 'center', gap: 18 }}>
          <button type="button" data-testid="story-photo-edit" onClick={openEditor}
            style={{ ...QUIET_BUTTON, color: 'var(--tj-gold, var(--tj-read-gold-default))' }}>
            edit
          </button>
          <button type="button" onClick={() => setPhoto(slot, null)}
            style={{ ...QUIET_BUTTON, color: 'var(--tj-read-dim)' }}>
            remove
          </button>
        </div>
      )}
      {liveEdit && photo && (
        <SquareCropModal
          isOpen={framing}
          source={photo.original ?? photo.url}
          title="Edit photo"
          initialFrame={photo.frame ?? null}
          allowAspectSelection={fill}
          frameAspect={fill ? openShape : ratioOf(aspect)}
          layer="takeover"
          onClose={() => setFraming(false)}
          onConfirm={saveFramed}
        />
      )}

      {captionText && !liveEdit && (
        <figcaption style={{ fontFamily: "'Lora',Georgia,serif", fontStyle: 'italic', fontSize: 13, lineHeight: 1.5, color: 'var(--tj-read-dim)', marginTop: 12 }}>
          {captionText}
        </figcaption>
      )}
      {/* Editable caption */}
      {liveEdit && captionField && (
        <figcaption style={{ marginTop: 10 }}>
          <input
            value={text(captionField, caption || '')}
            onChange={(e) => setText(captionField, e.target.value)}
            placeholder="caption…"
            style={{ width: '100%', fontFamily: "'Lora',Georgia,serif", fontStyle: 'italic', fontSize: 13, color: 'var(--tj-read-taupe)', background: 'transparent', border: 'none', borderBottom: '1px dashed rgb(var(--tj-read-gold-rgb) / 0.4)', outline: 'none', padding: '4px 0' }}
          />
        </figcaption>
      )}
    </figure>
  );
};

export default EditablePhoto;
