// The host's private guest book (Launch 2, H9), in the `after` part of
// /account/host/:id: the teas poured, listed once, then one private line per
// guest who came, saved when the host leaves the field. Only the host ever
// reads these; no contact details are shown or kept here.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { api } from '../../lib/api';
import { PART_QUERY, partView } from '../../lib/closedPart';
import { LoadFailed } from '../shared/LoadFailed';
import type { HostedTableGuest } from '../../lib/hostingApi';
import { hostSmallText, hostText, type HostTablePartProps } from './hostTableParts';

const NOTE_MAX = 500;

export function GuestBookPrivate({ tableId, detail }: HostTablePartProps) {
  const came = detail.guests.filter(guest => guest.status === 'confirmed' && guest.attended === 1);
  const notes = useQuery({
    queryKey: ['host-table-notes', tableId],
    queryFn: () => api.tables.notes(tableId),
    ...PART_QUERY,
  });
  const notesView = partView(notes);
  const teas = detail.teas.map(tea => tea.name).filter((name): name is string => Boolean(name));

  return (
    <section aria-labelledby="host-guest-book" data-host-guest-book className="space-y-3">
      <h3 id="host-guest-book" className={TYPOGRAPHY_CLASSES.h3}>Your guest book</h3>
      <p className={hostText}>Only you can see these.</p>
      {teas.length > 0 && (
        <p className={hostSmallText} data-host-poured>Poured: {teas.join(', ')}</p>
      )}
      {came.length === 0 && <p className={hostSmallText}>Once you mark who came, each guest has a line here.</p>}
      {notesView.state === 'failed' && <LoadFailed sentence="Could not open your notes just now." onRetry={notesView.retry} />}
      {notes.isSuccess && came.length > 0 && (
        <ul className="space-y-3">
          {came.map(guest => (
            <NoteField key={guest.id} tableId={tableId} guest={guest}
              saved={notes.data.notes.find(note => note.attendee_id === guest.id)?.note ?? ''} />
          ))}
        </ul>
      )}
    </section>
  );
}

function NoteField({ tableId, guest, saved }: { tableId: string; guest: HostedTableGuest; saved: string }) {
  const [value, setValue] = useState(saved);
  const [kept, setKept] = useState(saved);
  const [status, setStatus] = useState('');
  async function save() {
    const next = value.trim();
    if (next === kept) return;
    setStatus('Saving…');
    try {
      await api.tables.saveNote(tableId, guest.id, next);
      setKept(next);
      setStatus('Saved.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save. Try again.');
    }
  }
  const id = `host-note-${guest.id}`;
  return (
    <li className="space-y-1">
      <label htmlFor={id} className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>{guest.full_name}</label>
      <textarea id={id} className="btn-field block min-h-tap w-full min-w-0" rows={2} maxLength={NOTE_MAX}
        value={value} onChange={event => setValue(event.target.value)} onBlur={() => void save()} />
      {status && <p className={hostSmallText} role="status">{status}</p>}
    </li>
  );
}
