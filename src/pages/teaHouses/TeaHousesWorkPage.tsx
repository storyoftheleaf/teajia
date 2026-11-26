import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { mediaUrl } from '../../lib/mediaUrl';
import { TEA_HOUSES_TITLE } from '../../lib/teaHouses';
import { useTeaHouseWork } from '../../lib/teaHousesApi';
import { teaHousePagePath, type TeaHouseWorkItem } from '../../lib/teaHousesContract';
import { SectionSkeleton } from '../../components/shared/SectionSkeleton';

/**
 * Work, /tea-houses/work (Launch 4, K5 part two): the houses Adrian worked on,
 * in the order he chose by hand, each opening to its page. No counts, no
 * ranking, nothing sorted by anything but his hand.
 */

function HouseRow({ house }: { house: TeaHouseWorkItem }) {
  return (
    <li>
      <Link
        to={teaHousePagePath(house.slug)}
        className="flex flex-col sm:flex-row gap-4 p-4 bg-tea-surface border border-tea-border rounded-xl hover:border-tea-gold focus-visible:border-tea-gold transition-colors"
        data-testid="work-house"
      >
        {house.photograph && (
          <img src={mediaUrl(house.photograph)} alt="" loading="lazy" className="w-full sm:w-48 aspect-[3/2] object-cover rounded-md bg-tea-elevated flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className={`${T.h3} text-tea-text break-words`}>{house.name}</h2>
          {house.place && <p className={`${T.bodyLight} text-tea-text-dim mt-1`}>{house.place}</p>}
        </div>
      </Link>
    </li>
  );
}

export default function TeaHousesWorkPage() {
  const query = useTeaHouseWork();
  const houses = query.data?.houses ?? [];
  return (
    <div className="w-full max-w-3xl mx-auto pt-12 pb-16" data-testid="tea-houses-work">
      <Helmet><title>{`Work | ${TEA_HOUSES_TITLE} | Teajia`}</title></Helmet>
      <header className="text-center mb-8">
        <Link to="/tea-houses" className={`${T.label} text-tea-text-dim tap-target inline-flex items-center`}>{TEA_HOUSES_TITLE}</Link>
        <h1 className={`${T.h1} mt-3`}>Houses I have worked on</h1>
      </header>
      {query.isPending && <SectionSkeleton variant="grid" />}
      {query.isError && <p className={`${T.body} text-center text-tea-text-sec py-12`}>The houses could not be loaded just now.</p>}
      {query.isSuccess && houses.length === 0 && (
        <div className="text-center py-12" data-testid="work-empty">
          <p className={`${T.body} text-tea-text-sec`}>Nothing is shown here yet.</p>
          <Link to="/tea-houses/visit" className={`${T.link} tap-target inline-flex items-center mt-3`}>Find a tea house to visit</Link>
        </div>
      )}
      {houses.length > 0 && (
        <ul className="flex flex-col gap-4" aria-label="Houses">
          {houses.map(house => <HouseRow key={house.slug} house={house} />)}
        </ul>
      )}
    </div>
  );
}
