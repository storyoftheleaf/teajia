/**
 * @color-literals. The Read section is one always-dark editorial surface.
 * Rationale, and the conditions on this exception, in read/immersive.tsx.
 */
/**
 * Story inline-editing engine for the hand-built Read pages.
 *
 * Wrap a story in <StoryEditProvider slug="..."> and use the primitives:
 *   <EditableText field="title" as="h1" ...>default text</EditableText>
 *   useStoryEdit()  -> { editing, isOwner, dirty, save, publish, ... }
 *   <StoryEditorBar /> -> the floating owner toolbar (toggle / preview / publish / undo)
 *
 * Model:
 *   - The page renders its CODED defaults as children. An edit override, when
 *     present, replaces the default. Nothing is duplicated; the page is the
 *     source of layout, the store holds only what the owner changed.
 *   - Owner edits land in a DRAFT (autosaved). Visitors and "preview as visitor"
 *     see PUBLISHED. Publishing promotes the draft and snapshots for undo.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { api } from '../../lib/api';
import { useAppStore, selectIsOwnerTier } from '../../lib/store';

// ── content shape ────────────────────────────────────────────────────────────
export interface PhotoVal { url: string; crop: { scale: number; x: number; y: number } }
export interface StoryContent {
  text?: Record<string, string>;
  photos?: Record<string, PhotoVal>;
  plates?: string[]; // order + membership of the photo-row frames
}

interface Ctx {
  slug: string;
  isOwner: boolean;
  editing: boolean;
  setEditing: (v: boolean) => void;
  previewVisitor: boolean; // owner is previewing as a visitor (published only)
  setPreviewVisitor: (v: boolean) => void;
  loaded: boolean;
  dirty: boolean;
  saving: boolean;
  // effective content (draft when owner+editing, else published)
  text: (field: string, dflt: string) => string;
  setText: (field: string, value: string) => void;
  photos: Record<string, PhotoVal>;
  setPhoto: (slot: string, val: PhotoVal | null) => void;
  plates: string[] | null;
  setPlates: (p: string[]) => void;
  save: () => Promise<void>;
  publish: () => Promise<void>;
  versions: { id: string; label: string | null; created_at: string }[];
  refreshVersions: () => Promise<void>;
  restore: (versionId: string) => Promise<void>;
  // frame registry (for the "what needs a photo" checklist)
  registerFrame: (slot: string, label: string) => void;
  frames: { slot: string; label: string }[];
  // every image url ever used on this story, for reuse-from-library
  usedImages: string[];
  // mobile bottom edit-sheet: open it for a given field
  openSheet: (field: string, value: string, multiline: boolean, label?: string) => void;
}

const StoryEditCtx = createContext<Ctx | null>(null);

export function useStoryEdit(): Ctx {
  const c = useContext(StoryEditCtx);
  if (!c) throw new Error('useStoryEdit must be used inside <StoryEditProvider>');
  return c;
}

export const StoryEditProvider: React.FC<{ slug: string; children: React.ReactNode }> = ({ slug, children }) => {
  // Use the app's authoritative top-admin selector (reads live store state:
  // platform_owner / platform_admin / active-account owner), plus the localhost
  // dev-admin flag. This is the same gate the rest of the admin surface uses.
  const isOwner = useAppStore(
    (s) => selectIsOwnerTier(s) || s.isDevAdmin,
  );
  const [editing, setEditing] = useState(false);
  const [previewVisitor, setPreviewVisitor] = useState(false);
  const [published, setPublished] = useState<StoryContent>({});
  const [draft, setDraft] = useState<StoryContent>({});
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<{ id: string; label: string | null; created_at: string }[]>([]);
  const [frames, setFrames] = useState<{ slot: string; label: string }[]>([]);
  const [sheet, setSheet] = useState<{ field: string; value: string; multiline: boolean; label?: string } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openSheet = useCallback((field: string, value: string, multiline: boolean, label?: string) => {
    setSheet({ field, value, multiline, label });
  }, []);

  // Guard against losing edits if the phone backgrounds or the tab closes while
  // there are unsaved changes (#19).
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const registerFrame = useCallback((slot: string, label: string) => {
    setFrames((f) => (f.some((x) => x.slot === slot) ? f.map((x) => (x.slot === slot ? { slot, label } : x)) : [...f, { slot, label }]));
  }, []);

  // Load published always; load draft too if owner.
  useEffect(() => {
    let alive = true;
    api.storyContent.get(slug, 'published').then((c) => {
      if (alive) setPublished(c || {});
    }).catch(() => {}).finally(() => { if (alive) setLoaded(true); });
    if (isOwner) {
      api.storyContent.get(slug, 'draft').then((c) => {
        if (alive && c && Object.keys(c).length) setDraft(c);
      }).catch(() => {});
    }
    return () => { alive = false; };
  }, [slug, isOwner]);

  // The content the page should render right now.
  const active: StoryContent = editing && !previewVisitor ? draft : (previewVisitor ? published : published);
  // When the owner starts editing with an empty draft, seed it from published.
  useEffect(() => {
    if (editing && isOwner && Object.keys(draft).length === 0 && Object.keys(published).length > 0) {
      setDraft(JSON.parse(JSON.stringify(published)));
    }
  }, [editing, isOwner]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSave = useCallback((next: StoryContent) => {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try { await api.storyContent.saveDraft(slug, next); setDirty(false); }
      catch { /* keep dirty; retry on next edit */ }
      finally { setSaving(false); }
    }, 900);
  }, [slug]);

  const text = useCallback((field: string, dflt: string): string => {
    const v = active.text?.[field];
    return v !== undefined && v !== '' ? v : dflt;
  }, [active]);

  const setText = useCallback((field: string, value: string) => {
    setDraft((d) => {
      const next = { ...d, text: { ...(d.text || {}), [field]: value } };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const setPhoto = useCallback((slot: string, val: PhotoVal | null) => {
    setDraft((d) => {
      const photos = { ...(d.photos || {}) };
      if (val) photos[slot] = val; else delete photos[slot];
      const next = { ...d, photos };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const setPlates = useCallback((p: string[]) => {
    setDraft((d) => {
      const next = { ...d, plates: p };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const save = useCallback(async () => {
    setSaving(true);
    try { await api.storyContent.saveDraft(slug, draft); setDirty(false); }
    finally { setSaving(false); }
  }, [slug, draft]);

  const publish = useCallback(async () => {
    setSaving(true);
    try {
      await api.storyContent.saveDraft(slug, draft);
      await api.storyContent.publish(slug);
      setPublished(JSON.parse(JSON.stringify(draft)));
      setDirty(false);
    } finally { setSaving(false); }
  }, [slug, draft]);

  const refreshVersions = useCallback(async () => {
    try { setVersions(await api.storyContent.versions(slug)); } catch { /* none */ }
  }, [slug]);

  const restore = useCallback(async (versionId: string) => {
    const { content } = await api.storyContent.restore(slug, versionId);
    setDraft(content || {});
    setDirty(true);
  }, [slug]);

  const value: Ctx = {
    slug, isOwner, editing, setEditing, previewVisitor, setPreviewVisitor,
    loaded, dirty, saving,
    text, setText,
    photos: active.photos || {},
    setPhoto,
    plates: active.plates ?? null,
    setPlates,
    save, publish, versions, refreshVersions, restore,
    registerFrame, frames,
    usedImages: Array.from(new Set([
      ...Object.values(published.photos || {}).map((p) => p.url),
      ...Object.values(draft.photos || {}).map((p) => p.url),
    ])),
    openSheet,
  };

  return (
    <StoryEditCtx.Provider value={value}>
      {children}
      {sheet && (
        <EditSheet
          field={sheet.field}
          initial={sheet.value}
          multiline={sheet.multiline}
          label={sheet.label}
          onSave={(t) => { setText(sheet.field, t); setSheet(null); }}
          onClose={() => setSheet(null)}
        />
      )}
    </StoryEditCtx.Provider>
  );
};

// Touch-first device test (no hover; cramped inline editing). On these the
// bottom EditSheet replaces inline contentEditable.
const IS_TOUCH = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints ?? 0) > 0);

// ── EditSheet ────────────────────────────────────────────────────────────────
// A roomy bottom sheet for editing one field on a phone: a large textarea above
// the keyboard with a Done bar. Avoids the cramped in-page caret and the
// keyboard hiding the text being edited.
const EditSheet: React.FC<{
  field: string;
  initial: string;
  multiline: boolean;
  label?: string;
  onSave: (t: string) => void;
  onClose: () => void;
}> = ({ initial, multiline, label, onSave, onClose }) => {
  const [val, setVal] = useState(initial);
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { taRef.current?.focus(); }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgb(var(--tj-read-bg-rgb) / 0.55)' }} />
      <div style={{ position: 'relative', background: 'var(--tj-read-card-to)', borderTop: '1px solid rgb(var(--tj-read-gold-rgb) / 0.35)', borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 14, paddingBottom: 'max(14px, env(safe-area-inset-bottom))', maxHeight: '72vh', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--tj-gold, var(--tj-read-gold-default))' }}>{label || 'Edit text'}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ minHeight: 44, padding: '0 14px', background: 'transparent', border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.3)', borderRadius: 4, color: 'var(--tj-read-taupe)', fontFamily: 'var(--font-sans)', fontSize: 12, cursor: 'pointer' }}>cancel</button>
            <button type="button" onClick={() => onSave(val.trimEnd())} style={{ minHeight: 44, padding: '0 18px', background: 'var(--tj-gold, var(--tj-read-gold-default))', border: 'none', borderRadius: 4, color: 'var(--tj-read-bg)', fontFamily: 'var(--font-sans)', fontSize: 12, letterSpacing: '0.06em', cursor: 'pointer' }}>done</button>
          </div>
        </div>
        <textarea
          ref={taRef}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          rows={multiline ? 6 : 2}
          style={{ width: '100%', resize: 'none', background: 'var(--tj-read-card-from)', border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.25)', borderRadius: 6, color: 'var(--tj-read-cream)', fontFamily: "'Lora',Georgia,serif", fontSize: 17, lineHeight: 1.5, padding: 12, outline: 'none' }}
        />
      </div>
    </div>
  );
};

// ── EditableText ─────────────────────────────────────────────────────────────
// Renders the field's text. On desktop the owner edits in place (contentEditable);
// on touch, tapping opens the roomy bottom EditSheet instead.
export const EditableText: React.FC<{
  field: string;
  children: string; // the coded default
  as?: keyof React.JSX.IntrinsicElements;
  style?: React.CSSProperties;
  className?: string;
  multiline?: boolean;
}> = ({ field, children, as = 'span', style, className, multiline }) => {
  const { isOwner, editing, previewVisitor, text, setText, openSheet } = useStoryEdit();
  const Tag = as as any;
  const value = text(field, children);
  const liveEdit = isOwner && editing && !previewVisitor;
  const ref = useRef<HTMLElement>(null);

  if (!liveEdit) {
    return <Tag style={style} className={className}>{value}</Tag>;
  }

  // Touch: tap opens the bottom sheet rather than cramped inline editing.
  if (IS_TOUCH) {
    return (
      <Tag
        className={className}
        onClick={() => openSheet(field, value, !!multiline, field)}
        style={{ ...style, outline: '1px dashed rgb(var(--tj-read-gold-rgb) / 0.4)', outlineOffset: 3, borderRadius: 2, cursor: 'pointer', minWidth: 24 }}
      >
        {value}
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref}
      className={className}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e: React.FocusEvent) => {
        const t = (e.currentTarget as HTMLElement).innerText.replace(/ /g, ' ').trimEnd();
        if (t !== value) setText(field, t);
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (!multiline && e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); }
      }}
      onFocus={(e: React.FocusEvent) => { (e.currentTarget as HTMLElement).style.outline = '1px dashed rgb(var(--tj-read-gold-rgb) / 0.7)'; }}
      onMouseOver={(e: React.MouseEvent) => { const el = e.currentTarget as HTMLElement; if (document.activeElement !== el) el.style.outline = '1px dashed rgb(var(--tj-read-gold-rgb) / 0.35)'; }}
      onMouseOut={(e: React.MouseEvent) => { const el = e.currentTarget as HTMLElement; if (document.activeElement !== el) el.style.outline = '1px dashed rgb(var(--tj-read-gold-rgb) / 0)'; }}
      style={{
        ...style,
        outline: '1px dashed rgb(var(--tj-read-gold-rgb) / 0)',
        outlineOffset: 4,
        borderRadius: 2,
        cursor: 'text',
        minWidth: 24,
        transition: 'outline-color 140ms',
      }}
      title="Click to edit"
    >
      {value}
    </Tag>
  );
};
