/**
 * /wisdom/producer/:id. One factory, house or brand, in public.
 *
 * Shows what the record states about who made the tea and where, and the
 * marks it is known for. A mark we also hold links to its own page; one named
 * only in this producer's own record is shown as text.
 */
import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { findProducerById, marksOf, markNamesOf, type Producer } from '../../wisdom';
import {
  AXIS_INDENT,
  EntryAuthorship,
  FACT_CLASS,
  Fact,
  HoldingNotFound,
  Invitation,
  MEASURE,
  PAGE,
  PageHead,
  QUIET_LINK,
  SPACE,
  SectionHead,
  WisdomSubNav,
  catalogueNumber,
} from './wisdomShared';

const KIND_LABEL: Record<Producer['kind'], string> = {
  factory: 'Factory',
  house: 'House (pre-1950 family firm)',
  brand: 'Brand',
  cooperative: 'Cooperative',
  unknown: 'Not recorded',
};

const ProducerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const producer = findProducerById(id);

  const heldMarks = useMemo(() => (producer ? marksOf(producer) : []), [producer]);
  const heldByName = useMemo(() => new Map(heldMarks.map(mark => [mark.name, mark])), [heldMarks]);
  const markNames = useMemo(() => (producer ? markNamesOf(producer) : []), [producer]);

  const structuredData = useMemo(() => {
    if (!producer) return null;
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const pageUrl = `${origin}/wisdom/producer/${producer.id}`;
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${pageUrl}#org`,
          name: producer.name,
          alternateName: [producer.chineseName, ...producer.altNames].filter(Boolean),
          ...(producer.description ? { description: producer.description } : {}),
          ...(producer.country ? { areaServed: producer.country } : {}),
        },
        {
          '@type': 'WebPage',
          '@id': pageUrl,
          url: pageUrl,
          name: `${producer.name} · Tea producer reference`,
          inLanguage: 'en',
          about: { '@id': `${pageUrl}#org` },
          isPartOf: { '@type': 'CollectionPage', name: 'Producers', url: `${origin}/wisdom/producers` },
        },
      ],
    };
  }, [producer]);

  if (!producer) {
    return (
      <HoldingNotFound
        section="producers"
        heading="Not a producer we hold"
        backTo="/wisdom/producers"
        backLabel="All producers"
        subject="A producer that is missing"
      />
    );
  }

  return (
    <article className={PAGE}>
      <Helmet>
        <title>{`${producer.name} · Producers · Teajia`}</title>
        <meta
          name="description"
          content={(producer.description || `${producer.name}, a tea producer read out of the wisdom base.`).slice(0, 160)}
        />
        {structuredData && <script type="application/ld+json">{JSON.stringify(structuredData)}</script>}
      </Helmet>

      <WisdomSubNav active="producers" />

      <div className="mt-7">
        <PageHead
          kind="Producer"
          title={producer.name}
          chineseName={producer.chineseName}
          aka={producer.altNames.length > 0 ? `Also written ${producer.altNames.join(', ')}` : undefined}
          rungFor={producer.id}
          number={catalogueNumber('makers', producer.id)}
        />
      </div>

      <div className="mt-8">
        <Fact label="Kind">{KIND_LABEL[producer.kind]}</Fact>
        <Fact label="Operates in">{[producer.region, producer.country].filter(Boolean).join(', ') || null}</Fact>
        <Fact label="Founded">
          {producer.founded ? <span className="figures-tab">{producer.founded}</span> : null}
        </Fact>
      </div>

      {producer.description && (
        <section className={SPACE.section}>
          <SectionHead label="Record" />
          <p className={`${FACT_CLASS} text-tea-text ${MEASURE} ${AXIS_INDENT}`}>{producer.description}</p>
        </section>
      )}

      {markNames.length > 0 && (
        <section className={SPACE.section}>
          <SectionHead label="Known for" count={markNames.length} />
          <ul className={`list-none m-0 p-0 ${AXIS_INDENT}`}>
            {markNames.map(name => {
              const held = heldByName.get(name);
              return (
                <li key={name} className="py-1.5 min-h-[44px] flex items-center">
                  {held ? (
                    <Link to={`/wisdom/mark/${held.id}`} className={`${FACT_CLASS} ${QUIET_LINK}`}>
                      {name}
                    </Link>
                  ) : (
                    <span className={`${FACT_CLASS} text-tea-text`}>{name}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <EntryAuthorship id={producer.id} />

      <Invitation subject={`Producer: ${producer.name}`} />
    </article>
  );
};

export default ProducerPage;
