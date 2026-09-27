import { useMemo } from 'react';
import { ContributorIdentityMark } from '../components/shared/ContributorIdentityMark';
import { Cover, Dek, GroupHead, PeopleNav, PeopleRoot, SplitName, useReadingProgress, useReveals } from '../components/people/immersive';
import { coverKicker } from '../components/people/profileFormat';
import { useContributors } from '../hooks/useContributor';

// /people. The directory, in the Read section's language: the sticky Teajia
// nav with the eyebrow "People", "The People of Tea" with the italic gold
// second word, an italic dek, then one cover card per person: a 140px image
// on the left (or the identity mark), the name with its italic gold surname,
// and one line in their own words. No caps labels anywhere but the "This
// season" divider (canvas version 24, 2026-09-20): the role and place still
// name the card for a screen reader, not for the eye.

export default function ContributorsIndexPage() {
  const { data, isLoading } = useContributors();
  const rootRef = useReveals([data?.length]);
  const progress = useReadingProgress();

  const people = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [data],
  );

  if (isLoading) return null;

  const count = people.length;

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
            <div data-reveal>
              <GroupHead label="This season" />
              <ul className="mt-3.5 flex flex-col gap-3.5" aria-label="People">
                {people.map(person => (
                  <li key={person.id}>
                    <Cover
                      to={`/people/${encodeURIComponent(person.id)}`}
                      height={180}
                      className="!flex-row !items-stretch"
                      testId="people-card"
                      ariaLabel={`${person.display_name}, ${coverKicker(person.role, person.location_line) || 'tea master'}`}
                    >
                      <span className="-m-6 flex h-[180px]">
                        <span className="relative w-[140px] flex-none overflow-hidden bg-tea-elevated">
                          {person.card_image_url ? (
                            <img src={person.card_image_url} alt={person.display_name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                          ) : (
                            <ContributorIdentityMark name={person.display_name} decorative={false} />
                          )}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col justify-end px-[18px] py-4">
                          <span className="block font-display text-ui-26 leading-none text-tea-text"><SplitName name={person.display_name} /></span>
                          {person.own_line && (
                            /* Three lines at most, so a long first sentence never pushes the kicker off the top of the card. */
                            <Dek className="mt-2 text-[12.5px]" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{person.own_line}</Dek>
                          )}
                        </span>
                      </span>
                    </Cover>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </main>

        <footer data-reveal className="px-6 pb-16 pt-12 text-center">
          <Dek className="text-ui-15">More are invited each season.</Dek>
        </footer>
      </article>
    </PeopleRoot>
  );
}
