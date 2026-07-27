/**
 * /wisdom/cultivar/:id. One tea plant, in public.
 *
 * The header and the lineage tree render from the lean index the moment the
 * route opens. The prose (sensory footprint, named teas, growing and making)
 * arrives from the code-split corpus a beat later. Structured data is emitted
 * as a Taxon so an agent reading this page gets the same lineage a person does.
 */
import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { findCultivarById } from '../../wisdom';
import {
  EntryAuthorship,
  CELL,
  CELL_CLASS,
  FACT,
  FACT_CLASS,
  Fact,
  FactPanel,
  Panel,
  HoldingNotFound,
  Invitation,
  LABEL,
  NAME_CLASS,
  PageHead,
  Passage,
  ProseSkeleton,
  QUIET_LINK,
  SectionHead,
  WisdomSubNav,
  growingPlace,
  useCultivarStory,
} from './wisdomShared';
import { LineageTree, isCultivar, nameOf, readLineage } from './LineageTree';

const titleCase = (value: string) =>
  value.replace(/\b[a-z]/g, letter => letter.toUpperCase()).replace(/\bAnd\b/g, 'and');

// ─── Page ────────────────────────────────────────────────────────────────────

const CultivarPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const cultivar = findCultivarById(id);
  const { story, loading } = useCultivarStory(cultivar ? id : undefined);

  const lineage = useMemo(() => (cultivar ? readLineage(cultivar) : null), [cultivar]);
  const place = useMemo(() => growingPlace(cultivar?.originRegion), [cultivar]);

  const structuredData = useMemo(() => {
    if (!cultivar || !lineage) return null;
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const pageUrl = `${origin}/wisdom/cultivar/${cultivar.id}`;
    const taxonRef = (node: Parameters<typeof nameOf>[0]) => ({
      '@type': 'Taxon',
      name: nameOf(node),
      taxonRank: 'cultivar',
      ...(isCultivar(node) ? { url: `${origin}/wisdom/cultivar/${node.id}` } : {}),
    });

    const properties: Array<{ '@type': 'PropertyValue'; name: string; value: string }> = [];
    const addProperty = (name: string, value?: string | null) => {
      if (value) properties.push({ '@type': 'PropertyValue', name, value });
    };
    addProperty('Origin country', cultivar.originCountry);
    addProperty('Origin region', cultivar.originRegion);
    addProperty('Recorded parentage', cultivar.parentage);
    addProperty('Altitude', place?.altitude);
    addProperty('Climate', place?.climate);
    addProperty('Aroma', story?.sensory?.aroma);
    addProperty('Flavour', story?.sensory?.flavor);
    addProperty('Mouthfeel and liquor', story?.sensory?.mouthfeel_liquor);
    addProperty('Plant', story?.plantType);
    addProperty('Oxidation', story?.oxidation);
    addProperty('Roasting', story?.roasting);
    addProperty('Processing', story?.processing);

    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Taxon',
          '@id': `${pageUrl}#taxon`,
          name: cultivar.name,
          alternateName: [cultivar.chineseName, ...cultivar.altNames].filter(Boolean),
          taxonRank: 'cultivar',
          ...(story?.description ? { description: story.description } : {}),
          ...(cultivar.developedYear ? { dateCreated: String(cultivar.developedYear) } : {}),
          ...(lineage.parents.length ? { parentTaxon: lineage.parents.map(taxonRef) } : {}),
          ...(lineage.children.length ? { childTaxon: lineage.children.map(taxonRef) } : {}),
          ...(properties.length ? { additionalProperty: properties } : {}),
        },
        {
          '@type': 'WebPage',
          '@id': pageUrl,
          url: pageUrl,
          name: `${cultivar.name} · Tea plant reference`,
          inLanguage: 'en',
          about: { '@id': `${pageUrl}#taxon` },
          isPartOf: { '@type': 'CollectionPage', name: 'The Tea Plants', url: `${origin}/wisdom/cultivars` },
          creditText: 'Drafted by AI from research, published by Teajia, corrected by hand.',
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'The Tea Plants', item: `${origin}/wisdom/cultivars` },
            { '@type': 'ListItem', position: 2, name: cultivar.name, item: pageUrl },
          ],
        },
      ],
    };
  }, [cultivar, lineage, place, story]);

  if (!cultivar) {
    return (
      <HoldingNotFound
        section="cultivars"
        heading="Not a plant we hold"
        backTo="/wisdom/cultivars"
        backLabel="All tea plants"
        subject="A plant that is missing"
      />
    );
  }

  const distribution = story?.distribution ? Object.entries(story.distribution) : [];
  const expressions = story?.expressions ? Object.entries(story.expressions) : [];

  return (
    <article className="w-full max-w-3xl mx-auto pt-4 pb-nav">
      <Helmet>
        <title>{`${cultivar.name} · The Tea Plants · Teajia`}</title>
        <meta
          name="description"
          content={(
            story?.description ||
            `${cultivar.name}, a tea cultivar from ${cultivar.originRegion || cultivar.originCountry || 'the record'}. Lineage, growing region and sensory footprint.`
          ).slice(0, 160)}
        />
        <meta property="og:title" content={`${cultivar.name} · Teajia`} />
        <meta property="og:type" content="article" />
        {structuredData && <script type="application/ld+json">{JSON.stringify(structuredData)}</script>}
      </Helmet>

      <WisdomSubNav active="cultivars" />

      <div className="mt-4">
        <PageHead
          title={cultivar.name}
          chineseName={cultivar.chineseName}
          note={cultivar.altNames.length > 0 ? `Also written ${cultivar.altNames.join(', ')}` : undefined}
          rungFor={cultivar.id}
        />
        {/* The country and the year, and not the region. The region is a place
            with a page of its own, an altitude and a climate, and it is said
            once further down where all of that is attached to it. Printed here
            as well it was the first of three Nantous on one page. */}
        <p className={`${CELL} mt-2`}>
          {[cultivar.originCountry, cultivar.developedYear ? `recorded ${cultivar.developedYear}` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <div className="mt-12">
        <LineageTree cultivar={cultivar} />
      </div>

      {/* The account. Prose, so it waits for the corpus. */}
      <section className="mt-14">
        <SectionHead glyph="¶" label="The plant" />
        <Panel>
          {loading && <ProseSkeleton lines={4} />}
          {!loading && !story && (
            <p className={`${FACT_CLASS} text-tea-text-dim max-w-[64ch]`}>
              No written account is held for this plant yet.
            </p>
          )}
          {story && (
            <>
              <p className={`${FACT_CLASS} text-tea-text max-w-[68ch]`}>{story.description}</p>
              <div className="mt-5">
                <Fact label="Habit">{story.plantType}</Fact>
                <Fact label="Versatility">{story.versatility}</Fact>
              </div>
            </>
          )}
        </Panel>
      </section>

      {/* Where it grows.

          This section used to print the same place three times: once as the
          recorded origin, once again as the place that origin was matched to,
          and a third time under "grown in". The header line above printed it a
          fourth. It now says the place once, as the place, linked to the page
          that holds its altitude and its climate, with the grower's own wording
          kept underneath only where the two differ. The developed year went the
          same way: the header line already carries it. */}
      <section className="mt-14">
        <SectionHead glyph="◇" label="Where it grows" />
        <Panel>
          <div>
            <Fact label="Place">
              {place ? (
                <>
                  <Link to={`/wisdom/region/${place.id}`} className={QUIET_LINK}>
                    {place.name}
                  </Link>
                  {cultivar.originRegion && place.name !== cultivar.originRegion && (
                    <span className={`${CELL_CLASS} text-tea-text-dim block mt-1.5`}>
                      Written on the record as {cultivar.originRegion}.
                    </span>
                  )}
                </>
              ) : (
                cultivar.originRegion || cultivar.originCountry
              )}
            </Fact>
            <Fact label="Altitude">{place?.altitude}</Fact>
          </div>

          {/* Climate is research prose, not a fact, and is set as prose. Same
              field, same source, same treatment as on the place's own page. */}
          <Passage label="Climate" text={place?.climate} className="mt-6" />

          {loading && (
            <div className="mt-6">
              <ProseSkeleton lines={2} />
            </div>
          )}

          {distribution.length > 0 && (
            <div className="mt-7">
              <p className={`${LABEL} mb-1`}>Grown in</p>
              <ul className="list-none m-0 p-0">
                {distribution.map(([country, areas]) => (
                  <li
                    key={country}
                    className="py-2.5 border-t border-tea-border first:border-t-0 sm:grid sm:grid-cols-[152px_minmax(0,1fr)] sm:gap-x-6"
                  >
                    <span className={`${LABEL} block sm:pt-1`}>{titleCase(country)}</span>
                    <span className={`${FACT_CLASS} text-tea-text max-w-[60ch] block`}>{areas.join(', ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {story?.environment && <p className={`${FACT} mt-7 max-w-[68ch]`}>{story.environment}</p>}
        </Panel>
      </section>

      {/* The sensory footprint. */}
      <section className="mt-14">
        <SectionHead glyph="◈" label="In the cup" />
        {loading && (
          <Panel>
            <ProseSkeleton lines={3} />
          </Panel>
        )}
        {!loading && !story?.sensory && (
          <Panel>
            <p className={`${FACT_CLASS} text-tea-text-dim max-w-[64ch]`}>
              No sensory record is held for this plant yet.
            </p>
          </Panel>
        )}
        {story?.sensory && (
          <FactPanel>
            <Fact label="Aroma">{story.sensory.aroma}</Fact>
            <Fact label="Flavour">{story.sensory.flavor}</Fact>
            <Fact label="Mouthfeel and liquor">{story.sensory.mouthfeel_liquor}</Fact>
          </FactPanel>
        )}
      </section>

      {/* The named teas made from this plant. An expression family is a proper
          name of four or five words, so it is set as a name, never as caps.
          A family is its own object: the name sits on the page and the teas
          under it sit in a panel, the same shape a section takes. */}
      {(loading || expressions.length > 0) && (
        <section className="mt-14">
          <SectionHead glyph="◊" label="The teas" />
          {loading && (
            <Panel>
              <ProseSkeleton lines={3} />
            </Panel>
          )}
          {expressions.map(([family, teas]) => (
            <div key={family} className="mt-8 first:mt-0">
              <p className={`${NAME_CLASS} italic text-tea-text-sec mb-2`}>{family}</p>
              <Panel className="py-2 sm:py-2">
                <ul className="list-none m-0 p-0">
                  {Object.entries(teas).map(([tea, note]) => (
                    <li key={tea} className="py-3 border-t border-tea-border first:border-t-0">
                      <p className={`${NAME_CLASS} text-tea-text`}>{tea}</p>
                      <p className={`${FACT} mt-1 max-w-[68ch]`}>{note}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          ))}
        </section>
      )}

      {/* Growing and making. */}
      {(loading || story) && (
        <section className="mt-14">
          <SectionHead glyph="∞" label="Grown and made" />
          <Panel>
            {loading && <ProseSkeleton lines={5} />}
            {story && (
              <>
                <Passage label="Processing" text={story.processing} />
                <Passage label="Oxidation" text={story.oxidation} />
                <Passage label="Roasting" text={story.roasting} />
              </>
            )}
          </Panel>
        </section>
      )}

      {/* The reverse link the design doc promises, done honestly. Products are
          not available to the reference and must never be copied into it, so
          this says what is true and points at the shop rather than inventing a
          list of teas attributed to the plant. */}
      <section className="mt-14">
        <SectionHead glyph="◉" label="In the shop" />
        <Panel>
          <p className={`${FACT} max-w-[64ch]`}>
            The reference does not hold what any shop stocks, so nothing on sale is currently attributed to this plant.{' '}
            <Link to="/shop" className={QUIET_LINK}>
              Browse the shop
            </Link>{' '}
            and look for {cultivar.name} by name.
          </p>
        </Panel>
      </section>

      <EntryAuthorship id={cultivar.id} />

      <Invitation subject={`Cultivar: ${cultivar.name}`} />
    </article>
  );
};

export default CultivarPage;
