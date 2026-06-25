/**
 * EditablePhoto — a photo frame for the hand-built Read story pages.
 *
 * For everyone: shows the saved photo (filling the frame, positioned by the
 * saved pan/zoom crop) or a captioned placeholder if none is set.
 *
 * For the owner (admin): drag a photo file onto the frame to upload it, then
 * drag to pan and use the slider / wheel to zoom until it sits right, and Save.
 * The image goes to the cloud store; the photo + crop save against this story
 * and frame, so the public page shows it for everyone.
 *
 * The bespoke page layout stays in code — this only swaps what fills each frame.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, getTokenClaims } from '../../lib/api';

export interface Crop {
  scale: number; // 1 = cover; >1 zooms in
  x: number; // 0..1 horizontal focal point
  y: number; // 0..1 vertical focal point
}

const DEFAULT_CROP: Crop = { scale: 1, x: 0.5, y: 0.5 };

function useIsOwner(): boolean {
  return React.useMemo(() => {
    const claims = getTokenClaims();
    if (!claims) return false;
    if (claims.role === 'owner' || claims.role === 'admin') return true;
    return (claims.memberships ?? []).some((m: any) => m.role === 'owner' || m.role === 'admin');
  }, []);
}

// Shared store so every frame on a page does ONE fetch, not one per frame.
const pageCache = new Map<string, Record<string, { url: string; crop: Crop }>>();

interface Props {
  storySlug: string;
  slot: string;
  alt: string;
  label?: string;
  caption?: string;
  aspect?: string;
  /** fill the parent (absolute inset) instead of using an aspect ratio */
  fill?: boolean;
  /** placeholder background when no photo is set (keeps the page's mood) */
  placeholderBg?: string;
  /** optional decorative placeholder content (SVG etc.) */
  placeholder?: React.ReactNode;
}

const EditablePhoto: React.FC<Props> = ({
  storySlug,
  slot,
  alt,
  label,
  caption,
  aspect = '4/5',
  fill = false,
  placeholderBg = 'linear-gradient(160deg,#23252a,#120e09)',
  placeholder,
}) => {
  const isOwner = useIsOwner();
  const [photo, setPhoto] = useState<{ url: string; crop: Crop } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ url: string; crop: Crop } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  // Load this story's photos once, share across frames.
  useEffect(() => {
    let alive = true;
    const cached = pageCache.get(storySlug);
    if (cached) {
      setPhoto(cached[slot] || null);
      return;
    }
    api.storyPhotos
      .get(storySlug)
      .then((map) => {
        if (!alive) return;
        pageCache.set(storySlug, map || {});
        setPhoto((map || {})[slot] || null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [storySlug, slot]);

  const objectPosition = (c: Crop) => `${(c.x * 100).toFixed(1)}% ${(c.y * 100).toFixed(1)}%`;

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) return;
      setBusy(true);
      try {
        const url = await api.uploadImage(file, { filename: file.name });
        setDraft({ url, crop: { ...DEFAULT_CROP } });
        setEditing(true);
      } catch {
        /* surfaced by the disabled state lifting; keep frame as-is */
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!isOwner) return;
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [isOwner, handleFile],
  );

  // Pan by dragging the image in edit mode.
  const startPan = (e: React.PointerEvent) => {
    if (!draft) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    panRef.current = { startX: e.clientX, startY: e.clientY, ox: draft.crop.x, oy: draft.crop.y };
  };
  const movePan = (e: React.PointerEvent) => {
    if (!panRef.current || !draft || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const dx = (e.clientX - panRef.current.startX) / rect.width;
    const dy = (e.clientY - panRef.current.startY) / rect.height;
    // dragging right should reveal the left of the image -> move focal point left
    const x = Math.min(1, Math.max(0, panRef.current.ox - dx));
    const y = Math.min(1, Math.max(0, panRef.current.oy - dy));
    setDraft({ ...draft, crop: { ...draft.crop, x, y } });
  };
  const endPan = () => {
    panRef.current = null;
  };

  const setScale = (scale: number) => {
    if (!draft) return;
    setDraft({ ...draft, crop: { ...draft.crop, scale: Math.min(3, Math.max(1, scale)) } });
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await api.storyPhotos.put(storySlug, slot, draft.url, draft.crop);
      const map = pageCache.get(storySlug) || {};
      map[slot] = { url: draft.url, crop: draft.crop };
      pageCache.set(storySlug, map);
      setPhoto({ url: draft.url, crop: draft.crop });
      setEditing(false);
      setDraft(null);
    } catch {
      /* keep edit mode open so the owner can retry */
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async () => {
    setBusy(true);
    try {
      await api.storyPhotos.remove(storySlug, slot);
      const map = pageCache.get(storySlug) || {};
      delete map[slot];
      pageCache.set(storySlug, map);
      setPhoto(null);
      setEditing(false);
      setDraft(null);
    } catch {
      /* no-op */
    } finally {
      setBusy(false);
    }
  };

  const shown = editing && draft ? draft : photo;

  return (
    <figure style={fill ? { margin: 0, position: 'absolute', inset: 0 } : { margin: 0 }}>
      <div
        ref={frameRef}
        onDragOver={(e) => {
          if (!isOwner) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          position: fill ? 'absolute' : 'relative',
          inset: fill ? 0 : undefined,
          aspectRatio: fill ? undefined : aspect,
          border: fill ? 'none' : `1px solid ${dragOver ? 'rgba(168,135,77,0.7)' : 'rgba(168,135,77,0.2)'}`,
          borderRadius: fill ? 0 : 3,
          overflow: 'hidden',
          background: shown ? '#14100b' : placeholderBg,
          cursor: editing ? 'grab' : 'default',
          transition: 'border-color 160ms',
        }}
      >
        {shown ? (
          <img
            src={shown.url}
            alt={alt}
            loading="lazy"
            draggable={false}
            onPointerDown={editing ? startPan : undefined}
            onPointerMove={editing ? movePan : undefined}
            onPointerUp={editing ? endPan : undefined}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: objectPosition(shown.crop),
              transform: `scale(${shown.crop.scale})`,
              transformOrigin: objectPosition(shown.crop),
              userSelect: 'none',
              touchAction: editing ? 'none' : 'auto',
            }}
          />
        ) : (
          placeholder ?? null
        )}

        {label && !editing && (
          <div style={{ position: 'absolute', left: 14, bottom: 12, fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#a8874d' }}>
            {label}
          </div>
        )}

        {/* Owner affordance: a quiet "add / edit photo" hint */}
        {isOwner && !editing && (
          <button
            type="button"
            onClick={() => {
              if (photo) {
                setDraft({ ...photo });
                setEditing(true);
              }
            }}
            style={{
              position: 'absolute',
              inset: 0,
              border: 'none',
              background: dragOver ? 'rgba(168,135,77,0.14)' : 'transparent',
              color: '#f3ead9',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'flex-end',
              padding: 10,
            }}
            aria-label={photo ? 'Edit photo' : 'Add photo'}
          >
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#cdc0a8', background: 'rgba(20,16,11,0.7)', padding: '4px 8px', borderRadius: 2 }}>
              {busy ? 'working' : photo ? 'edit photo' : 'drop or pick photo'}
            </span>
          </button>
        )}

        {/* Hidden file picker for click-to-upload (alongside drag-drop) */}
        {isOwner && !editing && !photo && (
          <label style={{ position: 'absolute', inset: 0, cursor: 'pointer' }} aria-label="Choose a photo">
            <input
              type="file"
              accept="image/*"
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
        )}
      </div>

      {/* Edit controls — owner only, while editing */}
      {isOwner && editing && draft && (
        <div style={fill
          ? { position: 'absolute', left: 16, right: 16, bottom: 16, zIndex: 5, padding: 12, border: '1px solid rgba(168,135,77,0.24)', borderRadius: 4, background: 'rgba(20,16,11,0.92)' }
          : { marginTop: 10, padding: 12, border: '1px solid rgba(168,135,77,0.24)', borderRadius: 4, background: 'linear-gradient(160deg,#1d1810,#15110b)' }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#a8874d', marginBottom: 10 }}>
            Drag the image to pan · slider to zoom
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#cdc0a8' }}>Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.02}
              value={draft.crop.scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: '#a8874d' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <button
              type="button"
              onClick={removePhoto}
              disabled={busy}
              style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#80735f', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              Remove
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(null);
                }}
                disabled={busy}
                style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#cdc0a8', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#14100b', background: '#a8874d', border: 'none', borderRadius: 2, padding: '6px 14px', cursor: 'pointer' }}
              >
                {busy ? 'Saving' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {caption && !editing && (
        <figcaption style={{ fontFamily: "'Lora',Georgia,serif", fontStyle: 'italic', fontSize: 13, lineHeight: 1.5, color: '#80735f', marginTop: 12 }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
};

export default EditablePhoto;
