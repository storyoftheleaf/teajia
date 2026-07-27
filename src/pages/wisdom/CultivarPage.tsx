/**
 * /wisdom/cultivar/:id. One tea plant, in public.
 *
 * The header and the lineage tree render from the lean index the moment the
 * route opens. The prose (sensory footprint, named teas, growing and making)
 * arrives from the code-split corpus a beat later. Structured data is emitted
 * as a Taxon so an agent reading this page gets the same lineage a person does.
 */
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { findCultivarById } from '../../wisdom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import {
  AuthorshipNote,
  BackLink,
  EYEBROW,
  Fact,
  HoldingNotFound,
  Invitation,
  ProseSkeleton,
  SectionHead,
  WisdomSubNav,
  growingPlace,
  useCultivarStory,
} from './wisdomShared';
import { LineageTree, isCultivar, nameOf, readLineage } from './LineageTree';

const titleCase = (value: string) =>
  value.replace(/\b[a-z]/g, letter => letter.toUpperCase()).replace(/\bAnd\b/g, 'and');

/** A paragraph of the drafted record, under its own quiet heading. */
const Passage: React.FC<{ label: string; text?: string | null }> = ({ label, text }) => {
  if (!text) return null;
  return (
    <div className="mt-7 first:mt-0">
      <p className={`${EYEBROW} mb-2`}>{label}</p>
      <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text-sec max-w-[64ch]`}>{text}</p>
    </div>
  );
};

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
    <article className="w-full max-w-3xl mx-auto pt-10 pb-nav">
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

      <BackLink to="/wisdom/cultivars" label="All tea plants" />

      <header className="mt-6">
        <p className={EYEBROW}>The wisdom base · Cultivar</p>
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 mt-3">
          <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text`}>{cultivar.name}</h1>
          {cultivar.chineseName && (
            <span className="font-display text-[clamp(22px,3vw,30px)] text-tea-text-sec">{cultivar.chineseName}</span>
          )}
        </div>
        {cultivar.altNames.length > 0 && (
          <p className={`${TYPOGRAPHY_CLASSES.subtitle} text-tea-text-sec mt-3 max-w-[56ch]`}>
            Also written {cultivar.altNames.join(', ')}
          </p>
        )}
        <p className={`${EYEBROW} mt-4`}>
          {[
            cultivar.originCountry,
            cultivar.originRegion,
            cultivar.developedYear ? `recorded ${cultivar.developedYear}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      <div className="mt-12">
        <LineageTree cultivar={cultivar} />
      </div>

      {/* The account. Prose, so it waits for the corpus. */}
      <section className="mt-16">
        <SectionHead glyph="¶" label="The plant" />
        {loading && <ProseSkeleton lines={4} />}
        {!loading && !story && (
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-dim max-w-[60ch]`}>
            No written account is held for this plant yet.
          </p>
        )}
        {story && (
          <>
            <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text max-w-[64ch]`}>{story.description}</p>
            <div className="mt-8">
              <Fact label="Habit">{story.plantType}</Fact>
              <Fact label="Versatility">{story.versatility}</Fact>
            </div>
          </>
        )}
      </section>

      {/* Where it grows. Region comes from the lean index, altitude from the researched place. */}
      <section className="mt-16">
        <SectionHead glyph="◇" label="Where it grows" />
        <div>
          <Fact label="Recorded origin">{cultivar.originRegion || cultivar.originCountry}</Fact>
          {place && place.name !== cultivar.originRegion && <Fact label="Matched place">{place.name}</Fact>}
          <Fact label="Altitude">{place?.altitude}</Fact>
          <Fact label="Climate">{place?.climate}</Fact>
          <Fact label="Developed">{cultivar.developedYear ? String(cultivar.developedYear) : null}</Fact>
        </div>

        {loading && (
          <div className="mt-8">
            <ProseSkeleton lines={2} />
          </div>
        )}

        {distribution.length > 0 && (
          <div className="mt-8">
            <p className={`${EYEBROW} mb-3`}>Grown in</p>
            <ul className="list-none m-0 p-0">
              {distribution.map(([country, areas]) => (
                <li key={country} className="py-3 border-t border-tea-border flex flex-wrap gap-x-8 gap-y-1 justify-between">
                  <span className={`${EYEBROW} shrink-0`}>{titleCase(country)}</span>
                  <span className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text max-w-[54ch] sm:text-right`}>
                    {areas.join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {story?.environment && (
          <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text-sec mt-8 max-w-[64ch]`}>{story.environment}</p>
        )}
      </section>

      {/* The sensory footprint. */}
      <section className="mt-16">
        <SectionHead glyph="◈" label="In the cup" />
        {loading && <ProseSkeleton lines={3} />}
        {!loading && !story?.sensory && (
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-dim max-w-[60ch]`}>
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

      {/* The named teas made from this plant. */}
      {(loading || expressions.length > 0) && (
        <section className="mt-16">
          <SectionHead glyph="◊" label="Teas made from this plant" />
          {loading && <ProseSkeleton lines={3} />}
          {expressions.map(([family, teas]) => (
            <div key={family} className="mt-8 first:mt-0">
              <p className={`${EYEBROW} mb-3`}>{family}</p>
              <ul className="list-none m-0 p-0">
                {Object.entries(teas).map(([tea, note]) => (
                  <li key={tea} className="py-4 border-t border-tea-border">
                    <p className="font-display text-ui-20 text-tea-text">{tea}</p>
                    <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec mt-1 max-w-[64ch]`}>{note}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* Growing and making. */}
      {(loading || story) && (
        <section className="mt-16">
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

      <div className="mt-16 pt-8 border-t border-tea-border">
        <AuthorshipNote id={cultivar.id} className="max-w-[60ch]" />
        <p className={`${EYEBROW} mt-2`}>
          Nothing on this page is account scoped. It is true of the plant, not of any shop.
        </p>
      </div>

      <Invitation subject={`Cultivar: ${cultivar.name}`} />
    </article>
  );
};

export default CultivarPage;
