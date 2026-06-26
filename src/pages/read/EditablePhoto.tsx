/**
 * EditablePhoto — a photo frame for the hand-built Read story pages.
 *
 * Reads/writes through the shared story-edit draft (see storyEdit.tsx), so a
 * photo change joins the same draft -> publish -> undo flow as text edits.
 *
 * For everyone: shows the saved photo (filling the frame, positioned by the
 * saved pan/zoom/focal crop) or a captioned placeholder if none is set.
 *
 * For the owner in edit mode: drag a photo file onto the frame (or paste from
 * clipboard, or pick) to upload it, drag the focal dot to choose what stays
 * centered, slider to zoom. Changes flow into the draft and save automatically.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useStoryEdit, type PhotoVal } from './storyEdit';
import { shrinkImage, isTouch } from './imageUtils';

const DEFAULT_CROP = { scale: 1, x: 0.5, y: 0.5 };
const TOUCH = isTouch();

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
}

const EditablePhoto: React.FC<Props> = ({
  slot, alt, label, caption, captionField, aspect = '4/5', fill = false,
  placeholderBg = 'linear-gradient(160deg,#23252a,#120e09)', placeholder,
}) => {
  const { isOwner, editing, previewVisitor, photos, setPhoto, text, setText, registerFrame, usedImages } = useStoryEdit();
  const liveEdit = isOwner && editing && !previewVisitor;
  const photo: PhotoVal | undefined = photos[slot];
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1 during upload
  const [uploadError, setUploadError] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [focusing, setFocusing] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);

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

  // Drag the focal dot to set what stays centered when the frame crops.
  const moveFocal = useCallback((clientX: number, clientY: number) => {
    if (!photo || !frameRef.current) return;
    const r = frameRef.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    setPhoto(slot, { ...photo, crop: { ...photo.crop, x, y } });
  }, [photo, slot, setPhoto]);

  const setScale = (scale: number) => {
    if (!photo) return;
    setPhoto(slot, { ...photo, crop: { ...photo.crop, scale: Math.min(3, Math.max(1, scale)) } });
  };

  // Tap anywhere on the photo to place the focal point there (touch-friendly,
  // no precise dragging needed). Ignored if the tap was a pinch.
  const tapFocal = useCallback((e: React.PointerEvent) => {
    if (!liveEdit || !photo || pinchRef.current) return;
    // Don't hijack a tap on the dot itself (it has its own drag handler).
    if ((e.target as HTMLElement).dataset.focalDot) return;
    moveFocal(e.clientX, e.clientY);
  }, [liveEdit, photo, moveFocal]);

  // Pinch-to-zoom on touch.
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!liveEdit || !photo || e.touches.length !== 2) return;
    const [a, b] = [e.touches[0], e.touches[1]];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    pinchRef.current = { startDist: dist, startScale: photo.crop.scale };
  }, [liveEdit, photo]);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pinchRef.current || e.touches.length !== 2 || !photo) return;
    e.preventDefault();
    const [a, b] = [e.touches[0], e.touches[1]];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const next = pinchRef.current.startScale * (dist / pinchRef.current.startDist);
    setScale(next);
  }, [photo]); // eslint-disable-line react-hooks/exhaustive-deps
  const onTouchEnd = useCallback(() => { pinchRef.current = null; }, []);

  // Global pointer move while dragging the focal dot.
  useEffect(() => {
    if (!focusing) return;
    const mv = (e: PointerEvent) => moveFocal(e.clientX, e.clientY);
    const up = () => setFocusing(false);
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
  }, [focusing, moveFocal]);

  const captionText = captionField ? text(captionField, caption || '') : caption;

  return (
    <figure style={fill ? { margin: 0, position: 'absolute', inset: 0 } : { margin: 0 }}>
      <div
        ref={frameRef}
        data-frame-slot={slot}
        tabIndex={liveEdit ? 0 : -1}
        onPaste={onPaste}
        onPointerUp={tapFocal}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDragOver={(e) => { if (!liveEdit) return; e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          position: fill ? 'absolute' : 'relative',
          inset: fill ? 0 : undefined,
          aspectRatio: fill ? undefined : aspect,
          border: fill ? 'none' : `1px solid ${dragOver ? 'rgba(168,135,77,0.7)' : liveEdit ? 'rgba(168,135,77,0.4)' : 'rgba(168,135,77,0.2)'}`,
          borderRadius: fill ? 0 : 3,
          overflow: 'hidden',
          background: photo ? '#14100b' : placeholderBg,
          outline: 'none',
          touchAction: liveEdit && photo ? 'none' : 'auto',
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
          <div style={{ position: 'absolute', left: 14, bottom: 12, fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#a8874d' }}>
            {label}
          </div>
        )}

        {/* Focal dot — drag OR tap the photo to set the crop center. Bigger
            touch grab area; the visible ring stays small. */}
        {liveEdit && photo && (
          <div
            data-focal-dot="1"
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setFocusing(true); }}
            style={{
              position: 'absolute',
              left: `${photo.crop.x * 100}%`,
              top: `${photo.crop.y * 100}%`,
              width: TOUCH ? 44 : 26, height: TOUCH ? 44 : 26,
              marginLeft: TOUCH ? -22 : -13, marginTop: TOUCH ? -22 : -13,
              borderRadius: '50%',
              border: '2px solid #f3ead9',
              boxShadow: '0 0 0 2px rgba(20,16,11,0.6), 0 0 8px rgba(0,0,0,0.5)',
              background: 'rgba(168,135,77,0.4)',
              cursor: 'grab',
              touchAction: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Drag or tap the photo to set the focal point"
          >
            <span data-focal-dot="1" style={{ width: 6, height: 6, borderRadius: '50%', background: '#f3ead9' }} />
          </div>
        )}

        {/* Upload progress bar */}
        {liveEdit && busy && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: 'rgba(168,135,77,0.18)', zIndex: 6 }}>
            <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: '#a8874d', transition: 'width 160ms' }} />
          </div>
        )}

        {/* Upload error + retry */}
        {liveEdit && uploadError && !busy && (
          <button type="button" onClick={retryUpload}
            style={{ position: 'absolute', inset: 0, zIndex: 7, background: 'rgba(20,16,11,0.85)', border: 'none', color: '#f3ead9', cursor: 'pointer', fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, letterSpacing: '0.08em' }}>
            upload failed · tap to retry
          </button>
        )}

        {/* Owner hint / dropzone label */}
        {liveEdit && !busy && !uploadError && (
          <div style={{ position: 'absolute', top: 8, right: 8, fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#cdc0a8', background: 'rgba(20,16,11,0.72)', padding: '4px 8px', borderRadius: 2, pointerEvents: 'none' }}>
            {photo ? (TOUCH ? 'tap to set focus' : 'drag focus · paste') : (TOUCH ? 'add a photo' : 'drop / paste / pick')}
          </div>
        )}

        {/* Empty frame: take a photo (camera) + choose from library/files */}
        {liveEdit && !photo && !showLibrary && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12 }}>
            {TOUCH && (
              <label style={{ minWidth: 160, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(168,135,77,0.5)', borderRadius: 4, color: '#f3ead9', background: 'rgba(168,135,77,0.18)', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                take a photo
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
              </label>
            )}
            <label style={{ minWidth: 160, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(168,135,77,0.35)', borderRadius: 4, color: '#cdc0a8', background: 'rgba(20,16,11,0.5)', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
              {TOUCH ? 'choose from photos' : 'drop, paste, or choose'}
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            </label>
          </div>
        )}

        {/* Reuse a photo already used elsewhere on this story */}
        {liveEdit && !photo && usedImages.length > 0 && (
          <button type="button" onClick={() => setShowLibrary((s) => !s)}
            style={{ position: 'absolute', bottom: 8, left: 8, zIndex: 3, fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#cdc0a8', background: 'rgba(20,16,11,0.8)', border: 'none', borderRadius: 2, padding: '4px 8px', cursor: 'pointer' }}>
            {showLibrary ? 'close' : 'reuse a photo'}
          </button>
        )}
        {liveEdit && !photo && showLibrary && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 4, background: 'rgba(20,16,11,0.95)', padding: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(44px,1fr))', gap: 6, alignContent: 'start', overflowY: 'auto' }}>
            {usedImages.map((url) => (
              <button key={url} type="button"
                onClick={() => { setPhoto(slot, { url, crop: { ...DEFAULT_CROP } }); setShowLibrary(false); }}
                style={{ aspectRatio: '1/1', border: '1px solid rgba(168,135,77,0.3)', borderRadius: 2, padding: 0, overflow: 'hidden', cursor: 'pointer', background: 'none' }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Zoom + remove controls under the frame, owner editing only */}
      {liveEdit && photo && (
        <div style={fill
          ? { position: 'absolute', left: 16, right: 16, bottom: 16, zIndex: 5, padding: 10, border: '1px solid rgba(168,135,77,0.3)', borderRadius: 4, background: 'rgba(20,16,11,0.92)', display: 'flex', alignItems: 'center', gap: 10 }
          : { marginTop: 8, padding: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#cdc0a8' }}>Zoom</span>
          <input type="range" min={1} max={3} step={0.02} value={photo.crop.scale}
            onChange={(e) => setScale(parseFloat(e.target.value))} style={{ flex: 1, accentColor: '#a8874d' }} />
          <button type="button" onClick={() => setPhoto(slot, null)}
            style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#80735f', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            remove
          </button>
        </div>
      )}

      {captionText && !liveEdit && (
        <figcaption style={{ fontFamily: "'Lora',Georgia,serif", fontStyle: 'italic', fontSize: 13, lineHeight: 1.5, color: '#80735f', marginTop: 12 }}>
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
            style={{ width: '100%', fontFamily: "'Lora',Georgia,serif", fontStyle: 'italic', fontSize: 13, color: '#cdc0a8', background: 'transparent', border: 'none', borderBottom: '1px dashed rgba(168,135,77,0.4)', outline: 'none', padding: '4px 0' }}
          />
        </figcaption>
      )}
    </figure>
  );
};

export default EditablePhoto;
