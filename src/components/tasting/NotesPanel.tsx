import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, Star, Trash2, Plus } from 'lucide-react';
import type { NoteEntry } from '../../types';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';

interface NotesPanelProps {
  notes: NoteEntry[];
  onChange: (next: NoteEntry[]) => void;
}

/**
 * Dedicated notes workspace — opens when the NOTE tab is tapped during a
 * tasting session. Replaces the previous inline notes list with a
 * full-bleed editor: scrollable cards with inline edit, star toggle, and
 * delete. Also supports adding new notes here (tap mic to record, or type).
 *
 * Press-and-hold silent capture is handled on the NOTE tab itself (in
 * TastingSession); this panel exists for the deliberate curate gesture.
 */
export const NotesPanel: React.FC<NotesPanelProps> = ({ notes, onChange }) => {
  const [localText, setLocalText] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addNote = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const entry: NoteEntry = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `note-${Date.now()}`,
      text: trimmed,
      capturedAt: new Date().toISOString(),
    };
    onChange([...notes, entry]);
  }, [notes, onChange]);

  const { state: recState, start, stop } = useVoiceCapture({
    onTranscribed: addNote,
    onError: setError,
  });

  const toggleMic = useCallback(() => {
    setError(null);
    if (recState === 'recording') stop();
    else if (recState === 'idle') start();
  }, [recState, start, stop]);

  const getText = (n: NoteEntry) => (localText[n.id] ?? n.text);

  const commitText = (id: string) => {
    const pending = localText[id];
    if (pending === undefined) return;
    onChange(notes.map(n => (n.id === id ? { ...n, text: pending } : n)));
    setLocalText(({ [id]: _drop, ...rest }) => rest);
  };

  const toggleStar = (id: string) => {
    const pending = localText[id];
    onChange(notes.map(n => (
      n.id === id
        ? { ...n, starred: !n.starred, text: pending ?? n.text }
        : n
    )));
    if (pending !== undefined) {
      setLocalText(({ [id]: _drop, ...rest }) => rest);
    }
  };

  const remove = (id: string) => {
    onChange(notes.filter(n => n.id !== id));
    setLocalText(({ [id]: _drop, ...rest }) => rest);
  };

  const submitDraft = useCallback(() => {
    addNote(draft);
    setDraft('');
  }, [addNote, draft]);

  const handleDraftKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitDraft();
    }
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Header — intent */}
      <div className="px-4 pt-4 pb-3">
        <h3
          className="text-ui-11 uppercase tracking-[0.18em] text-tea-gold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Notes
        </h3>
        <p className="text-ui-11 text-tea-text-dim mt-1" style={{ fontFamily: 'var(--font-body)' }}>
          Star what you want readers to see. Edits save as you go; unstar keeps it private.
        </p>
      </div>

      {/* Note list — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 space-y-2 pb-2">
        <AnimatePresence initial={false}>
          {notes.length === 0 ? (
            <p className="text-center text-ui-12 text-tea-text-dim py-8" style={{ fontFamily: 'var(--font-body)' }}>
              No notes yet. Record or type below.
            </p>
          ) : (
            notes.map(note => {
              const starred = !!note.starred;
              return (
                <div
                  key={note.id}
                  className={`rounded-xl pl-3 pr-1 py-1 flex items-start gap-2 transition-colors ${starred ? 'bg-tea-gold/10' : 'bg-tea-surface'}`}
                >
                  <textarea
                    value={getText(note)}
                    onChange={e => setLocalText(s => ({ ...s, [note.id]: e.target.value }))}
                    onBlur={() => commitText(note.id)}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = 'auto';
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    rows={1}
                    className="flex-1 bg-transparent border-none outline-none resize-none text-ui-14 text-tea-text leading-[1.45] placeholder-tea-text-dim focus:ring-0 py-1.5"
                    style={{ fontFamily: 'var(--font-body)', fieldSizing: 'content' as any, minHeight: '24px' }}
                  />
                  <div className="flex items-center shrink-0 py-1">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => { e.stopPropagation(); remove(note.id); }}
                      aria-label="Delete note"
                      className="p-1.5 text-tea-text-dim hover:text-tea-error transition-colors"
                    >
                      <Trash2 size={12} strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => { e.stopPropagation(); toggleStar(note.id); }}
                      aria-pressed={starred}
                      aria-label={starred ? 'Unstar — retract from product' : 'Star — publish to product'}
                      className={`p-1.5 transition-colors ${starred ? 'text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
                    >
                      <Star size={13} fill={starred ? 'currentColor' : 'none'} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Input row — permanently anchored at the bottom of the panel */}
      <div
        className="shrink-0 border-t border-tea-border bg-tea-bg"
        style={{
          boxShadow: '0 -4px 12px rgba(24,19,14,0.2)',
        }}
      >
        <div className="tasting-voice-field">
          {recState === 'recording' ? (
            <div className="flex-1 flex items-center px-3 py-2.5">
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                className="text-ui-13 text-tea-gold/70"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Recording…
              </motion.span>
            </div>
          ) : (
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleDraftKey}
              placeholder={notes.length > 0 ? 'Add another note…' : 'Type a note, or tap the mic to record…'}
              rows={1}
              className="flex-1 px-3 py-2.5 bg-transparent text-ui-13 text-tea-text placeholder:text-tea-text-dim/40 focus:outline-none resize-none"
              style={{ fontFamily: 'var(--font-body)' }}
            />
          )}

          {draft.trim() ? (
            <button
              type="button"
              onClick={submitDraft}
              className="tasting-voice-btn"
              aria-label="Add note"
            >
              <Plus size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleMic}
              disabled={recState === 'transcribing'}
              className={`tasting-voice-btn ${recState === 'recording' ? 'tasting-voice-btn-recording' : ''}`}
              aria-label={recState === 'recording' ? 'Stop recording' : 'Tap to record a note'}
            >
              {recState === 'transcribing' ? (
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Loader2 size={14} className="text-tea-gold" />
                </motion.span>
              ) : recState === 'recording' ? (
                <Square size={13} className="text-tea-gold" fill="currentColor" />
              ) : (
                <Mic size={14} className="text-tea-text-sec" />
              )}
            </button>
          )}
        </div>

        {error && (
          <p className="px-3 pb-2 text-ui-11 text-tea-error" style={{ fontFamily: 'var(--font-body)' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
};
