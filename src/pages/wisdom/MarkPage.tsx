/**
 * /wisdom/mark/:id. One recipe number, seal or label, in public.
 *
 * Links back to its producer when the record names one we hold. A mark whose
 * producer is not in the base yet is shown without that link, not a broken one.
 */
import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { findMarkById, findProducerById } from '../../wisdom';
import {
  EntryAuthorship,
  FACT_CLASS,
  Fact,
  HoldingNotFound,
  Invitation,
  LABEL,
  PageHead,
  QUIET_LINK,
  WisdomSubNav,
} from './wisdomShared';

const MarkPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const mark = findMarkById(id);
  const producer = useMemo(() => findProducerById(mark?.producerId), [mark]);

  const structuredData = useMemo(() => {
    if (!mark) return null;
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const pageUrl = `${origin}/wisdom/mark/${mark.id}`;
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Thing',
          '@id': `${pageUrl}#mark`,
          name: mark.name,
          alternateName: [mark.chineseName, ...mark.altNames].filter(Boolean),
          ...(mark.description ? { description: mark.description } : {}),
        },
        {
          '@type': 'WebPage',
          '@id': pageUrl,
          url: pageUrl,
          name: `${mark.name} · Tea mark reference`,
          inLanguage: 'en',
          about: { '@id': `${pageUrl}#mark` },
          isPartOf: { '@type': 'CollectionPage', name: 'Marks', url: `${origin}/wisdom/marks` },
        },
      ],
    };
  }, [mark]);

  if (!mark) {
    return (
      <HoldingNotFound
        section="marks"
        heading="Not a mark we hold"
        backTo="/wisdom/marks"
        backLabel="All marks"
        subject="A mark that is missing"
      />
    );
  }

  return (
    <article className="w-full max-w-3xl mx-auto pt-4 pb-nav">
      <Helmet>
        <title>{`${mark.name} · Marks · Teajia`}</title>
        <meta
          name="description"
          content={(mark.description || `${mark.name}, a tea mark read out of the wisdom base.`).slice(0, 160)}
        />
        {structuredData && <script type="application/ld+json">{JSON.stringify(structuredData)}</script>}
      </Helmet>

      <WisdomSubNav active="marks" />

      <div className="mt-4">
        <PageHead
          title={mark.name}
          chineseName={mark.chineseName}
          note={mark.altNames.length > 0 ? `Also written ${mark.altNames.join(', ')}` : undefined}
          rungFor={mark.id}
        />
      </div>

      <div className="mt-6">
        <Fact label="Era">{mark.era}</Fact>
        <Fact label="Applies to">{mark.appliesToTypes.join(', ') || null}</Fact>
        {/* A producer the base holds is somewhere to go. One the record does
            not name is said plainly rather than left as a missing row, which
            reads as an oversight instead of a fact about the record. */}
        <Fact label="Producer">
          {producer ? (
            <Link to={`/wisdom/producer/${producer.id}`} className={QUIET_LINK}>
              {producer.name}
            </Link>
          ) : (
            <span className="text-tea-text-sec">Not recorded</span>
          )}
        </Fact>
      </div>

      {mark.description && (
        <section className="mt-10">
          <p className={`${LABEL} mb-1.5`}>Record</p>
          <p className={`${FACT_CLASS} text-tea-text max-w-[68ch]`}>{mark.description}</p>
        </section>
      )}

      <EntryAuthorship id={mark.id} />

      <Invitation subject={`Mark: ${mark.name}`} />
    </article>
  );
};

export default MarkPage;
