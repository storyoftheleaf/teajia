/**
 * /wisdom/region/:id. One growing place, in public.
 *
 * The facts are short, so the page earns its keep on the reverse link: the
 * plants whose recorded origin walks back to here. That is read out of the base
 * with `plantsGrownIn`, never stored, so a plant added tomorrow appears here
 * without anyone editing a list.
 */
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { REGIONS, findRegion } from '../../wisdom';
import {
  AXIS_INDENT,
  catalogueNumber,
  EntryAuthorship,
  Fact,
  FACT_CLASS,
  GROUND,
  HoldingNotFound,
  HoldingRow,
  IndexList,
  Invitation,
  MEASURE,
  PAGE,
  PREVIEW_PAGE,
  PageHead,
  Passage,
  plantsGrownIn,
  QUIET_LINK,
  SectionHead,
  SPACE,
  WisdomSubNav,
  WisdomFallback,
} from './wisdomShared';
import { EntryResearchSection } from './EntryResearchSection';
import { WisdomPublicStateGate, WisdomRelatedMaterial } from './WisdomRelatedMaterial';
import { mapSearchLink } from './mapLinks';

const PreviewOriginPage = import.meta.env.MODE === 'tea-reference-preview'
  ? React.lazy(() => import('./PreviewOriginPage'))
  : null;
const REGION_PAGE = import.meta.env.MODE === 'tea-reference-preview' ? PREVIEW_PAGE : PAGE;

const RegionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  // The id first, exactly. `findRegion` normalises away the hyphens, which
  // happens to work today because every id is a slug of its own name, and
  // would quietly resolve to a neighbour the day one is not.
  const region = useMemo(() => REGIONS.find(entry => entry.id === id) ?? findRegion(id), [id]);

  const plants = useMemo(() => (region ? plantsGrownIn(region) : []), [region]);
  const placesWithin = useMemo(() => {
    if (!region || region.province) return [];
    return REGIONS.filter(candidate => (
      candidate.id !== region.id
      && candidate.country === region.country
      && candidate.province === region.name
    ));
  }, [region]);
  const plantsWithin = useMemo(() => {
    const seen = new Set<string>();
    return placesWithin.flatMap(place => plantsGrownIn(place).map(plant => ({ plant, place })))
      .filter(({ plant }) => {
        if (seen.has(plant.id)) return false;
        seen.add(plant.id);
        return true;
      });
  }, [placesWithin]);

  const structuredData = useMemo(() => {
    if (!region) return null;
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const pageUrl = `${origin}/wisdom/region/${region.id}`;
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Place',
          '@id': `${pageUrl}#place`,
          name: region.name,
          ...(region.climate ? { description: region.climate } : {}),
          address: {
            '@type': 'PostalAddress',
            addressCountry: region.country,
            ...(region.province ? { addressRegion: region.province } : {}),
          },
          ...(region.altitude
            ? { additionalProperty: [{ '@type': 'PropertyValue', name: 'Altitude', value: region.altitude }] }
            : {}),
        },
        {
          '@type': 'WebPage',
          '@id': pageUrl,
          url: pageUrl,
          name: `${region.name} · Tea growing region reference`,
          inLanguage: 'en',
          about: { '@id': `${pageUrl}#place` },
          isPartOf: { '@type': 'CollectionPage', name: 'Growing Regions', url: `${origin}/wisdom/regions` },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Growing Regions', item: `${origin}/wisdom/regions` },
            { '@type': 'ListItem', position: 2, name: region.name, item: pageUrl },
          ],
        },
      ],
    };
  }, [region]);

  if (!region) {
    if (PreviewOriginPage) {
      return (
        <React.Suspense fallback={<WisdomFallback />}>
          <PreviewOriginPage id={id ?? ''} />
        </React.Suspense>
      );
    }
    return (
      <HoldingNotFound
        section="regions"
        heading="Not a place we hold"
        backTo="/wisdom/regions"
        backLabel="All growing regions"
        subject="A growing place that is missing"
      />
    );
  }

  const map = mapSearchLink([region.name, region.province], region.country);
  const directOrNestedPlants = plants.length > 0
    ? plants.map(plant => ({ plant, place: null }))
    : plantsWithin;

  return (
    <WisdomPublicStateGate identity={{ nodeType: 'region', nodeId: region.id }}>
    <article className={REGION_PAGE} data-wisdom-region-page="true">
      <Helmet>
        <title>{`${region.name} · Growing Regions · Teajia`}</title>
        <meta
          name="description"
          content={(
            region.climate || `${region.name}, a tea growing place in ${region.country}.`
          ).slice(0, 160)}
        />
        <meta property="og:title" content={`${region.name} · Teajia`} />
        {structuredData && <script type="application/ld+json">{JSON.stringify(structuredData)}</script>}
      </Helmet>

      <WisdomSubNav active="regions" />

      {/* No dateline under the title. It printed the province and the country,
          which are the first two rows of the panel below it: the same two facts
          twice, eight pixels apart. */}
      <div className="mt-7">
        <PageHead
          kind="Growing place"
          title={region.name}
          rungFor={region.id}
          number={catalogueNumber('places', region.id)}
        />
      </div>

      <div className="mt-8">
        <Fact label="Country">{region.country}</Fact>
        <Fact label="Province">{region.province}</Fact>
        {region.altitude && (
          <Fact label="Altitude">
            <span className="figures-tab">{region.altitude}</span>
          </Fact>
        )}
        <Fact label="Map">
          <a href={map.url} target="_blank" rel="noreferrer" className={`${QUIET_LINK} tap-target`}>
            {map.label}
          </a>
        </Fact>

        {/* Climate is the one field here that is research prose, not a fact:
            the longest runs to 239 characters, four lines of body type. Set on
            a value line it broke the baseline the three facts above it agree
            on. It keeps the same hung label and drops clear of it. */}
        <Passage label="Climate" text={region.climate} className="mt-5" />

        {!region.altitude && !region.climate && placesWithin.length > 0 && (
          <p className={`${FACT_CLASS} text-tea-text-dim ${MEASURE} ${AXIS_INDENT}`}>
            This is a broad place entry. Elevation and climate are recorded on the more specific growing places below.
          </p>
        )}
        {!region.altitude && !region.climate && placesWithin.length === 0 && (
          <p className={`${FACT_CLASS} text-tea-text-dim ${MEASURE} ${AXIS_INDENT}`}>
            This entry currently records its name and country. Elevation and climate have not been added yet.
          </p>
        )}
      </div>

      {placesWithin.length > 0 && (
        <section className={SPACE.section}>
          <SectionHead label={`Places within ${region.name}`} count={placesWithin.length} />
          <IndexList>
            {placesWithin.map(place => (
              <HoldingRow
                key={place.id}
                to={`/wisdom/region/${place.id}`}
                name={place.name}
                cells={[place.altitude]}
              />
            ))}
          </IndexList>
        </section>
      )}

      <section className={`${SPACE.section} ${GROUND} py-6`}>
        <SectionHead
          label={plants.length > 0 ? 'Plants from here' : `Plants recorded within ${region.name}`}
          count={directOrNestedPlants.length || undefined}
        />
        {directOrNestedPlants.length === 0 ? (
          <p className={`${FACT_CLASS} text-tea-text-dim ${MEASURE} ${AXIS_INDENT}`}>
            No cultivar record links directly to this place or to a more specific place within it yet.
          </p>
        ) : (
          <IndexList plain>
            {directOrNestedPlants.map(({ plant, place }) => (
              <HoldingRow
                key={plant.id}
                to={`/wisdom/cultivar/${plant.id}`}
                name={plant.name}
                chineseName={plant.chineseName}
                cells={[
                  place ? { text: place.name, to: `/wisdom/region/${place.id}` } : undefined,
                  plant.developedYear ? `recorded ${plant.developedYear}` : undefined,
                ]}
              />
            ))}
          </IndexList>
        )}
      </section>

      <EntryResearchSection entryKind="region" entryId={region.id} entry={region} />

      <WisdomRelatedMaterial identity={{ nodeType: 'region', nodeId: region.id }} />
      <EntryAuthorship id={region.id} />

      <Invitation subject={`Growing place: ${region.name}`} />
    </article>
    </WisdomPublicStateGate>
  );
};

export default RegionPage;
