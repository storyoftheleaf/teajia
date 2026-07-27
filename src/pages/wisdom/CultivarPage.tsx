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
  FACT,
  FACT_CLASS,
  Fact,
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
        <p className={`${CELL} mt-2`}>
          {[
            cultivar.originCountry,
            cultivar.originRegion,
            cultivar.developedYear ? `recorded ${cultivar.developedYear}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <div className="mt-10">
        <LineageTree cultivar={cultivar} />
      </div>

      {/* The account. Prose, so it waits for the corpus. */}
      <section className="mt-12">
        <SectionHead glyph="¶" label="The plant" />
        {loading && <ProseSkeleton lines={4} />}
        {!loading && !story && (
          <p className={`${FACT_CLASS} text-tea-text-dim max-w-[64ch]`}>
            No written account is held for this plant yet.
          </p>
        )}
        {story && (
          <>
            <p className={`${FACT_CLASS} text-tea-text max-w-[68ch]`}>{story.description}</p>
            <div className="mt-6">
              <Fact label="Habit">{story.plantType}</Fact>
              <Fact label="Versatility">{story.versatility}</Fact>
            </div>
          </>
        )}
      </section>

      {/* Where it grows. Region comes from the lean index, altitude from the researched place. */}
      <section className="mt-12">
        <SectionHead glyph="◇" label="Where it grows" />
        <div>
          <Fact label="Recorded origin">{cultivar.originRegion || cultivar.originCountry}</Fact>
          {place && place.name !== cultivar.originRegion && <Fact label="Matched place">{place.name}</Fact>}
          <Fact label="Altitude">{place?.altitude}</Fact>
          <Fact label="Developed">{cultivar.developedYear ? String(cultivar.developedYear) : null}</Fact>
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
          <div className="mt-6">
            <p className={`${LABEL} mb-2`}>Grown in</p>
            <ul className="list-none m-0 p-0">
              {distribution.map(([country, areas]) => (
                <li
                  key={country}
                  className="py-2.5 border-t border-tea-border sm:grid sm:grid-cols-[152px_minmax(0,1fr)] sm:gap-x-6"
                >
                  <span className={`${LABEL} block sm:pt-1`}>{titleCase(country)}</span>
                  <span className={`${FACT_CLASS} text-tea-text max-w-[60ch] block`}>{areas.join(', ')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {story?.environment && <p className={`${FACT} mt-6 max-w-[68ch]`}>{story.environment}</p>}
      </section>

      {/* The sensory footprint. */}
      <section className="mt-12">
        <SectionHead glyph="◈" label="In the cup" />
        {loading && <ProseSkeleton lines={3} />}
        {!loading && !story?.sensory && (
          <p className={`${FACT_CLASS} text-tea-text-dim max-w-[64ch]`}>
            No sensory record is held for this plant yet.
          </p>
        )}
        {story?.sensory && (
          <div>
            <Fact label="Aroma">{story.sensory.aroma}</Fact>
            <Fact label="Flavour">{story.sensory.flavor}</Fact>
            <Fact label="Mouthfeel and liquor">{story.sensory.mouthfeel_liquor}</Fact>
          </div>
        )}
      </section>

      {/* The named teas made from this plant. An expression family is a proper
          name of four or five words, so it is set as a name, never as caps. */}
      {(loading || expressions.length > 0) && (
        <section className="mt-12">
          <SectionHead glyph="◊" label="The teas" />
          {loading && <ProseSkeleton lines={3} />}
          {expressions.map(([family, teas]) => (
            <div key={family} className="mt-7 first:mt-0">
              <p className={`${NAME_CLASS} italic text-tea-text-sec mb-1`}>{family}</p>
              <ul className="list-none m-0 p-0">
                {Object.entries(teas).map(([tea, note]) => (
                  <li key={tea} className="py-3 border-t border-tea-border">
                    <p className={`${NAME_CLASS} text-tea-text`}>{tea}</p>
                    <p className={`${FACT} mt-0.5 max-w-[68ch]`}>{note}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* Growing and making. */}
      {(loading || story) && (
        <section className="mt-12">
          <SectionHead glyph="∞" label="Grown and made" />
          {loading && <ProseSkeleton lines={5} />}
          {story && (
            <>
              <Passage label="Processing" text={story.processing} />
              <Passage label="Oxidation" text={story.oxidation} />
              <Passage label="Roasting" text={story.roasting} />
            </>
          )}
        </section>
      )}

      {/* The reverse link the design doc promises, done honestly. Products are
          not available to the reference and must never be copied into it, so
          this says what is true and points at the shop rather than inventing a
          list of teas attributed to the plant. */}
      <section className="mt-12">
        <SectionHead glyph="◉" label="In the shop" />
        <p className={`${FACT} max-w-[64ch]`}>
          The reference does not hold what any shop stocks, so nothing on sale is currently attributed to this plant.{' '}
          <Link to="/shop" className={QUIET_LINK}>
            Browse the shop
          </Link>{' '}
          and look for {cultivar.name} by name.
        </p>
      </section>

      <EntryAuthorship id={cultivar.id} />

      <Invitation subject={`Cultivar: ${cultivar.name}`} />
    </article>
  );
};

export default CultivarPage;
