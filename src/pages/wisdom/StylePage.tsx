/**
 * /wisdom/style/:id. One way of making or pressing a tea, in public.
 */
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { findStyleById } from '../../wisdom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { AuthorshipNote, BackLink, EYEBROW, Fact, HoldingNotFound, Invitation, WisdomSubNav } from './wisdomShared';

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
        heading="Not a style we hold"
        backTo="/wisdom/styles"
        backLabel="All styles"
        subject="A style that is missing"
      />
    );
  }

  return (
    <article className="w-full max-w-3xl mx-auto pt-10 pb-nav">
      <Helmet>
        <title>{`${style.name} · Styles · Teajia`}</title>
        <meta
          name="description"
          content={(style.description || `${style.name}, a tea style read out of the wisdom base.`).slice(0, 160)}
        />
        {structuredData && <script type="application/ld+json">{JSON.stringify(structuredData)}</script>}
      </Helmet>

      <WisdomSubNav active="styles" />

      <BackLink to="/wisdom/styles" label="All styles" />

      <header className="mt-6">
        <p className={EYEBROW}>The wisdom base · Style</p>
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 mt-3">
          <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text`}>{style.name}</h1>
          {style.chineseName && (
            <span className="font-display text-[clamp(22px,3vw,30px)] text-tea-text-sec">{style.chineseName}</span>
          )}
        </div>
        {style.altNames.length > 0 && (
          <p className={`${TYPOGRAPHY_CLASSES.subtitle} text-tea-text-sec mt-3 max-w-[56ch]`}>
            Also written {style.altNames.join(', ')}
          </p>
        )}
      </header>

      <div className="mt-10">
        <Fact label="Applies to">{style.appliesToTypes.join(', ') || null}</Fact>
        <Fact label="Region">{style.region}</Fact>
      </div>

      {style.description && (
        <section className="mt-12">
          <p className={`${EYEBROW} mb-2`}>Record</p>
          <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text max-w-[64ch]`}>{style.description}</p>
        </section>
      )}

      <div className="mt-16 pt-8 border-t border-tea-border">
        <AuthorshipNote id={style.id} className="max-w-[60ch]" />
        <p className={`${EYEBROW} mt-2`}>
          Nothing on this page is account scoped. It is true of the style, not of any shop.
        </p>
      </div>

      <Invitation subject={`Style: ${style.name}`} />
    </article>
  );
};

export default StylePage;
