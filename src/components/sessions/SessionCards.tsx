import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatEventLong } from '../people/profileFormat';
import { TeaCard, TeaCardMeta, TeaCardTitle } from '../tea/TeaCard';
import { SessionPhoto, type SessionPhotoSource } from './SessionPhoto';
import { useFormalSessionCards } from '../../lib/publicSessionCards';
import { recapPath } from '../../lib/publicSitConnections';
import { sitProfileCreditVerb } from '../../lib/sitCreditContract';
import { casualSitPhotoUrl, casualSitRecapPath, usePublicCasualSits } from '../../lib/casualSitPublications';

type SessionCard = {
  id: string;
  href: string;
  title: string;
  date: string;
  byline?: string;
  writing: string;
  teaNames: string[];
  teaType?: string | null;
  photo?: SessionPhotoSource;
};

export function SessionCards({ profile }: { profile?: string }) {
  const formal = useFormalSessionCards(profile);
  const casual = usePublicCasualSits(profile ?? '');
  const cards: SessionCard[] = [
    ...(formal.isSuccess && !formal.isFetching ? formal.data : []).map(sit => ({
      id: 'formal:' + sit.slug,
      href: recapPath(sit.slug),
      title: sit.title,
      date: sit.event_date,
      byline: sit.role ? sitProfileCreditVerb(sit.role) ?? undefined : sit.host,
      writing: sit.writing,
      teaNames: sit.teas.map(tea => tea.name),
      teaType: sit.teas[0]?.type,
      photo: profile
        ? { kind: 'formal' as const, slug: sit.slug, fallback: sit.galleryPhoto }
        : { kind: 'formal' as const, slug: sit.slug, placement: 'brewing' as const },
    })),
    ...(casual.isSuccess && !casual.isFetching ? (casual.data.recaps ?? []) : []).map(sit => ({
      id: 'casual:' + sit.slug,
      href: casualSitRecapPath(sit.slug),
      title: sit.title,
      date: sit.date,
      byline: 'Hosted',
      writing: sit.writing,
      teaNames: sit.tea ? [sit.tea.name] : [],
      photo: sit.photo ? { kind: 'casual' as const, url: casualSitPhotoUrl(sit.slug, sit.photo.id),
        alt: sit.photo.alt, credit: sit.host.name } : undefined,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  if (!cards.length) {
    if (profile) return null;
    if (formal.isPending || formal.isFetching) return <p role="status" className="text-ui-13 text-tea-text-sec">Opening sessions…</p>;
    if (formal.isError) return <p role="alert" className="text-ui-13 text-tea-text-sec">Couldn’t open brewing experiences.</p>;
    return <p className="text-ui-14 text-tea-text-sec">Published sessions appear here.</p>;
  }

  const grid = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="session-card-grid">
      {cards.map(card => (
        <TeaCard key={card.id} teaType={card.teaType ?? undefined} testId="session-card"
          title={<TeaCardTitle as={profile ? 'h3' : 'h2'}>
            <Link to={card.href} className="tap-target flex items-center gap-2 hover:text-tea-gold">
              <span className="min-w-0 break-words">{card.title}</span>
              <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
            </Link>
          </TeaCardTitle>}
          meta={<TeaCardMeta primary={[formatEventLong(card.date), card.byline].filter(Boolean).join(' · ')} />}>
          {card.photo && <SessionPhoto source={card.photo} />}
          {(card.writing || card.teaNames.length > 0) && (
            <div className="space-y-2 px-3 py-3">
              {card.writing && <p className="line-clamp-3 break-words text-ui-14 text-tea-text-sec">{card.writing}</p>}
              {card.teaNames.length > 0 && <p className="break-words text-ui-13 text-tea-text">{card.teaNames.join(' · ')}</p>}
            </div>
          )}
        </TeaCard>
      ))}
    </div>
  );
  return profile ? (
    <section id="sit-recaps" aria-labelledby="profile-session-cards" className="mt-4">
      <h2 id="profile-session-cards" className="type-section-heading mb-3">Sessions</h2>
      {grid}
    </section>
  ) : grid;
}
