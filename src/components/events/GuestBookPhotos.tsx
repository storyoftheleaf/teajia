import { useState } from 'react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { GuestBookData, GuestBookStatus } from '../../lib/guestBookApi';
import { guestBookPhotoApi, type GuestBookPhoto, type OwnPhoto } from '../../lib/guestBookPhotoApi';
import { groupGuestBookEntries } from '../../lib/groupGuestBookEntries';
import { Button } from '../shared/Button';
import { GuestBookPhotoTile } from './GuestBookPhotoTile';

export const GUEST_BOOK_PHOTOS_QUERY = 'after-sit-guest-book-photos';
export const GUEST_BOOK_PHOTO_STATE: Record<GuestBookStatus, string> = {
  pending: 'Pending host review',
  included: 'Included in the Guest Book',
  passed: 'Passed by the host',
};

type Identity = { accountId: string | null; userId: string };
type PhotoScope = { credential: string; identity: Identity; cacheKey: readonly unknown[] };
const PAGE_SIZE = 12;

export function GuestBookEntries({ notes, photos, credential, identity, cacheKey }: PhotoScope & {
  notes: GuestBookData['entries']; photos: GuestBookPhoto[];
}) {
  const [page, setPage] = useState(0);
  const entries = groupGuestBookEntries(notes, photos);
  if (!entries.length) return <p className="mt-2 text-ui-13 text-tea-text-sec">No entries have been included yet.</p>;
  const currentPage = Math.min(page, Math.ceil(entries.length / PAGE_SIZE) - 1);

  return (
    <>
      <ul aria-label="Entries from session guests" className="my-3 divide-y divide-tea-border">
        {entries.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map(entry => (
          <li key={entry.key} className="py-3">
            {entry.displayName && <p className="text-ui-13 text-tea-text-sec break-words">{entry.displayName}</p>}
            {entry.note && <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-1 whitespace-pre-wrap break-words`}>{entry.note.note}</p>}
            {entry.photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {entry.photos.map(photo => (
                  <GuestBookPhotoTile key={photo.id} queryKey={[...cacheKey, 'included', photo.id]} previewId={photo.id} alt={photo.alt_text}
                    title={photo.display_name ? `Photo by ${photo.display_name}` : 'Photo from the table'}
                    load={signal => guestBookPhotoApi.read(credential, { action: 'photo-bytes', grantId: photo.id }, identity, signal)} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {entries.length > PAGE_SIZE && (
        <nav aria-label="Guest Book pages" className="flex flex-wrap items-center gap-2">
          <Button variant="quiet" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous entries</Button>
          <Button variant="quiet" size="sm" disabled={(currentPage + 1) * PAGE_SIZE >= entries.length}
            onClick={() => setPage(currentPage + 1)}>Next entries</Button>
        </nav>
      )}
    </>
  );
}

export function GuestBookPhotoPicker({ choices, chosen, onChoose, disabled, credential, identity, cacheKey }: PhotoScope & {
  choices: OwnPhoto[]; chosen?: OwnPhoto; onChoose: (id: string) => void; disabled: boolean;
}) {
  return (
    <div className="grid gap-2">
      <label className="flex flex-wrap items-center gap-2 text-ui-13 text-tea-text-sec">
        Saved photo (optional)
        <select className="btn-field max-w-full" value={chosen?.id ?? ''}
          onChange={event => onChoose(event.target.value)} disabled={disabled}>
          <option value="">No photo</option>
          {choices.map((photo, index) => <option key={photo.id} value={photo.id}>
            {photo.tea_name || 'Whole setup'} · {index + 1}
          </option>)}
        </select>
      </label>
      {chosen && (
        <GuestBookPhotoTile key={chosen.id} queryKey={[...cacheKey, 'own', chosen.id]} previewId={`own-${chosen.id}`}
          alt="Your selected private photo" title="Your selected private photo"
          load={signal => guestBookPhotoApi.read(credential, { action: 'private-photo-preview', photoId: chosen.id }, identity, signal)} />
      )}
    </div>
  );
}
