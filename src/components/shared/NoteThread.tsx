/**
 * NoteThread — unified note thread component.
 *
 * Renders anywhere a tea appears: compass capture, compass ledger,
 * product page, tasting journal. Always shows the same thread.
 *
 * Layout:
 *   Input row (always at top)
 *   ↓
 *   Thread (chronological, oldest at top)
 *     • Manual / voice notes — editable if you authored them
 *     • Tasting artifacts — read-only summary cards
 *     • Attribution shown only when >1 unique author
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, X, Plus, Leaf, Sparkles, BookOpen } from 'lucide-react';
import { useNotesStore } from '../../lib/notesStore';
import { syncNotes } from '../../lib/notesSync';
import { useAppStore } from '../../lib/store';
import type { Note, NoteVisibility } from '../../lib/notesStore';
import type { TastingData, CustomerTasting } from '../../types';

// ── Audio recording helpers ──────────────────────────────────────────────────

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  return 'audio/mp4';
}

// ── Tasting artifact renderer ────────────────────────────────────────────────

const ARTIFACT_DOT: Record<string, string> = {
  body: '#a08060',
  flavor: '#9a7a6a',
  finish: '#8a8a72',
  feeling: '#7a9a80',
};

const TastingArtifact: React.FC<{ snapshot: TastingData }> = ({ snapshot }) => {
  const groups = [
    { cat: 'body',    color: ARTIFACT_DOT.body,    terms: snapshot.body ?? [] },
    { cat: 'flavor',  color: ARTIFACT_DOT.flavor,  terms: snapshot.flavor ?? [] },
    { cat: 'finish',  color: ARTIFACT_DOT.finish,  terms: snapshot.finish ?? [] },
    { cat: 'feeling', color: ARTIFACT_DOT.feeling, terms: snapshot.feeling ?? [] },
  ];
  const allTerms = groups.flatMap(g => g.terms.map(t => ({ t, color: g.color })));
  const visible = allTerms.slice(0, 7);
  const overflow = allTerms.length - visible.length;

  return (
    <div className="flex flex-col gap-2">
      {snapshot.quality != null && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-[2px] rounded-full overflow-hidden bg-tea-elevated">
            <div
              className="h-full rounded-full"
              style={{ width: `${snapshot.quality * 10}%`, background: 'linear-gradient(90deg, #d4ac6666, #b8924e)' }}
            />
          </div>
          <span className="text-ui-12 font-semibold tabular-nums text-tea-gold shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
            {snapshot.quality}<span className="text-tea-text-dim font-normal text-ui-10">/10</span>
          </span>
        </div>
      )}
      {visible.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visible.map(({ t, color }) => (
            <span key={t} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-ui-11 text-tea-text-sec bg-tea-bg border border-tea-border">
              <span className="shrink-0 rounded-full" style={{ width: 5, height: 5, background: color, display: 'inline-block', opacity: 0.85 }} />
              {t}
            </span>
          ))}
          {overflow > 0 && (
            <span className="self-center text-ui-10 text-tea-text-dim">+{overflow}</span>
          )}
        </div>
      )}
      {snapshot.huiGan && (
        <span className="inline-flex items-center gap-1 text-ui-11 font-medium text-tea-gold/80">
          <Sparkles size={9} />
          回甘
        </span>
      )}
      {snapshot.cleanliness && (
        <span className="text-ui-10 text-tea-text-dim capitalize">{snapshot.cleanliness}</span>
      )}
    </div>
  );
};

// ── Individual note card ─────────────────────────────────────────────────────

const NoteCard: React.FC<{
  note: Note;
  showAuthor: boolean;
  currentAuthorId: string;
}> = ({ note, showAuthor, currentAuthorId }) => {
  const { updateNote, removeNote } = useNotesStore();
  const { addTasting } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [converted, setConverted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isOwn = note.authorId === currentAuthorId;
  const isTasting = note.sourceType === 'tasting';
  // Feature 6: show convert button when note is anchored to a tea or compass entry
  const canConvertToJournal = !isTasting && (!!note.teaKey || !!note.compassEntryId) && !converted;

  const handleConvertToJournal = () => {
    const productId = note.teaKey || note.compassEntryId;
    if (!productId) return;
    const id = crypto.randomUUID();
    const entry: CustomerTasting = {
      id,
      productId,
      productName: note.teaKey || 'Tea note',
      productType: '',
      note: {
        tasting: { notes: [note.text] },
        personalNote: note.text,
        updatedAt: note.createdAt,
      },
      tastings: [{
        id,
        createdAt: note.createdAt,
        tasting: { notes: [note.text] },
        sourceType: note.compassEntryId ? 'compass' : 'product',
      }],
      compassEntryId: note.compassEntryId,
      synced: false,
      createdAt: note.createdAt,
    };
    addTasting(entry);
    setConverted(true);
  };

  const commitEdit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== note.text) {
      updateNote(note.id, trimmed);
      syncNotes().catch(() => {});
    } else {
      setDraft(note.text); // revert
    }
    setEditing(false);
  }, [draft, note.id, note.text, updateNote]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { setDraft(note.text); setEditing(false); }
  };

  const handleRemove = () => {
    removeNote(note.id);
    syncNotes().catch(() => {});
  };

  const startEdit = () => {
    if (isTasting || !isOwn) return;
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 10, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className={`group flex gap-2 ${isTasting ? '' : 'items-start'}`}
    >
      {/* Left accent */}
      <div className={`shrink-0 w-0.5 self-stretch rounded-full mt-1 ${
        isTasting ? 'bg-tea-gold/30' : 'bg-tea-border'
      }`} />

      <div className="flex-1 min-w-0">
        {/* Author + timestamp — only when multiple authors */}
        {showAuthor && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-ui-10 font-medium text-tea-text-dim uppercase tracking-[0.08em]">
              {note.authorName}
            </span>
            {isTasting && (
              <>
                <span className="text-tea-border">·</span>
                <Leaf size={9} className="text-tea-gold/60" />
                <span className="text-ui-10 text-tea-gold/60">Tasting</span>
              </>
            )}
          </div>
        )}

        {/* Content */}
        {isTasting && note.tastingSnapshot ? (
          <TastingArtifact snapshot={note.tastingSnapshot as TastingData} />
        ) : editing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            rows={2}
            className="w-full bg-transparent text-ui-13 text-tea-text resize-none outline-none focus-visible:ring-1 focus-visible:ring-tea-gold/40 rounded px-1 -mx-1"
            style={{ fontFamily: 'var(--font-body)' }}
          />
        ) : (
          <p
            onClick={startEdit}
            className={`text-ui-13 text-tea-text leading-relaxed whitespace-pre-wrap ${
              isOwn && !isTasting ? 'cursor-text hover:text-tea-text' : ''
            }`}
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {note.text}
          </p>
        )}

        {/* Timestamp — only visible while editing */}
        {editing && (
          <div className="text-ui-10 text-tea-text-dim mt-1">
            {new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            {note.sourceType === 'voice' && ' · voice'}
          </div>
        )}
      </div>

      {/* Actions column */}
      <div className="shrink-0 flex flex-col gap-1 mt-0.5">
        {/* Feature 6: Convert to journal entry */}
        {canConvertToJournal && (
          <button
            type="button"
            onClick={handleConvertToJournal}
            title="Save to tasting journal"
            className="p-1 text-tea-text-dim opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-tea-gold transition-all rounded"
            aria-label="Convert to journal entry"
          >
            <BookOpen size={11} />
          </button>
        )}
        {converted && (
          <span className="text-ui-9 text-tea-gold/60 px-1">saved</span>
        )}
        {/* Remove — own non-tasting notes only */}
        {isOwn && !isTasting && (
          <button
            type="button"
            onClick={handleRemove}
            className="p-1 text-tea-text-dim opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-tea-text transition-all rounded"
            aria-label="Remove note"
          >
            <X size={11} />
          </button>
        )}
      </div>
    </motion.div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

interface NoteThreadProps {
  /** Anchor — pass one */
  teaKey?: string;
  compassEntryId?: string;
  /** Default visibility for new notes */
  defaultVisibility?: NoteVisibility;
  /** Compact mode — used inside capture cards */
  compact?: boolean;
  /** Hide the mic button — when recording is handled externally (e.g. bottom bar) */
  hideMic?: boolean;
  /** Suppress tasting artifact cards — use when TastingProfileStrip already shows the same data */
  hideTastingArtifacts?: boolean;
  /** Bigger textarea + mic — used in teaware capture where the notes field
   *  was reported as too cramped to engage with on mobile. */
  larger?: boolean;
}

type RecState = 'idle' | 'recording' | 'transcribing';

export const NoteThread: React.FC<NoteThreadProps> = ({
  teaKey,
  compassEntryId,
  defaultVisibility = 'private',
  compact = false,
  hideMic = false,
  hideTastingArtifacts = false,
  larger = false,
}) => {
  const textareaRows = larger ? 3 : compact ? 1 : 2;
  const inputPad = larger ? 'px-4 py-3.5' : 'px-3 py-2.5';
  const inputText = larger ? 'text-ui-14' : 'text-ui-13';
  const micIconSize = larger ? 20 : 14;
  const micBtnExtra = larger ? 'tasting-voice-btn-large' : '';
  const { addNote, notes: allNotes } = useNotesStore();
  const { activeAccountId, activeAccount } = useAppStore();

  const [draft, setDraft] = useState('');
  const [recState, setRecState] = useState<RecState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showTyping, setShowTyping] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Current author info from store
  const authorId = activeAccountId ?? 'guest';
  const authorName = activeAccount?.name ?? 'You';

  // Notes for this anchor — OR logic so compassEntryId notes + teaKey notes merge into one thread
  const notes = useMemo(() => {
    const seen = new Set<string>();
    return allNotes.filter(n => {
      if (n.deleted) return false;
      if (hideTastingArtifacts && n.sourceType === 'tasting') return false;
      const match = (teaKey && n.teaKey === teaKey) || (compassEntryId && n.compassEntryId === compassEntryId);
      if (!match || seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
  }, [allNotes, teaKey, compassEntryId, hideTastingArtifacts]);

  // Show attribution only when multiple unique authors exist
  const multipleAuthors = useMemo(() => {
    const ids = new Set(notes.map(n => n.authorId));
    return ids.size > 1;
  }, [notes]);

  const writeNote = useCallback((text: string, sourceType: Note['sourceType'] = 'manual') => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addNote({
      accountId: authorId,
      teaKey,
      compassEntryId,
      text: trimmed,
      sourceType,
      authorId,
      authorName,
      visibility: defaultVisibility,
    });
    syncNotes().catch(() => {});
  }, [addNote, authorId, authorName, teaKey, compassEntryId, defaultVisibility]);

  const submitDraft = useCallback(() => {
    writeNote(draft, 'manual');
    setDraft('');
  }, [draft, writeNote]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitDraft(); }
  };

  // Recording
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isMountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onerror = () => {
        if (!isMountedRef.current) return;
        setError('Recording failed. Try typing instead.');
        setRecState('idle');
        stopStream();
      };
      recorder.onstop = async () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size < 100) { if (isMountedRef.current) setRecState('idle'); return; }
        if (isMountedRef.current) setRecState('transcribing');
        try {
          const { api } = await import('../../lib/api');
          const result = await api.transcribeAudio(blob);
          if (!isMountedRef.current) return;
          if (result.text?.trim()) writeNote(result.text.trim(), 'voice');
        } catch (err: unknown) {
          if (!isMountedRef.current) return;
          const msg = err instanceof Error ? err.message : '';
          setError(msg.toLowerCase().includes('timeout')
            ? 'Took too long. Try again.'
            : 'Transcription failed. Try typing.');
        }
        if (isMountedRef.current) setRecState('idle');
      };

      recorder.start(250);
      setRecState('recording');
    } catch {
      if (!isMountedRef.current) return;
      setRecState('idle');
      setError('Microphone access denied.');
    }
  }, [stopStream, writeNote]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
  }, []);

  const handleMicPress = useCallback(() => {
    if (recState === 'recording') stopRecording();
    else if (recState === 'idle') startRecording();
  }, [recState, startRecording, stopRecording]);

  if (!teaKey && !compassEntryId) return null;

  return (
    <div className={`flex flex-col gap-3 ${compact ? '' : 'py-1'}`}>

      {/* ── Thread ── */}
      {notes.length > 0 && (
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {notes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                showAuthor={multipleAuthors}
                currentAuthorId={authorId}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Input row — textarea always visible, mic on the right ── */}
      <div className="tasting-voice-field">
        {recState === 'idle' || recState === 'transcribing' ? (
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={notes.length > 0 ? 'Add another note…' : 'Impressions, vendor story, anything worth keeping…'}
            rows={textareaRows}
            className={`flex-1 ${inputPad} bg-transparent ${inputText} text-tea-text placeholder:text-tea-text-dim/40 focus:outline-none resize-none`}
            style={{ fontFamily: 'var(--font-body)' }}
          />
        ) : (
          <div className={`flex-1 flex items-center ${inputPad}`}>
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              className={`${inputText} text-tea-gold/70`}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Recording…
            </motion.span>
          </div>
        )}

        {/* Right button: Send when there's text, Mic when idle (unless hideMic) */}
        {draft.trim() ? (
          <button
            type="button"
            onClick={submitDraft}
            className={`tasting-voice-btn ${micBtnExtra}`}
            aria-label="Add note"
          >
            <Plus size={micIconSize} />
          </button>
        ) : !hideMic ? (
          <button
            type="button"
            onClick={handleMicPress}
            disabled={recState === 'transcribing'}
            className={`tasting-voice-btn ${micBtnExtra} ${recState === 'recording' ? 'tasting-voice-btn-recording' : ''}`}
            aria-label={recState === 'recording' ? 'Stop recording' : 'Tap to record a note'}
          >
            {recState === 'transcribing' ? (
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <Loader2 size={micIconSize} />
              </motion.span>
            ) : recState === 'recording' ? (
              <Square size={micIconSize - 2} fill="currentColor" />
            ) : (
              <Mic size={micIconSize} />
            )}
          </button>
        ) : null}
      </div>

      {error && (
        <p className="text-ui-11 text-red-400" style={{ fontFamily: 'var(--font-body)' }}>{error}</p>
      )}
    </div>
  );
};

/**
 * Inject a tasting session summary into the note thread when a session is saved.
 * Call this from TastingSession.handleSave when compassEntryId or teaKey is known.
 */
export function injectTastingNote({
  teaKey,
  compassEntryId,
  tastingId,
  tastingData,
  authorId,
  authorName,
  accountId,
  visibility = 'private',
}: {
  teaKey?: string;
  compassEntryId?: string;
  tastingId: string;
  tastingData: TastingData;
  authorId: string;
  authorName: string;
  accountId: string;
  visibility?: NoteVisibility;
}) {
  // Build a concise text summary for fallback rendering / search
  const parts: string[] = [];
  if (tastingData.quality != null) parts.push(`${tastingData.quality}/10`);
  if (tastingData.body?.length) parts.push(tastingData.body.join(', '));
  if (tastingData.flavor?.length) parts.push(tastingData.flavor.slice(0, 3).join(', '));
  if (tastingData.huiGan) parts.push('hui gan');
  const text = parts.join(' · ') || 'Tasting session';

  useNotesStore.getState().addNote({
    accountId,
    teaKey,
    compassEntryId,
    text,
    sourceType: 'tasting',
    tastingId,
    tastingSnapshot: tastingData as unknown as Record<string, unknown>,
    authorId,
    authorName,
    visibility,
  });
  syncNotes().catch(() => {});
}
