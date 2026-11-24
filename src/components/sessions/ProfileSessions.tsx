import { useState } from 'react';
import { Button } from '../shared/Button';
import type { PublicSessionTea, SessionPerson, SessionPhotograph, SessionSignature } from '../../../shared/sessionTea';
import { casualSitPhotoUrl, casualSitRecapPath, usePublicCasualSits } from '../../lib/casualSitPublications';
import { useFormalSessionCards } from '../../lib/publicSessionCards';
import { recapPath } from '../../lib/publicSitConnections';
import { sitProfileCreditVerb } from '../../lib/sitCreditContract';
import { GroupHead } from '../people/immersive';
import {
  LeadPhoto, NextSitRow, OpenRecapRow, PhotoStrip, PouredTeas, sessionDate, SessionBlock, SessionHead, SessionNote,
} from './SessionBlocks';
import type { SessionPhotoSource } from './SessionPhoto';

type PastSit = {
  id: string; href: string; title: string; date: string; part: string;
  people: SessionPerson[]; note: { text: string; by: SessionSignature | null } | null;
  photo?: SessionPhotoSource; small: SessionPhotograph[]; more: number; teas: PublicSessionTea[];
};

const SHOWN = 2;

/**
 * The Sessions section of a People profile: the person's next sit, then their
 * past sits, each with that person's own part ("Hosted", "Poured at"). Every
 * photograph and the closing row open the sit's recap.
 */
export function ProfileSessions({ profile, name, next }: {
  profile: string;
  name: string;
  next?: { slug: string; title: string; event_date: string } | null;
}) {
  const [all, setAll] = useState(false);
  const formal = useFormalSessionCards(profile);
  const casual = usePublicCasualSits(profile);
  const past: PastSit[] = [
    ...(formal.isSuccess && !formal.isFetching ? formal.data : []).map((sit): PastSit => ({
      id: 'formal:' + sit.slug,
      href: recapPath(sit.slug),
      title: sit.title,
      date: sit.event_date,
      part: (sit.role && sitProfileCreditVerb(sit.role)) || 'At the table',
      people: sit.people ?? [],
      note: sit.note ?? (sit.writing ? { text: sit.writing, by: null } : null),
      photo: { kind: 'formal', slug: sit.slug, fallback: sit.galleryPhoto },
      small: sit.photos?.small ?? [],
      more: sit.photos?.more ?? 0,
      teas: sit.teas.filter((tea): tea is PublicSessionTea => 'kind' in tea),
    })),
    ...(casual.isSuccess && !casual.isFetching ? casual.data.recaps ?? [] : []).map((sit): PastSit => ({
      id: 'casual:' + sit.slug,
      href: casualSitRecapPath(sit.slug),
      title: sit.title,
      date: sit.date,
      part: 'Hosted',
      people: [{ slug: sit.host.slug, name: sit.host.name, role: 'lead_host' }],
      note: sit.writing ? { text: sit.writing, by: { name: sit.host.name, part: 'host', slug: sit.host.slug } } : null,
      photo: sit.photo ? { kind: 'casual', url: casualSitPhotoUrl(sit.slug, sit.photo.id), alt: sit.photo.alt, credit: sit.host.name } : undefined,
      small: [],
      more: 0,
      teas: sit.teas ?? (sit.tea ? [{ kind: 'name', id: null, name: sit.tea.name }] : []),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

  if (!next && !past.length) return null;
  const shown = all ? past : past.slice(0, SHOWN);
  return (
    <section id="sit-recaps" aria-label="Sessions" className="px-6" data-testid="profile-sessions">
      <GroupHead label="Sessions" />
      <div className="h-2" />
      {next && <NextSitRow slug={next.slug} title={next.title} date={next.event_date} host={name} />}
      {past.length > 0 && (
        <p className={`m-0 font-sans text-ui-10 uppercase tracking-[0.16em] text-tea-text-dim ${next ? 'mt-8' : ''} mb-3`}>Past sits</p>
      )}
      <div className="grid gap-8">
        {shown.map(sit => (
          <SessionBlock key={sit.id}>
            {sit.photo && <LeadPhoto source={sit.photo} to={sit.href} title={sit.title} />}
            <PhotoStrip photos={sit.small} more={sit.more} to={sit.href} />
            <SessionHead date={sessionDate(sit.date)} part={sit.part} title={sit.title} to={sit.href} people={sit.people} />
            {sit.note && <SessionNote text={sit.note.text} by={sit.note.by} className="mx-6 mb-[18px] mt-4" />}
            {!sit.note && <div className="h-4" />}
            <PouredTeas teas={sit.teas} />
            <OpenRecapRow to={sit.href} />
          </SessionBlock>
        ))}
      </div>
      {!all && past.length > SHOWN && (
        <div className="mt-5 text-center">
          <Button type="button" variant="quiet" size="sm" onClick={() => setAll(true)}>All sessions</Button>
        </div>
      )}
    </section>
  );
}
