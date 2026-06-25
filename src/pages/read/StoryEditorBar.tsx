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

const barWrap: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 200,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: '10px clamp(12px,3vw,28px)',
  background: 'rgba(20,16,11,0.96)',
  borderBottom: '1px solid rgba(168,135,77,0.3)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  fontFamily: "'IBM Plex Mono',monospace",
};

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

  return (
    <div style={barWrap}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
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
