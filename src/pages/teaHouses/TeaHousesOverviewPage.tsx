import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { BAR_WORDS } from '../../components/navSections';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { useTeaHouseWork, useTeaSpaces } from '../../lib/teaHousesApi';

/**
 * The tea spaces page, /tea-houses (tea spaces, step 3, todo/plans/tea-spaces.md).
 *
 * Adrian: "Let's focus on the spaces, not the houses. Because anyone can own a
 * space." One page of spaces: a tea house he shows sits under its own name
 * with the spaces inside it, and a host's own tea space appears once they turn
 * it on, by its area only, with who serves there. Nothing ranks them.
 *
 * Until his own house is shown, it stands first as a placeholder, one house
 * with two spaces, plainly marked for him to replace (his words: placeholders
 * never hold a build). The doors to Build, Work and Visit stay below.
 */
const PLACEHOLDER_HOUSE = {
  name: 'Adrian’s house',
  spaces: ['First tea space', 'Second tea space'],
};

export default function TeaHousesOverviewPage() {
  const work = useTeaHouseWork();
  const spaces = useTeaSpaces();
  const hasWork = (work.data?.houses.length ?? 0) > 0;
  const houses = spaces.data?.houses ?? [];
  const ownSpaces = spaces.data?.spaces ?? [];
  const doors = [
    ...(hasWork ? [
      { to: '/tea-houses/build', label: 'Build one with me' },
      { to: '/tea-houses/work', label: 'Houses I have worked on' },
    ] : []),
    { to: '/tea-houses/visit', label: 'Find a tea house to visit' },
  ];
  const title = BAR_WORDS.houses;

  return (
    <div className="w-full max-w-3xl mx-auto pt-12 pb-16 pb-nav-gap" data-testid="tea-houses-overview">
      <Helmet><title>{`${title} | Teajia`}</title></Helmet>
      <header className="text-center mb-10">
        <h1 className={T.h1}>{title}</h1>
      </header>

      <section aria-label="Tea houses and their spaces" className="border-t border-tea-border" data-testid="tea-spaces-houses">
        {houses.length === 0 && spaces.isSuccess && (
          <article className="border-b border-tea-border py-5" data-testid="tea-spaces-placeholder">
            <h2 className={`${T.h3} text-tea-text`}>{PLACEHOLDER_HOUSE.name}</h2>
            <p className="mt-1 text-ui-12 text-tea-text-sec">Placeholder: Adrian will name this house and its spaces.</p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {PLACEHOLDER_HOUSE.spaces.map(name => (
                <li key={name} className="text-ui-14 text-tea-text-sec">{name} <span className="text-tea-text-dim">(placeholder)</span></li>
              ))}
            </ul>
          </article>
        )}
        {houses.map(house => (
          <article key={house.slug} className="border-b border-tea-border py-5" data-testid="tea-spaces-house">
            <h2 className={T.h3}>
              <Link to={`/tea-houses/work/${encodeURIComponent(house.slug)}`} className="tap-target text-tea-text hover:text-tea-gold-lt">{house.name}</Link>
            </h2>
            {house.spaces.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                {house.spaces.map(name => <li key={name} className="text-ui-14 text-tea-text-sec">{name}</li>)}
              </ul>
            )}
          </article>
        ))}
      </section>

      {ownSpaces.length > 0 && (
        <section aria-label="Hosts’ own tea spaces" className="mt-10" data-testid="tea-spaces-own">
          <h2 className={`${T.label} text-tea-text-sec`}>At a host’s own table</h2>
          <ul className="mt-3 flex flex-col border-t border-tea-border">
            {ownSpaces.map(space => (
              <li key={space.id} className="border-b border-tea-border py-4" data-testid="tea-spaces-space">
                <p className="text-ui-16 text-tea-text">{space.area}</p>
                {space.served_by && (
                  <p className="mt-1 text-ui-13 text-tea-text-sec">
                    Served by{' '}
                    <Link to={`/people/${encodeURIComponent(space.served_by.slug)}`} className="tap-target underline decoration-tea-border underline-offset-4 hover:text-tea-text">
                      {space.served_by.name}
                    </Link>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="mt-10 flex flex-col border-t border-tea-border" aria-label="More about tea houses">
        {doors.map(door => (
          <li key={door.to} className="border-b border-tea-border">
            <Link to={door.to} className={`${T.h3} text-tea-text hover:text-tea-gold-lt flex items-center py-5 tap-target`}>{door.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
