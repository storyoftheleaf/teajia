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
  PageHead,
  Passage,
  plantsGrownIn,
  SectionHead,
  SPACE,
  WisdomSubNav,
} from './wisdomShared';
import { EntryResearchSection } from './EntryResearchSection';

const RegionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  // The id first, exactly. `findRegion` normalises away the hyphens, which
  // happens to work today because every id is a slug of its own name, and
  // would quietly resolve to a neighbour the day one is not.
  const region = useMemo(() => REGIONS.find(entry => entry.id === id) ?? findRegion(id), [id]);

  const plants = useMemo(() => (region ? plantsGrownIn(region) : []), [region]);

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

  return (
    <article className={PAGE}>
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
        <Fact label="Altitude">
          <span className="figures-tab">{region.altitude}</span>
        </Fact>

        {/* Climate is the one field here that is research prose, not a fact:
            the longest runs to 239 characters, four lines of body type. Set on
            a value line it broke the baseline the three facts above it agree
            on. It keeps the same hung label and drops clear of it. */}
        <Passage label="Climate" text={region.climate} className="mt-5" />

        {!region.altitude && !region.climate && (
          <p className={`${FACT_CLASS} text-tea-text-dim ${MEASURE} ${AXIS_INDENT}`}>
            Only the name and the country are held for this place. Altitude and climate have not been researched yet.
          </p>
        )}
      </div>

      <section className={`${SPACE.section} ${GROUND} py-6`}>
        <SectionHead label="Plants from here" count={plants.length || undefined} />
        {plants.length === 0 ? (
          <p className={`${FACT_CLASS} text-tea-text-dim ${MEASURE} ${AXIS_INDENT}`}>
            No plant in the reference records this place as its origin yet. That is a gap in the plant records, not a
            claim that nothing grows here.
          </p>
        ) : (
          <IndexList plain>
            {plants.map(plant => (
              <HoldingRow
                key={plant.id}
                to={`/wisdom/cultivar/${plant.id}`}
                name={plant.name}
                chineseName={plant.chineseName}
                cells={[plant.developedYear ? `recorded ${plant.developedYear}` : undefined]}
              />
            ))}
          </IndexList>
        )}
      </section>

      <EntryResearchSection entryKind="region" entryId={region.id} />

      <EntryAuthorship id={region.id} />

      <Invitation subject={`Growing place: ${region.name}`} />
    </article>
  );
};

export default RegionPage;
