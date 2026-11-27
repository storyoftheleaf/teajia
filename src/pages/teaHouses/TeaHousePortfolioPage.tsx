import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { mediaUrl } from '../../lib/mediaUrl';
import { TEA_HOUSES_TITLE } from '../../lib/teaHouses';
import { TEA_HOUSE_READ, teaHousesApi } from '../../lib/teaHousesApi';
import { TEA_HOUSE_PART_LABELS, type TeaHouseContribution } from '../../lib/teaHousesContract';
import { SectionSkeleton } from '../../components/shared/SectionSkeleton';
import { LoadFailed } from '../../components/shared/LoadFailed';
import { PART_QUERY, partView } from '../../lib/closedPart';

/**
 * A house's portfolio page, /tea-houses/work/:slug (Launch 4, K5 part two).
 * It leads with Adrian's part in the house, in his words, part by part, each
 * part present only where he said it is true, with his photographs. Then the
 * house's own page, for anyone who wants to sit down there. Nothing here is
 * written for him: the worker answers only a page he marked shown.
 */

function PartSection({ part }: { part: TeaHouseContribution }) {
  return (
    <section id={part.part} aria-labelledby={`part-${part.part}`} className="scroll-mt-24" data-testid="house-part">
      <h2 id={`part-${part.part}`} className={`${T.h2} text-tea-text`}>{TEA_HOUSE_PART_LABELS[part.part]}</h2>
      <p className={`${T.body} text-tea-text mt-3 whitespace-pre-line break-words`}>{part.words}</p>
      {part.photographs.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {part.photographs.map(url => (
            <img
              key={url}
              src={mediaUrl(url)}
              alt=""
              loading="lazy"
              className={`${part.photographs.length === 1 ? 'w-full' : 'w-full sm:w-[calc(50%-0.375rem)]'} h-auto rounded-md bg-tea-elevated`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function TeaHousePortfolioPage() {
  const { slug = '' } = useParams();
  const query = useQuery({
    queryKey: ['tea-houses', 'page', slug],
    queryFn: () => teaHousesApi.page(slug),
    ...TEA_HOUSE_READ,
    ...PART_QUERY,
  });
  const view = partView(query);

  return (
    <div className="w-full max-w-3xl mx-auto pt-12 pb-16" data-testid="tea-house-page">
      <Helmet>
        <title>{query.data ? `${query.data.house.name} · ${TEA_HOUSES_TITLE} · Teajia` : `${TEA_HOUSES_TITLE} · Teajia`}</title>
      </Helmet>
      <Link to="/tea-houses/work" className={`${T.link} tap-target inline-flex items-center`}>{TEA_HOUSES_TITLE}</Link>

      {query.isPending && <SectionSkeleton variant="grid" />}
      {view.state === 'failed' && <LoadFailed className="py-12" sentence="This house's page could not be loaded just now." onRetry={view.retry} />}
      {view.state === 'closed' && (
        <div className="py-12">
          <p className={`${T.body} text-tea-text-sec`}>This house has no page here.</p>
          <Link to="/tea-houses/visit" className={`${T.link} tap-target inline-flex items-center mt-3`}>Find a tea house to visit</Link>
        </div>
      )}
      {query.data && (
        <>
          <header className="mt-6 mb-10">
            <h1 className={`${T.h1} text-tea-text break-words`}>{query.data.house.name}</h1>
            {query.data.house.place && <p className={`${T.bodyLight} text-tea-text-dim mt-2`}>{query.data.house.place}</p>}
          </header>
          <div className="flex flex-col gap-12">
            {query.data.parts.map(part => <PartSection key={part.part} part={part} />)}
          </div>
          <p className="mt-12">
            <Link to={`/store/${encodeURIComponent(query.data.house.slug)}`} className={`${T.link} tap-target inline-flex items-center`}>
              Visit {query.data.house.name}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
