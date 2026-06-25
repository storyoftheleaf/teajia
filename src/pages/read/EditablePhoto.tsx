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

const DEFAULT_CROP = { scale: 1, x: 0.5, y: 0.5 };

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
  const [dragOver, setDragOver] = useState(false);
  const [focusing, setFocusing] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  // Register this frame so the editor bar's "what needs a photo" list knows it.
  useEffect(() => {
    if (isOwner) registerFrame(slot, label || alt || slot);
  }, [isOwner, slot, label, alt, registerFrame]);

  const objPos = (c: { x: number; y: number }) => `${(c.x * 100).toFixed(1)}% ${(c.y * 100).toFixed(1)}%`;

  const upload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setBusy(true);
    try {
      const url = await api.uploadImage(file, { filename: file.name || 'photo.jpg' });
      setPhoto(slot, { url, crop: { ...DEFAULT_CROP } });
    } catch { /* leave frame unchanged */ }
    finally { setBusy(false); }
  }, [slot, setPhoto]);

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

        {/* Focal dot — drag to set the crop center (owner, editing, has photo) */}
        {liveEdit && photo && (
          <div
            onPointerDown={(e) => { e.preventDefault(); setFocusing(true); }}
            style={{
              position: 'absolute',
              left: `${photo.crop.x * 100}%`,
              top: `${photo.crop.y * 100}%`,
              width: 22, height: 22, marginLeft: -11, marginTop: -11,
              borderRadius: '50%',
              border: '2px solid #f3ead9',
              boxShadow: '0 0 0 2px rgba(20,16,11,0.6), 0 0 8px rgba(0,0,0,0.5)',
              background: 'rgba(168,135,77,0.35)',
              cursor: 'grab',
              touchAction: 'none',
            }}
            title="Drag to set the focal point"
          />
        )}

        {/* Owner hint / dropzone label */}
        {liveEdit && (
          <div style={{ position: 'absolute', top: 8, right: 8, fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#cdc0a8', background: 'rgba(20,16,11,0.72)', padding: '4px 8px', borderRadius: 2, pointerEvents: 'none' }}>
            {busy ? 'uploading' : photo ? 'drag focus · paste to replace' : 'drop / paste / pick'}
          </div>
        )}

        {/* Click-to-pick file input when empty */}
        {liveEdit && !photo && !showLibrary && (
          <label style={{ position: 'absolute', inset: 0, cursor: 'pointer' }} aria-label="Choose a photo">
            <input type="file" accept="image/*" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          </label>
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
