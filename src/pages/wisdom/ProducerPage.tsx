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
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { AuthorshipNote, BackLink, EYEBROW, Fact, HoldingNotFound, Invitation, QUIET_LINK, WisdomSubNav } from './wisdomShared';

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
        heading="Not a producer we hold"
        backTo="/wisdom/producers"
        backLabel="All producers"
        subject="A producer that is missing"
      />
    );
  }

  return (
    <article className="w-full max-w-3xl mx-auto pt-10 pb-nav">
      <Helmet>
        <title>{`${producer.name} · Producers · Teajia`}</title>
        <meta
          name="description"
          content={(producer.description || `${producer.name}, a tea producer read out of the wisdom base.`).slice(0, 160)}
        />
        {structuredData && <script type="application/ld+json">{JSON.stringify(structuredData)}</script>}
      </Helmet>

      <WisdomSubNav active="producers" />

      <BackLink to="/wisdom/producers" label="All producers" />

      <header className="mt-6">
        <p className={EYEBROW}>The wisdom base · Producer</p>
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 mt-3">
          <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text`}>{producer.name}</h1>
          {producer.chineseName && (
            <span className="font-display text-[clamp(22px,3vw,30px)] text-tea-text-sec">{producer.chineseName}</span>
          )}
        </div>
        {producer.altNames.length > 0 && (
          <p className={`${TYPOGRAPHY_CLASSES.subtitle} text-tea-text-sec mt-3 max-w-[56ch]`}>
            Also written {producer.altNames.join(', ')}
          </p>
        )}
      </header>

      <div className="mt-10">
        <Fact label="Kind">{KIND_LABEL[producer.kind]}</Fact>
        <Fact label="Operates in">{[producer.region, producer.country].filter(Boolean).join(', ') || null}</Fact>
        <Fact label="Founded">{producer.founded ? String(producer.founded) : null}</Fact>
      </div>

      {producer.description && (
        <section className="mt-12">
          <p className={`${EYEBROW} mb-2`}>Record</p>
          <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text max-w-[64ch]`}>{producer.description}</p>
        </section>
      )}

      {markNames.length > 0 && (
        <section className="mt-12">
          <p className={`${EYEBROW} mb-3`}>Known for</p>
          <ul className="list-none m-0 p-0">
            {markNames.map(name => {
              const held = heldByName.get(name);
              return (
                <li key={name} className="py-3 border-t border-tea-border first:border-t-0 min-h-[44px] flex items-center">
                  {held ? (
                    <Link
                      to={`/wisdom/mark/${held.id}`}
                      className={`${TYPOGRAPHY_CLASSES.bodyLight} ${QUIET_LINK}`}
                    >
                      {name}
                    </Link>
                  ) : (
                    <span className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text`}>{name}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-16 pt-8 border-t border-tea-border">
        <AuthorshipNote id={producer.id} className="max-w-[60ch]" />
        <p className={`${EYEBROW} mt-2`}>
          Nothing on this page is account scoped. It is true of the producer, not of any shop.
        </p>
      </div>

      <Invitation subject={`Producer: ${producer.name}`} />
    </article>
  );
};

export default ProducerPage;
