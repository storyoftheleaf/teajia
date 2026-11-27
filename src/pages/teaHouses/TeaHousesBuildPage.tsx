import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { TEA_HOUSES_TITLE } from '../../lib/teaHouses';
import { teaHouseFreshRead, teaHousesApi } from '../../lib/teaHousesApi';
import { TEA_HOUSE_PART_OFFERS, teaHousePagePath } from '../../lib/teaHousesContract';
import { SectionSkeleton } from '../../components/shared/SectionSkeleton';

/**
 * Build, /tea-houses/build (Launch 4, K5 part two): the same parts as a
 * house's page, turned into an offer. Each part appears only where Adrian has
 * done it somewhere, and points at the houses where he did, in his order.
 */
export default function TeaHousesBuildPage() {
  const query = useQuery({ queryKey: ['tea-houses', 'build'], queryFn: () => teaHousesApi.build(), ...teaHouseFreshRead });
  const parts = query.isSuccess && !query.isFetching ? query.data.parts : [];
  return (
    <div className="w-full max-w-3xl mx-auto pt-12 pb-16" data-testid="tea-houses-build">
      <Helmet><title>{`Build | ${TEA_HOUSES_TITLE} | Teajia`}</title></Helmet>
      <header className="text-center mb-10">
        <Link to="/tea-houses" className={`${T.label} text-tea-text-dim tap-target inline-flex items-center`}>{TEA_HOUSES_TITLE}</Link>
        <h1 className={`${T.h1} mt-3`}>This is what I can do for your room</h1>
      </header>
      {(query.isPending || query.isFetching) && <SectionSkeleton variant="grid" />}
      {query.isError && !query.isFetching && <p className={`${T.body} text-center text-tea-text-sec py-12`}>This could not be loaded just now.</p>}
      {parts.length > 0 && (
        <ol className="flex flex-col border-t border-tea-border">
          {parts.map(entry => (
            <li key={entry.part} className="py-5 border-b border-tea-border" data-testid="build-part">
              <h2 className={`${T.h3} text-tea-text`}>{TEA_HOUSE_PART_OFFERS[entry.part]}</h2>
              <p className={`${T.bodyLight} text-tea-text-sec mt-2 flex flex-wrap gap-x-4 gap-y-1`}>
                {entry.houses.map(house => (
                  <Link key={house.slug} to={`${teaHousePagePath(house.slug)}#${entry.part}`} className={`${T.link} tap-target inline-flex items-center`}>
                    As at {house.name}
                  </Link>
                ))}
              </p>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-10 text-center">
        <Link to="/advise" className={`${T.link} tap-target inline-flex items-center`}>Start the conversation</Link>
      </p>
    </div>
  );
}
