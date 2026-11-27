import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/shared/Button';
import { ContributorIdentityMark } from '../components/shared/ContributorIdentityMark';
import { Cover, Dek, GroupHead, PeopleNav, PeopleRoot, SplitName, useReadingProgress, useReveals } from '../components/people/immersive';
import { coverKicker } from '../components/people/profileFormat';
import { useContributors } from '../hooks/useContributor';
import { PEOPLE_LIST_FAMILY_SHOWN, type PeopleListGroup } from '../lib/familyContract';
import { mediaUrl } from '../lib/mediaUrl';
import type { ContributorListItem } from '../types';

// /people. The directory, in the Read section's language: the sticky Teajia
// nav with the eyebrow "People", "The People of Tea" with the italic gold
// second word, an italic dek, then the people in three groups.
//
// "This season" and "Founding members" are cover cards: a 140px image on the
// left, the name with its italic gold surname, and one line in their own
// words. "The family" is a row each: a small square of their photograph, the
// name and the line.
//
// Who is here and in what order is the worker's answer (worker/src/peopleList.ts):
// nobody without a photograph, and the family in a quiet order. This page
// prints that order as it arrives. No counts, no dates, no ranking words, no
// badge: where a person sits is all it says. Past the first
// PEOPLE_LIST_FAMILY_SHOWN the rest of the family wait behind "See everyone".
// One plain line may sit beneath a name: "Pours at tables", for someone who
// has poured at a completed session (the worker's `pours`). Words only: no
// count of sessions, no icon, nothing that grows with how often.

/** "Pours at tables", or nothing. The same three words for everyone who pours. */
// Hidden for now (2026-11-27): worked out from who has hosted, it would be
// automatic, which the quiet acknowledgement rule forbids. It returns once a
// host or Adrian can give it by hand.
const POURS_LINE_SHOWN = false;

function PoursLine({ person }: { person: ContributorListItem }) {
  if (!POURS_LINE_SHOWN || person.pours !== true) return null;
  return <span className="mt-1 block font-sans text-ui-12 text-tea-text-sec" data-testid="person-pours">Pours at tables</span>;
}

/** The group a person sits in. The worker says; an answer without it falls back to the word on their page. */
function groupOf(person: ContributorListItem): PeopleListGroup {
  return person.list_group ?? (person.page_tier === 'family' ? 'family' : 'season');
}

function PersonCard({ person }: { person: ContributorListItem }) {
  return (
    <Cover
      to={`/people/${encodeURIComponent(person.id)}`}
      height={180}
      className="!flex-row !items-stretch !justify-start"
      testId="people-card"
      ariaLabel={`${person.display_name}, ${coverKicker(person.role, person.location_line) || 'host'}`}
    >
      <span className="-m-6 flex h-[180px]">
        <span className="relative w-[140px] flex-none overflow-hidden bg-tea-elevated">
          {person.card_image_url ? (
            <img src={mediaUrl(person.card_image_url)} alt={person.display_name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: person.card_image_focus ?? undefined }} />
          ) : (
            <ContributorIdentityMark name={person.display_name} decorative={false} />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-end px-[18px] py-4">
          <span className="block font-display text-ui-26 leading-none text-tea-text"><SplitName name={person.display_name} /></span>
          <PoursLine person={person} />
          {person.own_line && (
            /* Three lines at most, so a long first sentence never pushes the kicker off the top of the card. */
            <Dek className="mt-2 text-[12.5px]" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{person.own_line}</Dek>
          )}
        </span>
      </span>
    </Cover>
  );
}

function CardGroup({ label, people, testId }: { label: string; people: ContributorListItem[]; testId?: string }) {
  if (people.length === 0) return null;
  return (
    <div data-reveal data-testid={testId}>
      <GroupHead label={label} />
      <ul className="mt-3.5 flex flex-col gap-3.5" aria-label={label === 'This season' ? 'People' : label}>
        {people.map(person => <li key={person.id}><PersonCard person={person} /></li>)}
      </ul>
    </div>
  );
}

function FamilyRow({ person }: { person: ContributorListItem }) {
  const image = person.card_image_url ?? person.avatar_url;
  return (
    <Link
      to={`/people/${encodeURIComponent(person.id)}`}
      data-testid="family-row"
      aria-label={`${person.display_name}, ${person.role || 'Teajia family'}`}
      className="tj-people-row grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-4 border-b border-tea-border py-3 text-left text-tea-text"
    >
      <span className="relative block h-16 w-16 flex-none overflow-hidden bg-tea-elevated">
        {image ? (
          <img src={mediaUrl(image)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: person.card_image_url ? person.card_image_focus ?? undefined : undefined }} />
        ) : (
          <ContributorIdentityMark name={person.display_name} decorative />
        )}
      </span>
      <span className="min-w-0">
        <span className="tj-people-title block font-display text-ui-24 leading-[1.08] transition-colors"><SplitName name={person.display_name} /></span>
        <PoursLine person={person} />
        {person.own_line && <Dek className="mt-1" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{person.own_line}</Dek>}
      </span>
    </Link>
  );
}

export default function ContributorsIndexPage() {
  const { data, isLoading } = useContributors();
  const [everyone, setEveryone] = useState(false);
  const rootRef = useReveals([data?.length, everyone]);
  const progress = useReadingProgress();

  // The order inside each group is the order the list arrived in.
  const groups = useMemo(() => {
    const sorted: Record<PeopleListGroup, ContributorListItem[]> = { season: [], founding: [], family: [] };
    for (const person of data ?? []) sorted[groupOf(person)].push(person);
    return sorted;
  }, [data]);

  if (isLoading) return null;

  const count = groups.season.length + groups.founding.length + groups.family.length;
  const family = everyone ? groups.family : groups.family.slice(0, PEOPLE_LIST_FAMILY_SHOWN);

  return (
    <PeopleRoot rootRef={rootRef} testId="people-directory">
      <PeopleNav eyebrow="People" progress={progress} backTo="/" chevron={false} />
      <article className="relative z-[1] mx-auto w-full max-w-2xl pb-nav-gap-lg">
        <header className="px-6 pt-10">
          <h1 className="font-display text-[44px] leading-none text-tea-text md:text-[56px]">
            The People <span className="italic text-tea-readgold">of Tea</span>
          </h1>
          <Dek className="mt-3.5 max-w-[32ch] text-ui-15">The people who pour, pick and teach. Each page is theirs, in their own words.</Dek>
        </header>

        <main className="px-6">
          {count === 0 ? (
            <p className="subtitle mt-10 py-16 text-center text-tea-text-sec">The first pages are being set in type. Come back soon.</p>
          ) : (
            <>
              <CardGroup label="This season" people={groups.season} />
              <CardGroup label="Founding members" people={groups.founding} testId="people-founding" />
              {groups.family.length > 0 && (
                <div data-reveal data-testid="people-family">
                  <GroupHead label="The family" />
                  <ul aria-label="The family">
                    {family.map(person => <li key={person.id}><FamilyRow person={person} /></li>)}
                  </ul>
                  {!everyone && groups.family.length > family.length && (
                    <Button variant="quiet" size="sm" type="button" className="mt-4" onClick={() => setEveryone(true)} data-testid="people-see-everyone">
                      See everyone
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        <footer data-reveal className="px-6 pb-16 pt-12 text-center">
          <Dek className="text-ui-15">More are invited each season.</Dek>
        </footer>
      </article>
    </PeopleRoot>
  );
}
