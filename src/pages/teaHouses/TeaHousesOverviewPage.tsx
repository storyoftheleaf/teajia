import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { TEA_HOUSES_TITLE } from '../../lib/teaHouses';
import { useTeaHouseWork } from '../../lib/teaHousesApi';

/**
 * The Overview, /tea-houses (Launch 4, K5 part two): three doors, build one,
 * see the houses Adrian worked on, visit one. Build and Work appear only once
 * a house page is shown; until then the section is Visit alone. What a Teajia
 * tea house is, in his words, waits for his words.
 */
export default function TeaHousesOverviewPage() {
  const work = useTeaHouseWork();
  const hasWork = (work.data?.houses.length ?? 0) > 0;
  const doors = [
    ...(hasWork ? [
      { to: '/tea-houses/build', label: 'Build one with me' },
      { to: '/tea-houses/work', label: 'Houses I have worked on' },
    ] : []),
    { to: '/tea-houses/visit', label: 'Find a tea house to visit' },
  ];
  return (
    <div className="w-full max-w-3xl mx-auto pt-12 pb-16" data-testid="tea-houses-overview">
      <Helmet><title>{`${TEA_HOUSES_TITLE} · Teajia`}</title></Helmet>
      <header className="text-center mb-10">
        <h1 className={T.h1}>{TEA_HOUSES_TITLE}</h1>
      </header>
      <ul className="flex flex-col border-t border-tea-border" aria-label={TEA_HOUSES_TITLE}>
        {doors.map(door => (
          <li key={door.to} className="border-b border-tea-border">
            <Link to={door.to} className={`${T.h3} text-tea-text hover:text-tea-gold-lt flex items-center py-5 tap-target`}>{door.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
