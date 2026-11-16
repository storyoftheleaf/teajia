import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useLibraryRecordSelection() {
  const [, setRecordParams] = useSearchParams();
  // Desktop tasting: which entry is shown in the right detail panel
  const [tastingSelectedEntryId, setTastingSelectedEntryId] = useState<string | null>(null);
  const selectLibraryRecord = useCallback((id: string | null) => {
    setTastingSelectedEntryId(id);
    setRecordParams(current => {
      const params = new URLSearchParams(current);
      if (id) {
        params.set('tab', 'library');
        params.set('entry', id);
      } else {
        params.delete('entry');
      }
      return params;
    }, { replace: !id });
  }, [setRecordParams]);
  return { tastingSelectedEntryId, setTastingSelectedEntryId, selectLibraryRecord };
}
