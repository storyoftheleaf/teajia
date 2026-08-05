/**
 * /wisdom/style/:id. One way of making or pressing a tea, in public.
 */
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { findStyleById } from '../../wisdom';
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
  SPACE,
  SectionHead,
  WisdomSubNav,
  catalogueNumber,
} from './wisdomShared';

const StylePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const style = findStyleById(id);

  const structuredData = useMemo(() => {
    if (!style) return null;
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const pageUrl = `${origin}/wisdom/style/${style.id}`;
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Thing',
          '@id': `${pageUrl}#style`,
          name: style.name,
          alternateName: [style.chineseName, ...style.altNames].filter(Boolean),
          ...(style.description ? { description: style.description } : {}),
        },
        {
          '@type': 'WebPage',
          '@id': pageUrl,
          url: pageUrl,
          name: `${style.name} · Tea style reference`,
          inLanguage: 'en',
          about: { '@id': `${pageUrl}#style` },
          isPartOf: { '@type': 'CollectionPage', name: 'Styles', url: `${origin}/wisdom/styles` },
        },
      ],
    };
  }, [style]);

  if (!style) {
    return (
      <HoldingNotFound
        section="styles"
        heading="Not a style we hold"
        backTo="/wisdom/styles"
        backLabel="All styles"
        subject="A style that is missing"
      />
    );
  }

  return (
    <article className={PAGE}>
      <Helmet>
        <title>{`${style.name} · Styles · Teajia`}</title>
        <meta
          name="description"
          content={(style.description || `${style.name}, a tea style read out of the wisdom base.`).slice(0, 160)}
        />
        {structuredData && <script type="application/ld+json">{JSON.stringify(structuredData)}</script>}
      </Helmet>

      <WisdomSubNav active="styles" />

      <div className="mt-7">
        <PageHead
          kind="Style"
          title={style.name}
          chineseName={style.chineseName}
          aka={style.altNames.length > 0 ? `Also written ${style.altNames.join(', ')}` : undefined}
          rungFor={style.id}
          number={catalogueNumber('styles', style.id)}
        />
      </div>

      <div className="mt-8">
        <Fact label="Applies to">{style.appliesToTypes.join(', ') || null}</Fact>
        <Fact label="Region">{style.region}</Fact>
      </div>

      {style.description && (
        <section className={SPACE.section}>
          <SectionHead label="Record" />
          <p className={`${FACT_CLASS} text-tea-text ${MEASURE} ${AXIS_INDENT}`}>{style.description}</p>
        </section>
      )}

      <EntryAuthorship id={style.id} />

      <Invitation subject={`Style: ${style.name}`} />
    </article>
  );
};

export default StylePage;
