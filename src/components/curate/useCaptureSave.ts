import { useCallback, useRef, useState } from 'react';
import { ensureCompassEncounterSaved } from '../../lib/teaCompassSync';

export interface CaptureSaveState { busy: boolean; error: string }

/** Close the editor only after its tea and notes have reached the shop. */
export function useCaptureSave(entryId: string, onSaved: () => void, onChange?: (state: CaptureSaveState) => void) {
  const [state, setState] = useState<CaptureSaveState>({ busy: false, error: '' });
  const busy = useRef(false);
  const currentEntry = useRef(entryId);
  currentEntry.current = entryId;
  const save = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const update = (next: CaptureSaveState) => { setState(next); onChange?.(next); };
    update({ busy: true, error: '' });
    try {
      await ensureCompassEncounterSaved(entryId);
      update({ busy: false, error: '' });
      if (currentEntry.current === entryId) onSaved();
    } catch (error) {
      update({ busy: false, error: error instanceof Error ? error.message : 'Your capture is kept here. Retry Save.' });
    } finally {
      busy.current = false;
    }
  }, [entryId, onSaved, onChange]);
  return { state, save };
}
