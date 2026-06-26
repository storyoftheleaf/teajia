/**
 * StoryEditorBar — the floating owner toolbar for a hand-built Read story.
 *
 * Shown only to the owner. One switch turns edit mode on (every editable zone
 * lights up). While editing: a live saved/saving indicator, a "view as visitor"
 * toggle, Publish (go live), and an Undo panel listing past published versions
 * to roll back to. Text-only labels, no icons, matches the brand.
 */
import React, { useState } from 'react';
import { useStoryEdit } from './storyEdit';

// When NOT editing: a single discreet pill tucked in the bottom-left, so the
// page reads exactly like a visitor's while you show it to people.
// When editing: the pill expands into the full toolbar (still bottom-anchored,
// clear of the article's top nav).
// Anchored top-right, clear of both the article's own header chrome and the
// site's full-width bottom nav. When not editing it is a single faint pill so
// the page reads like a visitor's; editing expands the toolbar downward.
const barWrap = (editing: boolean): React.CSSProperties => ({
  position: 'fixed',
  right: 'clamp(10px,2.5vw,20px)',
  top: 'clamp(64px,9vh,84px)',
  zIndex: 200,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 8,
  maxWidth: 'min(94vw, 720px)',
  padding: editing ? '10px 12px' : 0,
  background: editing ? 'rgba(20,16,11,0.94)' : 'transparent',
  border: editing ? '1px solid rgba(168,135,77,0.3)' : 'none',
  borderRadius: 6,
  backdropFilter: editing ? 'blur(10px)' : 'none',
  WebkitBackdropFilter: editing ? 'blur(10px)' : 'none',
  fontFamily: "'IBM Plex Mono',monospace",
});

const pill = (active = false): React.CSSProperties => ({
  fontFamily: "'IBM Plex Mono',monospace",
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  padding: '8px 14px',
  borderRadius: 3,
  border: '1px solid rgba(168,135,77,0.4)',
  background: active ? '#a8874d' : 'rgba(20,16,11,0.92)',
  color: active ? '#14100b' : '#cdc0a8',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});

const StoryEditorBar: React.FC = () => {
  const {
    isOwner, editing, setEditing, previewVisitor, setPreviewVisitor,
    dirty, saving, publish, versions, refreshVersions, restore,
    frames, photos,
  } = useStoryEdit();
  const [showHistory, setShowHistory] = useState(false);
  const [showGaps, setShowGaps] = useState(false);
  const [publishing, setPublishing] = useState(false);

  if (!isOwner) return null;

  const status = saving ? 'saving…' : dirty ? 'unsaved draft' : 'draft saved';
  const emptyFrames = frames.filter((f) => !photos[f.slot]);

  const jumpTo = (slot: string) => {
    // the frame's drop-zone has a stable label rendered; scroll the nearest
    // figure containing this slot into view by finding its registered element.
    const el = document.querySelector(`[data-frame-slot="${slot}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setShowGaps(false);
  };

  // Not editing: just a faint, low-key trigger that stays out of the way.
  if (!editing) {
    return (
      <div style={barWrap(false)}>
        <button
          type="button"
          onClick={() => setEditing(true)}
          style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            padding: '7px 12px',
            borderRadius: 3,
            border: '1px solid rgba(168,135,77,0.25)',
            background: 'rgba(20,16,11,0.55)',
            color: 'rgba(205,192,168,0.75)',
            cursor: 'pointer',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
          onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = '#f3ead9'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(168,135,77,0.6)'; }}
          onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(205,192,168,0.75)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(168,135,77,0.25)'; }}
          title="Owner editing"
        >
          edit
        </button>
      </div>
    );
  }

  return (
    <div style={barWrap(true)}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
        <span style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#a8874d', marginRight: 4 }}>
          Owner ·
        </span>
        {editing && (
          <span style={{ fontSize: 10, letterSpacing: '0.06em', color: dirty || saving ? '#bfa06a' : '#80735f', background: 'rgba(20,16,11,0.92)', padding: '6px 10px', borderRadius: 3, border: '1px solid rgba(168,135,77,0.2)' }}>
            {status}
          </span>
        )}

        {editing && emptyFrames.length > 0 && (
          <button type="button" style={pill(showGaps)} onClick={() => setShowGaps(!showGaps)}>
            {emptyFrames.length} photo{emptyFrames.length === 1 ? '' : 's'} needed
          </button>
        )}

        {editing && (
          <button type="button" style={pill(previewVisitor)} onClick={() => setPreviewVisitor(!previewVisitor)}>
            {previewVisitor ? 'editing view' : 'view as visitor'}
          </button>
        )}

        {editing && (
          <button
            type="button"
            style={pill(showHistory)}
            onClick={async () => { if (!showHistory) await refreshVersions(); setShowHistory(!showHistory); }}
          >
            undo
          </button>
        )}

        {editing && (
          <button
            type="button"
            style={{ ...pill(false), borderColor: 'rgba(168,135,77,0.7)', color: '#f3ead9' }}
            disabled={publishing}
            onClick={async () => { setPublishing(true); try { await publish(); } finally { setPublishing(false); } }}
          >
            {publishing ? 'publishing…' : 'publish'}
          </button>
        )}

        <button
          type="button"
          style={pill(editing)}
          onClick={() => { setEditing(!editing); if (editing) setPreviewVisitor(false); }}
        >
          {editing ? 'done editing' : 'edit story'}
        </button>
      </div>

      {showHistory && (
        <div style={{ width: 280, maxHeight: 320, overflowY: 'auto', padding: 12, border: '1px solid rgba(168,135,77,0.4)', borderRadius: 4, background: 'rgba(20,16,11,0.97)' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#a8874d', marginBottom: 10 }}>Undo to a past version</div>
          {versions.length === 0 && (
            <div style={{ fontSize: 11, color: '#80735f', lineHeight: 1.5 }}>No past versions yet. They appear here each time you publish.</div>
          )}
          {versions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={async () => { await restore(v.id); setShowHistory(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 6px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(168,135,77,0.12)', color: '#cdc0a8', cursor: 'pointer', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}
            >
              {new Date(v.created_at + 'Z').toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              <span style={{ color: '#80735f' }}> · restore</span>
            </button>
          ))}
        </div>
      )}

      {showGaps && editing && (
        <div style={{ width: 280, padding: 12, border: '1px solid rgba(168,135,77,0.4)', borderRadius: 4, background: 'rgba(20,16,11,0.97)' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#a8874d', marginBottom: 10 }}>What still needs a photo</div>
          {emptyFrames.length === 0 ? (
            <div style={{ fontSize: 11, color: '#80735f' }}>Every frame has a photo. Nicely done.</div>
          ) : emptyFrames.map((f) => (
            <button key={f.slot} type="button" onClick={() => jumpTo(f.slot)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 6px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(168,135,77,0.12)', color: '#cdc0a8', cursor: 'pointer', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>
              {f.label}<span style={{ color: '#80735f' }}> · jump</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default StoryEditorBar;
