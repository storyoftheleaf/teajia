import { useMemo, useState } from 'react';
import { TastingSession } from './TastingSession';
import type { CustomerTasting, TastingRecord } from '../../types';
import { journalEntryCurateTeaIdHere, saveCurateTasting } from '../../lib/curateTastingSave';
import { useAppStore } from '../../lib/store';
import { latestTasting } from '../../lib/tastingAccessors';
import { updateImpressionNote } from './YourImpression';
import { tastingNoteText } from './tastingNoteText';

interface JournalTastingEditorProps {
  entry: CustomerTasting;
  record?: TastingRecord;
  onClose: () => void;
}

export function JournalTastingEditor({ entry: startingEntry, record: startingRecord, onClose }: JournalTastingEditorProps) {
  const journal = useAppStore(state => state.tastingJournal);
  const [selected, setSelected] = useState<{ entryId: string; recordId: string } | null>(null);
  const tastings = useMemo(() => journal.filter(entry => !entry.archived).flatMap(entry => (
    entry.tastings.length ? entry.tastings : [latestTasting(entry)]
  ).map(record => ({ entry, record }))).sort((a, b) => b.record.createdAt.localeCompare(a.record.createdAt)), [journal]);
  const entryId = selected?.entryId ?? startingEntry.id;
  const recordId = selected?.recordId ?? startingRecord?.id ?? latestTasting(startingEntry).id;
  const index = tastings.findIndex(tasting => tasting.entry.id === entryId && tasting.record.id === recordId);
  const { entry, record } = tastings[index] ?? { entry: startingEntry, record: startingRecord };
  const compassEntryId = journalEntryCurateTeaIdHere(entry);
  let journalRecord = record;
  // Earlier journal edits could store prose only in the tea's summary.
  const legacyNote = entry.note.personalNote;
  if (record && record.id === latestTasting(entry).id && legacyNote?.trim() && !record.sessionSharedNote?.trim() &&
      !tastingNoteText(record.tasting).trim()) {
    journalRecord = { ...record, tasting: updateImpressionNote(record.tasting, legacyNote) };
  }
  return (
    <TastingSession
      key={`${entry.id}:${record?.id ?? ''}`}
      sequence={index >= 0 ? {
        index,
        count: tastings.length,
        itemLabel: 'Tasting',
        onSelect: nextIndex => {
          const next = tastings[nextIndex];
          setSelected({ entryId: next.entry.id, recordId: next.record.id });
        },
      } : undefined}
      item={{
        id: entry.productId,
        name: entry.productName,
        type: entry.productType,
        image: entry.productImage,
        compassEntryId,
        journalRecord,
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
