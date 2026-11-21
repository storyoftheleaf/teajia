import React, { useCallback, useRef, useState } from 'react';
import { Cloud, Loader2 } from 'lucide-react';
import { entryHasDeliberateInput, useTeaCompassStore } from '../../lib/teaCompassStore';
import { useNotesStore } from '../../lib/notesStore';
import { ensureCompassEncounterSaved } from '../../lib/teaCompassSync';

/** Capture status and explicit retries belong to this tea. Background failures
 * for other records must never label a saved recording or empty capture as lost. */
export const SyncIndicator: React.FC<{ entryId?: string }> = ({ entryId }) => {
  const activeEntryId = useTeaCompassStore(s => s.activeEntryId);
  const id = entryId ?? activeEntryId;
  const entry = useTeaCompassStore(s => s.entries.find(e => e.id === id) ?? s.pendingEntries.find(e => e.id === id));
  const accountId = useTeaCompassStore(s => s.accountScopeId);
  const userId = useTeaCompassStore(s => s.userScopeId);
  const pendingNotes = useNotesStore(s => s.notes.some(note => !note.synced && note.compassEntryId === id && note.accountId === accountId && note.authorId === userId));
  const [attempt, setAttempt] = useState({ id, busy: false, error: '', saved: false });
  const busy = useRef(false);
  const isPending = Boolean(entry && ((!entry.synced && entryHasDeliberateInput(entry)) || pendingNotes));
  const current = attempt.id === id ? attempt : undefined;

  const handleSave = useCallback(async () => {
    if (!id || busy.current) return;
    busy.current = true;
    setAttempt({ id, busy: true, error: '', saved: false });
    try {
      await ensureCompassEncounterSaved(id);
      setAttempt({ id, busy: false, error: '', saved: true });
    } catch (error) {
      setAttempt({ id, busy: false, error: error instanceof Error ? error.message : 'Your changes are kept here. Retry saving this tea.', saved: false });
    } finally {
      busy.current = false;
    }
  }, [id]);

  if (current?.busy) return <span className="inline-flex items-center gap-1.5 text-ui-11 text-tea-text-sec" role="status"><Loader2 size={12} className="animate-spin" />Saving…</span>;
  if (!isPending) return current?.saved
    ? <span className="inline-flex items-center gap-1.5 text-ui-11 text-tea-text-sec" role="status"><Cloud size={12} />Saved</span>
    : null;

  return <span className="inline-flex flex-wrap items-center gap-1.5">
    <button type="button" onClick={() => void handleSave()} className="btn-quiet btn-sm tap-target"
      aria-label={current?.error ? 'Retry saving this tea' : 'Save changes to this tea'}>
      {current?.error ? 'Retry' : 'Save'}
    </button>
    {current?.error && <span role="alert" className="text-ui-11 text-tea-text-sec">{current.error}</span>}
  </span>;
};
