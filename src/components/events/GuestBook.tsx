import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { ApiError } from '../../lib/api';
import { afterSitGuestBook, GUEST_BOOK_NOTE_LIMIT, type GuestBookEntryDraft, type GuestBookStatus } from '../../lib/guestBookApi';
import { guestBookPhotoApi, type OwnPhoto } from '../../lib/guestBookPhotoApi';
import { useAppStore } from '../../lib/store';
import { Button } from '../shared/Button';
import { GuestBookEntries, GuestBookPhotoPicker, GUEST_BOOK_PHOTOS_QUERY, GUEST_BOOK_PHOTO_STATE } from './GuestBookPhotos';

type Identity = { accountId: string | null; userId: string };
type Draft = { note: string; photo?: NonNullable<GuestBookEntryDraft['photo']>; confirmed: boolean };
type Write =
  | { action: 'save'; draft: GuestBookEntryDraft }
  | { action: 'withdraw' }
  | { action: 'withdraw-note' }
  | { action: 'withdraw-photo'; grantId: string };

const EMPTY_DRAFT: Draft = { note: '', confirmed: false };

export function GuestBook({ token, afterSitKey }: { token: string; afterSitKey: string }) {
  const userId = useAppStore(state => state.activeUserId);
  const accountId = useAppStore(state => state.activeAccountId);
  if (!userId) return null;
  return <GuestBookPanel key={JSON.stringify([userId, accountId, afterSitKey])} token={token}
    afterSitKey={afterSitKey} identity={{ accountId, userId }} />;
}

function contributionStatus(note: GuestBookStatus | undefined, photos: OwnPhoto[]) {
  const status = photos[0]?.status;
  if (photos.length === 1 && note && status && note !== status) {
    return `Note: ${GUEST_BOOK_PHOTO_STATE[note]} · Photo: ${GUEST_BOOK_PHOTO_STATE[status]}`;
  }
  const states = [note, ...photos.map(photo => photo.status)];
  if (states.includes('pending')) return GUEST_BOOK_PHOTO_STATE.pending;
  if (states.includes('included')) return GUEST_BOOK_PHOTO_STATE.included;
  return GUEST_BOOK_PHOTO_STATE.passed;
}

function GuestBookPanel({ token, afterSitKey, identity }: { token: string; afterSitKey: string; identity: Identity }) {
  const headingId = useId();
  const countId = useId();
  const client = useQueryClient();
  const noteKey = ['guest-book-attendee', identity.userId, identity.accountId, afterSitKey];
  const photoKey = [GUEST_BOOK_PHOTOS_QUERY, identity.accountId, identity.userId, afterSitKey];
  const notes = useQuery({
    queryKey: noteKey,
    queryFn: ({ signal }) => afterSitGuestBook.read(token, identity, signal),
    staleTime: 0, gcTime: 0, retry: false,
  });
  const photos = useQuery({
    queryKey: photoKey,
    queryFn: ({ signal }) => guestBookPhotoApi.list(token, identity, signal),
    staleTime: 0, gcTime: 0, retry: false,
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: noteKey, exact: true }),
    client.invalidateQueries({ queryKey: photoKey, exact: true }),
    client.invalidateQueries({ queryKey: ['guest-book-photo-owner', identity.accountId, identity.userId] }),
  ]);
  const write = useMutation({
    gcTime: 0,
    networkMode: 'always',
    mutationFn: (input: Write) => {
      switch (input.action) {
        case 'save': return afterSitGuestBook.saveEntry(token, input.draft, identity);
        case 'withdraw': return afterSitGuestBook.withdrawEntry(token, identity);
        case 'withdraw-note': return afterSitGuestBook.withdrawNote(token, identity);
        case 'withdraw-photo': return guestBookPhotoApi.withdraw(token, input.grantId, identity);
      }
    },
    onSuccess: async (_, input) => {
      if (input.action === 'withdraw') {
        client.removeQueries({ queryKey: [...photoKey, 'included'] });
        setDraft(null);
      }
      if (input.action === 'withdraw-photo') {
        client.removeQueries({ queryKey: [...photoKey, 'included', input.grantId] });
      }
      await refresh();
      if (input.action === 'save' || input.action === 'withdraw-note') setDraft(null);
    },
    onError: error => {
      if (error instanceof ApiError && error.status === 409) return refresh();
    },
  });

  const unavailable = [notes.error, photos.error].some(error => error instanceof ApiError && [401, 403, 404].includes(error.status));
  if (unavailable) return null;
  const own = notes.data?.own;
  const contributed = (photos.data?.own ?? []).filter(photo => photo.grant_id);
  const choices = (photos.data?.own ?? []).filter(photo => !photo.grant_id);
  const hasEntry = Boolean(own || contributed.length);
  const active = draft ?? EMPTY_DRAFT;
  const chosen = contributed.length
    ? contributed.find(photo => photo.grant_id === active.photo?.grantId)
    : choices.find(photo => photo.id === active.photo?.photoId);
  const note = active.note.trim();
  const noteChanged = Boolean(note && note !== own?.note);
  const noteCleared = Boolean(own?.note && !note);
  const photoUnavailable = Boolean(active.photo && !chosen);
  const canSend = active.confirmed && !photoUnavailable && !noteCleared && (noteChanged || Boolean(chosen));
  const showEditor = !hasEntry || draft !== null;

  const attachedPhotos = contributed.length > 0 && (
    <ul aria-label="Your attached photos" className="my-2 divide-y divide-tea-border">
      {contributed.map(photo => (
        <li key={photo.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
          <p className="min-w-0 break-words text-ui-13 text-tea-text-sec">{photo.alt_text ?? 'Saved photo'}</p>
          {(draft || contributed.length > 1) && (
            <Button type="button" variant="quiet" size="sm" disabled={write.isPending} onClick={() => {
              if (photo.grant_id) write.mutate({ action: 'withdraw-photo', grantId: photo.grant_id });
            }}>Withdraw photo</Button>
          )}
        </li>
      ))}
    </ul>
  );

  function update(patch: Partial<Draft>) {
    setDraft({ ...active, ...patch });
    if (write.isError) write.reset();
  }

  return (
    <section aria-labelledby={headingId} className="mt-6 border-t border-tea-border pt-4">
      <h2 id={headingId} className={TYPOGRAPHY_CLASSES.h2}>Guest Book</h2>
      {notes.isError || photos.isError ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className={TYPOGRAPHY_CLASSES.bodyLight}>Could not load the Guest Book.</p>
          <Button variant="quiet" size="sm" onClick={() => void refresh()}>Try again</Button>
        </div>
      ) : !notes.data || !photos.data ? (
        <p role="status" className={TYPOGRAPHY_CLASSES.bodyLight}>Loading the Guest Book…</p>
      ) : (
        <>
          <GuestBookEntries notes={notes.data.entries} photos={photos.data.gallery}
            credential={token} identity={identity} cacheKey={photoKey} />
          <section aria-label="Your Guest Book entry" className="mt-4 border-t border-tea-border pt-3">
            <h3 className={TYPOGRAPHY_CLASSES.h3}>Your entry</h3>
            {hasEntry && (
              <p role="status" className="mt-1 text-ui-13 text-tea-text-sec">{contributionStatus(own?.status, contributed)}</p>
            )}
            {showEditor ? (
              <form className="mt-2 grid gap-2" onSubmit={event => {
                event.preventDefault();
                if (!canSend || write.isPending) return;
                write.mutate({
                  action: 'save',
                  draft: { ...(noteChanged ? { note } : {}), ...(chosen ? { photo: active.photo } : {}) },
                });
              }}>
                <label className="block text-ui-13 text-tea-text-sec">
                  Note
                  {!own && ' (optional)'}
                  <textarea className="input-field mt-1 p-3 text-ui-16" rows={3} value={active.note}
                    maxLength={GUEST_BOOK_NOTE_LIMIT} aria-describedby={countId} disabled={write.isPending}
                    onChange={event => update({ note: event.target.value, confirmed: false })} />
                </label>
                <p id={countId} className="text-right text-ui-12 text-tea-text-sec">{active.note.length}/{GUEST_BOOK_NOTE_LIMIT}</p>
                {own && contributed.length > 0 && (
                  <div>
                    <Button type="button" variant="quiet" size="sm" disabled={write.isPending}
                      onClick={() => write.mutate({ action: 'withdraw-note' })}>Withdraw note</Button>
                  </div>
                )}
                {noteCleared && !contributed.length && (
                  <p className="text-ui-13 text-tea-text-sec">To remove the note, withdraw the entry.</p>
                )}
                {contributed.length > 0 ? attachedPhotos : choices.length > 0 ? (
                  <GuestBookPhotoPicker choices={choices} chosen={chosen} disabled={write.isPending} credential={token}
                    identity={identity} cacheKey={photoKey} onChoose={photoId => update({
                      photo: photoId ? { photoId, grantId: crypto.randomUUID() } : undefined, confirmed: false,
                    })} />
                ) : (
                  <p className="text-ui-13 text-tea-text-sec">To add a photo, save it with your setup above.</p>
                )}
                {photoUnavailable && (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-ui-13 text-tea-text-sec">
                      {contributed.length ? 'Your entry already has a photo.' : 'The selected photo is no longer available.'}
                    </p>
                    <Button type="button" variant="quiet" size="sm" onClick={() => update({ photo: undefined, confirmed: false })}>
                      Clear photo selection
                    </Button>
                  </div>
                )}
                <label className="flex min-h-tap cursor-pointer items-center gap-2 text-ui-13 text-tea-text-sec">
                  <input type="checkbox" className="h-4 w-4 shrink-0 accent-tea-gold"
                    checked={active.confirmed} disabled={write.isPending}
                    onChange={event => update({ confirmed: event.target.checked })} />
                  <span>
                    Share this entry with the host and, if approved, with this session’s guests under my name.
                    {chosen && ' I have permission to share this photo.'}
                  </span>
                </label>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {hasEntry && <Button type="button" variant="quiet" size="sm" disabled={write.isPending}
                    onClick={() => { setDraft(null); write.reset(); }}>Cancel</Button>}
                  <Button type="submit" variant="primary" size="sm" className="ml-auto"
                    disabled={!canSend} loading={write.isPending && write.variables?.action === 'save'}>Send for review</Button>
                </div>
              </form>
            ) : (
              <>
                {own && <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-1 whitespace-pre-wrap break-words`}>{own.note}</p>}
                {attachedPhotos}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button type="button" variant="secondary" size="sm" disabled={write.isPending}
                    onClick={() => { setDraft({ note: own?.note ?? '', confirmed: false }); write.reset(); }}>Edit entry</Button>
                  <Button type="button" variant="quiet" size="sm" disabled={write.isPending} onClick={() => write.mutate({ action: 'withdraw' })}>
                    Withdraw entry
                  </Button>
                </div>
              </>
            )}
            {write.isError && (
              <p role="alert" className="mt-2 text-ui-13 text-tea-text-sec">
                {write.variables?.action === 'save' ? 'Could not send your entry for review.' : 'Could not withdraw your contribution.'} Try again.
              </p>
            )}
            {write.isSuccess && write.variables.action !== 'save' && (
              <p role="status" className="mt-2 text-ui-13 text-tea-text-sec">
                {write.variables.action === 'withdraw' ? 'Entry withdrawn.' : write.variables.action === 'withdraw-note' ? 'Note withdrawn.' : 'Photo withdrawn.'}
              </p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
