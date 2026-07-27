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
  CELL,
  EntryAuthorship,
  FACT_CLASS,
  Fact,
  HoldingNotFound,
  HoldingRow,
  IndexTable,
  Invitation,
  PageHead,
  Passage,
  SectionHead,
  WisdomSubNav,
  plantsGrownIn,
  type IndexColumns,
} from './wisdomShared';

const PLANT_COLUMNS: IndexColumns = {
  template: 'minmax(0,1fr) 196px 72px',
  nameLabel: 'Plant',
  labels: ['Recorded origin', 'Developed'],
};

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
    <article className="w-full max-w-3xl mx-auto pt-4 pb-nav">
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

      <div className="mt-4">
        <PageHead title={region.name} />
        <p className={`${CELL} mt-2`}>{[region.province, region.country].filter(Boolean).join(' · ')}</p>
      </div>

      <div className="mt-6">
        <Fact label="Country">{region.country}</Fact>
        <Fact label="Province">{region.province}</Fact>
        <Fact label="Altitude">{region.altitude}</Fact>
      </div>

      {/* Climate is the one field here that is research prose, not a fact:
          the longest runs to 239 characters, four lines of body type. Inside
          the 152px label track it read as a paragraph stuffed into a field and
          broke the axis the three facts above it form. It gets the full
          measure and its label above it instead. */}
      <Passage label="Climate" text={region.climate} className="mt-8" />

      {!region.altitude && !region.climate && (
        <p className={`${FACT_CLASS} text-tea-text-dim mt-6 max-w-[64ch]`}>
          Only the name and the country are held for this place. Altitude and climate have not been researched yet.
        </p>
      )}

      <section className="mt-12">
        <SectionHead glyph="◇" label="Plants from here" count={plants.length || undefined} />
        {plants.length === 0 ? (
          <p className={`${FACT_CLASS} text-tea-text-dim max-w-[64ch]`}>
            No plant in the reference records this place as its origin yet. That is a gap in the plant records, not a
            claim that nothing grows here.
          </p>
        ) : (
          <IndexTable columns={PLANT_COLUMNS}>
            <ul className="list-none m-0 p-0">
              {plants.map(plant => (
                <HoldingRow
                  key={plant.id}
                  to={`/wisdom/cultivar/${plant.id}`}
                  name={plant.name}
                  chineseName={plant.chineseName}
                  cells={[plant.originRegion, plant.developedYear ? String(plant.developedYear) : undefined]}
                />
              ))}
            </ul>
          </IndexTable>
        )}
      </section>

      <EntryAuthorship id={region.id} />

      <Invitation subject={`Growing place: ${region.name}`} />
    </article>
  );
};

export default RegionPage;
