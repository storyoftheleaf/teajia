import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SessionGuestItem, SessionPhotograph } from '../../../shared/sessionTea';
import { sessionPhotoSrc, useRecapSeat, useSendRecapNote, type PublicRecapTea, type PublicSitRecap } from '../../lib/publicSitRecap';
import { Button } from '../shared/Button';
import { pouredLabel, SectionRule, sessionDate, SessionBlock, SessionHead, SessionNote } from './SessionBlocks';
import { SessionPhoto, type SessionPhotoSource } from './SessionPhoto';
import { SessionTeaRow } from './SessionTeaRow';

// A sit's recap, ordered by tea (approved drawing, 2026-11-24): the host's
// words, then each poured tea with the guests' photographs and notes attached
// to it, then "The table" and "Guest book" for everything that names no tea.
// Only what the host included and the guest agreed to make public reaches
// this page. "Add yours" shows only to someone who sat at this table.

function PhotoGrid({ photos, columns, caption }: {
  photos: SessionPhotograph[]; columns: 2 | 3; caption: (photo: SessionPhotograph) => string;
}) {
  if (!photos.length) return null;
  return (
    <div className={`grid gap-0.5 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`} data-testid="recap-photos">
      {photos.map(photo => (
        <figure key={photo.src} className="m-0 grid min-w-0 gap-1">
          <img src={sessionPhotoSrc(photo.src)} alt={photo.alt} loading="lazy" className="block aspect-square w-full object-cover" />
          <figcaption className="px-2 pb-1 font-sans text-ui-11 text-tea-text-dim">{caption(photo)}</figcaption>
        </figure>
      ))}
    </div>
  );
}

const signed = (photo: SessionPhotograph) => (photo.by ? `${photo.by.name}, ${photo.by.part}` : '');

function TeaBlock({ tea }: { tea: PublicRecapTea }) {
  const photos = tea.items.filter((item): item is Extract<SessionGuestItem, { kind: 'photo' }> => item.kind === 'photo');
  const notes = tea.items.filter((item): item is Extract<SessionGuestItem, { kind: 'note' }> => item.kind === 'note');
  return (
    <SessionBlock testId="recap-tea">
      <div className="px-6 pt-0.5"><SessionTeaRow tea={tea} /></div>
      {photos.length > 0 && <div className="mt-px"><PhotoGrid photos={photos} columns={2} caption={signed} /></div>}
      {notes.map((note, index) => <SessionNote key={index} text={note.text} by={note.by} className="mx-6 my-4" />)}
      {!photos.length && !notes.length && <div className="h-2" />}
    </SessionBlock>
  );
}

function AddYours({ slug, teas }: { slug: string; teas: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [teaId, setTeaId] = useState('');
  const [publicRecap, setPublicRecap] = useState(false);
  const send = useSendRecapNote(slug);
  const noteId = useId();
  const field = 'input-field mt-1 w-full p-3 text-ui-16';
  return (
    <div className="relative -mx-6 mt-8 border-y border-tea-border bg-tea-surface px-6 py-3" data-testid="recap-add-yours">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-tea-gold" />
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="m-0 font-sans text-ui-10 uppercase tracking-[0.16em] text-tea-gold-lt">You sat at this table</p>
          <p className="m-0 font-display text-ui-20 leading-tight text-tea-text">What stayed with you?</p>
          <p className="m-0 font-sans text-ui-13 text-tea-text-sec">Add a note or a photograph, and say which tea</p>
        </div>
        {!open && <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>Add yours</Button>}
      </div>
      {open && (send.isSuccess ? (
        <p role="status" className="mt-3 text-ui-13 text-tea-text-sec">Sent to the host. It appears here once they include it.</p>
      ) : (
        <form className="mt-3 grid gap-2" onSubmit={event => {
          event.preventDefault();
          if (note.trim()) send.mutate({ note: note.trim(), teaId: teaId || null, publicRecap });
        }}>
          <label htmlFor={noteId} className="text-ui-13 text-tea-text-sec">Note</label>
          <textarea id={noteId} className={field} rows={3} maxLength={280} value={note} onChange={event => setNote(event.target.value)} />
          <label className="text-ui-13 text-tea-text-sec">
            Which tea
            <select className={field} value={teaId} onChange={event => setTeaId(event.target.value)}>
              <option value="">The whole table</option>
              {teas.map(tea => <option key={tea.id} value={tea.id}>{tea.name}</option>)}
            </select>
          </label>
          <label className="flex min-h-tap cursor-pointer items-center gap-2 text-ui-13 text-tea-text-sec">
            <input type="checkbox" className="h-4 w-4 shrink-0 accent-tea-gold" checked={publicRecap} onChange={event => setPublicRecap(event.target.checked)} />
            <span>If the host includes it, show it on this public recap under my first name.</span>
          </label>
          <p className="m-0 text-ui-12 text-tea-text-dim">To add a photograph, open the after-sit link your host sent.</p>
          {send.isError && <p role="alert" className="m-0 text-ui-13 text-tea-text-sec">Could not send your note. Try again.</p>}
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="quiet" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" disabled={!note.trim()} loading={send.isPending}>Send for review</Button>
          </div>
        </form>
      ))}
    </div>
  );
}

export function SitRecap({ recap, photo, guestBook = true }: {
  recap: PublicSitRecap;
  /** The lead photograph; a formal sit reads its placed recap photo. */
  photo?: SessionPhotoSource | null;
  /** A casual sit has no guest book or seat check. */
  guestBook?: boolean;
}) {
  const seat = useRecapSeat(guestBook ? recap.slug : '');
  const lead = photo === undefined ? { kind: 'formal' as const, slug: recap.slug, fallback: recap.galleryPhoto } : photo;
  const host = recap.people.find(person => person.role === 'lead_host') ?? recap.people[0];
  return (
    <article data-testid="sit-recap">
      <SessionBlock testId="recap-head">
        {lead && <SessionPhoto source={lead} />}
        <SessionHead date={sessionDate(recap.event_date)} part="Session recap" title={recap.title} people={recap.people} level="h1" />
        {recap.note ? <SessionNote text={recap.note.text} by={recap.note.by} className="mx-6 mb-[18px] mt-4" /> : <div className="h-4" />}
      </SessionBlock>

      {recap.teas.length > 0 && <SectionRule label={pouredLabel(recap.teas.length)} className="mb-3 mt-8" />}
      <div className="grid gap-8">
        {recap.teas.map((tea, index) => <TeaBlock key={tea.id ?? `${tea.name}-${index}`} tea={tea} />)}
      </div>

      {recap.table.length > 0 && (
        <>
          <SectionRule label="The table" className="mb-3 mt-8" />
          <div className="-mx-6"><PhotoGrid photos={recap.table} columns={3} caption={photo => photo.by?.name ?? ''} /></div>
        </>
      )}

      {recap.guestBook.length > 0 && (
        <>
          <SectionRule label="Guest book" className="mb-3 mt-8" />
          <div className="grid gap-4">
            {recap.guestBook.map((entry, index) => <SessionNote key={index} text={entry.text} by={entry.by} />)}
          </div>
        </>
      )}

      {seat.data?.seated && <AddYours slug={recap.slug} teas={seat.data.teas ?? []} />}

      {host && (
        <p className="mt-8 text-center">
          <Link to={`/people/${encodeURIComponent(host.slug)}`}
            className="tap-target inline-flex min-h-tap items-center font-sans text-ui-10 uppercase tracking-[0.22em] text-tea-text-dim hover:text-tea-text">
            Back to {host.name}
          </Link>
        </p>
      )}
    </article>
  );
}
