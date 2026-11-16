import { TastingSession } from './TastingSession';
import type { CustomerTasting, TastingRecord } from '../../types';
import { journalEntryCurateTeaIdHere, saveCurateTasting } from '../../lib/curateTastingSave';

interface JournalTastingEditorProps {
  entry: CustomerTasting;
  record?: TastingRecord;
  onClose: () => void;
}

export function JournalTastingEditor({ entry, record, onClose }: JournalTastingEditorProps) {
  const compassEntryId = journalEntryCurateTeaIdHere(entry);
  return (
    <TastingSession
      item={{
        id: entry.productId,
        name: entry.productName,
        type: entry.productType,
        image: entry.productImage,
        compassEntryId,
        journalRecord: record,
      }}
      onClose={onClose}
      onAfterSave={(data, verdict, _wouldBuy, identity) => {
        if (!compassEntryId) return;
        const editing = record && (record.id === entry.tastings.at(-1)?.id ? 'latest' : 'past');
        saveCurateTasting(compassEntryId, data, verdict, { record: identity, editing });
      }}
    />
  );
}
