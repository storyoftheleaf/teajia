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
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { AuthorshipNote, BackLink, EYEBROW, Fact, HoldingNotFound, Invitation, QUIET_LINK, WisdomSubNav } from './wisdomShared';

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
        heading="Not a mark we hold"
        backTo="/wisdom/marks"
        backLabel="All marks"
        subject="A mark that is missing"
      />
    );
  }

  return (
    <article className="w-full max-w-3xl mx-auto pt-10 pb-nav">
      <Helmet>
        <title>{`${mark.name} · Marks · Teajia`}</title>
        <meta
          name="description"
          content={(mark.description || `${mark.name}, a tea mark read out of the wisdom base.`).slice(0, 160)}
        />
        {structuredData && <script type="application/ld+json">{JSON.stringify(structuredData)}</script>}
      </Helmet>

      <WisdomSubNav active="marks" />

      <BackLink to="/wisdom/marks" label="All marks" />

      <header className="mt-6">
        <p className={EYEBROW}>The wisdom base · Mark</p>
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 mt-3">
          <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text`}>{mark.name}</h1>
          {mark.chineseName && (
            <span className="font-display text-[clamp(22px,3vw,30px)] text-tea-text-sec">{mark.chineseName}</span>
          )}
        </div>
        {mark.altNames.length > 0 && (
          <p className={`${TYPOGRAPHY_CLASSES.subtitle} text-tea-text-sec mt-3 max-w-[56ch]`}>
            Also written {mark.altNames.join(', ')}
          </p>
        )}
      </header>

      <div className="mt-10">
        <Fact label="Era">{mark.era}</Fact>
        <Fact label="Applies to">{mark.appliesToTypes.join(', ') || null}</Fact>
        <Fact label="Producer">
          {producer ? (
            <Link to={`/wisdom/producer/${producer.id}`} className={QUIET_LINK}>
              {producer.name}
            </Link>
          ) : null}
        </Fact>
      </div>

      {mark.description && (
        <section className="mt-12">
          <p className={`${EYEBROW} mb-2`}>Record</p>
          <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text max-w-[64ch]`}>{mark.description}</p>
        </section>
      )}

      <div className="mt-16 pt-8 border-t border-tea-border">
        <AuthorshipNote id={mark.id} className="max-w-[60ch]" />
        <p className={`${EYEBROW} mt-2`}>
          Nothing on this page is account scoped. It is true of the mark, not of any shop.
        </p>
      </div>

      <Invitation subject={`Mark: ${mark.name}`} />
    </article>
  );
};

export default MarkPage;
