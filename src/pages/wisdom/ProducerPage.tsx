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
  EntryAuthorship,
  FACT_CLASS,
  Fact,
  FactPanel,
  HoldingNotFound,
  Invitation,
  LABEL,
  PageHead,
  Panel,
  QUIET_LINK,
  WisdomSubNav,
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
    <article className="w-full max-w-3xl mx-auto pt-4 pb-nav">
      <Helmet>
        <title>{`${producer.name} · Producers · Teajia`}</title>
        <meta
          name="description"
          content={(producer.description || `${producer.name}, a tea producer read out of the wisdom base.`).slice(0, 160)}
        />
        {structuredData && <script type="application/ld+json">{JSON.stringify(structuredData)}</script>}
      </Helmet>

      <WisdomSubNav active="producers" />

      <div className="mt-4">
        <PageHead
          title={producer.name}
          chineseName={producer.chineseName}
          note={producer.altNames.length > 0 ? `Also written ${producer.altNames.join(', ')}` : undefined}
          rungFor={producer.id}
        />
      </div>

      <FactPanel className="mt-6">
        <Fact label="Kind">{KIND_LABEL[producer.kind]}</Fact>
        <Fact label="Operates in">{[producer.region, producer.country].filter(Boolean).join(', ') || null}</Fact>
        <Fact label="Founded">{producer.founded ? String(producer.founded) : null}</Fact>
      </FactPanel>

      {producer.description && (
        <section className="mt-10">
          <Panel>
            <p className={`${LABEL} mb-2`}>Record</p>
            <p className={`${FACT_CLASS} text-tea-text max-w-[68ch]`}>{producer.description}</p>
          </Panel>
        </section>
      )}

      {markNames.length > 0 && (
        <section className="mt-10">
          <p className={`${LABEL} mb-2`}>Known for</p>
          <Panel className="py-1 sm:py-1">
            <ul className="list-none m-0 p-0">
              {markNames.map(name => {
                const held = heldByName.get(name);
                return (
                  <li
                    key={name}
                    className="py-2.5 border-t border-tea-border first:border-t-0 min-h-[44px] flex items-center"
                  >
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
          </Panel>
        </section>
      )}

      <EntryAuthorship id={producer.id} />

      <Invitation subject={`Producer: ${producer.name}`} />
    </article>
  );
};

export default ProducerPage;
